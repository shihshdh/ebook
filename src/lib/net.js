// 网络层：所有远程请求都从这里走。
//   · 原生端（Tauri / Capacitor）用原生 HTTP，没有 CORS 限制，可以直连 github.com
//   · 网页端只用带 CORS 头的地址：jsDelivr 各节点、raw.githubusercontent、GitHub 加速代理
//
// 国内直连的关键：没有哪个镜像永远可用、永远最快（今天 jsDelivr 主域被墙，明天某个代理挂了）。
// 所以不写死顺序，而是**错峰竞速**：
//   1. 候选地址按"本机记住的速度"排好序（快的在前，最近失败过的垫底）
//   2. 先发第一个；过 stagger 毫秒还没回音，再发下一个……；某个失败了立刻补发下一个
//   3. 谁先回响应头谁赢，其余全部中止——同一时刻通常只有一两个请求在跑，不会把带宽分掉
//   4. 赢家的耗时记进本机（指数平均），下次它排第一，基本一发即中
// 正文下载过程中 15 秒没有新数据（代理卡住）就判它失败，换剩下的地址重来。
import { isNative, nativeGetBinary, nativeGetText, nativeProbe, platform } from './native.js';

const HEAD_TIMEOUT = 15000;   // 单个地址等响应头的上限
const STALL = 15000;          // 正文多久没动静算卡死

// ---------- 记住每个节点的速度 ----------
const STATS_KEY = 'librarium.net.v1';
const FAIL_TTL = 10 * 60e3;   // 失败记 10 分钟，之后重新给机会（网络环境会变：开关代理、换 Wi-Fi）
let stats = {};
try { stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{}') || {}; } catch {}
let saveTimer = 0;
const save = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {} }, 800);
};

export const hostOf = (url) => { try { return new URL(url).host; } catch { return url; } };

function record(url, ms, ok) {
  const h = hostOf(url);
  const s = stats[h] || (stats[h] = {});
  if (ok) {
    s.ms = s.ms ? Math.round(s.ms * 0.6 + ms * 0.4) : Math.round(ms);
    s.failAt = 0; s.fails = 0;
  } else {
    s.failAt = Date.now(); s.fails = (s.fails || 0) + 1;
  }
  s.at = Date.now();
  save();
}

function score(url, i) {
  const s = stats[hostOf(url)];
  // 没测过的节点保持原先的推荐顺序（i 越小越靠前），排在已知快节点之后、已知慢节点之前
  let v = s?.ms ?? 1800 + i * 50;
  // 连续失败两次以上才降级：偶尔一次超时（比如一屏封面同时在抢带宽）不该让它十分钟都排最后
  if (s?.failAt && (s.fails || 1) >= 2 && Date.now() - s.failAt < FAIL_TTL) v += 60000;
  return v;
}
const order = (urls) => urls.map((u, i) => [score(u, i), u]).sort((a, b) => a[0] - b[0]).map(x => x[1]);

/** 诊断页用：当前记住的各节点速度 */
export const netStats = () => ({ ...stats });
export function forgetNetStats() { stats = {}; try { localStorage.removeItem(STATS_KEY); } catch {} }

// ---------- 错峰竞速 ----------
const LOST = 'lost-race';

/**
 * @param {string[]} urls
 * @param {(url:string, signal:AbortSignal) => Promise<any>} attempt  拿到"可以用了"的结果就 resolve
 * @returns {Promise<{value:any, url:string}>}
 */
function race(urls, attempt, { stagger = 700, signal } = {}) {
  const list = order(urls);
  return new Promise((resolve, reject) => {
    if (!list.length) return reject(new Error('没有可用地址'));
    const ctrls = new Map();
    let next = 0, running = 0, done = false, lastErr = null, timer = 0;
    const stop = () => { done = true; clearTimeout(timer); signal?.removeEventListener('abort', onAbort); };
    const onAbort = () => {
      if (done) return;
      stop();
      ctrls.forEach(c => c.abort(LOST));
      reject(signal.reason instanceof Error ? signal.reason : new DOMException('已取消', 'AbortError'));
    };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort);

    const launch = () => {
      clearTimeout(timer);
      if (done || next >= list.length) return;
      const url = list[next++];
      const ctrl = new AbortController();
      ctrls.set(url, ctrl);
      running++;
      const t0 = performance.now();
      attempt(url, ctrl.signal).then(value => {
        running--;
        if (done) return;
        record(url, performance.now() - t0, true);
        stop();
        ctrls.forEach((c, u) => u !== url && c.abort(LOST));
        resolve({ value, url });
      }, err => {
        running--;
        if (done || ctrl.signal.aborted && ctrl.signal.reason === LOST) return;
        record(url, 0, false);
        console.warn('[net]', hostOf(url), err?.message || err);
        lastErr = err;
        if (next < list.length) launch();
        else if (!running) { stop(); reject(lastErr || new Error('没有可用地址')); }
      });
      if (next < list.length) timer = setTimeout(launch, stagger);
    };
    launch();
  });
}

// ---------- 浏览器 fetch ----------
async function webOpen(url, signal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('超时')), HEAD_TIMEOUT);
  // 不解绑：响应头到了以后，正文阶段仍要能被外面中止
  signal.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true });
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** 读完正文，带卡死检测。onProgress(loaded, total) 可选 */
async function readBody(res, onProgress) {
  const total = +res.headers.get('content-length') || 0;
  if (!res.body) { const b = await res.blob(); onProgress?.(b.size, total || b.size); return b; }
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    let stallTimer;
    const stalled = new Promise((_, rej) => { stallTimer = setTimeout(() => rej(new Error('下载卡住了')), STALL); });
    let r;
    try { r = await Promise.race([reader.read(), stalled]); }
    catch (e) { reader.cancel().catch(() => {}); throw e; }
    finally { clearTimeout(stallTimer); }
    if (r.done) break;
    chunks.push(r.value); loaded += r.value.length;
    onProgress?.(loaded, total);
  }
  return new Blob(chunks, { type: res.headers.get('content-type') || '' });
}

const isZip = async (blob) => {
  const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  return head[0] === 0x50 && head[1] === 0x4b;
};

// 竞速拿到响应头 → 读正文；正文阶段失败就换剩下的地址再赛一轮
async function webGet(urls, { onProgress, stagger, signal, check } = {}) {
  let left = [...urls], lastErr;
  while (left.length) {
    let win;
    try { win = await race(left, (u, s) => webOpen(u, s), { stagger, signal }); }
    catch (e) { throw lastErr && e.message === '没有可用地址' ? lastErr : e; }
    left = left.filter(u => u !== win.url);
    try {
      const blob = await readBody(win.value, onProgress);
      if (check) await check(blob);
      return blob;
    } catch (e) {
      if (signal?.aborted) throw e;
      record(win.url, 0, false);
      console.warn('[net]', hostOf(win.url), e?.message || e);
      lastErr = e;
    }
  }
  throw lastErr || new Error('没有可用地址');
}

// ---------- 对外接口 ----------
export async function getText(urls, { signal } = {}) {
  const list = Array.isArray(urls) ? urls : [urls];
  if (isNative) return (await race(list, (u, s) => nativeGetText(u, { signal: s }), { stagger: 900, signal })).value;
  const blob = await webGet(list, { stagger: 700, signal });
  return blob.text();
}

export async function getJSON(urls, opts) {
  return JSON.parse(await getText(urls, opts));
}

/**
 * 下载二进制，带进度。onProgress(loaded, total)
 * opts.expectZip：镜像偶尔会回一个 HTML 错误页，EPUB 一定以 PK 开头，不是就换下一个地址
 * opts.validate(blob)：自定义检查，抛错就当这个地址失败、换下一个（纯文本下载用它挡掉 HTML 错误页）
 */
export async function getBinary(urls, onProgress, { expectZip = false, validate, signal } = {}) {
  const list = Array.isArray(urls) ? urls : [urls];
  const check = async (blob) => {
    if (blob.size < 512 || (expectZip && !(await isZip(blob)))) throw new Error('下载到的不是有效文件');
    if (validate) await validate(blob);
  };
  if (!isNative) return webGet(list, { onProgress, stagger: 1500, signal, check });

  // 原生端：赢家要等整个文件下完才算数（Capacitor 拿不到流）。
  // 几个请求同时在下时，进度条跟着领先的那个走，不来回跳。
  // 下完、核对过是有效文件才报 100%，之前最多到 99%：核对没过的那一路作废、换别的线路接着下，进度条退回 0。
  // 以前先报 100% 再核对，核对没过时进度条停在 100% 干等别的线路，看着像卡死（0.3.15 检查更新就这样）
  let best = 0;
  const lead = (loaded, total) => {
    const f = total ? Math.min(loaded / total, .99) : 0;
    if (f >= best) { best = f; onProgress?.(total ? f * total : 0, total); }
  };
  // Capacitor 的请求中止不了，错峰拉长，免得同时下好几份
  const stagger = platform === 'capacitor' ? 5000 : 2000;
  const { value } = await race(list, async (u, s) => {
    let mine = 0;
    const blob = await nativeGetBinary(u, (loaded, total) => { mine = total ? Math.min(loaded / total, .99) : 0; lead(loaded, total); }, { signal: s });
    try { await check(blob); }
    catch (e) { if (mine && mine >= best && !s.aborted) { best = 0; onProgress?.(0, 0); } throw e; }
    onProgress?.(blob.size, blob.size);
    return blob;
  }, { stagger, signal });
  return value;
}

// ---------- 候选地址 ----------
// 下面的顺序只是"没测过时的初始推荐"，跑起来以后按本机实测重排。
// jsDelivr：cdn 主域国内常被干扰，testingcf / gcore / fastly 等子节点各有各的线路
const JSD = ['testingcf.jsdelivr.net', 'gcore.jsdelivr.net', 'originfastly.jsdelivr.net', 'quantil.jsdelivr.net', 'fastly.jsdelivr.net', 'cdn.jsdelivr.net'];
// GitHub 加速代理（前缀式：代理地址 + 原始地址），都带 CORS 头
const GH_PROXIES = ['https://gh-proxy.org/', 'https://edgeone.gh-proxy.org/', 'https://ghfast.top/', 'https://gh.llkk.cc/'];

/**
 * GitHub 仓库里的文件。小文件 jsDelivr 优先（有 CDN、带 CORS）；
 * 大仓库里的大文件（ixinzhi 的 EPUB 仓库好几个 G）jsDelivr 会超时，改成代理 / raw 优先、jsDelivr 垫底
 */
export function repoFileUrls(owner, repo, branch, path, { big = false } = {}) {
  const enc = path.split('/').map(encodeURIComponent).join('/');
  const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${enc}`;
  const cdn = JSD.map(h => `https://${h}/gh/${owner}/${repo}@${branch}/${enc}`);
  const proxied = GH_PROXIES.map(p => p + raw);
  return big ? [...proxied, raw, ...cdn.slice(0, 2)] : [...cdn.slice(0, 3), ...proxied, raw, ...cdn.slice(3)];
}

/**
 * GitHub Releases 附件：原生端可直连 github.com；网页端只能走带 CORS 的代理
 * （ghfast 下 Releases 时跳转后的响应没有 CORS 头，网页端用不了，客户端里照用）
 */
export function releaseAssetUrls(owner, repo, tag, file) {
  const direct = `https://github.com/${owner}/${repo}/releases/download/${tag}/${encodeURIComponent(file)}`;
  const proxied = GH_PROXIES.map(p => p + direct);
  return isNative ? [...proxied, direct] : proxied.filter(u => !u.startsWith('https://ghfast.top/'));
}

// ---------- 诊断 ----------
/**
 * 测一个地址：只等响应头，到了就中止，不下正文。
 * 网页端对没有 CORS 头的地址用 no-cors（拿不到状态码，但能测通不通、多快）；原生端见 native.js 的 nativeProbe。
 * @returns {Promise<{ok:boolean, ms:number, error?:string}>}
 */
export async function probe(url, { timeout = 8000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('超时')), timeout);
  const t0 = performance.now();
  try {
    if (isNative) {
      await nativeProbe(url, { signal: ctrl.signal, timeout });
    } else {
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store', mode: url.includes('github.com/') && !GH_PROXIES.some(p => url.startsWith(p)) ? 'no-cors' : 'cors' });
      if (res.type !== 'opaque' && !res.ok) throw new Error(`HTTP ${res.status}`);
      ctrl.abort(LOST);
    }
    const ms = performance.now() - t0;
    record(url, ms, true);
    return { ok: true, ms: Math.round(ms) };
  } catch (e) {
    const timedOut = ctrl.signal.reason?.message === '超时';
    record(url, 0, false);
    return { ok: false, ms: Math.round(performance.now() - t0), error: timedOut ? '超时' : /^HTTP \d+/.test(e?.message) ? e.message : '连不上' };
  } finally {
    clearTimeout(timer);
  }
}

/** 测一张图（封面代理）：加载成功且不是占位小图算通 */
export function probeImage(url, { timeout = 8000 } = {}) {
  return new Promise(resolve => {
    const im = new Image();
    const t0 = performance.now();
    const end = (ok, error) => {
      clearTimeout(timer); im.onload = im.onerror = null;
      const ms = Math.round(performance.now() - t0);
      record(url, ms, ok);
      resolve(ok ? { ok, ms } : { ok, ms, error });
      if (!ok) im.src = '';
    };
    const timer = setTimeout(() => end(false, '超时'), timeout);
    im.onload = () => end(im.naturalWidth >= 60, '图片无效');
    im.onerror = () => end(false, '连不上');
    im.src = url;
  });
}

/**
 * 图片错峰竞速（封面用）：先加载第一张，stagger 毫秒没出来再加载下一张，谁先出来用谁。
 * 原站缺封面时会回一张很小的占位图，宽度太小的当失败。
 * @returns {Promise<string|null>} 赢的地址；全部失败 null
 */
export function raceImage(urls, { stagger = 1200, timeout = 12000 } = {}) {
  const list = order(urls);
  return new Promise(resolve => {
    const imgs = [];
    let next = 0, failed = 0, done = false, timer = 0;
    const finish = (url) => {
      done = true; clearTimeout(timer);
      imgs.forEach(({ im, t }) => { clearTimeout(t); im.onload = im.onerror = null; if (im.src !== url) im.src = ''; });
      resolve(url);
    };
    const launch = () => {
      clearTimeout(timer);
      if (done || next >= list.length) return;
      const url = list[next++];
      const im = new Image();
      const t0 = performance.now();
      const fail = () => {
        if (done) return;
        record(url, 0, false);
        if (++failed >= list.length) return finish(null);
        launch();
      };
      const t = setTimeout(fail, timeout);
      imgs.push({ im, t });
      im.onload = () => {
        clearTimeout(t);
        if (done) return;
        if (im.naturalWidth < 60) return fail();
        record(url, performance.now() - t0, true);
        finish(url);
      };
      im.onerror = () => { clearTimeout(t); fail(); };
      im.src = url;
      if (next < list.length) timer = setTimeout(launch, stagger);
    };
    launch();
  });
}
