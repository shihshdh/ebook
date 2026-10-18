// 启动这几秒的长帧是谁造成的：无窗口 Edge 打开正式构建（vite preview），手机路径（390×844、DPR 3、CPU 降速 4 倍），
// 录启动后 N 秒的 Long Animation Frames（带脚本归属）+ CPU 采样，按脚本 / 函数汇总。
// 用法：npx vite preview --port 4180 先开着；node scripts/perf/startup-longtasks.mjs http://127.0.0.1:4180/ [秒数=6] [降速=4]
import { launch, openPage, sleep } from './cdp.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const [url = 'http://127.0.0.1:5192/', secs = '6', rate = '4'] = process.argv.slice(2);
const br = await launch({ port: 9351, profile: join(tmpdir(), 'ebook-continuation-startup'), headless: true, width: 1200, height: 1000 });
try {
  const p = await openPage(br.port);
  await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await p.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' });
  await p.send('Emulation.setCPUThrottlingRate', { rate: +rate });
  // 开屏每个会话只播一次；这里每次都是新标签，照常播
  await p.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    try { sessionStorage.removeItem('librarium.splash'); } catch {}
    window.__loaf = [];
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__loaf.push({ t: Math.round(e.startTime), d: Math.round(e.duration), b: Math.round(e.blockingDuration || 0),
      s: (e.scripts || []).map(s => ({ d: Math.round(s.duration), f: s.sourceFunctionName || '', u: (s.sourceURL || '').split('/').pop(), c: s.sourceCharPosition, i: s.invoker || '' })) }); })
      .observe({ type: 'long-animation-frame', buffered: true }); } catch {}` });
  await p.send('Profiler.enable'); await p.send('Profiler.setSamplingInterval', { interval: 500 }); await p.send('Profiler.start');
  await p.send('Page.navigate', { url });
  await sleep(+secs * 1000);
  const { profile } = await p.send('Profiler.stop');
  const ready = await p.eval(`({ hero: !!document.querySelector('.hero-title'), books: !!document.querySelector('.discshelf .disc'), scripts: [...document.scripts].map(s=>s.src), errors: document.body.innerText.slice(0, 100) })`);
  console.log('页面确认', JSON.stringify(ready));
  if (!ready.hero) throw Error('首页未挂载，测量无效');
  const loaf = await p.eval('window.__loaf');
  const long = loaf.filter(l => l.d > 50).sort((a, b) => b.d - a.d);
  console.log(`启动 ${secs} 秒内长帧 ${long.length} 个，合计阻塞 ${long.reduce((a, l) => a + l.b, 0)}ms：`);
  for (const l of long.slice(0, 12)) console.log(`  @${l.t}ms ${l.d}ms 阻塞${l.b}  ` + l.s.slice(0, 3).map(s => `${s.d}ms ${s.f || '(anon)'} ${s.u}:${s.c} [${s.i.slice(0, 40)}]`).join(' | '));
  if (process.argv[5]) { mkdirSync('release/verification', { recursive: true }); writeFileSync(process.argv[5], JSON.stringify({ url, ready, secs, rate, loaf, blocking: long.reduce((a,l)=>a+l.b,0) }, null, 2)); }
  const byId = new Map(profile.nodes.map(n => [n.id, n])), parent = new Map();
  for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const self = new Map(), total = new Map();
  profile.samples.forEach((id, i) => {
    const ms = (profile.timeDeltas[i] || 0) / 1000, cf = byId.get(id).callFrame;
    if (/^\((idle|program|root)\)$/.test(cf.functionName)) return;
    const k = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber + 1}:${cf.columnNumber + 1}`;
    self.set(k, (self.get(k) || 0) + ms);
    const seen = new Set();
    for (let cur = id; cur != null; cur = parent.get(cur)) { const c = byId.get(cur).callFrame; const kk = `${c.functionName || '(anon)'} ${c.url.split('/').pop()}:${c.lineNumber + 1}:${c.columnNumber + 1}`; if (c.url && !seen.has(kk)) { seen.add(kk); total.set(kk, (total.get(kk) || 0) + ms); } }
  });
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${v.toFixed(0).padStart(6)}ms ${k}`).join('\n  ');
  console.log('自身耗时前 15：\n  ' + top(self, 15));
  console.log('含子调用前 15：\n  ' + top(total, 15));
} finally { await br.close?.(); }
