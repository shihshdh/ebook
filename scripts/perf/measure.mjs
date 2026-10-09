// 流畅度测量：有界面的 Edge（真显卡、按屏幕刷新率跑），CDP 发真实的滚轮 / 鼠标 / 触摸事件，
// 页面里记 rAF 帧间隔 + Long Animation Frames，按场景出 帧数 / 平均 / p95 / p99 / 最长 / 掉帧数。
// 用法：node measure.mjs <scratch> <url> <out.json> [desktop|mobile] [场景,场景]
import { launch, openPage, sleep } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
const [S, base, out, mode = 'desktop', only = ''] = process.argv.slice(2);
const mobile = mode === 'mobile';
const br = await launch({ port: 9334, profile: S + '/edge-measure', width: 1480, height: 1000 });
const results = {};
try {
  const p = await openPage(br.port);
  if (mobile) {
    await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await p.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  } else {
    await p.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  }
  if (process.env.BLOCK) { await p.send('Network.enable'); await p.send('Network.setBlockedURLs', { urls: ['*wsrv.nl*', '*i0.wp.com*', '*bgm.tv*', '*img.wenku8*'] }); }
  // FONTS=google：fonts.loli.net（Google Fonts 的国内镜像）换成 fonts.googleapis.com，返回的 CSS 里字体文件直接走 fonts.gstatic.com。
  // 云端连不上 loli.net，不换的话衬线字体一直是本机后备字体，测不到「等网络字体、到了再重排」那一段
  if (process.env.FONTS === 'google') {
    p.on('Fetch.requestPaused', e => p.send('Fetch.continueRequest', { requestId: e.requestId, url: e.request.url.replace('//fonts.loli.net/', '//fonts.googleapis.com/') }).catch(() => {}));
    await p.send('Fetch.enable', { patterns: [{ urlPattern: '*fonts.loli.net*', requestStage: 'Request' }] });
  }
  if (process.env.HIDEGEN) await p.send('Page.addScriptToEvaluateOnNewDocument', { source: `document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.cover.is-gen img { display: none !important; }'; document.head.appendChild(s); });` });
  await p.send('Page.navigate', { url: base + '#/' });
  // 等书库和首页就绪、开屏播完
  for (let i = 0; i < 80; i++) { await sleep(500); if (await p.eval(`!!document.querySelector('.discshelf .disc') && !document.querySelector('.splash')`).catch(() => false)) break; }
  await sleep(+process.env.IDLE || 1500);
  await p.eval(`(() => {
    window.__rec = null;
    window.__loaf = [];
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__loaf.push({ t: e.startTime, d: e.duration, b: e.blockingDuration || 0, render: e.renderStart ? e.startTime + e.duration - e.renderStart : 0, style: e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0, scripts: (e.scripts || []).map(x => ({ d: Math.round(x.duration), f: Math.round(x.forcedStyleAndLayoutDuration || 0), inv: x.invoker, fn: x.sourceFunctionName, src: (x.sourceURL || '').split('/').pop() + ':' + (x.sourceCharPosition ?? '') })).sort((a, b) => b.d - a.d).slice(0, 4) }); }).observe({ type: 'long-animation-frame', buffered: false }); } catch {}
    window.__start = () => { const r = { t: [] }; window.__rec = r; window.__loaf = []; const loop = (now) => { if (window.__rec !== r) return; r.t.push(now); requestAnimationFrame(loop); }; requestAnimationFrame(loop); };
    window.__stop = () => { const r = window.__rec; window.__rec = null; const loaf = window.__loaf; return { t: r ? r.t : [], loaf }; };
  })()`);

  // 屏幕刷新间隔（空闲时的 rAF 中位数）
  await p.eval('__start()'); await sleep(1000);
  const idle = await p.eval('__stop()');
  const iv = idle.t.slice(1).map((t, i) => t - idle.t[i]).sort((a, b) => a - b);
  const vsync = iv[Math.floor(iv.length / 2)] || 16.7;
  results.vsync = +vsync.toFixed(2);

  const mx = mobile ? 195 : 720, my = mobile ? 500 : 520;
  const wheel = async (dy, x = mx, y = my, dx = 0) => p.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: dx, deltaY: dy });
  const touchScroll = async (dy, steps = 12, x = mx, y0 = 700) => {
    await p.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let i = 1; i <= steps; i++) { await p.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - dy * i / steps }] }); await sleep(16); }
    await p.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const scrollBy = async (total, step = 120) => {
    if (mobile) { for (let d = 0; d < Math.abs(total); d += 300) { await touchScroll(Math.sign(total) * 300); await sleep(60); } return; }
    for (let d = 0; d < Math.abs(total); d += step) { await wheel(Math.sign(total) * step); await sleep(16); }
  };
  const click = (sel) => p.eval(`(() => { const el = typeof ${JSON.stringify(sel)} === 'string' ? document.querySelector(${JSON.stringify(sel)}) : null; if (!el) return false; el.click(); return true; })()`);
  const nav = (label) => p.eval(`(() => { const a = [...document.querySelectorAll('a, button')].find(e => e.textContent.trim() === ${JSON.stringify(label)} && e.offsetParent); if (a) a.click(); return !!a; })()`);
  const center = (sel) => p.eval(`(() => { const r = document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; })()`);
  const scrollTo = (y) => p.eval(`(window.scrollTo(0, ${y}), true)`);

  const scenario = async (name, fn) => {
    if (only && !only.split(',').includes(name)) return;
    const prof = process.env.PROFILE && process.env.PROFILE.split(',').includes(name);
    const trace = process.env.TRACE && process.env.TRACE.split(',').includes(name);
    const events = [];
    if (trace) {
      p.on('Tracing.dataCollected', e => events.push(...e.value));
      await p.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink', 'cc', 'gpu', 'v8.execute', 'disabled-by-default-devtools.timeline.stack'] } });
    }
    if (prof) { await p.send('Profiler.enable'); await p.send('Profiler.setSamplingInterval', { interval: 200 }); await p.send('Profiler.start'); }
    await p.eval('__start()');
    const t0 = Date.now();
    await fn();
    await sleep(400);
    const r = await p.eval('__stop()');
    if (trace) {
      const done = new Promise(res => p.on('Tracing.tracingComplete', res));
      await p.send('Tracing.end'); await done;
      writeFileSync(`${S}/perf/${name}.trace.json`, JSON.stringify(events));
      // 主线程（渲染进程里事件最多的线程）上，按事件名汇总；再列出最长的几个事件
      const main = {}; for (const e of events) if (e.ph === 'X' && e.dur) main[e.tid] = (main[e.tid] || 0) + e.dur;
      const tid = +Object.entries(main).sort((a, b) => b[1] - a[1])[0][0];
      const sum = {}, longs = [];
      for (const e of events) if (e.tid === tid && e.ph === 'X' && e.dur) {
        if (['ParseHTML', 'RunTask', 'ThreadControllerImpl::RunTask'].includes(e.name)) continue;
        sum[e.name] = (sum[e.name] || 0) + e.dur / 1000;
        if (e.dur > 15000 && !/^(RunTask|ThreadControllerImpl|ProxyMain::BeginMainFrame|WebFrameWidgetImpl::UpdateLifecycle|LocalFrameView::|PageAnimator|Document::|ScheduledAction|V8\.|v8\.|EventDispatch$|FunctionCall$|EvaluateScript$|TimerFire$|FireAnimationFrame$)/.test(e.name)) longs.push(`${(e.dur / 1000).toFixed(1)}ms ${e.name} ${JSON.stringify(e.args?.beginData || e.args?.data || {}).slice(0, 110)}`);
      }
      // 所有线程：线程名 + 最长的事件（看显卡进程、光栅化线程有没有卡）
      const tname = {}; for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') tname[e.pid + ':' + e.tid] = e.args.name;
      const other = events.filter(e => e.ph === 'X' && e.dur > 12000 && e.tid !== tid && !/RunTask|ThreadController|ThreadPool_RunTask|TaskGraphRunner|MessageLoop|SequenceManager/.test(e.name));
      console.log('   其他线程长事件：' + String.fromCharCode(10) + '     ' + other.sort((a, b) => b.dur - a.dur).slice(0, 14).map(e => `${(e.dur / 1000).toFixed(1)}ms [${tname[e.pid + ':' + e.tid] || e.tid}] ${e.name} ${JSON.stringify(e.args?.data || {}).slice(0, 80)}`).join(String.fromCharCode(10) + '     '));
      console.log('   主线程按类汇总：' + Object.entries(sum).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(' | '));
      console.log('   单个长事件：' + String.fromCharCode(10) + '     ' + longs.sort((a, b) => parseFloat(b) - parseFloat(a)).slice(0, 16).join(String.fromCharCode(10) + '     '));
    }
    if (prof) {
      const { profile } = await p.send('Profiler.stop');
      writeFileSync(`${S}/perf/${name}.cpuprofile`, JSON.stringify(profile));
      // 自身耗时（self）按函数汇总；再按「源文件里的组件」汇总总耗时（含子调用）
      const byId = new Map(profile.nodes.map(n => [n.id, n]));
      const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
      const dt = new Map(); profile.samples.forEach((id, i) => dt.set(id, (dt.get(id) || 0) + (profile.timeDeltas[i] || 0) / 1000));
      const self = new Map(), total = new Map();
      const key = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`;
      for (const [id, ms] of dt) {
        const n = byId.get(id); self.set(key(n), (self.get(key(n)) || 0) + ms);
        const seen = new Set();
        for (let cur = id; cur != null; cur = parent.get(cur)) { const k = key(byId.get(cur)); if (!seen.has(k)) { seen.add(k); total.set(k, (total.get(k) || 0) + ms); } }
      }
      const top = (m, n) => [...m].filter(([k]) => !/^\((root|idle|program)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${v.toFixed(0).padStart(5)}ms ${k}`).join(String.fromCharCode(10) + '     ');
      console.log('   自身耗时前 14：' + String.fromCharCode(10) + '     ' + top(self, 14));
      console.log('   总耗时前 22（含子调用）：' + String.fromCharCode(10) + '     ' + top(total, 22));
    }
    const gaps = r.t.slice(1).map((t, i) => t - r.t[i]);
    const sorted = [...gaps].sort((a, b) => a - b);
    const q = (x) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * x))] || 0;
    const dropped = gaps.reduce((n, g) => n + Math.max(0, Math.round(g / vsync) - 1), 0);
    results[name] = {
      ms: Date.now() - t0, frames: gaps.length, fps: +(gaps.length / ((r.t.at(-1) - r.t[0]) / 1000 || 1)).toFixed(1),
      mean: +(gaps.reduce((a, b) => a + b, 0) / (gaps.length || 1)).toFixed(2), p95: +q(.95).toFixed(1), p99: +q(.99).toFixed(1), max: +(sorted.at(-1) || 0).toFixed(1),
      dropped, over33: gaps.filter(g => g > 33.4).length, loaf: r.loaf.length, loafMax: +Math.max(0, ...r.loaf.map(l => l.d)).toFixed(0), blocking: +r.loaf.reduce((a, l) => a + l.b, 0).toFixed(0),
    };
    console.log(name.padEnd(16), JSON.stringify(results[name]));
    if (process.env.DETAIL) for (const l of r.loaf.filter(l => l.d > 12).sort((a, b) => b.d - a.d).slice(0, 6)) console.log('   长帧', Math.round(l.d) + 'ms', '渲染', Math.round(l.render), '样式布局', Math.round(l.style), JSON.stringify(l.scripts));
  };

  await scenario('home-scroll', async () => { await scrollTo(0); await sleep(300); await scrollBy(3600); await sleep(200); await scrollBy(-3600); });
  await scenario('disc-flip', async () => {
    await p.eval(`document.querySelector('.disc-stage').scrollIntoView({ block: 'center' })`); await sleep(500);
    const c = await center('.disc-stage');
    if (mobile) { for (let k = 0; k < 6; k++) { await p.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x + 100, y: c.y }] }); for (let i = 1; i <= 10; i++) { await p.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x + 100 - 20 * i, y: c.y }] }); await sleep(16); } await p.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(350); } }
    else for (let k = 0; k < 24; k++) { await wheel(110, c.x, c.y); await sleep(45); }
    await sleep(800);
  });
  await scenario('page-switch', async () => { await scrollTo(0); for (const l of ['探索', '搜索', '书架', '插件', '首页', '探索', '首页']) { await nav(l); await sleep(700); } });
  await scenario('world-switch', async () => {
    await nav('探索'); await sleep(600); await scrollTo(0); await sleep(300);
    for (const g of ['幻', '青', '星', '恋', '谜']) { await p.eval(`[...document.querySelectorAll('.ws-cap')].find(b => b.querySelector('.ws-cap-glyph').textContent === '${g}')?.click()`); await sleep(1100); }
    await p.eval(`document.querySelector('.ws-all')?.click()`); await sleep(900);
  });
  await scenario('explore-scroll', async () => { await nav('探索'); await sleep(500); await scrollTo(0); await sleep(300); await scrollBy(5000); await sleep(200); await scrollBy(-5000); });
  await scenario('sheet-open', async () => {
    await nav('探索'); await sleep(400); await scrollTo(700); await sleep(500);
    for (let k = 0; k < 3; k++) {
      await p.eval(`[...document.querySelectorAll('.mw-tile')].filter(e => e.getBoundingClientRect().top > 0 && e.getBoundingClientRect().top < innerHeight - 200)[${k}]?.click()`);
      await sleep(1000);
      await p.eval(`document.querySelector('.sheet-close')?.click()`); await sleep(800);
    }
  });
  await scenario('search-type', async () => {
    await nav('搜索'); await sleep(600);
    await p.eval(`document.querySelector('.search-box input').focus()`);
    for (const ch of ['魔', '女', '之', '旅']) { await p.send('Input.insertText', { text: ch }); await sleep(180); }
    await sleep(600); await scrollBy(1500); await sleep(200); await scrollBy(-1500);
    await p.eval(`document.querySelector('.search-box button[aria-label=清空]')?.click()`);
  });
  writeFileSync(out, JSON.stringify(results, null, 1));
  console.log('vsync', results.vsync, 'ms');
} finally { await br.close(); }
