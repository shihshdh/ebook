// 漫画源沙箱：主页面这一侧。
//   每个源一个 iframe，sandbox="allow-scripts"——不给 allow-same-origin，所以和 App 不同源，读不到书架、账户和 IndexedDB；
//   srcdoc 里的 CSP 不许它自己联网。源脚本要发的请求经 postMessage 交到这里，用原生 HTTP 发出去（不受 CORS 限制）。
//   沙箱里跑的是什么见 sandbox.js。
import sandboxCode from './sandbox.js?inline-script';
import { nativeRequest, mobileOS } from '../../lib/native.js';
import { checkUrl } from '../policy.js';

const CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:";
let srcdoc = '';
const docOf = () => srcdoc || (srcdoc = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><script>${sandboxCode.replace(/<\/script/gi, '<\\/script')}</script>`);

const bufferOf = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
const charsetOf = (type) => /charset\s*=\s*["']?([^\s;"']+)/i.exec(type || '')?.[1];

// 所有沙箱共用一个 message 监听：按 event.source 找到是哪个沙箱发来的
const byWindow = new Map();
let listening = false;
function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener('message', (event) => {
    const box = byWindow.get(event.source);
    if (box && event.data && typeof event.data === 'object') box.onMessage(event.data);
  });
}

export class Sandbox {
  /**
   * @param {object} o
   * @param {string} o.code        源脚本
   * @param {string} o.runtime     同一个仓库的 _venera_.js
   * @param {string} o.className   源脚本里 extends ComicSource 的类名
   * @param {object} o.data        源上次存下的数据（load_data / 设置 / cookie）
   * @param {boolean} [o.allowPrivate]  自己搭的服务器：允许访问局域网
   * @param {(key: string, value: any) => void} [o.onData]   源存了东西
   * @param {(m: object) => void} [o.onUi]                    源要弹提示 / 打开网页
   */
  constructor({ code, runtime, className, data, allowPrivate = false, onData, onUi }) {
    listen();
    Object.assign(this, { allowPrivate, onData, onUi });
    this.pending = new Map();
    this.seq = 0;
    this.logs = [];
    this.challenged = '';   // 最近一次被 Cloudflare 人机验证拦下的站，「测一遍」给原因用
    this.boot = { t: 'boot', runtime, code, className, data, env: { platform: mobileOS || 'windows', bridgeGuard: window.__EBOOK_BRIDGE_GUARD__ } };
    this.ready = new Promise((resolve, reject) => { this.settle = { resolve, reject }; });
    this.ready.catch(() => {});
    const frame = this.frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;left:-10px;top:-10px;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
    frame.srcdoc = docOf();
    document.body.append(frame);
    this.win = frame.contentWindow;
    byWindow.set(this.win, this);
    this.bootTimer = setTimeout(() => this.settle.reject(new Error('源加载超时')), 20000);
  }

  post(message, transfer = []) { this.win?.postMessage(message, '*', transfer); }

  /** 有调用没回来、或者有请求在发（取图直接走 http）：这时不能关 */
  get busy() { return this.pending.size > 0 || this.inflight > 0; }

  onMessage(m) {
    switch (m.t) {
      case 'hello': this.post(this.boot); this.boot = null; return;
      case 'ready':
        clearTimeout(this.bootTimer);
        if (m.error) this.settle.reject(new Error(`源加载失败：${m.error}`));
        else { this.meta = m.meta; this.settle.resolve(m.meta); }
        return;
      case 'result': {
        const p = this.pending.get(m.id);
        if (p) m.error ? p.reject(new Error(m.error)) : p.resolve(m.value);
        return;
      }
      case 'http':
        this.http(m.req).then(
          value => this.post({ t: 'reply', id: m.id, value }, value.body instanceof ArrayBuffer ? [value.body] : []),
          error => this.post({ t: 'reply', id: m.id, value: { status: null, headers: {}, body: null, error: String(error?.message || error) } }));
        return;
      case 'data': this.onData?.(m.key, m.value); return;
      case 'log':
        this.logs.push(`[${m.level}] ${m.title}: ${m.content}`);
        if (this.logs.length > 50) this.logs.shift();
        if (import.meta.env?.DEV) console.debug('[comic]', m.title, m.content);
        return;
      case 'ui': this.onUi?.(m); return;
    }
  }

  /** 替沙箱发请求。返回 Venera 的格式：{ status, headers, body }，body 按 req.bytes 给 ArrayBuffer 或文字 */
  async http(req, { signal } = {}) {
    const url = checkUrl(req.url, { allowPrivate: this.allowPrivate });
    let body = req.body;
    if (body instanceof Uint8Array) body = new TextDecoder().decode(body);   // 原生桥接只收文字请求体
    this.inflight = (this.inflight || 0) + 1;
    let res;
    try { res = await nativeRequest({ url, method: req.method || 'GET', headers: req.headers || {}, body: body ?? undefined, raw: true, signal, timeout: 25000 }); }
    finally { this.inflight--; }
    if (res.headers['cf-mitigated'] === 'challenge') this.challenged = new URL(url).host;
    if (req.bytes) return { status: res.status, headers: res.headers, body: bufferOf(res.bytes) };
    const { decodeBytes, declaredCharset } = await import('../../lib/charset.js');
    return { status: res.status, headers: res.headers, body: decodeBytes(res.bytes, [charsetOf(res.headers['content-type']), declaredCharset(res.bytes)]) };
  }

  /** 调源：search / info / ep / image / thumb / imageResponse / setSetting / callback（见 sandbox.js 的 calls） */
  async call(fn, args = [], { timeout = 30000, signal } = {}) {
    await this.ready;
    if (!this.win) throw new Error('沙箱已关闭');
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      const finish = (settle, value) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        this.pending.delete(id);
        settle(value);
      };
      const onAbort = () => finish(reject, new DOMException('已取消', 'AbortError'));
      const timer = setTimeout(() => finish(reject, new Error('源没有回应（超时）')), timeout);
      if (signal?.aborted) return onAbort();
      signal?.addEventListener('abort', onAbort, { once: true });
      this.pending.set(id, { resolve: v => finish(resolve, v), reject: e => finish(reject, e) });
      this.post({ t: 'call', id, fn, args }, args.filter(a => a instanceof ArrayBuffer));
    });
  }

  close() {
    clearTimeout(this.bootTimer);
    this.settle.reject(new Error('沙箱已关闭'));
    for (const p of this.pending.values()) p.reject(new Error('沙箱已关闭'));
    this.pending.clear();
    byWindow.delete(this.win);
    this.frame.remove();
    this.win = null;
  }
}
