// iPhone 模拟器里查漫画封面：真 App（调试版，-EBOOK_TOUR 启动，刚装好、什么都没缓存）打开探索页「漫画」，
// 「全部」和「恋爱」两个世界各往下翻几屏，每屏记封面全部出来用了多久、哪几本没出来（哪个源、哪个图床）；
// 最后到插件页读每个漫画源的封面统计和失败原因。只记录不判失败——网络在 GitHub 的美国机房，和国内直连不一样。
// 通道和 ios-tour.mjs 一样：往 App 的 Documents/tour/ 写 cmd-<n>.js，App 跑完写 res-<n>.json。
//
//   node scripts/ios-cover-probe.mjs <模拟器 UDID> <输出目录>
//   结果：<输出目录>/<序号>-<名字>.png，<输出目录>/covers.json
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [device, out] = process.argv.slice(2);
if (!device || !out) { console.error('usage: node scripts/ios-cover-probe.mjs <udid> <out-dir>'); process.exit(2); }
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const data = execFileSync('xcrun', ['simctl', 'get_app_container', device, 'app.librarium.reader', 'data']).toString().trim();
const dir = join(data, 'Documents', 'tour');
mkdirSync(dir, { recursive: true });

const HELPERS = `
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const until = async (fn, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = fn(); if (v) return v; } catch {} await sleep(250); } return null; };
const byText = (sel, re) => $$(sel).find(b => re.test(b.textContent || ''));
// 屏幕上看得见的封面（光盘、拼贴、书墙都算；太小的不算）
const vis = () => $$('.route.is-active .cover').filter(c => { const r = c.getBoundingClientRect(); return r.width > 40 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; });
const real = (c) => { const i = c.querySelector('img'); return c.classList.contains('is-real') && !!i && i.complete && i.naturalWidth > 0; };
// 这本书有哪几个源、封面在哪个图床：从 React 的 fiber 上找 Cover 的 props（只为诊断，界面上不显示）
const bookOf = (c) => { const k = Object.keys(c).find(k => k.startsWith('__reactFiber$')); let f = k && c[k]; while (f && !f.memoizedProps?.book) f = f.return; return f?.memoizedProps?.book; };
const host = (u) => { try { return new URL(u).host; } catch { return ''; } };
const who = (c) => { const b = bookOf(c); return { title: b?.title, from: (b?.comics || []).filter(x => x.cover).map(x => x.sourceId + ' @ ' + host(x.cover)) }; };
// 等这一屏的封面全出来（最多 max 毫秒）：用了多久、几张、没出来的是谁
const screen = async (max = 20000) => {
  const t = Date.now();
  await until(() => { const v = vis(); return v.length && v.every(real); }, max);
  const v = vis(), done = v.length > 0 && v.every(real);
  return { ms: done ? Date.now() - t : null, real: v.filter(real).length, total: v.length, missing: v.filter(c => !real(c)).map(who) };
};
`;

let n = 0;
async function run(name, body, timeout = 120000) {
  const i = n++;
  const tmp = join(dir, `cmd-${i}.tmp`);
  writeFileSync(tmp, `${HELPERS}\nconst __r = await (async () => { ${body} })();\nreturn JSON.stringify({ r: __r === undefined ? null : __r });`);
  renameSync(tmp, join(dir, `cmd-${i}.js`));
  const res = join(dir, `res-${i}.json`), t = Date.now();
  while (!existsSync(res)) {
    if (Date.now() - t > timeout) return { name, ok: false, error: `${timeout / 1000}s 没回` };
    await sleep(300);
  }
  await sleep(100);
  const r = JSON.parse(readFileSync(res, 'utf8'));
  if (!r.ok) return { name, ok: false, error: r.error };
  try { return { name, ok: true, result: JSON.parse(r.value).r }; } catch { return { name, ok: true, result: r.value }; }
}

let shotNo = 0;
const report = [];
async function step(name, body, { settle = 500, timeout } = {}) {
  const r = await run(name, body, timeout);
  await sleep(settle);
  const file = join(out, `${String(++shotNo).padStart(2, '0')}-${name}.png`);
  try { execFileSync('xcrun', ['simctl', 'io', device, 'screenshot', file], { stdio: 'ignore' }); } catch { /* 截不到就算了 */ }
  report.push(r);
  const s = r.result;
  console.log(`${r.ok ? 'ok ' : 'ERR'} ${name}${r.ok ? '' : ' ' + r.error} ${s && s.total !== undefined ? `${s.real}/${s.total} ${s.ms === null ? '没齐' : s.ms + 'ms'}${s.missing?.length ? ' 缺：' + s.missing.map(m => `${m.title}（${m.from.join('，')}）`).join('；') : ''}` : JSON.stringify(s ?? '').slice(0, 200)}`);
  return r;
}

const boot = await run('boot', `return await until(() => document.querySelector('.route.is-active') && 'ready', 60000);`, 90000);
if (!boot.ok || boot.result !== 'ready') {
  try { execFileSync('xcrun', ['simctl', 'io', device, 'screenshot', join(out, '00-boot-failed.png')], { stdio: 'ignore' }); } catch { /* 截不到就算了 */ }
  writeFileSync(join(out, 'covers.json'), JSON.stringify([boot], null, 1));
  console.log('App 没起来：' + boot.error);
  process.exit(1);
}

// 冷启动进漫画：书单多久出来、光盘多久有图
await step('comic-top', `location.hash = '#/explore'; await until(() => $('.route.is-active .explore-kind'));
  byText('.route.is-active .explore-kind .chip', /^漫画$/)?.click(); scrollTo(0, 0); const t = Date.now();
  const tiles = await until(() => $$('.route.is-active .explore-comic .mw-tile').length > 4, 90000);
  return { tilesMs: tiles ? Date.now() - t : null, ...(await screen(30000)) };`, { timeout: 150000 });
await step('discs', `const d = await until(() => $('.route.is-active .explore-comic .discshelf'), 30000); if (!d) throw Error('没有光盘架');
  d.scrollIntoView({ block: 'center' }); await sleep(300); return await screen(30000);`, { timeout: 60000 });
await step('wall-all-1', `$('.route.is-active .explore-comic .filters')?.scrollIntoView({ block: 'start' }); await sleep(300); return await screen();`);
for (let i = 2; i <= 6; i++) await step(`wall-all-${i}`, `scrollBy(0, innerHeight * .85); await sleep(300); return await screen();`);

// 「恋爱」世界（用户截图里那一屏）：拼贴、光盘、书墙
await step('romance-top', `scrollTo(0, 0); await sleep(300); const b = byText('.route.is-active .ws-cap', /恋爱/); if (!b) throw Error('没有「恋爱」');
  b.click(); await until(() => /恋爱/.test($('.route.is-active .cx-count')?.textContent || ''), 30000); await sleep(1500); scrollTo(0, 0); await sleep(300);
  return await screen(30000);`, { timeout: 90000 });
await step('romance-discs', `const d = $('.route.is-active .explore-comic .discshelf'); if (!d) return 'no discs'; d.scrollIntoView({ block: 'center' }); await sleep(300); return await screen(30000);`, { timeout: 60000 });
await step('wall-romance-1', `$('.route.is-active .explore-comic .filters')?.scrollIntoView({ block: 'start' }); await sleep(300); return await screen();`);
for (let i = 2; i <= 8; i++) await step(`wall-romance-${i}`, `scrollBy(0, innerHeight * .85); await sleep(300); return await screen();`);

// 插件页：每个漫画源的封面统计；有记录的展开读原因
await step('plugins', `location.hash = '#/plugins'; await until(() => $('#comicsources .bs-list > li'), 30000);
  const rows = [];
  for (const li of $$('#comicsources .bs-list > li')) {
    const row = { name: li.querySelector('.bs-name strong')?.textContent, on: !li.classList.contains('is-off'), line: li.querySelector('.bs-name small')?.textContent || '' };
    if (/封面/.test(row.line)) {
      const toggle = li.querySelector('button[aria-label$="的设置"]'); toggle?.click(); await sleep(250);
      row.detail = [...li.querySelectorAll('.cs-panel .cs-note, .cs-panel .cs-test.bad p')].map(p => p.textContent.trim()).join(' ');
      toggle?.click(); await sleep(100);
    }
    rows.push(row);
  }
  $('#comicsources')?.scrollIntoView({ block: 'start' });
  return rows;`, { timeout: 120000 });
for (const [slug, re] of [['goda', '/GoDa/i'], ['manhuaren', '/漫画人/']]) {
  await step(`plugins-${slug}`, `const li = $$('#comicsources .bs-list > li').find(li => ${re}.test(li.querySelector('.bs-name strong')?.textContent || ''));
    if (!li) return 'not installed'; li.querySelector('button[aria-label$="的设置"]')?.click(); await sleep(400); li.scrollIntoView({ block: 'start' }); scrollBy(0, -80); await sleep(300);
    return li.querySelector('.cs-panel')?.textContent.trim().slice(0, 300);`);
}

writeFileSync(join(out, 'covers.json'), JSON.stringify(report, null, 1));
const plugins = report.find(r => r.name === 'plugins')?.result;
if (Array.isArray(plugins)) {
  console.log('\n漫画源封面：');
  for (const p of plugins) if (p.on || p.line.includes('封面')) console.log(`  ${p.on ? '开' : '关'} ${p.name}：${p.line.split(' · ').filter(s => s.includes('封面')).join('') || '没取过'}${p.detail ? ' —— ' + p.detail : ''}`);
}
