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

// App 起来、首页渲染出来；起不来（闪退、通道没开）就别一屏屏干等了
const boot = await run('boot', `return await until(() => document.querySelector('.route.is-active') && 'ready', 60000);`, 90000);
if (!boot.ok || boot.result !== 'ready') {
  try { execFileSync('xcrun', ['simctl', 'io', device, 'screenshot', join(out, '00-boot-failed.png')], { stdio: 'ignore' }); } catch { /* 截不到就算了 */ }
  writeFileSync(join(out, 'tour.json'), JSON.stringify([boot], null, 1));
  console.log('App 没起来：' + boot.error);
  process.exit(1);
}

// Real WKWebView glass interaction: press, drag and release the actual control.
await step('tab-glass-held', `const bar=$('.lg-tabbar'); const items=$$('.lg-tabbar > .lg-tabs > a');
  if(!bar || items.length<3) throw Error('标签栏不可用');
  const a=items[0].getBoundingClientRect(),b=items[2].getBoundingClientRect();window.__glassEnd={x:b.x+b.width/2,y:b.y+b.height/2};
  bar.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:73,isPrimary:true,pointerType:'touch',clientX:a.x+a.width/2,clientY:a.y+a.height/2}));
  for(let n=1;n<=8;n++){bar.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:73,isPrimary:true,pointerType:'touch',clientX:(a.x+a.width/2)+(b.x+b.width/2-a.x-a.width/2)*n/8,clientY:b.y+b.height/2}));await sleep(18);}
  await sleep(180);const lens=$('.lg-lens'),q=lens.getBoundingClientRect();return {visible:getComputedStyle(lens).visibility,filter:getComputedStyle(lens).backdropFilter||getComputedStyle(lens).webkitBackdropFilter,w:q.width,h:q.height,barH:bar.clientHeight};`,{settle:150});
await step('tab-glass-rest', `const bar=$('.lg-tabbar');bar.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:73,isPrimary:true,pointerType:'touch',clientX:__glassEnd.x,clientY:__glassEnd.y}));await sleep(1100);
  const p=$('.lg-pill').getBoundingClientRect(),a=$('.lg-tabbar a.active')?.getBoundingClientRect();return {delta:a?p.x+p.width/2-a.x-a.width/2:999,lifted:bar.hasAttribute('data-lifted')};`,{settle:100});
const sheetEdges = async () => step('sheet-safe-corners', `const s=$('.sheet'),q=s.getBoundingClientRect(),probe=document.createElement('div');probe.style.cssText='position:fixed;visibility:hidden;padding-bottom:var(--safe-b)';document.body.append(probe);const safe=parseFloat(getComputedStyle(probe).paddingBottom)||0;probe.remove();
  const body=s.querySelector('.sheet-body');const last=s.querySelector('.cx-chapter-list li:last-child');const old=body.scrollTop;body.scrollTop=body.scrollHeight;await sleep(100);const lastBottom=last?.getBoundingClientRect().bottom,bodyBottom=body.getBoundingClientRect().bottom;body.scrollTop=old;return {gap:innerHeight-q.bottom,safe,radius:parseFloat(getComputedStyle(s).borderBottomLeftRadius),left:q.left,right:q.right,lastBottom,bodyBottom};`,{settle:100});
const readerTurns = async () => step('comic-page-turns', `const mode=byText('.rd-dock button',/^阅读方式$/);mode?.click();await sleep(200);byText('.rd-settings button',/^左右翻页$/)?.click();$('.rd-scrim')?.click();
  const ready=()=>$$('.cr-frame.is-visible img').some(i=>i.complete&&i.naturalWidth);if(!await until(ready,20000))throw Error('翻页模式没有显示正文');
  const before=$('.rd-ambient-bottom span')?.textContent||'';const match=before.match(/[0-9]+/g);const start=+(match?.[0]||1)-1,total=+(match?.[1]||1);let record=true,black=0,frames=0;
  function sample(){if(!record)return;frames++;if(!ready())black++;requestAnimationFrame(sample)}requestAnimationFrame(sample);
  const turns=[];try{for(let n=1;n<=Math.min(5,total-start-1);n++){const at=Date.now();window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));const target=start+n;const loaded=await until(()=>$$('.cr-frame.is-visible img').some(i=>i.dataset.image===String(target)&&i.complete&&i.naturalWidth),20000);turns.push({ms:Date.now()-at,loaded:!!loaded});if(!loaded)break;await sleep(200);}}finally{record=false;}
  return {turns,black,frames};`,{settle:200,timeout:150000});

if (appearance === 'dark') {
  // 模拟器已经切到深色：外观选「跟随系统」，App 跟着变深色
  await step('appearance-system', `location.hash = '#/plugins';
    const button = await until(() => [...document.querySelectorAll('.route.is-active [aria-label="外观"] button')].find(b => b.textContent.trim() === '跟随系统'));
    if (!button) throw Error('没有找到当前页面的外观设置');
    button.click();
    await until(() => document.documentElement.getAttribute('data-theme') === 'dark', 5000);
    return {theme: document.documentElement.getAttribute('data-theme'), systemDark: matchMedia('(prefers-color-scheme: dark)').matches, selected: button.getAttribute('aria-checked')};`);
  await step('home', `location.hash = '#/'; await sleep(1500); scrollTo(0, 0); return document.documentElement.getAttribute('data-theme');`);
  await step('explore-comic', `location.hash = '#/explore'; await until(() => $('.route.is-active .explore-kind')); byText('.route.is-active .explore-kind .chip', /^漫画$/)?.click();
    return await until(() => $$('.route.is-active .explore-comic .mw-tile').length > 4, 90000) && $$('.route.is-active .explore-comic .mw-tile').length;`, { settle: 3000 });
  await step('comic-sheet', `$('.route.is-active .explore-comic .mw-tile')?.click(); return await until(() => $$('.sheet .cx-chapter-list li').length, 60000);`, { settle: 2000 });
  await sheetEdges();
  await step('comic-reader', `const b = byText('.sheet .cs-read-row button, .sheet button', /开始看|继续看/); b?.click();
    return await until(() => [...document.querySelectorAll('.cr-scroll img')].some(i => i.complete && i.naturalWidth), 60000) && 'image';`, { settle: 2500 });
  await readerTurns();
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
  await step('comic-disc-covers', `const discs = await until(() => $('.route.is-active .explore-comic .discshelf'), 90000);
    if (!discs) throw Error('漫画光盘架没有出现'); discs.scrollIntoView({block:'center'});
    const ready = await until(() => [...discs.querySelectorAll('.disc-face .cover.is-real img')].filter(i => i.complete && i.naturalWidth > 60 && i.closest('.disc').offsetWidth > 80).length >= 2, 60000);
    return {real: !!ready, count: discs.querySelectorAll('.disc-face .cover.is-real').length};`, {settle:1000,timeout:160000});
  await step('explore-novel-return', `byText('.route.is-active .explore-kind .chip', /^轻小说$/)?.click(); scrollTo(0,0); await sleep(400);
    const page=$('.route.is-active .explore:not([hidden])'), hero=page?.querySelector('.ws');
    return {top:hero?.getBoundingClientRect().top, hidden:$$('.route.is-active .page[hidden]').map(e=>e.getBoundingClientRect().height), padding:parseFloat(getComputedStyle(page).paddingTop)};`,{settle:300});
  await step('explore-comic-return', `byText('.route.is-active .explore-kind .chip', /^漫画$/)?.click();scrollTo(0,0);await sleep(500);return 1;`);
  await step('explore-comic-wall', `$('.route.is-active .explore-comic .filters, .route.is-active .filters')?.scrollIntoView({ block: 'start' }); scrollBy(0, -60); await sleep(2500);
    return $$('.route.is-active .explore-comic .mw-tile').slice(0, 6).map(t => t.getAttribute('aria-label') || t.textContent.trim().slice(0, 12));`, { settle: 1500 });
  await step('comic-sheet', `scrollTo(0, 0); await sleep(300); $('.route.is-active .explore-comic .mw-tile')?.click();
    return await until(() => $$('.sheet .cx-chapter-list li').length, 60000);`, { settle: 2000 });
  await step('comic-sheet-chapters', `$('.sheet .sheet-body')?.scrollBy(0, 460); await sleep(600);
    const btns = $$('.sheet .cx-chapter-list button').slice(0, 20).map(b => Math.round(b.getBoundingClientRect().height));
    return { title: $('.sheet-title')?.textContent, minTap: Math.min(...btns) };`);
  await step('comic-shelf-add', `const b = byText('.sheet .cs-read-row button', /加入书架/); b?.click(); return await until(() => byText('.sheet .cs-read-row button', /已在书架/), 20000) ? 'added' : 'not added';`);
  await sheetEdges();
  await step('comic-reader', `const b = byText('.sheet .cs-read-row button', /开始看|继续看/); b?.click();
    return await until(() => $$('.cr-scroll img').some(i => i.complete && i.naturalWidth), 60000) ? 'image shown' : 'no image';`, { settle: 3000 });
  await readerTurns();
  await step('comic-reader-chrome', `return tap(innerWidth / 2, innerHeight / 2);`);
  await step('comic-reader-toc', `const t = byText('.rd-dock button, .rd-dock [role=tab]', /目录/); t?.click(); await sleep(800); return !!$('.panel-toc, .rd-toc');`);
  await step('comic-reader-settings', `const t = byText('.rd-dock button, .rd-dock [role=tab]', /设置|阅读|排版/); t?.click(); await sleep(800); return t?.textContent || 'no tab';`);
  await step('comic-reader-immersive', `$('.rd-scrim')?.click(); await sleep(500); tap(innerWidth / 2, innerHeight / 2); await sleep(400);
    const st = $('.cr-scroll'); st?.scrollBy?.(0, innerHeight * 0.8); return 1;`);
  await step('shelf', `history.back(); await sleep(800); location.hash = '#/shelf'; await sleep(2500); return $$('.route.is-active .cover').length;`);
  await step('search', `location.hash = '#/search?q=' + encodeURIComponent('咒术回战'); return await until(() => /漫画 [1-9]/.test($('.route.is-active .results-count')?.textContent || ''), 60000) ? $('.route.is-active .results-count').textContent : 'no comic results';`, { settle: 2500 });
  await step('plugins', `location.hash = '#/plugins'; await sleep(1500); $('#comicsources')?.scrollIntoView({ block: 'start' }); scrollBy(0, -70); return $$('#comicsources .bs-list > li').length;`);
  await step('comic-switch-shape', `const switches=$$('#comicsources .switch').slice(0,12);return switches.map(e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height};});`,{settle:300});
  await step('novel-sheet', `location.hash = '#/'; await sleep(1500); scrollTo(0, 0); byText('.route.is-active button, .route.is-active a', /看看这本/)?.click();
    return await until(() => $('.sheet .sheet-title')?.textContent, 15000);`, { settle: 1800 });
  // 下载按钮先入架、不会自动打开。用固定本地TXT验证真实阅读器，避免把上游下载慢误算成阅读器失败。
  await step('novel-reader', `const id='local:tour-novel';
    const text=['第一章 旅途', ...Array(180).fill('这是一段用于iPhone阅读验收的本地小说正文。'), '第二章 归来', ...Array(120).fill('远处的灯火亮了起来。')].join(String.fromCharCode(10));
    const q=indexedDB.open('librarium',1), db=await new Promise((r,j)=>{q.onsuccess=()=>r(q.result);q.onerror=j});
    await new Promise((r,j)=>{const t=db.transaction(['shelf','blob'],'readwrite');t.objectStore('shelf').put({id,title:'iPhone小说验收',ext:'txt',source:'local',addedAt:Date.now()},id);t.objectStore('blob').put(new Blob([text],{type:'text/plain'}),id);t.oncomplete=r;t.onerror=j});db.close();
    location.hash='#/read/'+encodeURIComponent(id);
    const ok=await until(()=>$('.reader2 .epub-container iframe')?.contentDocument?.body?.textContent?.includes('iPhone阅读验收'),60000);
    return {label:'本地TXT→真实EPUB阅读器',ok:!!ok,hash:location.hash};`, {settle:2000,timeout:90000});
  await step('novel-reader-chrome', `if (!location.hash.includes('/read/')) return 'not in reader'; return tap(innerWidth / 2, innerHeight / 2);`);
}

// 检查实际内容：命令成功执行不代表漫画出图/目录就绪。
const required = {
  'tab-glass-held': r => r?.visible==='visible' && /blur/.test(r.filter) && r.h <= r.barH*1.12,
  'tab-glass-rest': r => Math.abs(r?.delta)<1 && !r.lifted,
  'sheet-safe-corners': r => r?.gap>=Math.max(8,r.safe)-1 && r.radius>=30 && r.left>=0 && r.right<=500 && (!r.lastBottom || r.lastBottom<r.bodyBottom-8),
  'comic-page-turns': r => r?.turns.length>0 && r.turns.every(t=>t.loaded) && r.black===0,
  'comic-disc-covers': r => r?.real === true && r.count >= 2,
  'explore-novel-return': r => r?.top >= 0 && r.padding >= 8 && r.padding <= 100 && Math.abs(r.top-r.padding)<2 && r.hidden.every(h=>h===0),
  'comic-switch-shape': r => r?.length > 0 && r.every(s=>s.w===51&&s.h===31),
  'appearance-system': r => r?.theme === 'dark' && r?.systemDark && r?.selected === 'true',
  'explore-novel': r => Number(r) > 0,
  'explore-comic': r => Number(r) > 4,
  'explore-comic-top': r => Number(r) > 4,
  'comic-sheet': r => Number(r) > 0,
  'comic-reader': r => r === 'image' || r === 'image shown',
  'comic-reader-toc': r => r === true,
  'comic-shelf-add': r => r === 'added',
  'search': r => typeof r === 'string' && r !== 'no comic results',
  'novel-reader': r => r?.ok === true,
};
for (const row of report) if (row.ok && required[row.name] && !required[row.name](row.result)) {
  row.ok = false; row.error = '实际页面未达到预期：' + JSON.stringify(row.result);
}
writeFileSync(join(out, 'tour.json'), JSON.stringify(report, null, 1));
const bad = report.filter(r => !r.ok || r.page?.overflowX);
console.log(`${report.length} 屏，${bad.length} 屏有问题`);
for (const row of bad) console.error(row.name, row.error || '横向溢出');
if (bad.length) process.exitCode = 1;
