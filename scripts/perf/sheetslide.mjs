// 打开书详情时逐帧记录面板顶边位置和高度：看分两步挂会不会让面板在滑入途中跳一下
import { launch, openPage, sleep } from './cdp.mjs';
import { rmSync } from 'node:fs';
const [S, base] = process.argv.slice(2);
const prof = `${S}/edge-ss`; try { rmSync(prof, { recursive: true, force: true }); } catch {}
const br = await launch({ port: 9388, profile: prof, width: 1480, height: 1000 });
try {
  const p = await openPage(br.port);
  await p.send('Network.enable'); await p.send('Network.setBlockedURLs', { urls: ['*wsrv.nl*', '*i0.wp.com*', '*bgm.tv*', '*img.wenku8*'] });
  await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await p.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  for (const q of (process.env.Q || '你的故事,魔女之旅,红楼梦,灯花笑').split(',')) {
    await p.send('Page.navigate', { url: base + '#/search?q=' + encodeURIComponent(q) });
    for (let i = 0; i < 40; i++) { await sleep(400); if (await p.eval(`!!document.querySelector('.route.is-active .result')`).catch(() => false)) break; }
    await sleep(2500);
    const rec = await p.eval(`new Promise(res => {
      const out = []; const t0 = performance.now();
      const f = () => { const s = document.querySelector('.sheet'); if (s) { const r = s.getBoundingClientRect(); out.push([Math.round(performance.now() - t0), Math.round(r.top), Math.round(r.height), s.classList.contains('is-partial') ? 'P' : '']); } if (performance.now() - t0 < 900) requestAnimationFrame(f); else res(out); };
      document.querySelector('.route.is-active .result').click(); requestAnimationFrame(f); })`);
    // 顶边应当一路往上（变小）；记下有没有往回跳、高度变没变
    let back = 0; for (let i = 1; i < rec.length; i++) if (rec[i][1] > rec[i - 1][1] + 1) back++;
    const hs = [...new Set(rec.map(x => x[2]))];
    console.log(q.padEnd(5), `帧 ${rec.length}，顶边回跳 ${back} 次，高度 ${hs.join('→')}，分两步：${rec.some(x => x[3]) ? '是' : '否'} ｜ ` + rec.slice(0, 10).map(x => `${x[0]}:${x[1]}${x[3]}`).join(' '));
    await p.eval(`document.querySelector('.sheet-scrim')?.click()`); await sleep(800);
  }
} finally { await br.close(); }
