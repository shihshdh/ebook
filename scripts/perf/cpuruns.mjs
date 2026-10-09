// cpuprofile（measure.mjs 的 PROFILE=场景）：主线程上连续忙超过 N 毫秒的片段，每段按函数汇总总耗时，滤掉 React 内部函数。用法：node cpuruns.mjs <x.cpuprofile> [N]
import { readFileSync } from 'node:fs';
const [file, min = 40] = process.argv.slice(2);
const prof = JSON.parse(readFileSync(file, 'utf8'));
const byId = new Map(prof.nodes.map(n => [n.id, n]));
const parent = new Map(); for (const n of prof.nodes) for (const c of n.children || []) parent.set(c, n.id);
const stackOf = (id) => { const s = []; for (let c = id; c != null; c = parent.get(c)) s.push(byId.get(c)); return s; };
const idle = (n) => /^\((idle|program|garbage collector)\)$/.test(n.callFrame.functionName);
let t = prof.startTime, seg = null; const segs = [];
prof.samples.forEach((id, i) => {
  t += prof.timeDeltas[i] || 0;
  const n = byId.get(id);
  if (idle(n) || n.callFrame.functionName === '(root)') { if (seg) { segs.push(seg); seg = null; } return; }
  if (!seg) seg = { t0: t, t1: t, samples: [] };
  seg.t1 = t; seg.samples.push([id, prof.timeDeltas[i + 1] || 0]);
});
if (seg) segs.push(seg);
const key = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`;
for (const s of segs) {
  const d = (s.t1 - s.t0) / 1000;
  if (d < min) continue;
  const tot = new Map();
  for (const [id, dt] of s.samples) { const seen = new Set(); for (const n of stackOf(id)) { const k = key(n); if (seen.has(k)) continue; seen.add(k); tot.set(k, (tot.get(k) || 0) + dt / 1000); } }
  const ours = [...tot].filter(([k]) => !/^(\(root\)|R2 |J2 |Gk |Ik |Tk |Vk |Uk |Pk |Wk |Sk |Ek |jg |Nh |cj |Bj |Ej |dk |q index)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 9);
  console.log(`@${((s.t0 - prof.startTime) / 1000).toFixed(0)}ms 连续 ${d.toFixed(0)}ms: ` + ours.map(([k, v]) => `${k} ${v.toFixed(0)}`).join(' | '));
}
