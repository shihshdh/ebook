// 漫画源沙箱：跑在 sandbox iframe 里（只给 allow-scripts，和 App 不同源，碰不到书架的 IndexedDB；CSP 不许它自己联网）。
// 构建时连同 crypto-js 打成一段 IIFE 文本，由 host.js 塞进 iframe 的 srcdoc（见 vite.config.js 的 inline-script）。
//
// 做的事：实现 Venera 宿主的 sendMessage，让 venera-configs 里的源脚本原样跑起来。
//   html     DOMParser（同步，和 Venera 一样按整数 key 引用文档和元素）
//   convert  crypto-js：md5 / sha / hmac / AES（按块直接处理、不去填充，同 Venera 的 Dart 实现）；utf8 / gbk / base64
//   存档     load_data / save_data 在内存里，改动回写给主页面存进 IndexedDB；用户设置在 data.settings 里（同 Venera）
//   http     唯一出沙箱的东西：交给主页面用原生 HTTP 发（Tauri / OkHttp / URLSession）
// 行为照 Venera 1.6 的 lib/foundation/js_engine.dart 抄，包括它的怪癖（设置的默认值在加载源时就定下来）。
import CryptoJS from 'crypto-js/core';
import 'crypto-js/x64-core';
import 'crypto-js/md5';
import 'crypto-js/sha1';
import 'crypto-js/sha256';
import 'crypto-js/sha512';
import 'crypto-js/hmac';
import 'crypto-js/cipher-core';
import 'crypto-js/aes';
import 'crypto-js/mode-ecb';
import 'crypto-js/mode-cfb';
import 'crypto-js/mode-ofb';
import 'crypto-js/pad-nopadding';
import { encodeGbk } from '../../plugins/legado/encoding.js';

const APP_VERSION = '1.6.0';   // 索引里的源最高要求 1.6.0
const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// 源脚本会用自己的 setTimeout 覆盖全局的（_venera_.js 里用 delay 消息实现），先把原生的留一份
const nativeTimeout = globalThis.setTimeout.bind(globalThis);

// ---------- 原生桥 ----------
// WebView 会把原生桥也注入到子 frame。在源脚本跑起来之前看清楚、能拿掉的拿掉：
//   Windows（Tauri + WebView2）：__TAURI_INTERNALS__、ipc、chrome.webview 都在，但从子 frame 发的命令到不了 Rust
//     （2026-10-15 实测：从这里调 toggle_maximize 不生效，同一条从主页面调生效）。能拿掉的拿掉：chrome.webview（真正的传输通道）
//     删得掉；__TAURI_INTERNALS__、ipc 被 Tauri 定义成只读的，删不掉也改不了，留着也调不通
//   iPhone（WKWebView）：messageHandlers 在所有 frame 都能用，Capacitor 收消息不看是不是主 frame → 不安全，不运行源
//   安卓：Capacitor 用 WebMessageListener，只认主 frame、只注入到 App 自己的源；系统 WebView 太旧时退回
//     addJavascriptInterface（所有 frame 都有 androidBridge）→ 不安全，不运行源

// Tauri 把 window.__TAURI_INTERNALS__、window.ipc 定义成删不掉的属性：删不掉就把里面的方法逐个清空
function disarm(owner, name) {
  try { delete owner[name]; } catch {}
  if (owner[name] === undefined) return;
  try { Object.defineProperty(owner, name, { value: undefined, configurable: false, writable: false }); return; } catch {}
  const inner = owner[name];
  if (inner && (typeof inner === 'object' || typeof inner === 'function')) {
    for (const key of Object.getOwnPropertyNames(inner)) {
      try { delete inner[key]; } catch {}
      try { if (inner[key] !== undefined) Object.defineProperty(inner, key, { value: undefined, configurable: false, writable: false }); } catch {}
    }
    try { Object.freeze(inner); } catch {}
  }
}
for (const name of ['__TAURI_INTERNALS__', '__TAURI__', '__TAURI_IPC__', '__TAURI_METADATA__', 'ipc']) if (name in globalThis) disarm(globalThis, name);
if (globalThis.chrome?.webview) disarm(globalThis.chrome, 'webview');

// ---------- 和主页面通信 ----------
// 浏览器里是父页面的 postMessage；Node 测试里由测试脚本给 globalThis.__comicPort
const port = globalThis.__comicPort || {
  post: (message, transfer) => parent.postMessage(message, '*', transfer),
  listen: (fn) => addEventListener('message', (event) => { if (event.source === parent) fn(event.data); }),
};
let seq = 0;
const waiting = new Map();
function ask(message) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    port.post({ ...message, id });
  });
}
const log = (level, title, content) => port.post({ t: 'log', level, title: String(title ?? ''), content: String(content ?? '') });

// ---------- 存档、设置、cookie ----------
let data = {};          // 源自己存的东西（load_data / save_data），user 设置在 data.settings
let schema = {};        // 加载源时定下的设置默认值
let env = {};
const COOKIES = '__ebook_cookies';
function persist(key) {
  let value = data[key];
  try { value = value === undefined ? undefined : structuredClone(value); }
  catch { value = JSON.parse(JSON.stringify(value)); }   // 带函数的对象：存能存的部分
  port.post({ t: 'data', key, value });
}
const cookieHost = (url) => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } };
function cookiesFor(url) {
  const host = cookieHost(url), jar = data[COOKIES] || {};
  return Object.entries(jar).filter(([domain]) => host === domain || host.endsWith('.' + domain)).flatMap(([, list]) => list);
}

// ---------- 字节和编码 ----------
const utf8 = new TextEncoder();
// 不用 instanceof：别的 realm 来的 ArrayBuffer（父页面、测试里的 vm）instanceof 不成立
const isBuffer = (v) => Object.prototype.toString.call(v) === '[object ArrayBuffer]';
function bytesOf(value) {
  if (value == null) return new Uint8Array(0);
  if (isBuffer(value)) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value)) return Uint8Array.from(value);
  return utf8.encode(String(value));
}
const bufferOf = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
function words(u8) {
  const w = [];
  for (let i = 0; i < u8.length; i++) w[i >>> 2] |= u8[i] << (24 - (i % 4) * 8);
  return CryptoJS.lib.WordArray.create(w, u8.length);
}
function unwords(wa) {
  const out = new Uint8Array(wa.sigBytes);
  for (let i = 0; i < wa.sigBytes; i++) out[i] = (wa.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  return out.buffer;
}
function base64Decode(text) {
  let s = String(text).replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer;
}
function base64Encode(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function gbkBytes(text) {
  const encoded = encodeGbk(text), out = [];
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === '%') { out.push(parseInt(encoded.slice(i + 1, i + 3), 16)); i += 2; }
    else out.push(encoded.charCodeAt(i));
  }
  return Uint8Array.from(out).buffer;
}
const HASHES = { md5: CryptoJS.algo.MD5, sha1: CryptoJS.algo.SHA1, sha256: CryptoJS.algo.SHA256, sha512: CryptoJS.algo.SHA512 };
const MODES = { 'aes-ecb': CryptoJS.mode.ECB, 'aes-cbc': CryptoJS.mode.CBC, 'aes-cfb': CryptoJS.mode.CFB, 'aes-ofb': CryptoJS.mode.OFB };

function convert(m) {
  const { type, value, isEncode } = m;
  try {
    switch (type) {
      case 'utf8': return isEncode ? bufferOf(utf8.encode(String(value))) : new TextDecoder('utf-8').decode(bytesOf(value));
      case 'gbk': return isEncode ? gbkBytes(value) : new TextDecoder('gbk').decode(bytesOf(value));
      case 'base64': return isEncode ? base64Encode(bytesOf(value)) : base64Decode(value);
      case 'md5': case 'sha1': case 'sha256': case 'sha512':
        return unwords(HASHES[type].create().finalize(words(bytesOf(value))));
      case 'hmac': {
        const algo = HASHES[m.hash];
        if (!algo) throw new Error(`不支持的哈希：${m.hash}`);
        const digest = CryptoJS.algo.HMAC.create(algo, words(bytesOf(m.key))).finalize(words(bytesOf(value)));
        return m.isString ? digest.toString(CryptoJS.enc.Hex) : unwords(digest);
      }
      case 'aes-ecb': case 'aes-cbc': case 'aes-cfb': case 'aes-ofb': {
        // Venera 用 pointycastle 逐块处理：不加不去填充，CFB / OFB 只支持整块（blockSize 16）
        if ((type === 'aes-cfb' || type === 'aes-ofb') && m.blockSize && m.blockSize !== 16) throw new Error(`不支持 ${type} 块大小 ${m.blockSize}`);
        const raw = bytesOf(value);
        if (raw.length % 16) throw new Error(`${type} 的输入不是整块（${raw.length} 字节）`);
        const key = words(bytesOf(m.key)), iv = words(m.iv != null ? bytesOf(m.iv) : new Uint8Array(16));
        const opts = { mode: MODES[type], padding: CryptoJS.pad.NoPadding, iv };
        const input = words(raw);
        return unwords(isEncode ? CryptoJS.AES.encrypt(input, key, opts).ciphertext : CryptoJS.AES.decrypt({ ciphertext: input }, key, opts));
      }
      case 'rsa': throw new Error('暂不支持 RSA');
      default: return value;
    }
  } catch (error) {
    // Venera 转换失败返回 null，只记日志
    log('error', 'Convert', `${type}: ${error?.message || error}`);
    return null;
  }
}

// ---------- HTML：文档、元素都用整数 key 引用 ----------
const docs = new Map();    // key → { doc, nodes: Node[] }
const MAX_DOCS = 32;
const keyOf = (docKey, node) => {
  if (!node) return null;
  const nodes = docs.get(docKey).nodes;
  let i = nodes.indexOf(node);
  if (i < 0) i = nodes.push(node) - 1;
  return i;
};
const keysOf = (docKey, list) => Array.from(list, n => keyOf(docKey, n));
const nodeAt = (m) => {
  const entry = docs.get(m.doc);
  if (!entry) throw new Error('文档已释放');
  return entry.nodes[m.key];
};
const NODE_TYPES = { 1: 'element', 3: 'text', 8: 'comment', 9: 'document' };
function html(m) {
  switch (m.function) {
    case 'parse': {
      if (docs.size >= MAX_DOCS) docs.delete(docs.keys().next().value);
      docs.set(m.key, { doc: new DOMParser().parseFromString(String(m.data ?? ''), 'text/html'), nodes: [] });
      return null;
    }
    case 'querySelector': return keyOf(m.key, docs.get(m.key).doc.querySelector(m.query));
    case 'querySelectorAll': return keysOf(m.key, docs.get(m.key).doc.querySelectorAll(m.query));
    case 'getElementById': return keyOf(m.key, docs.get(m.key).doc.getElementById(m.id));
    case 'dispose': docs.delete(m.key); return null;
    case 'dom_querySelector': return keyOf(m.doc, nodeAt(m).querySelector(m.query));
    case 'dom_querySelectorAll': return keysOf(m.doc, nodeAt(m).querySelectorAll(m.query));
    case 'getText': return nodeAt(m).textContent;
    case 'getAttributes': return Object.fromEntries(Array.from(nodeAt(m).attributes, a => [a.name, a.value]));
    case 'getChildren': return keysOf(m.doc, nodeAt(m).children);
    case 'getNodes': return keysOf(m.doc, nodeAt(m).childNodes);
    case 'getInnerHTML': return nodeAt(m).innerHTML;
    case 'getParent': return keyOf(m.doc, nodeAt(m).parentElement);
    case 'getClassNames': return Array.from(nodeAt(m).classList);
    case 'getId': return nodeAt(m).id || null;
    case 'getLocalName': return nodeAt(m).localName;
    case 'getPreviousSibling': return keyOf(m.doc, nodeAt(m).previousElementSibling);
    case 'getNextSibling': return keyOf(m.doc, nodeAt(m).nextElementSibling);
    case 'node_text': return nodeAt(m).textContent;
    case 'node_type': return NODE_TYPES[nodeAt(m).nodeType] || 'unknown';
    case 'node_toElement': case 'node_to_element': return nodeAt(m).nodeType === 1 ? m.key : null;
  }
  return null;
}

// ---------- 网络：交给主页面 ----------
const headerIn = (headers, name) => Object.keys(headers).find(k => k.toLowerCase() === name);
function requestOf({ http_method: method = 'GET', url, headers, data: body, bytes }) {
  const h = { ...(headers || {}) };
  // 同 Venera：源没写 UA 就用浏览器 UA。名字首字母大写——有的站（Cloudflare）把小写的 user-agent 当机器人
  if (!headerIn(h, 'user-agent')) h['User-Agent'] = WEB_UA;
  const jar = cookiesFor(url);
  if (jar.length && !headerIn(h, 'cookie')) h.Cookie = jar.map(c => `${c.name}=${c.value}`).join('; ');
  // dio 的写法：对象按 Content-Type 编成表单或 JSON
  if (body && typeof body === 'object' && !isBuffer(body) && !ArrayBuffer.isView(body)) {
    const type = h[headerIn(h, 'content-type')] || '';
    if (/x-www-form-urlencoded/i.test(type)) body = new URLSearchParams(body).toString();
    else { body = JSON.stringify(body); if (!type) h['Content-Type'] = 'application/json'; }
  } else if (isBuffer(body) || ArrayBuffer.isView(body)) body = new Uint8Array(bytesOf(body));
  return { method: String(method).toUpperCase(), url: String(url), headers: h, body: body ?? null, bytes: !!bytes };
}
async function http(m) {
  try { return await ask({ t: 'http', req: requestOf(m) }); }
  catch (error) { return { status: null, headers: {}, body: null, error: String(error?.message || error) }; }
}

// ---------- 界面 ----------
let loadingId = 0;
function ui(m) {
  switch (m.function) {
    case 'showMessage': port.post({ t: 'ui', kind: 'toast', message: String(m.message ?? '') }); return null;
    case 'showDialog': port.post({ t: 'ui', kind: 'toast', message: [m.title, m.content].filter(Boolean).join('：') }); return null;
    case 'launchUrl': port.post({ t: 'ui', kind: 'open', url: String(m.url ?? '') }); return null;
    case 'showLoading': return ++loadingId;
    case 'cancelLoading': return null;
    // 输入框、选择框：EBOOK 没有给源弹窗的地方，当作用户取消
    case 'showInputDialog': case 'showSelectDialog': return Promise.resolve(null);
  }
  return null;
}

function uuid() {
  const b = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.random() * 256 | 0;
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---------- sendMessage：Venera 的宿主接口 ----------
globalThis.sendMessage = function sendMessage(m) {
  switch (m?.method) {
    case 'http': return http(m);
    case 'html': return html(m);
    case 'convert': return convert(m);
    case 'delay': return new Promise(resolve => nativeTimeout(resolve, Math.max(0, Number(m.time) || 0)));
    case 'load_data': return data[m.data_key] ?? null;
    case 'save_data': data[m.data_key] = m.data; persist(m.data_key); return null;
    case 'delete_data': delete data[m.data_key]; persist(m.data_key); return null;
    case 'load_setting': {
      const value = data.settings?.[m.setting_key] ?? schema[m.setting_key];
      if (value === undefined) throw new Error(`Setting not found: ${m.setting_key}`);
      return value;
    }
    case 'isLogged': return data.account != null;
    case 'cookie': {
      const jar = data[COOKIES] || (data[COOKIES] = {});
      const host = cookieHost(m.url);
      if (m.function === 'get') return cookiesFor(m.url).map(c => ({ ...c, session: true }));
      if (m.function === 'set') {
        for (const c of m.cookies || []) {
          const domain = String(c.domain || host).replace(/^\./, '').toLowerCase();
          const list = (jar[domain] || []).filter(x => x.name !== c.name);
          jar[domain] = [...list, { name: String(c.name), value: String(c.value), domain }];
        }
      } else if (m.function === 'delete') delete jar[host];
      persist(COOKIES);
      return null;
    }
    case 'log': log(m.level, m.title, m.content); return null;
    case 'UI': return ui(m);
    case 'getLocale': return 'zh_CN';
    case 'getPlatform': return env.platform || 'windows';
    case 'uuid': return uuid();
    case 'random': {
      const min = Number(m.min ?? 0), max = Number(m.max ?? 1);
      return m.type === 'int' ? min + Math.floor(Math.random() * (max - min)) : min + Math.random() * (max - min);
    }
    case 'setClipboard': return Promise.resolve(null);
    case 'getClipboard': return Promise.resolve(null);
    case 'compute': return Promise.resolve().then(() => venera.run(`(${m.function})`)(...(m.args || [])));
    case 'image': log('warning', 'Image', '暂不支持图片重排'); return null;
  }
  return null;
};

// ---------- 装载源 ----------
let venera = null;   // { source, run }：run 在源脚本的作用域里求值（能看到 Convert、Network 这些）
const text = (v) => (v == null ? '' : String(v));
const isMap = (v) => Object.prototype.toString.call(v) === '[object Map]';
const entriesOf = (v) => (isMap(v) ? [...v.entries()] : v && typeof v === 'object' ? Object.entries(v) : []);
const optionValue = (o) => text(o).split('-')[0];
const optionLabel = (o) => { const s = text(o), i = s.indexOf('-'); return i < 0 ? s : s.slice(i + 1); };

function comicOf(c) {
  if (!c || typeof c !== 'object') return null;
  return {
    id: text(c.id), title: text(c.title), subtitle: text(c.subtitle ?? c.subTitle), cover: text(c.cover),
    tags: Array.isArray(c.tags) ? c.tags.map(text).filter(Boolean) : [], description: text(c.description),
    language: text(c.language), maxPage: Number(c.maxPage) || 0,
  };
}
function detailsOf(d) {
  const chapters = [];
  for (const [k, v] of entriesOf(d.chapters)) {
    // 分组的章节：Map<组名, Map<章节 id, 标题>>
    if (isMap(v) || (v && typeof v === 'object')) for (const [id, title] of entriesOf(v)) chapters.push({ id: text(id), title: text(title), group: text(k) });
    else chapters.push({ id: text(k), title: text(v), group: '' });
  }
  return {
    title: text(d.title), subtitle: text(d.subtitle ?? d.subTitle), cover: text(d.cover), description: text(d.description),
    tags: entriesOf(d.tags).map(([group, values]) => [text(group), (Array.isArray(values) ? values : [values]).map(text).filter(Boolean)]),
    // 同 Venera：没给 chapters 是「整本一卷」（loadEp 的 epId 传 null）；给了个空的是「没有章节可看」
    chapters, single: d.chapters == null,
    updateTime: text(d.updateTime), uploadTime: text(d.uploadTime), url: text(d.url), maxPage: Number(d.maxPage) || 0,
    recommend: (Array.isArray(d.recommend) ? d.recommend : []).map(comicOf).filter(Boolean),
  };
}
function searchOptionsOf(list) {
  return (Array.isArray(list) ? list : []).map(o => {
    const options = (o.options || []).map(x => ({ value: optionValue(x), label: optionLabel(x) }));
    const fallback = o.type === 'multi-select' ? '[]' : (options[0]?.value ?? '');
    const value = o.default == null ? fallback : (Array.isArray(o.default) ? JSON.stringify(o.default) : text(o.default));
    return { label: text(o.label), type: text(o.type || 'select'), options, default: value };
  });
}
function settingsOf() {
  return entriesOf(venera.source.settings).map(([key, s]) => ({
    key, title: text(s?.title || key), type: text(s?.type || 'input'),
    options: (s?.options || []).map(o => ({ value: text(o.value), label: text(o.text ?? o.value) })),
    default: schema[key], value: data.settings?.[key] ?? schema[key], buttonText: text(s?.buttonText),
  }));
}
function meta() {
  const s = venera.source;
  return {
    name: text(s.name), key: text(s.key), version: text(s.version), url: text(s.url),
    search: !!(s.search?.load || s.search?.loadNext), searchOptions: searchOptionsOf(s.search?.optionList),
    explore: (Array.isArray(s.explore) ? s.explore : []).map(e => ({ title: text(e.title), type: text(e.type) })),
    account: !!s.account, settings: settingsOf(),
  };
}

// 探索页的四种写法统一成 [{ title, comics }]
const comicsOf = (list) => (Array.isArray(list) ? list : []).map(comicOf).filter(Boolean);
function partsOf(type, title, result) {
  switch (type) {
    case 'multiPartPage': return (Array.isArray(result) ? result : []).map(p => ({ title: text(p?.title), comics: comicsOf(p?.comics) }));
    case 'singlePageWithMultiPart': return entriesOf(result).map(([t, list]) => ({ title: text(t), comics: comicsOf(list) }));
    case 'multiPageComicList': return [{ title, comics: comicsOf(result?.comics) }];
    case 'mixed': return (result?.data || []).map(d => (Array.isArray(d) ? { title: '', comics: comicsOf(d) } : { title: text(d?.title), comics: comicsOf(d?.comics) }));
  }
  return [];
}

// 图片请求的回调（onResponse）留在沙箱里，主页面拿句柄来调
const imageHooks = new Map();
let hookSeq = 0;
function imageRequestOf(url, cfg) {
  cfg = cfg && typeof cfg === 'object' ? cfg : {};
  const req = requestOf({ http_method: cfg.method || 'GET', url: cfg.url || url, headers: cfg.headers, data: cfg.data, bytes: true });
  let hook = null;
  if (typeof cfg.onResponse === 'function') {
    hook = ++hookSeq; imageHooks.set(hook, cfg.onResponse);
    if (imageHooks.size > 300) imageHooks.delete(imageHooks.keys().next().value);
  }
  return { ...req, onResponse: hook, modifyImage: typeof cfg.modifyImage === 'string' ? cfg.modifyImage : null };
}

const calls = {
  async search(keyword, options, page, next) {
    const s = venera.source.search;
    const result = s.load ? await s.load(keyword, options, page) : await s.loadNext(keyword, options, next ?? null);
    return { comics: (result?.comics || []).map(comicOf).filter(Boolean), maxPage: Number(result?.maxPage) || 0, next: result?.next ?? null };
  },
  async explore(index = 0, page = 1) {
    const e = venera.source.explore?.[index];
    if (!e?.load) throw new Error('这个源没有探索页');
    const result = e.type === 'singlePageWithMultiPart' ? await e.load() : await e.load(page);
    return { parts: partsOf(e.type, text(e.title), result).filter(p => p.comics.length), maxPage: Number(result?.maxPage) || 0 };
  },
  // 分类：fixed（字符串列表 + categoryParams，或 { label, target: { attributes: { category, param } } }）和 dynamic（loader() 现拉）统一成 { label, category, param }
  async categories() {
    const out = [];
    for (const part of venera.source.category?.parts || []) {
      const list = part.type === 'dynamic' && part.loader ? await part.loader() : part.categories || [];
      (Array.isArray(list) ? list : []).forEach((c, i) => {
        if (typeof c === 'string') out.push({ label: c, category: c, param: part.categoryParams?.[i] ?? null });
        else if (c && (!c.target?.page || c.target.page === 'category')) {
          const a = c.target?.attributes || {};
          out.push({ label: text(c.label), category: text(a.category ?? c.label), param: a.param ?? null });
        }
      });
    }
    return out.filter(c => c.label);
  },
  async category(category, param, page = 1) {
    const s = venera.source.categoryComics;
    if (!s?.load) throw new Error('这个源没有分类页');
    const options = searchOptionsOf(s.optionList).map(o => o.default);
    const result = await s.load(category, param ?? null, options, page);
    return { comics: comicsOf(result?.comics), maxPage: Number(result?.maxPage) || 0 };
  },
  async info(id) { return detailsOf(await venera.source.comic.loadInfo(id)); },
  async ep(comicId, epId) {
    const result = await venera.source.comic.loadEp(comicId, epId ?? null);
    return { images: (result?.images || []).map(text).filter(Boolean) };
  },
  async image(url, comicId, epId) { return imageRequestOf(url, await venera.source.comic?.onImageLoad?.(url, comicId, epId ?? null)); },
  async thumb(url) { return imageRequestOf(url, await venera.source.comic?.onThumbnailLoad?.(url)); },
  async imageResponse(hook, buffer) {
    const fn = imageHooks.get(hook);
    if (!fn) throw new Error('图片回调已过期');
    return bufferOf(bytesOf(await fn(buffer)));
  },
  async setSetting(key, value) {
    data.settings = { ...(data.settings || {}), [key]: value };
    persist('settings');
    return settingsOf();
  },
  async callback(key) { await venera.source.settings?.[key]?.callback?.(); return settingsOf(); },
};

function messageOf(error) {
  if (error == null) return '出错了';
  if (typeof error === 'string') return error;
  return String(error.message || error);
}

async function boot({ runtime, code, className, data: saved, env: e }) {
  const unsafeBridge = globalThis.androidBridge ? '安卓的原生桥' : globalThis.webkit?.messageHandlers && e?.bridgeGuard !== 'main-frame' ? 'iOS 的原生桥' : '';
  if (unsafeBridge) throw new Error(`这台设备上${unsafeBridge}对子页面开放，不能安全运行漫画源`);
  data = saved && typeof saved === 'object' ? saved : {};
  env = e || {};
  globalThis.appVersion = APP_VERSION;
  if (!/^[A-Za-z_$][\w$]*$/.test(className)) throw new Error('源脚本里找不到 ComicSource 类');
  // _venera_.js 和源脚本一起求值：两边的 class / let 才在同一个作用域里（分开 eval 各管各的，源找不到 ComicSource）
  (0, eval)(`${runtime}\n;\n${code}\n;\nglobalThis.__venera = { source: new ${className}(), run: (code) => eval(code) };\n//# sourceURL=comic-source.js`);
  venera = globalThis.__venera;
  delete globalThis.__venera;
  // 设置的默认值在 init 之前定下（同 Venera：源在运行时改 this.settings 不影响 loadSetting）
  schema = Object.fromEntries(entriesOf(venera.source.settings).map(([k, s]) => [k, s && typeof s === 'object' ? s.default : undefined]));
  await venera.source.init?.();
  return meta();
}

port.listen(async (m) => {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'reply') {
    const w = waiting.get(m.id);
    if (!w) return;
    waiting.delete(m.id);
    m.error ? w.reject(new Error(m.error)) : w.resolve(m.value);
    return;
  }
  if (m.t === 'boot') {
    try { port.post({ t: 'ready', meta: await boot(m) }); }
    catch (error) { port.post({ t: 'ready', error: messageOf(error) }); }
    return;
  }
  if (m.t === 'call') {
    try {
      if (!venera) throw new Error('源还没装载');
      const fn = calls[m.fn];
      if (!fn) throw new Error(`没有这个调用：${m.fn}`);
      const value = await fn(...(m.args || []));
      port.post({ t: 'result', id: m.id, value }, isBuffer(value) ? [value] : undefined);
    } catch (error) { port.post({ t: 'result', id: m.id, error: messageOf(error) }); }
  }
});
port.post({ t: 'hello' });
