// 原生网络层：桌面（Tauri）和手机（Capacitor）用原生 HTTP，不受 CORS 限制。
// 网页版返回 null，由 net.js 退回浏览器 fetch + 带 CORS 的镜像。
//
// 约定（net.js 依赖这三个导出，签名不要改）：
//   platform: 'web' | 'tauri' | 'capacitor'
//   nativeGetText(url, opts?)                → Promise<string>，非 2xx 抛错
//   nativeGetBinary(url, onProgress?, opts?) → Promise<Blob>，onProgress(loaded, total) 可选，非 2xx 抛错
//   opts = { signal?: AbortSignal, timeout?: number }：net.js 多镜像竞速时用 signal 中止输掉的请求
//
// 插件按平台懒加载，浏览器不承担原生桥接的启动开销。

export const platform =
  typeof window !== 'undefined' && window.__TAURI_INTERNALS__ ? 'tauri'
  : typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() ? 'capacitor'
  : 'web';

export const isNative = platform !== 'web';

/** 书源需要保留错误页正文，且必须按原始字节而不是桥接默认 UTF-8 解码。 */
export async function nativeRequest({ url, method = 'GET', headers = {}, body, charset, signal, timeout = 20000 }) {
  if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
  const controller = new AbortController();
  let timer, rejectStop;
  const stopped = new Promise((_, reject) => { rejectStop = reject; });
  const stop = reason => { rejectStop(reason); controller.abort(reason); };
  const onAbort = () => stop(new DOMException('已取消', 'AbortError'));
  signal?.addEventListener('abort', onAbort, { once: true });
  if (timeout > 0) timer = setTimeout(() => stop(new DOMException('请求超时', 'TimeoutError')), timeout);
  try {
    return await Promise.race([stopped, (async () => {
      let response, bytes, type, bridgedJson;
      if (platform === 'capacitor') {
        const { CapacitorHttp } = await import('@capacitor/core');
        controller.signal.throwIfAborted();
        response = await CapacitorHttp.request({ url, method, headers, data: body,
          responseType: 'arraybuffer', connectTimeout: timeout, readTimeout: timeout });
        const data = response.data;
        type = Object.entries(response.headers || {}).find(([k]) => k.toLowerCase() === 'content-type')?.[1];
        if (/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(type || '')) {
          bridgedJson = JSON.stringify(data);
          bytes = new TextEncoder().encode(bridgedJson);
        }
        else if (typeof data === 'string') bytes = Uint8Array.from(atob(data.replace(/^data:[^,]*,/, '').replace(/\s/g, '')), c => c.charCodeAt(0));
        else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
        else if (ArrayBuffer.isView(data)) bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        // Capacitor 遇到 application/json 会忽略 responseType 并解析 JSON。
        // 此时字节已被桥接消费，只能恢复 JSON 文本；HTML/GBK 仍走原始字节路径。
        else if (data === null || typeof data === 'object') bytes = new TextEncoder().encode(JSON.stringify(data));
        else throw new Error('原生请求未返回原始字节');
      } else {
        const fetcher = platform === 'tauri' ? (await import('@tauri-apps/plugin-http')).fetch : globalThis.fetch;
        controller.signal.throwIfAborted();
        response = await fetcher(url, { method, headers, body, signal: controller.signal,
          ...(platform === 'tauri' ? { connectTimeout: timeout } : {}) });
        bytes = new Uint8Array(await response.arrayBuffer());
        type = response.headers.get('content-type');
      }
      controller.signal.throwIfAborted();
      const fromHeader = /charset\s*=\s*["']?([^\s;"']+)/i.exec(type || '')?.[1];
      const prefix = new TextDecoder('latin1').decode(bytes.subarray(0, 2048));
      const fromMeta = /<meta\b[^>]*charset\s*=\s*["']?([^\s;"'/>]+)/i.exec(prefix)?.[1];
      // 错写的编码名不应让可读正文变成网络错误，逐级退回直到 UTF-8。
      let decoder;
      for (const label of [charset, fromHeader, fromMeta, 'utf-8'].filter(Boolean)) {
        try { decoder = new TextDecoder(label); break; } catch { /* 尝试下一层编码声明。 */ }
      }
      const text = bridgedJson ?? decoder.decode(bytes);
      return { status: response.status, url: response.url || url, text };
    })()]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

// CapacitorHttp 的请求中止不了：signal 一到就让 Promise 先 reject，原生那边下完的结果直接丢掉
function abortable(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('已取消', 'AbortError'));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException('已取消', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(v => { signal.removeEventListener('abort', onAbort); resolve(v); },
      e => { signal.removeEventListener('abort', onAbort); reject(e); });
  });
}

export async function nativeGetText(url, { signal, timeout = 20000 } = {}) {
  if (platform === 'web') return null;
  if (platform === 'tauri') {
    const { fetch } = await import('@tauri-apps/plugin-http');
    const response = await fetch(url, { connectTimeout: timeout, signal });
    checkStatus(response.status);
    return response.text();
  }
  const { CapacitorHttp } = await import('@capacitor/core');
  const response = await abortable(CapacitorHttp.get({ url, responseType: 'text', connectTimeout: timeout, readTimeout: 120000 }), signal);
  checkStatus(response.status);
  // Capacitor 对 application/json 会自动解析，即使显式指定 text。
  return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
}

export async function nativeGetBinary(url, onProgress, { signal, timeout = 20000 } = {}) {
  if (platform === 'web') return null;
  if (platform === 'tauri') {
    const { fetch } = await import('@tauri-apps/plugin-http');
    const response = await fetch(url, { connectTimeout: timeout, signal });
    checkStatus(response.status);
    const total = Number(response.headers.get('content-length')) || 0;
    if (!response.body || !onProgress) {
      const blob = await response.blob(); onProgress?.(blob.size, total || blob.size); return blob;
    }
    const reader = response.body.getReader(), chunks = [];
    let loaded = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        chunks.push(value); loaded += value.byteLength; onProgress(loaded, total);
      }
    } finally { reader.releaseLock(); }
    onProgress(loaded, total || loaded);
    return new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' });
  }
  const { CapacitorHttp } = await import('@capacitor/core');
  onProgress?.(0, 0);
  const response = await abortable(CapacitorHttp.get({ url, responseType: 'arraybuffer', connectTimeout: timeout, readTimeout: 120000 }), signal);
  checkStatus(response.status);
  const type = Object.entries(response.headers || {}).find(([key]) => key.toLowerCase() === 'content-type')?.[1] || 'application/octet-stream';
  let blob;
  if (response.data instanceof Blob) blob = response.data;
  else if (response.data instanceof ArrayBuffer || ArrayBuffer.isView(response.data)) blob = new Blob([response.data], { type });
  else if (typeof response.data === 'string') {
    // Android 原生桥以 base64 传输二进制；分块转换，避免大书展开参数导致栈溢出。
    const base64 = response.data.replace(/^data:[^,]*,/, '').replace(/\s/g, '');
    const chunks = [];
    for (let offset = 0; offset < base64.length; offset += 32768) {
      const decoded = atob(base64.slice(offset, offset + 32768));
      chunks.push(Uint8Array.from(decoded, c => c.charCodeAt(0)));
    }
    blob = new Blob(chunks, { type });
  } else throw new Error('原生下载返回了无效的二进制内容');
  // CapacitorHttp 本身没有流式进度事件，只上报开始与完成，不伪造下载百分比。
  onProgress?.(blob.size, blob.size);
  return blob;
}

function checkStatus(status) {
  if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`);
}

/**
 * 诊断测速：只等响应头，不下正文。Tauri 的 fetch 拿到响应头就返回，随即中止；
 * Capacitor 只能整包下载，所以改用 HEAD 请求（GitHub 和加速代理都支持）。
 * 网页端返回 null，由 net.js 用浏览器 fetch 测。
 */
export async function nativeProbe(url, { signal, timeout = 8000 } = {}) {
  if (platform === 'web') return null;
  if (platform === 'tauri') {
    const { fetch } = await import('@tauri-apps/plugin-http');
    const ctrl = new AbortController();
    signal?.addEventListener('abort', () => ctrl.abort(), { once: true });
    const response = await fetch(url, { connectTimeout: timeout, signal: ctrl.signal });
    ctrl.abort();
    checkStatus(response.status);
    return true;
  }
  const { CapacitorHttp } = await import('@capacitor/core');
  const response = await abortable(CapacitorHttp.request({ url, method: 'HEAD', connectTimeout: timeout, readTimeout: timeout }), signal);
  checkStatus(response.status);
  return true;
}

// ---------- 窗口（Windows 客户端的自绘标题栏用；其它平台动作是空操作，查询返回 false） ----------
let tauriWin = null;
const cw = async () => {
  if (platform !== 'tauri') return null;
  if (!tauriWin) tauriWin = (await import('@tauri-apps/api/window')).getCurrentWindow();
  return tauriWin;
};
const call = (fn, fallback) => async (...args) => {
  const w = await cw();
  if (!w) return fallback;
  try { return await fn(w, ...args); } catch (e) { console.warn('[win]', e); return fallback; }
};

export const win = {
  minimize: call(w => w.minimize()),
  toggleMaximize: call(w => w.toggleMaximize()),
  close: call(w => w.close()),
  isMaximized: call(w => w.isMaximized(), false),
  setFullscreen: call((w, on) => w.setFullscreen(!!on)),
  isFullscreen: call(w => w.isFullscreen(), false),
  show: call(async w => { await w.show(); await w.setFocus(); }),
  /** 切主题时同步窗口底色：拖动改大小的一瞬间露出来的是它 */
  setBackground: call((w, hex) => {
    const n = parseInt(String(hex).replace('#', ''), 16);
    return w.setBackgroundColor([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]);
  }),
  /** 最大化状态变化（用 resized 事件推导）。返回取消订阅 */
  onMaximizedChange(cb) {
    if (platform !== 'tauri') return () => {};
    let off = null, dead = false, last = null;
    cw().then(async w => {
      const check = async () => { const m = await w.isMaximized().catch(() => false); if (m !== last) { last = m; cb(m); } };
      await check();
      const un = await w.onResized(check);
      if (dead) un(); else off = un;
    });
    return () => { dead = true; off?.(); };
  },
};

// ---------- 安卓（其它平台全是空操作，前端可以无条件调用） ----------
// EbookNative 是 android/app/src/main/java/app/librarium/reader/EbookNative.java 里的本地插件
let ebookNative = null;
const nativePlugin = async () => {
  if (platform !== 'capacitor') return null;
  if (!ebookNative) ebookNative = (await import('@capacitor/core')).registerPlugin('EbookNative');
  return ebookNative;
};

/** 页面第一帧画好了：Windows 亮出窗口，安卓撤掉启动页 */
export async function appReady() {
  if (platform === 'tauri') return win.show();
  (await nativePlugin())?.ready().catch(() => {});
}

// 返回键：后注册的先处理（最上层的面板），返回 true 表示处理了；都不处理就退到后台（安卓惯例，不杀进程）
const backHandlers = [];
let backHooked = false;
export function onBackButton(handler) {
  if (platform !== 'capacitor') return () => {};
  backHandlers.push(handler);
  if (!backHooked) {
    backHooked = true;
    import('@capacitor/app').then(({ App }) => App.addListener('backButton', () => {
      for (let i = backHandlers.length - 1; i >= 0; i--) {
        try { if (backHandlers[i]() === true) return; } catch (e) { console.warn('[back]', e); }
      }
      App.minimizeApp();
    }));
  }
  return () => { const i = backHandlers.lastIndexOf(handler); if (i >= 0) backHandlers.splice(i, 1); };
}

/** 轻震：翻页、加书签、下拉到位。'light' | 'medium' | 'select' */
export function haptic(kind = 'light') {
  if (platform !== 'capacitor') return;
  import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) =>
    Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light })).catch(() => {});
}

/** 系统栏图标颜色跟主题：dark=true（深色主题）用浅色图标 */
export function setSystemBars({ dark } = {}) {
  nativePlugin().then(p => p?.setBars({ dark: !!dark })).catch(() => {});
}

/** 阅读时藏起状态栏和导航栏（从边缘划一下临时呼出），离开阅读器恢复 */
export function setImmersive(on) {
  nativePlugin().then(p => p?.setImmersive({ on: !!on })).catch(() => {});
}

// ---------- 下载文件夹（只在 Windows 客户端；蓝奏云这类只能在浏览器里下的书，下好后自动入架） ----------
export const downloadsFolder = {
  available: platform === 'tauri',
  /** 「下载」文件夹里 since（毫秒时间戳）之后出现的 EPUB / TXT / ZIP：[{ name, size, time }] */
  async recent(since) {
    if (platform !== 'tauri') return [];
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('recent_downloads', { since: Math.floor(since) });
  },
  /** 读一个文件（只认文件名），返回 Uint8Array */
  async read(name) {
    const { invoke } = await import('@tauri-apps/api/core');
    const buf = await invoke('read_download', { name });
    return buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf);
  },
};

/**
 * 安卓「用 EBOOK 打开 / 分享到 EBOOK」带进来的文件：cb({ name, bytes:Uint8Array })。
 * 冷启动带进来的那个也会补发一次。返回取消订阅。
 */
export function onOpenedFile(cb) {
  if (platform !== 'capacitor') return () => {};
  let handle = null, dead = false;
  const take = async () => {
    const p = await nativePlugin();
    const r = await p.consumeFile().catch(e => { console.warn('[open-with]', e); return {}; });
    if (!r?.data || dead) return;
    const bin = atob(r.data), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    cb({ name: r.name || 'book.epub', bytes });
  };
  nativePlugin().then(async p => {
    handle = await p.addListener('fileOpened', take);
    if (dead) handle.remove();
    take();
  });
  return () => { dead = true; handle?.remove(); };
}

// ---------- 蓝奏云小窗（只在 Windows 客户端）：提取码自动填好，用户点下载，下完自动进书架 ----------
export const lanzou = {
  available: platform === 'tauri',
  async open({ url, pwd = '', title = '' }) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('open_lanzou', { url, pwd, title });
  },
  /** 小窗每下完一个文件回调一次：cb({ name, bytes:Uint8Array })。返回取消订阅 */
  onFile(cb) {
    if (platform !== 'tauri') return () => {};
    let off = null, dead = false;
    import('@tauri-apps/api/event').then(async ({ listen }) => {
      const un = await listen('lanzou-file', async ({ payload: name }) => {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const buf = await invoke('take_lanzou_file', { name });
          cb({ name, bytes: new Uint8Array(buf) });
        } catch (e) { console.warn('[lanzou]', e); }
      });
      if (dead) un(); else off = un;
    });
    return () => { dead = true; off?.(); };
  },
};

// ---------- 保存导出文件（账户备份） ----------
const b64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
/**
 * 把导出的文件存到「下载」：
 *   Windows 客户端 → 下载文件夹，存完在资源管理器里选中它
 *   安卓 → 下载/EBOOK（分块传给原生，大文件也不会撑爆内存）
 *   网页 → 浏览器下载
 * @returns {Promise<string>} 给用户看的位置
 */
export async function saveExport(name, bytes) {
  if (platform === 'tauri') {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('save_export', bytes, { headers: { 'x-name': encodeURIComponent(name) } });
  }
  if (platform === 'capacitor') {
    const p = await nativePlugin();
    const { token } = await p.beginSave({ name });
    const CHUNK = 3 * 1024 * 1024;
    for (let i = 0; i < bytes.length; i += CHUNK) await p.appendSave({ token, data: b64(bytes.subarray(i, i + CHUNK)) });
    return (await p.endSave({ token, name })).path;
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return '浏览器的下载文件夹';
}
