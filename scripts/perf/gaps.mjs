// 追踪里 rAF 间隔超过 N ms 的地方：间隔里主线程上每个任务（RunTask）按事件名汇总。用法：node gaps.mjs <trace.json> [N=33]
import { readFileSync } from 'node:fs';
const [file, min = 33] = process.argv.slice(2);
const ev = JSON.parse(readFileSync(file, 'utf8')).filter(e => e.ph === 'X' && e.dur);
const busy = {}; for (const e of ev) busy[e.tid] = (busy[e.tid] || 0) + e.dur;
const tid = +Object.entries(busy).sort((a, b) => b[1] - a[1])[0][0];
const main = ev.filter(e => e.tid === tid).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
const t0 = main[0].ts;
const raf = main.filter(e => e.name === 'FireAnimationFrame').map(e => e.ts);
const tasks0 = main.filter(e => e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask');
const tasks = tasks0.filter(t => !tasks0.some(o => o !== t && o.ts <= t.ts && o.ts + o.dur >= t.ts + t.dur && o.dur > t.dur));
const want = /^(FunctionCall|EventDispatch|TimerFire|FireAnimationFrame|RunMicrotasks|Layout|UpdateLayoutTree|Paint|PrePaint|Commit|HitTest|MajorGC|MinorGC|Layerize|IntersectionObserverController::computeIntersections|ParseAuthorStyleSheet|Decode Image|v8.run|ResourceReceivedData|StyleEngine::InvalidateStyleAndLayoutForFontUpdates)$/;
let n = 0;
for (let i = 1; i < raf.length; i++) {
  const gap = (raf[i] - raf[i - 1]) / 1000;
  if (gap < min) continue;
  n++;
  console.log(`@${((raf[i - 1] - t0) / 1000).toFixed(0)}ms 间隔 ${gap.toFixed(1)}ms`);
  for (const t of tasks) {
    if (t.ts + t.dur < raf[i - 1] || t.ts > raf[i] || t.dur < 2000) continue;
    const sum = {};
    for (const e of main) if (e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e !== t && want.test(e.name)) {
      const k = e.name === 'FunctionCall' ? `FC(${e.args?.data?.functionName || '?'})` : e.name === 'EventDispatch' ? `Ev(${e.args?.data?.type})` : e.name;
      sum[k] = (sum[k] || 0) + e.dur / 1000;
    }
    console.log(`   +${((t.ts - raf[i - 1]) / 1000).toFixed(0)} 任务 ${(t.dur / 1000).toFixed(1)}ms: ` + Object.entries(sum).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' | '));
  }
}
console.log('间隔 >', min, 'ms 共', n, '次；rAF', raf.length, '次');
