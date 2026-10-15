// 客户端里的流畅度测量（漫画只有客户端能用，网页版跨域连不上漫画源，measure.mjs 测不到）。
// 连正在跑的客户端（WebView2 调试端口），录帧、指标和 measure.mjs 一样：帧数 / 平均 / p95 / p99 / 最长 / 掉帧 / 长任务卡顿。
// 用法：WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223 打开客户端（正式版：src-tauri/target/release/EBOOK.exe），
//       node scripts/perf/measure-app.mjs <out.json> [mobile|desktop] [场景,场景] [端口 9223]
// mobile：390×844、DPR 3、CPU 降速 4 倍、触屏（同 measure.mjs 的手机路径）
import { connect, sleep } from './cdp.mjs';
import { writeFileSync } from 'node:fs';

const [out = 'perf-app.json', mode = 'mobile', only = '', port = '9223'] = process.argv.slice(2);
const mobile = mode === 'mobile';
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const target = targets.find(t => t.type === 'page' && /tauri\.localhost|localhost:5181/.test(t.url)) || targets.find(t => t.type === 'page');
const p = await connect(target.webSocketDebuggerUrl);
p.eval = async (expr) => { const r = await p.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const results = { mode, at: new Date().toISOString() };
try {
  if (mobile) {
    await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await p.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await p.eval(`location.hash = '#/'; location.reload(); 1`);
  for (let i = 0; i < 80; i++) { await sleep(500); if (await p.eval(`!!document.querySelector('.discshelf .disc') && !document.querySelector('.splash')`).catch(() => false)) break; }
  await sleep(1500);
  await p.eval(`(() => {
    window.__rec = null; window.__loaf = [];
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__loaf.push({ t: e.startTime, d: e.duration, b: e.blockingDuration || 0 }); }).observe({ type: 'long-animation-frame', buffered: false }); } catch {}
    window.__start = () => { const r = { t: [] }; window.__rec = r; window.__loaf = []; const loop = (now) => { if (window.__rec !== r) return; r.t.push(now); requestAnimationFrame(loop); }; requestAnimationFrame(loop); };
    window.__stop = () => { const r = window.__rec; window.__rec = null; return { t: r ? r.t : [], loaf: window.__loaf }; };
    return 1;
  })()`);
  await p.eval('__start()'); await sleep(1000);
  const idle = await p.eval('__stop()');
  const iv = idle.t.slice(1).map((t, i) => t - idle.t[i]).sort((a, b) => a - b);
  const vsync = iv[Math.floor(iv.length / 2)] || 16.7;
  results.vsync = +vsync.toFixed(2);

  const mx = mobile ? 195 : 720, my = mobile ? 500 : 520;
  const touchScroll = async (dy, steps = 12, x = mx, y0 = 700) => {
    await p.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let i = 1; i <= steps; i++) { await p.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - dy * i / steps }] }); await sleep(16); }
    await p.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const wheel = (dy) => p.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: mx, y: my, deltaX: 0, deltaY: dy });
  const scrollBy = async (total) => {
    if (mobile) { for (let d = 0; d < Math.abs(total); d += 300) { await touchScroll(Math.sign(total) * 300); await sleep(60); } return; }
    for (let d = 0; d < Math.abs(total); d += 120) { await wheel(Math.sign(total) * 120); await sleep(16); }
  };
  const tap = async (sel) => {
    const c = await p.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 60) }; })()`);
    if (!c) return false;
    if (mobile) { await p.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [c] }); await sleep(50); await p.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    else { await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...c, button: 'left', clickCount: 1 }); await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...c, button: 'left', clickCount: 1 }); }
    return true;
  };
  const nav = (label) => p.eval(`(() => { const a = [...document.querySelectorAll('a, button')].find(e => e.textContent.trim() === ${JSON.stringify(label)} && e.offsetParent); if (a) a.click(); return !!a; })()`);
  const kind = (label) => p.eval(`(() => { const b = [...document.querySelectorAll('.route.is-active .explore-kind .chip')].find(b => b.textContent === ${JSON.stringify(label)}); if (b) b.click(); return !!b; })()`);
  const scrollTo = (y) => p.eval(`(window.scrollTo(0, ${y}), true)`);
  const until = (expr, ms = 15000) => p.eval(`(async () => { const t = Date.now(); while (Date.now() - t < ${ms}) { if (${expr}) return true; await new Promise(r => setTimeout(r, 100)); } return false; })()`);

  // PROFILE=场景,场景：录 CPU 采样，按函数自身耗时、按脚本来源（主程序 / 漫画源沙箱 / 浏览器内部）汇总
  const scenario = async (name, fn) => {
    if (only && !only.split(',').includes(name)) return;
    const prof = process.env.PROFILE && process.env.PROFILE.split(',').includes(name);
    if (prof) { await p.send('Profiler.enable'); await p.send('Profiler.setSamplingInterval', { interval: 300 }); await p.send('Profiler.start'); }
    await p.eval('__start()');
    const t0 = Date.now();
    await fn();
    await sleep(400);
    const r = await p.eval('__stop()');
    if (prof) {
      const { profile } = await p.send('Profiler.stop');
      const byId = new Map(profile.nodes.map(n => [n.id, n]));
      const self = new Map(), bySrc = new Map();
      profile.samples.forEach((id, i) => {
        const n = byId.get(id), ms = (profile.timeDeltas[i] || 0) / 1000, cf = n.callFrame;
        if (/^\((idle|program|root)\)$/.test(cf.functionName)) return;
        const file = cf.url ? cf.url.split('/').pop().split('?')[0] || cf.url.slice(0, 30) : (cf.functionName.startsWith('(') ? cf.functionName : '(内置)');
        const k = `${cf.functionName || '(anon)'} ${file}:${cf.lineNumber + 1}`;
        self.set(k, (self.get(k) || 0) + ms);
        const src = !cf.url ? cf.functionName.startsWith('(') ? cf.functionName : '(内置)' : /^about:srcdoc|srcdoc/.test(cf.url) ? '漫画源沙箱' : /tauri\.localhost|localhost:5181/.test(cf.url) ? '主程序 ' + file.replace(/-[\w-]{8}\.js$/, '') : cf.url.slice(0, 40);
        bySrc.set(src, (bySrc.get(src) || 0) + ms);
      });
      const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${v.toFixed(0).padStart(6)}ms ${k}`).join('\n     ');
      console.log(`   ${name} 按来源：\n     ` + top(bySrc, 10) + `\n   自身耗时前 16：\n     ` + top(self, 16));
      // 最耗时的几个浏览器内置调用（offsetHeight 这种强制排版）是谁调的：往上找第一个有源文件的调用者，带三层
      const parent = new Map(); for (const n of profile.nodes) for (const ch of n.children || []) parent.set(ch, n.id);
      const callers = new Map();
      profile.samples.forEach((id, i) => {
        const n = byId.get(id); if (n.callFrame.url) return;
        if (!/^(get |set )?(offset|client|scroll|getBoundingClientRect|getComputedStyle|innerText)/.test(n.callFrame.functionName)) return;
        const chain = []; for (let cur = parent.get(id); cur != null && chain.length < 3; cur = parent.get(cur)) { const cf = byId.get(cur).callFrame; if (cf.url) chain.push(`${cf.functionName || '(anon)'}@${cf.url.split('/').pop().replace(/-[\w-]{8}\.js$/, '')}:${cf.lineNumber + 1}:${cf.columnNumber + 1}`); }
        const k = n.callFrame.functionName + ' ← ' + chain.join(' ← ');
        callers.set(k, (callers.get(k) || 0) + (profile.timeDeltas[i] || 0) / 1000);
      });
      if (callers.size) console.log('   强制排版的调用者：\n     ' + top(callers, 8));
    }
    const gaps = r.t.slice(1).map((t, i) => t - r.t[i]);
    const sorted = [...gaps].sort((a, b) => a - b);
    const q = (x) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * x))] || 0;
    const dropped = gaps.reduce((n, g) => n + Math.max(0, Math.round(g / vsync) - 1), 0);
    results[name] = {
      ms: Date.now() - t0, frames: gaps.length, fps: +(gaps.length / ((r.t.at(-1) - r.t[0]) / 1000 || 1)).toFixed(1),
      p95: +q(.95).toFixed(1), p99: +q(.99).toFixed(1), max: +(sorted.at(-1) || 0).toFixed(1),
      dropped, over33: gaps.filter(g => g > 33.4).length, loafMax: +Math.max(0, ...r.loaf.map(l => l.d)).toFixed(0), blocking: +r.loaf.reduce((a, l) => a + l.b, 0).toFixed(0),
    };
    console.log(name.padEnd(18), JSON.stringify(results[name]));
  };

  // 轻小说的老场景（和 measure.mjs 同名，方便对照）
  await scenario('disc-flip', async () => {
    await scrollTo(0); await p.eval(`document.querySelector('.route.is-active .discshelf')?.scrollIntoView({ block: 'center' }), 1`); await sleep(500);
    for (let i = 0; i < 6; i++) { await p.eval(`document.querySelector('.route.is-active .discshelf .disc-stage')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })), 1`); await sleep(650); }
  });
  await scenario('home-scroll', async () => { await scrollTo(0); await sleep(300); await scrollBy(3600); await sleep(200); await scrollBy(-3600); });
  await scenario('page-switch', async () => { await scrollTo(0); for (const l of ['探索', '搜索', '书架', '插件', '首页', '探索', '首页']) { await nav(l); await sleep(700); } });
  await scenario('explore-scroll', async () => { await nav('探索'); await sleep(500); await kind('轻小说'); await sleep(600); await scrollTo(0); await sleep(300); await scrollBy(5000); await sleep(200); await scrollBy(-5000); });
  // 漫画
  await scenario('kind-toggle', async () => { await nav('探索'); await sleep(500); await scrollTo(0); for (const k of ['漫画', '轻小说', '漫画', '轻小说', '漫画', '轻小说']) { await kind(k); await sleep(900); } });
  await scenario('comic-tab-open', async () => { await nav('探索'); await sleep(400); await scrollTo(0); await kind('漫画'); await sleep(3000); });
  await scenario('comic-disc-flip', async () => {
    await p.eval(`document.querySelector('.cx-top')?.scrollIntoView({ block: 'center' }), 1`); await sleep(500);
    for (let i = 0; i < 6; i++) { await p.eval(`document.querySelector('.cx-top .disc-stage')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })), 1`); await sleep(650); }
  });
  await scenario('comic-wall-scroll', async () => { await scrollTo(0); await sleep(300); await scrollBy(6000); await sleep(200); await scrollBy(-6000); });
  await scenario('comic-sheet-open', async () => {
    await p.eval(`document.querySelector('.route.is-active .explore-comic .mw-tile')?.scrollIntoView({ block: 'center' }), 1`); await sleep(400);
    await tap('.route.is-active .explore-comic .mw-tile'); await until(`document.querySelectorAll('.sheet .cx-chapter-list li').length > 0`, 20000); await sleep(800);
  });
  await scenario('comic-reader', async () => {
    await p.eval(`[...document.querySelectorAll('.sheet .cs-read-row button')].find(b => /开始看|继续看/.test(b.textContent))?.click(), 1`);
    await until(`[...document.querySelectorAll('.cr-scroll img')].some(i => i.complete && i.naturalWidth)`, 30000); await sleep(800);
    for (let i = 0; i < 8; i++) { if (mobile) await touchScroll(500, 12, 195, 700); else for (let k = 0; k < 4; k++) await wheel(120); await sleep(150); }
  });
  await scenario('comic-reader-exit', async () => { await p.eval(`history.back(), 1`); await sleep(1500); });
  await scenario('search-comic', async () => {
    await p.eval(`location.hash = '#/search?q=' + encodeURIComponent('咒术回战'), 1`);
    await until(`/漫画 [1-9]/.test(document.querySelector('.route.is-active .results-count')?.textContent || '')`, 30000); await sleep(1500); await scrollBy(2000);
  });
  writeFileSync(out, JSON.stringify(results, null, 1));
} finally {
  await p.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
  await p.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
  await p.send('Emulation.setTouchEmulationEnabled', { enabled: false }).catch(() => {});
  p.close();
}
