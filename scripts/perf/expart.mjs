// 探索页预排好后切到前台：每次只放开一块（ws / filters / mw ...），看切换那一帧的排版落在哪块
import { launch, openPage, sleep } from './cdp.mjs';
import { rmSync } from 'node:fs';
const [S, base] = process.argv.slice(2);
const KEEPS = (process.env.KEEP || '全部,ws,filters,mw,无').split(',');
for (const [ki, keep] of KEEPS.entries()) {
  const prof = `${S}/edge-ep-${ki}`; try { rmSync(prof, { recursive: true, force: true }); } catch {}
  const br = await launch({ port: 9400 + ki, profile: prof, width: 1480, height: 1000 });
  try {
    const p = await openPage(br.port);
    await p.send('Network.enable'); await p.send('Network.setBlockedURLs', { urls: ['*wsrv.nl*', '*i0.wp.com*', '*bgm.tv*', '*img.wenku8*'] });
    await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await p.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await p.send('Page.navigate', { url: base + '#/' });
    for (let i = 0; i < 90; i++) { await sleep(500); if (await p.eval(`(() => { const r = document.querySelector('.page.explore')?.closest('.route'); return !!r && !r.hasAttribute('data-warming') && r.querySelectorAll('[data-warm]').length > 5 && !!document.querySelector('.page.plugins-page'); })()`).catch(() => false)) break; }
    await sleep(2500);
    const kids = await p.eval(`[...document.querySelector('.page.explore').children].map(c => c.className.split(' ')[0])`);
    if (keep !== '全部') await p.eval(`(() => { const s = document.createElement('style'); s.textContent = '.page.explore > *:not(.${keep === '无' ? 'zzz' : keep}) { content-visibility: hidden !important; }'; document.head.appendChild(s); })()`);
    await sleep(300);
    const res = await p.eval(`new Promise(res => { const lo = []; const ob = new PerformanceObserver(l => lo.push(...l.getEntries())); ob.observe({ type: 'long-animation-frame' });
      const t0 = performance.now(); location.hash = '#/explore'; requestAnimationFrame(() => requestAnimationFrame(() => { const t1 = performance.now();
      setTimeout(() => { ob.disconnect(); const m = lo.sort((a, b) => b.duration - a.duration)[0]; res('两帧用时 ' + Math.round(t1 - t0) + 'ms，最长帧 ' + (m ? Math.round(m.duration) + '(排' + Math.round(m.startTime + m.duration - m.styleAndLayoutStart) + ')' : '<50')); }, 800); })); })`);
    console.log(('只放开 ' + keep).padEnd(12), res, keep === '全部' ? '（区块：' + kids.join(',') + '）' : '');
  } finally { await br.close(); }
}
