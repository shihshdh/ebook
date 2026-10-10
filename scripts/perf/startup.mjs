// 启动这一段（打开 → 开屏 logo → 首页）逐帧录屏 + 性能追踪。用法：node startup.mjs <scratch> <url> <标签> [降速倍数=4] [mobile|desktop]
// 帧存到 <scratch>/startup/<标签>/帧序号_毫秒.jpg（毫秒 = 相对开始加载），追踪存 <scratch>/startup/<标签>.trace.json
import { launch, openPage, sleep } from './cdp.mjs';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const [S, base, tag, rate = '4', mode = 'mobile'] = process.argv.slice(2);
const dir = `${S}/startup/${tag}`;
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const br = await launch({ port: 9341, profile: `${S}/edge-measure`, width: 1480, height: 1000 });
try {
  const p = await openPage(br.port);
  if (mode === 'mobile') {
    await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  } else await p.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  if (+rate > 1) await p.send('Emulation.setCPUThrottlingRate', { rate: +rate });
  await p.send('Network.enable'); await p.send('Network.setBlockedURLs', { urls: ['*wsrv.nl*', '*i0.wp.com*', '*bgm.tv*', '*img.wenku8*'] });
  const events = [];
  p.on('Tracing.dataCollected', e => events.push(...e.value));
  await p.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink', 'cc', 'v8.execute', 'disabled-by-default-devtools.timeline.stack', 'loading'] } });
  let n = 0, t0 = 0;
  p.on('Page.screencastFrame', (e) => {
    const ms = Math.round(e.metadata.timestamp * 1000 - t0);
    writeFileSync(`${dir}/${String(n++).padStart(4, '0')}_${ms}.jpg`, Buffer.from(e.data, 'base64'));
    p.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
  });
  await p.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: 390, maxHeight: 844, everyNthFrame: 1 });
  t0 = Date.now();
  await p.send('Page.navigate', { url: base + '#/' });
  // 开屏什么时候出现、什么时候没的（每 20ms 看一次）
  let splashOn = null, splashOff = null;
  for (let i = 0; i < 600; i++) {
    const s = await p.eval(`!!document.querySelector('.splash')`).catch(() => null);
    if (s && splashOn == null) splashOn = Date.now() - t0;
    if (s === false && splashOn != null && splashOff == null) splashOff = Date.now() - t0;
    if (splashOff != null && Date.now() - t0 > splashOff + 2500) break;
    await sleep(20);
  }
  await p.send('Page.stopScreencast');
  const done = new Promise(res => p.on('Tracing.tracingComplete', res));
  await p.send('Tracing.end'); await done;
  writeFileSync(`${S}/startup/${tag}.trace.json`, JSON.stringify(events));
  console.log(`[${tag}] 帧 ${n} 张；开屏出现 ${splashOn}ms、消失 ${splashOff}ms`);
} finally { await br.close(); }
