import { mobileOS } from '../lib/native.js';
import { checkUrl } from './policy.js';

// Android's bridge returns base64. Uint8Array.from(atob(...), callback) creates
// one JS call per byte (and a large temporary array). Decode bounded chunks,
// yielding between them so scrolling can paint. The visible page skips timer
// yields: background prefetch must never delay its first display. Only reader pages use this
// path; WKWebView keeps the established sandbox HTTP path below.
async function androidPageBytes(sandbox, req, signal, front) {
  const url = checkUrl(req.url, { allowPrivate: sandbox.allowPrivate });
  signal?.throwIfAborted();
  const { CapacitorHttp } = await import('@capacitor/core');
  const headers = Object.fromEntries(Object.entries(req.headers || {}).filter(([k]) => k.toLowerCase() !== 'accept-encoding'));
  let timer, onAbort;
  const stopped = new Promise((_, reject) => {
    onAbort = () => reject(new DOMException('已取消', 'AbortError'));
    signal?.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => reject(new DOMException('请求超时', 'TimeoutError')), 25000);
  });
  sandbox.inflight = (sandbox.inflight || 0) + 1;
  try {
    signal?.throwIfAborted();
    const response = await Promise.race([stopped, CapacitorHttp.request({ url, method: req.method || 'GET', headers,
      data: req.body instanceof Uint8Array ? new TextDecoder().decode(req.body) : req.body ?? undefined,
      responseType: 'arraybuffer', connectTimeout: 25000, readTimeout: 25000 })]);
    signal?.throwIfAborted();
    const responseHeaders = Object.fromEntries(Object.entries(response.headers || {}).map(([k,v]) => [k.toLowerCase(), String(v)]));
    if (responseHeaders['cf-mitigated'] === 'challenge') sandbox.challenged = new URL(url).host;
    if (response.status < 200 || response.status >= 300) throw new Error(`图片 HTTP ${response.status}`);
    const data = response.data;
    let bytes;
    if (typeof data === 'string' && !/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(responseHeaders['content-type'] || '')) {
      const base64 = data.replace(/^data:[^,]*,/, '').replace(/\s/g, '');
      bytes = new Uint8Array(Math.floor(base64.length / 4) * 3 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0));
      // Multiple of four: each independently decodable block is at most 48 KiB.
      for (let start = 0, offset = 0; start < base64.length; start += 65536) {
        signal?.throwIfAborted();
        const chunk = atob(base64.slice(start, start + 65536));
        for (let i = 0; i < chunk.length; i++) bytes[offset++] = chunk.charCodeAt(i);
        if (!front && start + 65536 < base64.length) await new Promise(resolve => setTimeout(resolve, 0));
      }
    } else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
    else if (ArrayBuffer.isView(data)) bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    else bytes = new TextEncoder().encode(typeof data === 'string' ? data : JSON.stringify(data));
    signal?.throwIfAborted();
    return { status: response.status, body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
    sandbox.inflight--;
  }
}

// 漫画图片：问源要请求配置（onImageLoad：防盗链的 Referer、签名这些），用原生 HTTP 取字节，必要时交回源解密，再变成 Blob。
// 网页上的 <img> 带不了 Referer，所以图都这样取，不直接把网址给 <img>。

/** 按文件头认图片格式；认不出就不是图片（网站常回一个 HTML 错误页，状态码却是 200） */
export function imageType(bytes) {
  const b = bytes, ascii = (from, to) => String.fromCharCode(...b.subarray(from, to));
  if (b.length < 12) return '';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 3) === 'GIF') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp' && /^avi[fs]$/.test(ascii(8, 12))) return 'image/avif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  return '';
}

/**
 * 取一张图。sandbox：host.js 的 Sandbox；thumb：封面 / 缩略图（走 onThumbnailLoad）
 * @returns {Promise<Blob>}
 */
export async function fetchImage(sandbox, url, { comicId, epId, thumb = false, signal, front = false } = {}) {
  const req = await sandbox.call(thumb ? 'thumb' : 'image', thumb ? [url] : [url, comicId, epId], { signal });
  if (req.modifyImage) throw new Error('这个源的图片要重新拼接，暂不支持');
  const res = mobileOS === 'android' && !thumb
    ? await androidPageBytes(sandbox, req, signal, front)
    : await sandbox.http({ ...req, bytes: true }, { signal });
  if (res.status < 200 || res.status >= 300) throw new Error(`图片 HTTP ${res.status}`);
  let buffer = res.body;
  if (req.onResponse) buffer = await sandbox.call('imageResponse', [req.onResponse, buffer], { signal });
  const type = imageType(new Uint8Array(buffer));
  if (!type) throw new Error('取到的不是图片');
  return new Blob([buffer], { type });
}
