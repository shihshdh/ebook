// 长任务的事件树：嵌套深度 ≤ D，只列 > 2ms 的事件，带关键参数（函数、URL、强制排版的 JS 栈顶）
import { readFileSync } from 'node:fs';
const [file, min = 45, D = 6] = process.argv.slice(2);
const ev = JSON.parse(readFileSync(file, 'utf8')).filter(e => e.ph === 'X' && e.dur);
const busy = {}; for (const e of ev) busy[e.tid] = (busy[e.tid] || 0) + e.dur;
const tid = +Object.entries(busy).sort((a, b) => b[1] - a[1])[0][0];
const main = ev.filter(e => e.tid === tid).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
const t0 = main[0].ts;
const tasks0 = main.filter(e => (e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask') && e.dur > min * 1000);
const tasks = tasks0.filter(t => !tasks0.some(o => o !== t && o.ts <= t.ts && o.ts + o.dur >= t.ts + t.dur && o.dur > t.dur));
const skip = /^(ThreadControllerImpl::RunTask|RunTask|ProxyMain::BeginMainFrame|WebFrameWidgetImpl::|LocalFrameView::|Blink\.|PageAnimator|Document::|V8\.|v8\.(?!compile)|ScheduledAction|WidgetBase::|HTMLDocumentParser::|MessagePort::Accept|SequenceManager|TaskAnnotator|PaintController|PaintLayerPainter|Scheduler)/;
const fr = (s) => s ? `${s.functionName || '(anon)'}@${String(s.url).split('/').pop()}:${s.lineNumber}` : '';
const info = (e) => {
  const d = e.args?.data || e.args?.beginData || {};
  if (d.stackTrace?.length) return ' ⟵ ' + d.stackTrace.slice(0, 4).map(fr).join(' < ');
  if (d.functionName || d.url) return ` ${d.functionName || ''}@${String(d.url || '').split('/').pop()}:${d.lineNumber ?? ''}`;
  if (d.type) return ' ' + d.type;
  if (e.name === 'Layout') return ` dirty ${d.dirtyObjects}/${d.totalObjects}`;
  return '';
};
for (const t of tasks) {
  console.log(`@${((t.ts - t0) / 1000).toFixed(0)}ms 任务 ${(t.dur / 1000).toFixed(0)}ms`);
  const inside = main.filter(e => e !== t && e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && !skip.test(e.name));
  const stack = [];
  for (const e of inside) {
    while (stack.length && stack.at(-1).ts + stack.at(-1).dur <= e.ts) stack.pop();
    if (e.dur > 2000 && stack.length < D) console.log('  ' + '  '.repeat(stack.length) + `${(e.dur / 1000).toFixed(1)} ${e.name}${info(e)}`.slice(0, 260));
    stack.push(e);
  }
}
