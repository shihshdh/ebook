// 打开首页后不碰，15 秒里每一帧的间隔：后台预渲染 / 预排版会不会让首页的环境动效（唱片自转、纸页漂移）顿一下
import { launch, openPage, sleep } from './cdp.mjs';
import { rmSync, writeFileSync } from 'node:fs';
const [S, ...bases] = process.argv.slice(2);
for (const base of bases) for (let r = 0; r < (+process.env.RUNS || 2); r++) {
  const prof = `${S}/edge-idle-${r}`; try { rmSync(prof, { recursive: true, force: true }); } catch {}
  const br = await launch({ port: 9360 + r, profile: prof, width: 1480, height: 1000 });
  try {
    const p = await openPage(br.port);
    await p.send('Network.enable'); await p.send('Network.setBlockedURLs', { urls: ['*wsrv.nl*', '*i0.wp.com*', '*bgm.tv*', '*img.wenku8*'] });
    await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await p.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await p.send('Page.navigate', { url: base + '#/' });
    for (let i = 0; i < 80; i++) { await sleep(500); if (await p.eval(`!!document.querySelector('.discshelf .disc') && !document.querySelector('.splash')`).catch(() => false)) break; }
    await p.eval(`(() => { window.__iv = []; let last = 0; const f = (t) => { if (last) window.__iv.push([t, t - last]); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f);
      window.__lt = []; new PerformanceObserver(l => window.__lt.push(...l.getEntries().map(e => [e.startTime, e.duration]))).observe({ type: 'longtask' }); })()`);
    const evs = [];
    if (process.env.ITRACE) { p.on('Tracing.dataCollected', e => evs.push(...e.value)); await p.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink', 'v8.execute', 'toplevel', 'disabled-by-default-devtools.timeline.stack', 'devtools.timeline.stack'] } }); }
    await sleep(+process.env.IDLEMS || 15000);
    if (process.env.ITRACE) { const done = new Promise(res => p.on('Tracing.tracingComplete', res)); await p.send('Tracing.end'); await done; writeFileSync(`${S}/perf/idle-${r}.trace.json`, JSON.stringify(evs)); }
    const { iv, lt } = await p.eval(`({ iv: window.__iv, lt: window.__lt })`);
    const t0 = iv[0][0], long = iv.filter(x => x[1] > 33).map(x => `${((x[0] - t0) / 1000).toFixed(1)}s:${x[1].toFixed(0)}`);
    console.log(base.includes('5185') ? '原来' : '现在', `第${r + 1}次`, `帧 ${iv.length}，>33ms ${long.length} 次，最长 ${Math.max(...iv.map(x => x[1])).toFixed(0)}ms`, '｜', long.slice(0, 12).join(' '), '｜长任务', lt.map(x => x[1].toFixed(0)).join(','));
  } finally { await br.close(); }
}
