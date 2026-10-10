// 底栏滑块检查：手机尺寸，从一格点到另一格，用调试协议把所有动画放慢 20 倍，在真实播放（合成线程在播）中连续截底栏，
// 存到 <scratch>/thumb/<标签>-<主题>/，再用 thumbseam.py 找两半拼接处的亮列。
// 用法：node thumbcheck.mjs <scratch> <url> <标签> [dark|light] [从=插件] [到=首页]
import { launch, openPage, sleep } from './cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const [S, base, tag, theme = 'dark', from = '插件', to = '首页'] = process.argv.slice(2);
const dir = `${S}/thumb/${tag}-${theme}`; mkdirSync(dir, { recursive: true });
const br = await launch({ port: 9354, profile: S + '/thumb-prof', width: 600, height: 1000 });
try {
  const p = await openPage(br.port);
  await p.send('Network.enable'); await p.send('Network.setBlockedURLs', { urls: ['*wsrv.nl*', '*i0.wp.com*', '*bgm.tv*', '*img.wenku8*'] });
  await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await p.send('Page.navigate', { url: base + '#/' });
  for (let i = 0; i < 80; i++) { await sleep(500); if (await p.eval(`!!document.querySelector('.discshelf .disc') && !document.querySelector('.splash')`).catch(() => false)) break; }
  await p.eval(`document.documentElement.setAttribute('data-theme', '${theme}')`);
  await sleep(2500);
  const click = (label) => p.eval(`[...document.querySelectorAll('.tabbar a')].find(e => e.textContent.trim() === ${JSON.stringify(label)})?.click()`);
  await click(from); await sleep(1500);
  const bar = await p.eval(`(() => { const b = document.querySelector('.tabbar').getBoundingClientRect(); return { x: b.left - 6, y: b.top - 10, width: b.width + 12, height: b.height + 24 }; })()`);
  await p.send('Animation.enable'); await p.send('Animation.setPlaybackRate', { playbackRate: 0.05 });
  await click(to);
  const t0 = Date.now(); let n = 0;
  while (Date.now() - t0 < 12000) {
    const { data } = await p.send('Page.captureScreenshot', { format: 'png', clip: { ...bar, scale: 1 } });
    writeFileSync(`${dir}/${String(n++).padStart(3, '0')}.png`, Buffer.from(data, 'base64'));
    await sleep(250);
  }
  console.log(dir, n, '张；播完还剩的动画', await p.eval(`[...document.querySelectorAll('.tabbar .lt-clip, .tabbar .lt-cap')].map(e => e.getAnimations().length).join(',')`));
  console.log('报错：', p.logs.filter(l => /exception|error/i.test(l)).join(' | ').slice(0, 300) || '无');
} finally { await br.close(); }
