// 追踪里某个时间点（毫秒，tasks.mjs 打印的 @时间）那个长任务的完整事件树（含参数）和同期的瞬时事件。用法：node taskdump.mjs <trace.json> <时间> [最短毫秒]
import { readFileSync } from 'node:fs';
const [file, at, min = 0.3] = process.argv.slice(2);
const ev = JSON.parse(readFileSync(file, 'utf8'));
const busy = {}; for (const e of ev) if (e.ph === 'X' && e.dur) busy[e.tid] = (busy[e.tid] || 0) + e.dur;
const tid = +Object.entries(busy).sort((a, b) => b[1] - a[1])[0][0];
const main = ev.filter(e => e.tid === tid && e.ph === 'X' && e.dur).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
const t0 = main[0].ts;
const task = main.find(e => /RunTask/.test(e.name) && Math.abs((e.ts - t0) / 1000 - at) < 3 && e.dur > 40000);
const inside = main.filter(e => e !== task && e.ts >= task.ts && e.ts + e.dur <= task.ts + task.dur);
const stack = [];
for (const e of inside) {
  while (stack.length && stack.at(-1).ts + stack.at(-1).dur <= e.ts) stack.pop();
  if (e.dur > min * 1000) console.log('  '.repeat(stack.length) + `${(e.dur / 1000).toFixed(1)} ${e.name} ${JSON.stringify(e.args || {}).slice(0, 200)}`);
  stack.push(e);
}
// 同时间段内的 instant 事件
const inst = ev.filter(e => e.tid === tid && (e.ph === 'I' || e.ph === 'i' || e.ph === 'n' || e.ph === 'b' || e.ph === 'e') && e.ts >= task.ts && e.ts <= task.ts + task.dur);
for (const e of inst.slice(0, 60)) console.log('I', ((e.ts - task.ts) / 1000).toFixed(1), e.name, JSON.stringify(e.args || {}).slice(0, 200));
