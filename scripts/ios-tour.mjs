// iPhone 模拟器里的界面巡检：真 App（调试版，-EBOOK_TOUR 启动）里一屏一屏走过去，每屏用 simctl 截整屏
// （带状态栏、灵动岛 / 刘海、Home 横条），顺手查有没有横向溢出、标签栏是不是压在 Home 横条上。
// 通道见 ios/App/App/EbookNative.swift 的 startTour：往 App 的 Documents/tour/ 写 cmd-<n>.js，App 跑完写 res-<n>.json。
//
//   node scripts/ios-tour.mjs <模拟器 UDID> <输出目录> <light|dark>
//   结果：<输出目录>/<序号>-<名字>.png，<输出目录>/tour.json（每一步的检查结果）
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [device, out, appearance = 'light'] = process.argv.slice(2);
if (!device || !out) { console.error('usage: node scripts/ios-tour.mjs <udid> <out-dir> [light|dark]'); process.exit(2); }
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const data = execFileSync('xcrun', ['simctl', 'get_app_container', device, 'app.librarium.reader', 'data']).toString().trim();
const dir = join(data, 'Documents', 'tour');
mkdirSync(dir, { recursive: true });

// 每段 JS 前面都带上这些
const HELPERS = `
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const until = async (fn, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = fn(); if (v) return v; } catch {} await sleep(250); } return null; };
const byText = (sel, re) => $$(sel).find(b => re.test(b.textContent || ''));
// 按坐标点：阅读器按点的位置分左翻 / 右翻 / 中间开菜单，el.click() 的坐标是 0
const tap = (x, y) => { const el = document.elementFromPoint(x, y); el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window })); return el ? el.tagName + '.' + String(el.className).slice(0, 40) : 'nothing'; };
const page = () => {
  const r = document.documentElement, cs = getComputedStyle(r), bar = $('.tabbar, .tab-bar, nav[class*=tab]');
  const b = bar?.getBoundingClientRect();
  return {
    hash: location.hash, w: innerWidth, h: innerHeight,
    overflowX: r.scrollWidth > innerWidth + 1,
    safeTop: cs.getPropertyValue('--native-safe-top').trim() || cs.getPropertyValue('--safe-top').trim(),
    safeBottom: cs.getPropertyValue('--native-safe-bottom').trim() || cs.getPropertyValue('--safe-bottom').trim(),
    tabbar: b && b.width ? { top: Math.round(b.top), bottom: Math.round(b.bottom) } : null,
    // 横向超出屏幕的元素（只记前几个，宽的在前）
    wide: $$('body *').filter(e => { const q = e.getBoundingClientRect(); return q.width > 0 && (q.right > innerWidth + 1 || q.left < -1) && getComputedStyle(e).position !== 'fixed'; })
      .filter(e => !e.closest('.mw-wall, .world-switch, [class*=carousel], [class*=scroller], .cr-scroll, .rd-track, ol, .chips, .explore-kind'))
      .slice(0, 5).map(e => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]),
  };
};
`;

let n = 0;
async function run(name, body, timeout = 120000) {
  const i = n++;
  const tmp = join(dir, `cmd-${i}.tmp`);
  writeFileSync(tmp, `${HELPERS}\nconst __r = await (async () => { ${body} })();\nreturn JSON.stringify({ r: __r === undefined ? null : __r, page: page() });`);
  renameSync(tmp, join(dir, `cmd-${i}.js`));
  const res = join(dir, `res-${i}.json`), t = Date.now();
  while (!existsSync(res)) {
    if (Date.now() - t > timeout) return { name, ok: false, error: `${timeout / 1000}s 没回` };
    await sleep(300);
  }
  await sleep(100);
  const r = JSON.parse(readFileSync(res, 'utf8'));
  if (!r.ok) return { name, ok: false, error: r.error };
  try { const v = JSON.parse(r.value); return { name, ok: true, result: v.r, page: v.page }; } catch { return { name, ok: true, result: r.value }; }
}

let shotNo = 0;
const report = [];
async function step(name, body, { settle = 1200, timeout } = {}) {
  const r = await run(name, body, timeout);
  await sleep(settle);
  const file = join(out, `${String(++shotNo).padStart(2, '0')}-${name}.png`);
  try { execFileSync('xcrun', ['simctl', 'io', device, 'screenshot', file], { stdio: 'ignore' }); } catch (e) { r.shotError = String(e.message || e).slice(0, 120); }
  report.push(r);
  console.log(`${r.ok ? 'ok ' : 'ERR'} ${name}${r.ok ? '' : ' ' + r.error}${r.page?.overflowX ? ' [横向溢出 ' + r.page.wide.join(' ') + ']' : ''} ${r.result ? JSON.stringify(r.result).slice(0, 160) : ''}`);
  return r;
}

// App 起来、首页渲染出来
await run('boot', `return await until(() => document.querySelector('.route.is-active') && 'ready', 60000);`, 90000);

if (appearance === 'dark') {
  await step('home', `location.hash = '#/'; await sleep(1500); scrollTo(0, 0); return 1;`);
  await step('explore-comic', `location.hash = '#/explore'; await until(() => $('.route.is-active .explore-kind')); byText('.route.is-active .explore-kind .chip', /^漫画$/)?.click();
    return await until(() => $$('.route.is-active .explore-comic .mw-tile').length > 4, 90000) && $$('.route.is-active .explore-comic .mw-tile').length;`, { settle: 3000 });
  await step('comic-sheet', `$('.route.is-active .explore-comic .mw-tile')?.click(); return await until(() => $$('.sheet .cx-chapter-list li').length, 60000);`, { settle: 2000 });
  await step('comic-reader', `const b = byText('.sheet .cs-read-row button, .sheet button', /开始看|继续看/); b?.click();
    return await until(() => [...document.querySelectorAll('.cr-scroll img')].some(i => i.complete && i.naturalWidth), 60000) && 'image';`, { settle: 2500 });
  await step('comic-reader-chrome', `return tap(innerWidth / 2, innerHeight / 2);`);
  await step('shelf', `location.hash = '#/shelf'; await sleep(2500); return $$('.route.is-active .cover').length;`);
  await step('plugins', `location.hash = '#/plugins'; await sleep(1500); return 1;`);
} else {
  await step('home', `await sleep(2500); scrollTo(0, 0); return 1;`);
  await step('home-scrolled', `scrollTo(0, 900); await sleep(600); return scrollY;`);
  await step('explore-novel', `scrollTo(0, 0); location.hash = '#/explore'; await until(() => $('.route.is-active .explore-kind'));
    byText('.route.is-active .explore-kind .chip', /^轻小说$/)?.click(); return await until(() => $$('.route.is-active .mw-tile').length, 30000) && $$('.route.is-active .mw-tile').length;`, { settle: 2500 });
  await step('explore-comic-top', `byText('.route.is-active .explore-kind .chip', /^漫画$/)?.click(); scrollTo(0, 0);
    return await until(() => $$('.route.is-active .explore-comic .mw-tile').length > 4, 90000) && $$('.route.is-active .explore-comic .mw-tile').length;`, { settle: 4000 });
  await step('explore-comic-wall', `$('.route.is-active .explore-comic .filters, .route.is-active .filters')?.scrollIntoView({ block: 'start' }); scrollBy(0, -60); await sleep(2500);
    return $$('.route.is-active .explore-comic .mw-tile').slice(0, 6).map(t => t.getAttribute('aria-label') || t.textContent.trim().slice(0, 12));`, { settle: 1500 });
  await step('comic-sheet', `scrollTo(0, 0); await sleep(300); $('.route.is-active .explore-comic .mw-tile')?.click();
    return await until(() => $$('.sheet .cx-chapter-list li').length, 60000);`, { settle: 2000 });
  await step('comic-sheet-chapters', `$('.sheet .sheet-body')?.scrollBy(0, 460); await sleep(600);
    const btns = $$('.sheet .cx-chapter-list button').slice(0, 20).map(b => Math.round(b.getBoundingClientRect().height));
    return { title: $('.sheet-title')?.textContent, minTap: Math.min(...btns) };`);
  await step('comic-shelf-add', `const b = byText('.sheet .cs-read-row button', /加入书架/); b?.click(); return await until(() => byText('.sheet .cs-read-row button', /已在书架/), 20000) ? 'added' : 'not added';`);
  await step('comic-reader', `const b = byText('.sheet .cs-read-row button', /开始看|继续看/); b?.click();
    return await until(() => $$('.cr-scroll img').some(i => i.complete && i.naturalWidth), 60000) ? 'image shown' : 'no image';`, { settle: 3000 });
  await step('comic-reader-chrome', `return tap(innerWidth / 2, innerHeight / 2);`);
  await step('comic-reader-toc', `const t = byText('.rd-dock button, .rd-dock [role=tab]', /目录/); t?.click(); await sleep(800); return !!$('.rd-toc');`);
  await step('comic-reader-settings', `const t = byText('.rd-dock button, .rd-dock [role=tab]', /设置|阅读|排版/); t?.click(); await sleep(800); return t?.textContent || 'no tab';`);
  await step('comic-reader-immersive', `$('.rd-scrim')?.click(); await sleep(500); tap(innerWidth / 2, innerHeight / 2); await sleep(400);
    const st = $('.cr-scroll'); st?.scrollBy?.(0, innerHeight * 0.8); return 1;`);
  await step('shelf', `history.back(); await sleep(800); location.hash = '#/shelf'; await sleep(2500); return $$('.route.is-active .cover').length;`);
  await step('search', `location.hash = '#/search?q=' + encodeURIComponent('咒术回战'); return await until(() => /漫画 [1-9]/.test($('.route.is-active .results-count')?.textContent || ''), 60000) ? $('.route.is-active .results-count').textContent : 'no comic results';`, { settle: 2500 });
  await step('plugins', `location.hash = '#/plugins'; await sleep(1500); $('#comicsources')?.scrollIntoView({ block: 'start' }); scrollBy(0, -70); return $$('#comicsources .bs-list > li').length;`);
  await step('novel-sheet', `location.hash = '#/'; await sleep(1500); scrollTo(0, 0); byText('.route.is-active button, .route.is-active a', /看看这本/)?.click();
    return await until(() => $('.sheet .sheet-title')?.textContent, 15000);`, { settle: 1800 });
  await step('novel-reader', `const b = byText('.sheet button', /开始读|继续读|阅读|下载/); const label = b?.textContent; b?.click();
    const ok = await until(() => location.hash.includes('/read/') && $('.reader2, .rd-stage, [class*=reader]'), 90000); await sleep(2500); return { label, ok: !!ok, hash: location.hash };`, { settle: 2000, timeout: 150000 });
  await step('novel-reader-chrome', `if (!location.hash.includes('/read/')) return 'not in reader'; return tap(innerWidth / 2, innerHeight / 2);`);
}

writeFileSync(join(out, 'tour.json'), JSON.stringify(report, null, 1));
const bad = report.filter(r => !r.ok || r.page?.overflowX);
console.log(`${report.length} 屏，${bad.length} 屏有问题`);
