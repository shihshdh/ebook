// 漫画源沙箱回归测试。
//   node scripts/comic-test.mjs              用假源（fixtures/comic/fixture-source.js）把沙箱的宿主接口逐项过一遍，网络回固定内容
//   node scripts/comic-test.mjs --live       另外拉真实的 Venera 源，走一遍 搜索 → 详情 → 第一章 → 第一张图
//   node scripts/comic-test.mjs --live --all 白名单里的源全部测（默认只测拷贝、包子、MangaDex）
//
// 沙箱代码（src/comic/runtime/sandbox.js）照 vite.config.js 的 inline-script 一样用 esbuild 打包，放进 vm 里跑；
// DOMParser 用 linkedom。主页面那一侧（host.js 的 http）在这里照着写了一份：Node 里没有 iframe。
// _venera_.js 没有许可证，不放进仓库：第一次跑时按固定提交下载，缓存到系统临时目录。
import assert from 'node:assert/strict';
import vm from 'node:vm';
import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
import { DOMParser } from 'linkedom';
import { decodeBytes, declaredCharset } from '../src/lib/charset.js';
import { comicSkipReason, checkUrl, isPrivateHost } from '../src/comic/policy.js';
import { registerHooks } from 'node:module';

// nativeRequest 的 raw 模式要按三个平台测：只在测试里把原生插件换成假的（同 legado-test.mjs）
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@tauri-apps/plugin-http') return { url: 'data:text/javascript,export const fetch=(...a)=>globalThis.__comicNativeMock(...a)', shortCircuit: true };
  if (specifier === '@capacitor/core') return { url: 'data:text/javascript,export const CapacitorHttp={request:(...a)=>globalThis.__comicNativeMock(...a)}', shortCircuit: true };
  return next(specifier, context);
} });

const args = new Set(process.argv.slice(2));
const VENERA = { owner: 'venera-app', repo: 'venera-configs', commit: 'e28e134074308c0006408272639a53b9af9ce9da' };
const here = (p) => new URL(p, import.meta.url);

// ---------- 取文件：jsDelivr 优先，raw 兜底 ----------
async function download(owner, repo, ref, path) {
  const urls = [`https://fastly.jsdelivr.net/gh/${owner}/${repo}@${ref}/${path}`, `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`];
  let last;
  for (const url of urls) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(20000) }); if (r.ok) return await r.text(); last = new Error(`HTTP ${r.status} ${url}`); }
    catch (e) { last = e; }
  }
  throw last;
}
async function veneraRuntime() {
  const dir = join(tmpdir(), 'ebook-comic-test'), file = join(dir, `_venera_.${VENERA.commit.slice(0, 8)}.js`);
  try { return await readFile(file, 'utf8'); } catch {}
  const code = await download(VENERA.owner, VENERA.repo, VENERA.commit, '_venera_.js');
  await mkdir(dir, { recursive: true });
  await writeFile(file, code);
  return code;
}

// ---------- 沙箱：和 vite 插件一样打包，放进 vm ----------
const sandboxCode = (await build({ entryPoints: [fileURLToPath(here('../src/comic/runtime/sandbox.js'))], bundle: true, minify: true,
  format: 'iife', target: ['es2020', 'safari15'], legalComments: 'none', write: false })).outputFiles[0].text;

/**
 * 开一个沙箱。fetcher(req) → { status, url, headers, bytes }（相当于 nativeRequest raw）
 * 返回 { meta, call(fn, ...args), http(req), sent: 收到的请求, saved: 存档消息, logs }
 */
async function openSandbox({ code, runtime, data = {}, fetcher, globals = {}, env = {} }) {
  const className = /\bclass\s+([A-Za-z_$][\w$]*)\s+extends\s+ComicSource\b/.exec(code)[1];
  const sent = [], saved = [], logs = [], waiting = new Map();
  let deliver, seq = 0;
  const hostHttp = async (req) => {
    const url = checkUrl(req.url);
    sent.push({ ...req, url });
    const res = await fetcher({ ...req, url });
    if (req.bytes) return { status: res.status, headers: res.headers, body: res.bytes.buffer.slice(res.bytes.byteOffset, res.bytes.byteOffset + res.bytes.byteLength) };
    const type = /charset\s*=\s*["']?([^\s;"']+)/i.exec(res.headers['content-type'] || '')?.[1];
    return { status: res.status, headers: res.headers, body: decodeBytes(res.bytes, [type, declaredCharset(res.bytes)]) };
  };
  let ready;
  const readyP = new Promise((resolve, reject) => { ready = { resolve, reject }; });
  const onMessage = (m) => {
    switch (m.t) {
      case 'hello': deliver({ t: 'boot', runtime, code, className, data, env: { platform: 'windows', ...env } }); break;
      case 'ready': m.error ? ready.reject(new Error(m.error)) : ready.resolve(m.meta); break;
      case 'result': { const w = waiting.get(m.id); waiting.delete(m.id); m.error ? w.reject(new Error(m.error)) : w.resolve(m.value); break; }
      case 'http': hostHttp(m.req).then(value => deliver({ t: 'reply', id: m.id, value }), e => deliver({ t: 'reply', id: m.id, value: { status: null, headers: {}, body: null, error: e.message } })); break;
      case 'data': saved.push([m.key, m.value]); break;
      case 'log': logs.push(`${m.level} ${m.title}: ${m.content}`); break;
    }
  };
  const context = vm.createContext({
    DOMParser, TextEncoder, TextDecoder, URL, URLSearchParams, atob, btoa, structuredClone, crypto: globalThis.crypto, console,
    setTimeout, clearTimeout, ...globals,
    __comicPort: { post: (m) => queueMicrotask(() => onMessage(structuredClone(m))), listen: (fn) => { deliver = (m) => queueMicrotask(() => fn(structuredClone(m))); } },
  });
  vm.runInContext(sandboxCode, context, { filename: 'sandbox.js' });
  const meta = await readyP;
  const call = (fn, ...a) => new Promise((resolve, reject) => {
    const id = ++seq;
    waiting.set(id, { resolve, reject });
    deliver({ t: 'call', id, fn, args: a });
  });
  return { meta, call, http: hostHttp, sent, saved, logs, evaluate: (code) => vm.runInContext(code, context) };
}

const tests = [];
const test = (name, run) => tests.push({ name, run });
const runtime = await veneraRuntime();

// ---------- 假源 ----------
const enc = (s) => new TextEncoder().encode(s);
const AES_KEY = '0123456789abcdef', AES_IV = 'fedcba9876543210';
function aesPayload(obj) {
  const plain = enc(JSON.stringify(obj)), pad = 16 - (plain.length % 16);
  const padded = Buffer.concat([plain, Buffer.alloc(pad, pad)]);
  const c = crypto.createCipheriv('aes-128-cbc', AES_KEY, AES_IV); c.setAutoPadding(false);
  return Buffer.concat([c.update(padded), c.final()]).toString('base64');
}
const IMAGE = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60, 7)]);
function FIXTURE_HTTP(req) {
  const u = new URL(req.url), json = (o) => ({ status: 200, url: req.url, headers: { 'content-type': 'application/json' }, bytes: enc(JSON.stringify(o)) });
  if (u.pathname === '/search') {
    // GBK 编码的网页，响应头不写编码：靠 <meta charset> 和内容判断
    const page = `<html><head><meta charset="gbk"></head><body><ul>
      <li class="item" data-id="c1"><span class="title"> 葬送的芙莉莲 </span><span class="author">山田钟人</span><img src="/c1.jpg"><i class="tag">奇幻</i><i class="tag">冒险</i></li>
      <li class="item" data-id="c2"><span class="title">迷宫饭</span><img src="/c2.jpg"></li></ul></body></html>`;
    return { status: 200, url: req.url, headers: { 'content-type': 'text/html' }, bytes: iconvGbk(page) };
  }
  if (u.pathname === '/info') return json({ title: '葬送的芙莉莲', author: '山田钟人', cover: 'https://a.test/c1.jpg', intro: '勇者一行打倒魔王之后', tags: ['奇幻', '冒险'],
    groups: [{ name: '默认', chapters: [{ id: 'e1', title: '第1话' }, { id: 'e2', title: '第2话' }] }, { name: '番外', chapters: [{ id: 's1', title: '番外1' }] }] });
  if (u.pathname.startsWith('/ep/')) return json({ key: AES_KEY, iv: AES_IV, payload: aesPayload(['/p/1.jpg', '/p/2.jpg']) });
  if (u.pathname.startsWith('/p/')) return { status: 200, url: req.url, headers: { 'content-type': 'image/jpeg' }, bytes: new Uint8Array(IMAGE.map(b => b ^ 0x5a)) };
  return { status: 404, url: req.url, headers: {}, bytes: enc('not found') };
}
// GBK 编码（Node 的 TextDecoder 能解 GBK 但不能编：借浏览器同款的反查做法，测试里只用到少数几个字）
function iconvGbk(text) {
  const out = [];
  const decoder = new TextDecoder('gbk');
  const cache = new Map();
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code < 0x80) { out.push(code); continue; }
    if (!cache.size) for (let hi = 0x81; hi <= 0xfe; hi++) for (let lo = 0x40; lo <= 0xfe; lo++) { if (lo === 0x7f) continue; const s = decoder.decode(Uint8Array.of(hi, lo)); if (s.length === 1 && !cache.has(s)) cache.set(s, [hi, lo]); }
    out.push(...(cache.get(ch) || [0x3f]));
  }
  return Uint8Array.from(out);
}

const fixtureCode = await readFile(here('./fixtures/comic/fixture-source.js'), 'utf8');
const fixture = (data) => openSandbox({ code: fixtureCode, runtime, data, fetcher: FIXTURE_HTTP });

test('装载：元信息、搜索选项默认值、设置快照', async () => {
  const box = await fixture({ visits: 2 });
  assert.equal(box.meta.name, '测试源');
  assert.equal(box.meta.search, true);
  assert.deepEqual(box.meta.searchOptions.map(o => o.default), ['hot', '["b"]']);
  assert.deepEqual(box.meta.searchOptions[0].options, [{ value: 'hot', label: '最热' }, { value: 'new', label: '最新' }]);
  const quality = box.meta.settings.find(s => s.key === 'quality');
  assert.equal(quality.value, 'high', 'init 里改 this.settings 不影响设置值（同 Venera）');
  assert.deepEqual(box.saved.find(([k]) => k === 'visits'), ['visits', 3], 'save_data 回写给主页面');
});

test('搜索：HTML 解析（GBK 网页）、cookie、浏览器 UA（首字母大写）', async () => {
  const box = await fixture();
  const r = await box.call('search', '芙莉莲', ['new', '[]'], 2, null);
  assert.equal(r.maxPage, 3);
  assert.deepEqual(r.comics.map(c => [c.id, c.title, c.subtitle]), [['c1', '葬送的芙莉莲', '山田钟人'], ['c2', '迷宫饭', '']]);
  assert.deepEqual(r.comics[0].tags, ['奇幻', '冒险']);
  assert.match(r.comics[0].description, /^5 children; next=li$/);
  const req = box.sent[0];
  assert.equal(req.url, 'https://a.test/search?q=%E8%8A%99%E8%8E%89%E8%8E%B2&sort=new&page=2');
  assert.match(req.headers['User-Agent'], /Chrome/, '默认 UA 用首字母大写的 User-Agent');
  assert.equal(req.headers.Cookie, 'sid=abc');
});

test('详情：表单请求体、分组章节、标签', async () => {
  const box = await fixture();
  const d = await box.call('info', 'c1');
  assert.equal(box.sent[0].method, 'POST');
  assert.equal(box.sent[0].body, 'id=c1&n=1');
  assert.equal(d.title, '葬送的芙莉莲');
  assert.equal(d.subtitle, '山田钟人');
  assert.deepEqual(d.chapters, [{ id: 'e1', title: '第1话', group: '默认' }, { id: 'e2', title: '第2话', group: '默认' }, { id: 's1', title: '番外1', group: '番外' }]);
  assert.deepEqual(d.tags, [['作者', ['山田钟人']], ['题材', ['奇幻', '冒险']]]);
  assert.equal(d.single, false);
  assert.equal(d.recommend[0].title, '推荐');
});

test('章节：hmac 签名、AES-CBC 不去填充、源自己的 UA、设置改了立即生效', async () => {
  const box = await fixture();
  await box.call('setSetting', 'quality', 'low');
  const { images } = await box.call('ep', 'c1', 'e1');
  assert.deepEqual(images, ['https://a.test/p/1.jpg?q=low', 'https://a.test/p/2.jpg?q=low']);
  const sig = crypto.createHmac('sha256', 'secret').update('c1:e1:1700000000').digest('hex');
  assert.equal(new URL(box.sent[0].url).searchParams.get('sig'), sig);
  assert.equal(box.sent[0].headers['user-agent'], 'FixtureUA/1.0');
  assert.equal(box.sent[0].headers['User-Agent'], undefined, '源写了 UA 就不再加默认的');
  assert.deepEqual(box.saved.at(-1), ['settings', { quality: 'low' }]);
});

test('图片：onImageLoad 的请求头、onResponse 解密', async () => {
  const box = await fixture();
  const req = await box.call('image', 'https://a.test/p/1.jpg', 'c1', 'e1');
  assert.equal(req.headers.Referer, 'https://a.test/ep/c1/e1');
  assert.equal(req.method, 'GET');
  assert.equal(typeof req.onResponse, 'number');
  const res = await box.http({ ...req, bytes: true });
  const plain = new Uint8Array(await box.call('imageResponse', req.onResponse, res.body));
  assert.deepEqual([...plain.slice(0, 4)], [0xff, 0xd8, 0xff, 0xe0]);
  const thumb = await box.call('thumb', 'https://a.test/c1.jpg');
  assert.equal(thumb.headers.Referer, 'https://a.test/');
  assert.equal(thumb.onResponse, null);
});

test('设置：换域名、回调按钮', async () => {
  const box = await fixture({ visits: 5 });
  await box.call('setSetting', 'domain', 'b.test');
  await box.call('search', 'x', ['hot', '[]'], 1, null);
  assert.equal(new URL(box.sent[0].url).host, 'b.test');
  await box.call('callback', 'reset');
  assert.deepEqual(box.saved.at(-1), ['visits', undefined]);
});

test('Convert 和 Node 的 crypto 对得上', async () => {
  // 直接调沙箱的 sendMessage（Venera 的 Convert.* 只是它外面薄薄一层）
  const box = await fixture();
  const hex = (b) => Buffer.from(b).toString('hex');
  const key = crypto.randomBytes(16), iv = crypto.randomBytes(16), block = crypto.randomBytes(32);
  const ecb = crypto.createCipheriv('aes-128-ecb', key, null).setAutoPadding(false);
  const cbc = crypto.createCipheriv('aes-128-cbc', key, iv).setAutoPadding(false);
  const expected = {
    md5: crypto.createHash('md5').update('漫画').digest('hex'),
    sha1: crypto.createHash('sha1').update('漫画').digest('hex'),
    sha256: crypto.createHash('sha256').update('漫画').digest('hex'),
    sha512: crypto.createHash('sha512').update('漫画').digest('hex'),
    hmac: crypto.createHmac('md5', 'k').update('v').digest('hex'),
    hmacBytes: crypto.createHmac('sha512', 'k').update('v').digest('hex'),
    b64: Buffer.from('漫画').toString('base64'),
    ecb: hex(Buffer.concat([ecb.update(block), ecb.final()])),
    cbc: hex(Buffer.concat([cbc.update(block), cbc.final()])),
    ecbBack: hex(block), cbcBack: hex(block),
    gbk: 'c2febbad61', gbkBack: '漫画a', b64url: '漫画', bad: 'null', rsa: 'null',
  };
  const out = box.evaluate(`((k, iv, block) => {
    const c = (m) => sendMessage({ method: 'convert', ...m });
    const hex = (b) => b == null ? 'null' : Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
    const bytes = (h) => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16))).buffer;
    const u = (s) => c({ type: 'utf8', value: s, isEncode: true });
    const ecb = c({ type: 'aes-ecb', value: bytes(block), key: bytes(k), isEncode: true });
    const cbc = c({ type: 'aes-cbc', value: bytes(block), key: bytes(k), iv: bytes(iv), isEncode: true });
    return {
      md5: hex(c({ type: 'md5', value: u('漫画') })), sha1: hex(c({ type: 'sha1', value: u('漫画') })),
      sha256: hex(c({ type: 'sha256', value: u('漫画') })), sha512: hex(c({ type: 'sha512', value: u('漫画') })),
      hmac: c({ type: 'hmac', value: u('v'), key: u('k'), hash: 'md5', isEncode: true, isString: true }),
      hmacBytes: hex(c({ type: 'hmac', value: u('v'), key: u('k'), hash: 'sha512', isEncode: true })),
      b64: c({ type: 'base64', value: u('漫画'), isEncode: true }),
      ecb: hex(ecb), cbc: hex(cbc),
      ecbBack: hex(c({ type: 'aes-ecb', value: ecb, key: bytes(k), isEncode: false })),
      cbcBack: hex(c({ type: 'aes-cbc', value: cbc, key: bytes(k), iv: bytes(iv), isEncode: false })),
      gbk: hex(c({ type: 'gbk', value: '漫画a', isEncode: true })),
      gbkBack: c({ type: 'gbk', value: c({ type: 'gbk', value: '漫画a', isEncode: true }), isEncode: false }),
      b64url: c({ type: 'utf8', value: c({ type: 'base64', value: '5ryr55S7', isEncode: false }), isEncode: false }),
      bad: hex(c({ type: 'aes-cbc', value: new Uint8Array(5).buffer, key: bytes(k), iv: bytes(iv), isEncode: false })),
      rsa: hex(c({ type: 'rsa', value: new Uint8Array(16).buffer, key: 'x', isEncode: false })),
    };
  })(${JSON.stringify(hex(key))}, ${JSON.stringify(hex(iv))}, ${JSON.stringify(hex(block))})`);
  assert.deepEqual({ ...out }, expected);
  await new Promise(resolve => setTimeout(resolve, 0));   // 日志消息是异步发出来的
  assert.ok(box.logs.some(l => /RSA/.test(l)), '不支持的转换记日志');
});

test('iPhone：仅主页面传来的 main-frame guard 放行，安卓仍拒绝', async () => {
  const globals = { webkit: { messageHandlers: { bridge: {} } } };
  await openSandbox({ code: fixtureCode, runtime, fetcher: FIXTURE_HTTP, globals, env: { bridgeGuard: 'main-frame' } });
  await assert.rejects(openSandbox({ code: fixtureCode, runtime, fetcher: FIXTURE_HTTP, globals }), /不能安全运行漫画源/);
  await assert.rejects(openSandbox({ code: fixtureCode, runtime, fetcher: FIXTURE_HTTP, globals: { ...globals, androidBridge: {} }, env: { bridgeGuard: 'main-frame' } }), /不能安全运行漫画源/);
});

test('原生桥：Tauri 的删掉，iOS / 旧安卓的拒绝运行', async () => {
  const box = await openSandbox({ code: fixtureCode, runtime, fetcher: FIXTURE_HTTP,
    globals: { __TAURI_INTERNALS__: { invoke() {} }, ipc: { postMessage() {} }, chrome: { webview: { postMessage() {} } } } });
  assert.equal(box.evaluate('typeof __TAURI_INTERNALS__ + typeof ipc + typeof chrome.webview'), 'undefinedundefinedundefined');
  for (const globals of [{ webkit: { messageHandlers: { bridge: {} } } }, { androidBridge: { postMessage() {} } }])
    await assert.rejects(openSandbox({ code: fixtureCode, runtime, fetcher: FIXTURE_HTTP, globals }), /不能安全运行漫画源/);
});

test('nativeRequest raw：三个平台都给原始字节和小写的响应头', async () => {
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0x80, 0xfe]);
  for (const platform of ['web', 'tauri', 'capacitor']) {
    globalThis.window = platform === 'tauri' ? { __TAURI_INTERNALS__: {} } : platform === 'capacitor' ? { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } } : {};
    const { nativeRequest } = await import(`../src/lib/native.js?comic=${platform}`);
    delete globalThis.window;
    // Capacitor 回大小写不定的普通对象、二进制给 base64；Tauri / 浏览器回 Headers 和 arrayBuffer
    const reply = platform === 'capacitor'
      ? { status: 200, url: 'https://img.test/1.jpg', headers: { 'Content-Type': 'image/jpeg', 'CF-Mitigated': 'challenge' }, data: Buffer.from(bytes).toString('base64') }
      : { status: 200, url: 'https://img.test/1.jpg', headers: new Headers({ 'Content-Type': 'image/jpeg', 'CF-Mitigated': 'challenge' }), arrayBuffer: async () => bytes.buffer.slice(0) };
    let seen;
    const mock = async (...a) => { seen = a; return reply; };
    const realFetch = globalThis.fetch;
    globalThis.__comicNativeMock = mock;
    if (platform === 'web') globalThis.fetch = mock;
    try {
      const r = await nativeRequest({ url: 'https://img.test/1.jpg', headers: { Referer: 'https://a.test/' }, raw: true });
      assert.deepEqual([...r.bytes], [...bytes], platform);
      assert.equal(r.status, 200);
      assert.equal(r.headers['content-type'], 'image/jpeg', platform);
      assert.equal(r.headers['cf-mitigated'], 'challenge', platform);
      assert.equal((platform === 'capacitor' ? seen[0] : seen[1]).headers.Referer, 'https://a.test/', platform);
    } finally { globalThis.fetch = realFetch; }
  }
});

test('网址检查：本机和局域网不许', () => {
  for (const host of ['localhost', 'a.localhost', 'nas.local', '127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.1.1', '[::1]', '[fd00::1]', '0.0.0.0'])
    assert.ok(isPrivateHost(new URL(`http://${host}/`).hostname), host);
  for (const host of ['example.com', '8.8.8.8', '172.32.0.1', '[2001:db8::1]']) assert.ok(!isPrivateHost(new URL(`http://${host}/`).hostname), host);
  assert.throws(() => checkUrl('http://2130706433/'), /局域网/);
  assert.throws(() => checkUrl('file:///etc/passwd'), /http/);
  assert.equal(checkUrl('http://192.168.1.2:25600/api', { allowPrivate: true }), 'http://192.168.1.2:25600/api');
});

test('白名单：成人站、没审过的不收', () => {
  for (const key of ['copy_manga', 'baozi', 'manga_dex', 'ManHuaGui', 'komga']) assert.equal(comicSkipReason({ key, name: key }), '', key);
  for (const [key, name] of [['jm', '禁漫天堂'], ['wnacg', '紳士漫畫'], ['hitomi', 'hitomi.la'], ['picacg', 'Picacg'], ['mh18', '18漫画'], ['hcomic', 'H-Comic'], ['mxs', '漫小肆'], ['new_site', '新站']])
    assert.notEqual(comicSkipReason({ key, name }), '', key);
});

// ---------- 真实源（--live）----------
// Node 的 https：请求头大小写原样发出（undici 的 fetch 会全转小写，被 Cloudflare 当机器人），自己跟跳转、解压
function nodeRequest({ url, method = 'GET', headers = {}, body }, hops = 0) {
  return new Promise((resolve, reject) => {
    const u = new URL(url), lib = u.protocol === 'http:' ? http : https;
    const h = { ...headers };
    if (!Object.keys(h).some(k => k.toLowerCase() === 'accept-encoding')) h['Accept-Encoding'] = 'gzip, deflate, br';
    const req = lib.request(u, { method, headers: h, timeout: 25000 }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && hops < 6) {
        res.resume();
        const next = new URL(res.headers.location, u).href;
        return resolve(nodeRequest({ url: next, method: res.statusCode === 303 ? 'GET' : method, headers, body: res.statusCode === 303 ? undefined : body }, hops + 1));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let buf = Buffer.concat(chunks);
        try {
          const ce = res.headers['content-encoding'];
          if (ce === 'gzip') buf = zlib.gunzipSync(buf); else if (ce === 'br') buf = zlib.brotliDecompressSync(buf); else if (ce === 'deflate') buf = zlib.inflateSync(buf);
        } catch {}
        const headers = Object.fromEntries(Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v)]));
        resolve({ status: res.statusCode, url, headers, bytes: new Uint8Array(buf) });
      });
    });
    req.on('timeout', () => req.destroy(new Error('超时')));
    req.on('error', reject);
    if (body != null) req.write(typeof body === 'string' ? body : Buffer.from(body));
    req.end();
  });
}
const KEYWORDS = { manga_dex: ['Frieren', 'Dungeon Meshi'], comick: ['One Piece'], comic_walker: ['異世界'], shonen_jump_plus: ['怪獣'], Komiic: ['航海王', '鬼滅之刃'], mycomic: ['航海王', '鬼滅之刃'], ccc: ['愛', '王'] };
const IMAGE_MAGIC = (b) => (b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b[1] === 0x50) || String.fromCharCode(...b.subarray(8, 12)) === 'WEBP' || String.fromCharCode(...b.subarray(0, 3)) === 'GIF' || String.fromCharCode(...b.subarray(4, 8)) === 'ftyp';

// --only=baozi,copy_manga 只测这几个；--set=baozi.domains=webmota.com 改某个源的设置；--verbose 失败时打印请求和源的日志
// --bundled 测随包附带的那份（src/comic/default-sources.js：脚本去过空白、带默认设置），不从 GitHub 拉
const option = (name) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
async function live() {
  const bundled = args.has('--bundled') ? (await import('../src/comic/default-sources.js')).default : null;
  const index = bundled ? bundled.sources : JSON.parse(await download(VENERA.owner, VENERA.repo, 'main', 'index.json'));
  const liveRuntime = bundled ? bundled.runtime : await download(VENERA.owner, VENERA.repo, 'main', '_venera_.js');
  const only = option('only')?.split(',');
  const sets = {};
  for (const s of bundled?.sources || []) if (s.settings) sets[s.key] = { ...s.settings };
  for (const a of process.argv.filter(x => x.startsWith('--set='))) { const [, key, setting, value] = /^--set=([^.]+)\.([^=]+)=(.*)$/.exec(a) || []; if (key) (sets[key] ||= {})[setting] = value; }
  const selfHosted = ['komga', 'kavita', 'lanraragi'];
  const wanted = index.filter(e => (bundled || e.fileName === `${e.key}.js`) && (only ? only.includes(e.key)
    : args.has('--all') ? !comicSkipReason(e) && !selfHosted.includes(e.key) : bundled ? e.enabled : ['copy_manga', 'baozi', 'manga_dex'].includes(e.key)));
  console.log(`\n真实源（${bundled ? `随包附带 @${bundled.commit.slice(0, 8)}` : 'venera-configs@main'}，${wanted.length} 个）：`);
  const rows = [];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let e; (e = wanted.shift());) {
      const t0 = Date.now(), row = { name: e.name, key: e.key };
      let stage = '装载', box;
      try {
        const code = e.code ?? await download(VENERA.owner, VENERA.repo, 'main', e.fileName);
        box = await openSandbox({ code, runtime: liveRuntime, fetcher: nodeRequest, data: sets[e.key] ? { settings: sets[e.key] } : {} });
        const options = box.meta.searchOptions.map(o => o.default);
        stage = '搜索';
        let comics = [];
        for (const k of KEYWORDS[e.key] || ['海贼王', '航海王', '鬼灭之刃']) { comics = (await box.call('search', k, options, 1, null)).comics; if (comics.length) break; }
        if (!comics.length) throw new Error('搜不到');
        row.search = comics.length;
        stage = '详情';
        // 第一本打不开（下架了）就换下一本，最多试三本
        let comic, d;
        for (const c of comics.slice(0, 3)) {
          try { d = await box.call('info', c.id); comic = c; if (d.chapters.length || d.single) break; } catch (err) { if (c === comics[Math.min(2, comics.length - 1)]) throw err; }
        }
        row.chapters = d.chapters.length || 1;
        stage = '章节';
        const ep = await box.call('ep', comic.id, d.chapters[0]?.id ?? null);
        row.images = ep.images.length;
        if (!ep.images.length) throw new Error('没有图片');
        stage = '图片';
        const req = await box.call('image', ep.images[0], comic.id, d.chapters[0]?.id ?? null);
        if (req.modifyImage) throw new Error('要重排图片');
        const img = await box.http({ ...req, bytes: true });
        let bytes = new Uint8Array(img.body);
        if (req.onResponse) bytes = new Uint8Array(await box.call('imageResponse', req.onResponse, img.body));
        if (img.status !== 200 || !IMAGE_MAGIC(bytes)) throw new Error(`HTTP ${img.status}，${IMAGE_MAGIC(bytes) ? '' : '不是图片'}`);
        row.image = `${(bytes.length / 1024).toFixed(0)}KB`;
        row.ok = true;
      } catch (err) {
        row.ok = false; row.why = `${stage}：${String(err?.message || err).slice(0, 70)}`;
        if (args.has('--verbose') && box) row.detail = [...box.sent.slice(-4).map(r => `    → ${r.method} ${r.url.slice(0, 140)}`), ...box.logs.slice(-6).map(l => `    · ${l.slice(0, 200)}`)].join('\n');
      }
      row.s = ((Date.now() - t0) / 1000).toFixed(1);
      rows.push(row);
    }
  }));
  for (const r of rows.sort((a, b) => a.key.localeCompare(b.key)))
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.name.padEnd(12)} ${r.ok ? `搜到 ${r.search}，${r.chapters} 话，第一话 ${r.images} 张，图 ${r.image}` : r.why}  (${r.s}s)${r.detail ? `\n${r.detail}` : ''}`);
  console.log(`  能用 ${rows.filter(r => r.ok).length} / ${rows.length}`);
}

// ---------- 跑 ----------
let failed = 0;
for (const t of tests) {
  try { await t.run(); console.log(`✓ ${t.name}`); }
  catch (error) { failed++; console.error(`✗ ${t.name}\n  ${error?.stack || error}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} 通过`);
if (args.has('--live')) await live();
process.exitCode = failed ? 1 : 0;

