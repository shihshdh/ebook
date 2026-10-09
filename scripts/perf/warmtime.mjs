// 打开首页后不碰：后台预渲染 + 预排版多久全部做完（每 0.5 秒看一次各页 data-warm 和引擎）
import { launch, openPage, sleep } from './cdp.mjs';
import { rmSync } from 'node:fs';
const [S, base] = process.argv.slice(2);
const prof = `${S}/edge-wt`; try { rmSync(prof, { recursive: true, force: true }); } catch {}
const br = await launch({ port: 9384, profile: prof, width: 1480, height: 1000 });
try {
  const p = await openPage(br.port);
  await p.send('Network.enable'); await p.send('Network.setBlockedURLs', { urls: ['*wsrv.nl*', '*i0.wp.com*', '*bgm.tv*', '*img.wenku8*'] });
  await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await p.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await p.send('Page.navigate', { url: base + '#/' });
  for (let i = 0; i < 80; i++) { await sleep(300); if (await p.eval(`!!document.querySelector('.discshelf .disc') && !document.querySelector('.splash')`).catch(() => false)) break; }
  const t0 = Date.now(); let last = '';
  while (Date.now() - t0 < 40000) {
    const st = await p.eval(`[...document.querySelectorAll('.route')].map(r => (r.firstElementChild?.className.split(' ').pop() || '?') + (r.classList.contains('is-active') ? '(当前)' : '') + ':' + r.querySelectorAll('[data-warm]').length + (r.hasAttribute('data-warming') ? '…' : '')).join(' ') + ' ｜首页下半截已排 ' + [...document.querySelectorAll('.home-lazy')].filter(s => s.querySelector('[data-warm]') || !s.hasAttribute('data-warming')).length`);
    if (st !== last) { console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', st); last = st; }
    if (/plugins-page:\d+[^…]/.test(st + ' ') && !/…/.test(st)) { const n = +(st.match(/plugins-page:(\d+)/) || [])[1]; if (n > 0) { console.log('全部排完'); break; } }
    await sleep(500);
  }
} finally { await br.close(); }
