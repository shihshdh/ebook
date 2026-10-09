// 追踪里和衬线字体有关的事件：BeginRemoteFontLoad（谁触发的：排字时现下 = ShapeText，预取 = FunctionCall）、字体到达后的整页失效。用法：node fontev.mjs <trace.json>
import { readFileSync } from 'node:fs';
const [file] = process.argv.slice(2);
const ev = JSON.parse(readFileSync(file, 'utf8'));
const busy = {}; for (const e of ev) if (e.ph === 'X' && e.dur) busy[e.tid] = (busy[e.tid] || 0) + e.dur;
const tid = +Object.entries(busy).sort((a, b) => b[1] - a[1])[0][0];
const main = ev.filter(e => e.tid === tid).sort((a, b) => a.ts - b.ts);
const t0 = main.find(e => e.ph === 'X').ts;
const xs = main.filter(e => e.ph === 'X' && e.dur);
const parentOf = (e) => xs.filter(p => p !== e && p.ts <= e.ts && p.ts + p.dur >= e.ts + e.dur && /^(InlineNode::ShapeText|StyleEngine::|Layout$|FireIdleCallback|FunctionCall|EventDispatch|EventHandler)/.test(p.name)).map(p => p.name + (p.name === 'Layout' ? '(' + p.args?.beginData?.dirtyObjects + ')' : '')).join(' > ');
for (const e of main) {
  if (e.name === 'BeginRemoteFontLoad' || e.name === 'StyleEngine::InvalidateStyleAndLayoutForFontUpdates' )
    console.log(((e.ts - t0) / 1000).toFixed(0).padStart(6), e.name, e.dur ? (e.dur / 1000).toFixed(1) + 'ms' : '', (e.args?.url || '').split('/').pop(), '|', parentOf(e));
}
