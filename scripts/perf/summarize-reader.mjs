// Recompute medians from raw runs; no benchmark data is edited by hand.
import {readFileSync,writeFileSync} from 'node:fs';
const labels=['baseline','step1-android-bytes','step2-decode','step3-window-priority','step4-visible-first','step5-current-bytes','step6-open-parallel','baseline-confirm','final'];
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
const fmt=n=>Number(n.toFixed(1));
let md='| 阶段 | 模式 | 首图 ms | 换话 ms | p95 | p99 | 最长帧 ms | >33.4ms 帧 | 最长长任务 ms | 阻塞合计 ms | heap 前→后 MiB | 第31张 URL数 |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|\n';
for(const label of labels){let data;try{data=JSON.parse(readFileSync(`scripts/perf/results/${label}.json`))}catch{continue}for(const mode of ['scroll','page']){const rows=data.runs.filter(r=>r.mode===mode);if(rows.length!==3)throw Error(`${label} ${mode}: expected three runs`);const m=k=>fmt(median(rows.map(r=>r[k])));md+=`| ${label} | ${mode} | ${m('first')} | ${m('next')} | ${m('p95')} | ${m('p99')} | ${m('max')} | ${m('over33')} | ${m('longMax')} | ${m('longBlocking')} | ${fmt(median(rows.map(r=>r.heapBefore))/1048576)}→${fmt(median(rows.map(r=>r.heapAfter))/1048576)} | ${median(rows.map(r=>r.checkpoints.at(-1).urls))} |\n`;}}
writeFileSync('scripts/perf/results/summary.md',md);console.log(md);
