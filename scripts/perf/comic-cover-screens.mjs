// 漫画封面实测（看用户真正感受到的）：正式界面跑在浏览器里，假装是 iPhone 客户端（Capacitor iOS），原生 HTTP 由 Node 代发。
// 先 npx vite build --outDir <目录> 再 npx vite preview --outDir <目录> --port 5194，然后：
//   CPU=4 node scripts/perf/comic-cover-screens.mjs <标签> [端口 5194]      （CPU=4：手机口径，降速 4 倍）
// 记录：冷启动（新的浏览器配置，本机没有封面缓存）首屏的封面多久全部出来；然后往下翻书墙 6 屏，每屏封面多久全部出来。
// 结果在 release/covers/<标签>.json。网络抖得厉害，A/B 要交替跑、每组 3 轮。2026-10-25：改前每屏 0.7–2.6 秒，提前取以后 18 屏里 8 屏不到 0.1 秒
import { createRequire } from 'node:module';
import http from 'node:http'; import https from 'node:https'; import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs'; import { fileURLToPath } from 'node:url';
const require = createRequire('C:/Users/ys221/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const [label = 'run', port = '5194'] = process.argv.slice(2);
const OUT = new URL('../../release/covers/', import.meta.url); mkdirSync(OUT, { recursive: true });

const reqLog = [];
async function request(options, hops = 0) {
  if (hops > 5) throw Error('Redirect loop');
  const u = new URL(options.url);
  if (!['http:', 'https:'].includes(u.protocol)) throw Error('Unsupported protocol');
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const req = (u.protocol === 'https:' ? https : http).request(u, { method: options.method || 'GET', headers: { 'Accept-Encoding': 'gzip, deflate, br', ...options.headers }, timeout: 20000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); resolve(request({ ...options, url: new URL(res.headers.location, u).href }, hops + 1)); return; }
      const chunks = []; res.on('error', reject); res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let body = Buffer.concat(chunks);
        try { const e = res.headers['content-encoding']; if (e === 'gzip') body = zlib.gunzipSync(body); if (e === 'br') body = zlib.brotliDecompressSync(body); if (e === 'deflate') body = zlib.inflateSync(body); } catch {}
        const type = res.headers['content-type'] || '';
        reqLog.push({ at: t0, ms: Date.now() - t0, host: u.host, status: res.statusCode, bytes: body.length, image: /^image\//.test(type) });
        let data = body.toString('base64');
        if (/application\/(?:[\w.-]+\+)?json/i.test(type)) { try { data = JSON.parse(body.toString()); } catch { data = body.toString(); } }
        resolve({ status: res.statusCode, headers: res.headers, data, url: options.url });
      });
    });
    req.on('error', e => { reqLog.push({ at: t0, ms: Date.now() - t0, host: u.host, status: 'ERR ' + e.message }); reject(e); });
    req.on('timeout', () => req.destroy(Error('Request timeout')));
    if (options.data != null) req.write(typeof options.data === 'string' ? options.data : JSON.stringify(options.data));
    req.end();
  });
}

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148' });
await context.exposeBinding('__acceptHTTP', async (source, options) => request(options));
await context.addInitScript(() => {
  if (self !== top) return;
  sessionStorage.setItem('librarium.splash', '1');
  window.__EBOOK_BRIDGE_GUARD__ = 'main-frame';
  const names = { CapacitorHttp: ['request'], EbookNative: ['ready', 'setBars', 'setImmersive', 'consumeFile', 'addListener', 'removeListener', 'haptic', 'prepareHaptics', 'getAccessibility', 'setBackground'], App: ['addListener', 'removeListener', 'getState'] };
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', platform: 'ios',
    PluginHeaders: Object.entries(names).map(([name, methods]) => ({ name, methods: methods.map(name => ({ name, rtype: name === 'addListener' ? 'callback' : 'promise' })) })),
    nativePromise: async (plugin, method, options) => plugin === 'CapacitorHttp' ? window.__acceptHTTP(options) : {}, nativeCallback: () => 'test-listener' };
  // 每块封面：第一次出现、变成真封面的时间
  window.__cov = new Map();
  const T0 = performance.now();
  const area = (el) => el.closest('.ws-collage') ? 'collage' : el.closest('.disc-face') ? 'disc' : el.closest('.mw-tile') ? 'wall' : el.closest('.cx-recent') ? 'recent' : 'other';
  const scan = () => {
    for (const el of document.querySelectorAll('.cover')) {
      let r = window.__cov.get(el);
      if (!r) { r = { area: area(el), seen: performance.now() - T0, real: null, title: el.closest('[aria-label]')?.getAttribute('aria-label') || '' }; window.__cov.set(el, r); }
      if (r.real == null && el.classList.contains('is-real')) r.real = performance.now() - T0;
    }
  };
  new MutationObserver(scan).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  window.__covReport = () => [...window.__cov.entries()].filter(([el]) => el.isConnected).map(([, r]) => r);
});
const page = await context.newPage();
const errors = []; page.on('pageerror', e => errors.push(String(e)));
// 手机口径：CPU 降速 4 倍（项目里测手机流畅度一直这么量）。沙箱 iframe 要另外降，所以对每个新开的 frame 也设上
const cdp = await context.newCDPSession(page);
if (process.env.CPU) await cdp.send('Emulation.setCPUThrottlingRate', { rate: +process.env.CPU });

const report = { label, at: new Date().toISOString() };
// 屏幕上（视口里）的封面有几张是真的
const onScreen = () => page.evaluate(() => {
  const H = innerHeight, W = innerWidth;
  const els = [...document.querySelectorAll('.route.is-active .cover')].filter(el => {
    if (el.closest('.ws-collage') && !el.closest('.ws')?.querySelector('.ws-cap.on')) return false;   // 没进世界时拼贴被裁掉、看不见
    const r = el.getBoundingClientRect(); return r.width > 20 && r.bottom > 40 && r.top < H - 90 && r.right > 0 && r.left < W;
  });
  return { n: els.length, real: els.filter(el => el.classList.contains('is-real')).length };
});
// 等这一屏的封面：每 200ms 看一次，记全部出来用了多久（最多 limit 毫秒）
async function screenFill(limit) {
  const t0 = Date.now(); let s;
  while (true) {
    s = await onScreen();
    if (s.n && s.real === s.n) return { ms: Date.now() - t0, ...s };
    if (Date.now() - t0 > limit) return { ms: null, ...s };
    await page.waitForTimeout(200);
  }
}
const t = Date.now();
await page.goto(`http://127.0.0.1:${port}/#/explore?kind=comic`);
await page.waitForFunction(() => document.querySelector('.route.is-active .discshelf .disc'), null, { timeout: 90000 }).catch(() => {});
report.discShownMs = Date.now() - t;
report.first = await screenFill(20000);
await page.screenshot({ path: fileURLToPath(new URL(`${label}-top.png`, OUT)) });
// 往下翻书墙：每次一屏，像人看完这一屏再往下
await page.evaluate(() => document.querySelector('.route.is-active .mw')?.scrollIntoView({ block: 'start' }));
report.screens = [];
for (let k = 0; k < 6; k++) {
  if (k) await page.evaluate(() => scrollBy(0, innerHeight - 160));
  report.screens.push(await screenFill(10000));
  await page.waitForTimeout(800);
}
await page.screenshot({ path: fileURLToPath(new URL(`${label}-wall.png`, OUT)) });
const imgs = reqLog.filter(r => r.image);
const hosts = {};
for (const r of reqLog) { const h = hosts[r.host] ||= { n: 0, img: 0, ms: [] }; h.n++; if (r.image) h.img++; h.ms.push(r.ms); }
for (const h of Object.values(hosts)) { h.ms.sort((a, b) => a - b); h.median = h.ms[h.ms.length >> 1]; h.max = h.ms[h.ms.length - 1]; delete h.ms; }
report.requests = { total: reqLog.length, images: imgs.length, failed: reqLog.filter(r => typeof r.status !== 'number' || r.status >= 400).length, hosts };
report.errors = errors.slice(0, 5);
const origin = await page.evaluate(() => performance.timeOrigin);
report.reqs = reqLog.map(r => ({ ...r, at: Math.round(r.at - origin) }));
writeFileSync(new URL(`${label}.json`, OUT), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
await browser.close();
