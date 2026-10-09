// 主线程上超过 N 毫秒的任务：每个任务里按事件名汇总（只算任务内最外层的几类）
import { readFileSync } from 'node:fs';
const [file, min = 50] = process.argv.slice(2);
const ev = JSON.parse(readFileSync(file, 'utf8')).filter(e => e.ph === 'X' && e.dur);
const busy = {}; for (const e of ev) busy[e.tid] = (busy[e.tid] || 0) + e.dur;
const tid = +Object.entries(busy).sort((a, b) => b[1] - a[1])[0][0];
const main = ev.filter(e => e.tid === tid).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
const tasks0 = main.filter(e => (e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask') && e.dur > min * 1000); const tasks = tasks0.filter(t => !tasks0.some(o => o !== t && o.ts <= t.ts && o.ts + o.dur >= t.ts + t.dur && o.dur > t.dur));
const want = /^(FunctionCall|EventDispatch|TimerFire|FireAnimationFrame|RunMicrotasks|Layout|UpdateLayoutTree|Paint|PrePaint|ParseHTML|Commit|HitTest|IntersectionObserverController::computeIntersections|ResizeObserverController::BroadcastObservations|MajorGC|MinorGC|V8.GC_SCAVENGER|V8.GCScavenger|V8.GC_MARK_COMPACTOR|EvaluateScript|v8.compile|V8.Execute|ResourceReceivedData|ResourceFinish|XHRReadyStateChange|ParseAuthorStyleSheet|Decode Image|Layerize|HandlePostMessage|v8.run)$/;
const t0 = main[0].ts;
for (const t of tasks) {
  const sum = {};
  for (const e of main) if (e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e !== t && want.test(e.name)) {
    const k = e.name === 'FunctionCall' ? `FunctionCall(${(e.args?.data?.functionName || '?')}@${String(e.args?.data?.url || '').split('/').pop()}:${e.args?.data?.lineNumber})` : e.name === 'EventDispatch' ? `Event(${e.args?.data?.type})` : e.name;
    sum[k] = (sum[k] || 0) + e.dur / 1000;
  }
  console.log(`@${((t.ts - t0) / 1000).toFixed(0)}ms 任务 ${(t.dur / 1000).toFixed(0)}ms: ` + Object.entries(sum).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(' | '));
}
