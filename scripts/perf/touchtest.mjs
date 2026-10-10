// 手感测试：手机模拟（390×844、触屏），真触摸事件，打印每一项的结果（翻没翻页、关没关上、缩没缩）。
// 用法：node touchtest.mjs <scratch> <url> <标签> [项目,项目]   项目：reader disc sheet press（默认全跑）
//   标签区分浏览器配置目录（新旧版本各用一个）；reader 会往书架导入一本自动生成的三章测试书（<scratch>/touch/测试书.txt）
import { launch, openPage, sleep } from './cdp.mjs';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const [S, base, tag, only = 'reader,disc,sheet,press'] = process.argv.slice(2);
const want = new Set(only.split(','));
mkdirSync(`${S}/touch`, { recursive: true });
if (!existsSync(`${S}/touch/测试书.txt`)) {
  const seed = '夜风从河面上吹过来，带着一点潮湿的青草味。她把书合上，望着远处的灯火一盏一盏亮起来，像是有人在黑暗里轻轻地写字。那些字没有声音，却比任何话都要清楚。';
  let txt = '';
  [['一', '春水'], ['二', '夏至'], ['三', '秋分']].forEach(([n, t], i) => {
    txt += `第${n}章 ${t}\n\n`;
    for (let p = 0; p < 40; p++) txt += `　　${seed.repeat(2)}（第${i + 1}章第${p + 1}段）\n\n`;
  });
  writeFileSync(`${S}/touch/测试书.txt`, txt);
}
const br = await launch({ port: 9338, profile: `${S}/edge-touch-${tag}`, width: 520, height: 960 });
const log = (...a) => console.log(`[${tag}]`, ...a);
try {
  const p = await openPage(br.port);
  await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await p.send('Network.enable'); await p.send('Network.setBlockedURLs', { urls: ['*wsrv.nl*', '*i0.wp.com*', '*bgm.tv*', '*img.wenku8*'] });
  const T = (type, x, y) => p.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y }] });
  const drag = async (x0, y0, dx, dy, steps, ms, { hold = 0, end = 'touchEnd' } = {}) => {
    await T('touchStart', x0, y0);
    for (let i = 1; i <= steps; i++) { await sleep(ms); await T('touchMove', x0 + dx * i / steps, y0 + dy * i / steps); }
    if (hold) await sleep(hold);
    await T(end, 0, 0);
  };
  const shot = async (name) => { const { data } = await p.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${S}/touch/${tag}-${name}.png`, Buffer.from(data, 'base64')); };
  const ready = async (expr, n = 60) => { for (let i = 0; i < n; i++) { if (await p.eval(expr).catch(() => false)) return true; await sleep(250); } return false; };

  await p.send('Page.navigate', { url: base + '#/' });
  await ready(`!!document.querySelector('.discshelf .disc') && !document.querySelector('.splash')`, 120);
  await sleep(1500);

  if (want.has('disc')) {
    const active = `[...document.querySelectorAll('.disc')].find(b => b.getAttribute('aria-label')?.startsWith('打开 '))?.getAttribute('aria-label')`;
    await p.eval(`document.querySelector('.disc-stage').scrollIntoView({ block: 'center' })`); await sleep(600);
    const c = await p.eval(`(() => { const r = document.querySelector('.disc-stage').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const a0 = await p.eval(active);
    await drag(c.x + 40, c.y, -60, 0, 3, 16); await sleep(1200);
    const a1 = await p.eval(active);
    log('光盘 快甩 60px：', a0 === a1 ? '没换（弹回原来那张）' : '换了一张', '|', a0, '→', a1);
    await drag(c.x - 40, c.y, 60, 0, 12, 40, { hold: 150 }); await sleep(1200);
    const a2 = await p.eval(active);
    log('光盘 慢拖 60px 停住再松：', a2 === a1 ? '没换' : '换了', '|', a2);
  }

  if (want.has('sheet') || want.has('press')) {
    await p.eval(`[...document.querySelectorAll('a, button')].find(e => e.textContent.trim() === '探索' && e.offsetParent)?.click()`);
    await sleep(1500); await p.eval('scrollTo(0, 700)'); await sleep(800);
  }
  if (want.has('press')) {
    const c = await p.eval(`(() => { const el = [...document.querySelectorAll('.mw-tile')].find(e => { const r = e.getBoundingClientRect(); return r.top > 80 && r.bottom < innerHeight - 100; }); el.id = 'tt-tile'; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const sc = `getComputedStyle(document.getElementById('tt-tile')).scale`;
    await T('touchStart', c.x, c.y); await sleep(40);
    const s40 = await p.eval(sc); await sleep(200);
    const s240 = await p.eval(sc);
    await T('touchEnd'); await sleep(400);
    const sUp = await p.eval(sc);
    log('按下反馈 书卡：按住 40ms', s40, '｜240ms', s240, '｜抬手后', sUp);
    await sleep(800); await p.eval(`document.querySelector('.sheet-close')?.click()`); await sleep(900);
    // 一划就滚：不该压下去
    await T('touchStart', c.x, c.y); await sleep(16); await T('touchMove', c.x, c.y - 30); await sleep(150);
    const sScroll = await p.eval(sc); await T('touchEnd'); await sleep(300);
    log('按下反馈 按着就划走：150ms 时', sScroll);
  }
  if (want.has('sheet')) {
    await p.eval(`scrollTo(0, 700)`); await sleep(500);
    await p.eval(`[...document.querySelectorAll('.mw-tile')].find(e => e.getBoundingClientRect().top > 80)?.click()`);
    await sleep(1400);
    const g = await p.eval(`(() => { const r = document.querySelector('.sheet-grip').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom + 60 }; })()`);
    await drag(g.x, g.y, 0, 200, 12, 16); await sleep(900);
    const open1 = await p.eval(`!!document.querySelector('.sheet-layer')`);
    log('书详情 往下拖 200px：', open1 ? '没关上' : '关上了');
    if (open1) { await p.eval(`document.querySelector('.sheet-close')?.click()`); await sleep(900); }
    await p.eval(`[...document.querySelectorAll('.mw-tile')].find(e => e.getBoundingClientRect().top > 80)?.click()`);
    await sleep(1400);
    await drag(g.x, g.y, 0, 60, 4, 6); await sleep(900);   // 短促往下甩
    const open2 = await p.eval(`!!document.querySelector('.sheet-layer')`);
    log('书详情 往下甩 60px：', open2 ? '没关上' : '关上了');
    if (open2) { await p.eval(`document.querySelector('.sheet-close')?.click()`); await sleep(900); }
    await p.eval(`[...document.querySelectorAll('.mw-tile')].find(e => e.getBoundingClientRect().top > 80)?.click()`);
    await sleep(1400);
    const max = await p.eval(`(() => { const b = document.querySelector('.sheet-body'); return b.scrollHeight - b.clientHeight; })()`);
    await drag(g.x, g.y + 200, 0, -300, 12, 16); await sleep(600);   // 往上推：内容应该滚动
    const st = await p.eval(`document.querySelector('.sheet-body')?.scrollTop || 0`);
    log('书详情 往上推 300px：内容滚了', Math.round(st), '/ 最多', Math.round(max), 'px');
    await p.eval(`document.querySelector('.sheet-close')?.click()`); await sleep(900);
  }

  if (want.has('reader')) {
    await p.eval(`[...document.querySelectorAll('a, button')].find(e => e.textContent.trim() === '书架' && e.offsetParent)?.click()`);
    await sleep(1200);
    const { root } = await p.send('DOM.getDocument', { depth: -1, pierce: false });
    const { nodeId } = await p.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file][multiple][accept*="epub"]' });
    await p.send('DOM.setFileInputFiles', { nodeId, files: [`${S.replace(/^\/([a-z])\//, (m, d) => d.toUpperCase() + ':/')}/touch/测试书.txt`] });
    await ready(`!!document.querySelector('.shelf-cover')`, 60);
    await sleep(800);
    await p.eval(`document.querySelector('.shelf-cover')?.click()`);
    await ready(`!!document.querySelector('.rd-content.is-ready iframe')`, 80);
    await sleep(1500);
    const page = () => p.eval(`(() => { const t = [...document.querySelectorAll('.num')].map(e => e.textContent).find(t => /本章/.test(t)) || ''; const m = /本章 (\\d+) \\/ (\\d+)/.exec(t); return m ? m[1] + '/' + m[2] : t || '?'; })()`);
    const chap = () => p.eval(`(() => { const d = document.querySelector('.rd-content iframe')?.contentDocument; return d?.querySelector('h1,h2,h3')?.textContent?.trim() || ''; })()`);
    const left = () => p.eval(`(() => { const v = document.querySelector('.epub-view'), h = document.querySelector('.rd-content'); return (v?.style.transform || '') + '|' + (h?.style.transform || ''); })()`);
    const X = 260, Y = 430;
    log('打开：', await page(), await chap());
    await drag(X, Y, -20, 0, 3, 16); await sleep(700);
    log('轻拨 20px（约 80ms）：', await page(), '残留位移', await left());
    await drag(X, Y, -24, 0, 3, 6); await sleep(700);
    log('轻拨 24px（约 40ms）：', await page());
    await drag(X, Y, -30, 0, 10, 40, { hold: 150 }); await sleep(700);
    log('慢拖 30px 停住再松（应弹回）：', await page());
    await drag(X, Y, -60, 0, 10, 40, { hold: 150 }); await sleep(700);
    log('慢拖 60px 停住再松（应翻）：', await page());
    await drag(X, Y, 20, 0, 3, 16); await sleep(700);
    log('往右轻拨 20px（应回上一页）：', await page());
    await drag(X, Y, -24, 18, 3, 16); await sleep(700);
    log('斜着轻拨（横 24 竖 18）：', await page());
    // 往回甩：先慢慢拖 -90，再快速回 +50
    await T('touchStart', X, Y); for (let i = 1; i <= 9; i++) { await sleep(30); await T('touchMove', X - 10 * i, Y); }
    await sleep(16); await T('touchMove', X - 65, Y); await sleep(16); await T('touchMove', X - 40, Y); await T('touchEnd'); await sleep(700);
    log('拖过去又往回甩（应弹回）：', await page());
    // 拖到一半截图：看露出的是不是真实的下一页
    await T('touchStart', X + 100, Y); for (let i = 1; i <= 10; i++) { await sleep(16); await T('touchMove', X + 100 - 18 * i, Y); }
    await sleep(100); await shot('mid-drag');
    log('拖到 -180px 时：', await left());
    await T('touchEnd'); await sleep(700);
    log('松手（停住后松，过了 40px 应翻）：', await page(), '残留', await left());
    // 被打断
    await T('touchStart', X, Y); for (let i = 1; i <= 5; i++) { await sleep(16); await T('touchMove', X - 20 * i, Y); }
    await T('touchCancel'); await sleep(700);
    log('拖到一半被打断：', await page(), '残留', await left());
    // 点右边三分之一（原来的点按翻页，不变）
    await T('touchStart', 360, Y); await sleep(60); await T('touchEnd'); await sleep(700);
    log('点右边：', await page());
    // 快速连拨三下
    for (let k = 0; k < 3; k++) { await drag(X, Y, -24, 0, 2, 16); await sleep(60); }
    await sleep(700);
    log('连拨三下（间隔 60ms）：', await page(), '残留', await left());
    // 翻到本章最后一页，再往下一章拨：章节交界照旧
    for (let k = 0; k < 40; k++) { const pg = await page(); const [a, b] = pg.split('/').map(Number); if (a >= b) break; await T('touchStart', 360, Y); await sleep(40); await T('touchEnd'); await sleep(350); }
    log('到章末：', await page(), await chap());
    await T('touchStart', X, Y); for (let i = 1; i <= 6; i++) { await sleep(16); await T('touchMove', X - 15 * i, Y); }
    log('章末往左拖 90px：', await left());
    await T('touchEnd'); await sleep(1500);
    log('松手：', await page(), await chap(), '残留', await left());
    // 下拉书签
    await T('touchStart', 200, 120); for (let i = 1; i <= 12; i++) { await sleep(16); await T('touchMove', 200, 120 + 20 * i); }
    log('下拉 240px：', await p.eval(`document.querySelector('.rd-pull')?.textContent`));
    await T('touchEnd'); await sleep(500);
    log('松手：', await p.eval(`document.querySelector('.rd-toast, .toast')?.textContent || ''`));
  }
  const errs = p.logs.filter(l => /exception|error/i.test(l));
  if (errs.length) log('页面报错：', errs.slice(0, 5).join(' / '));
} finally { await br.close(); }
