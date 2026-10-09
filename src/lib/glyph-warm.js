// 书详情的字形预热：手指按下一本书时，在屏幕外按面板里的字重、字号把这本书的字先排一遍，抬手点开时字形已经是热的。
//
// 为什么：一个字第一次以某个「字重 × 字号」出现，浏览器要现算它的字形数据（分片早就下好了也一样，和下载无关）。
// 4 倍降速下每个新字 0.5–1ms；书详情的书名（700、24px）、简介（400、15px）是别处没用过的组合，每本书点开那一帧
// 光排字就二三十毫秒。同一本书关了再开（字形全热），最长帧 37–53 → 13–20ms。
// 字形数据按「字 × 字体 × 字号」记，和字在哪段话里无关——所以只排没排过的字，每次一小段，排完让出主线程。
//
// 从按下到点开（click）一般有七八十毫秒，够排完一本书的字；没排完的，点开那一帧照旧现算，不会比原来更慢。
// 手指一动变成滚动（pointercancel）就停：不在滚动开头占主线程。
//
// 槽位的类名、标签要和 BookSheet.jsx 里一致（字重、字号全靠它们），面板改了样式这里跟着改。
import { loadSerif } from './fonts.js';

const BUDGET = 6;    // 每段最多排多久（毫秒）
const CHUNK = 12;    // 每次往一个槽位里放几个字

// [标签, 类名, 用不用衬线字, 取字]；嵌套的写 'div.dl-head>h3' 这样
const SLOTS = [
  ['p', 'eyebrow', true, b => `${b.publisher || 'LIGHT NOVEL'}${b.aid ? ` · No.${b.aid}` : ''}`],   // Cinzel 只有拉丁字，中文落到衬线
  ['h2', 'sheet-title serif', true, b => b.title],
  ['p', 'sheet-alt', false, b => b.alt ? `又名 ${b.alt}` : ''],
  ['p', 'sheet-author', false, b => b.author],
  ['span', 'tag', false, b => [b.status, b.length && `${b.length} 字`].filter(Boolean).join('')],
  ['p', 'sheet-desc', true, b => b.description],
  ['span', 'chip chip-static', false, b => b.tags.join('')],
  ['p', 'sheet-note', false, b => b.blockedNote],
  ['div.dl-head>h3', '', true, b => b.downloads.map(d => d.kind === 'illustrated' ? d.label : '').join('')],
  ['div.dl-head>p', '', false, b => b.downloads.map(d => d.kind === 'illustrated' ? d.note : '').join('')],
  ['span', 'vol-title', false, b => b.downloads.map(d => d.volumes ? d.volumes.map(v => v.title).join('') : d.label || '').join('')],
  ['span.vol-title>small', 'muted', false, b => b.downloads.map(d => d.volumes ? '' : (d.note || '') + (d.pwd ? ` · 提取码 ${d.pwd}` : '')).join('')],
  ['p', 'sheet-source muted', false, b => `来源：${(b.poolSources || []).join('、')}`],
];

let slots = null;
function build() {
  const host = document.createElement('div');
  host.className = 'glyph-warm';
  host.setAttribute('aria-hidden', 'true');
  slots = SLOTS.map(([tag, cls, serif, text]) => {
    let parent = host, el;
    for (const part of tag.split('>')) {
      const [name, pcls] = part.split('.');
      el = document.createElement(name);
      if (pcls) el.className = pcls;
      parent.appendChild(el);
      parent = el;
    }
    if (cls) el.className = cls;
    return { el, serif, text, done: new Set() };
  });
  document.body.appendChild(host);
}

let queue = [], token = 0;
const later = (fn) => (globalThis.scheduler?.postTask ? globalThis.scheduler.postTask(fn) : setTimeout(fn, 0));

function pump(t) {
  if (t !== token) return;
  const t0 = performance.now();
  while (queue.length) {
    const job = queue[0];
    const piece = job.chars.splice(0, CHUNK);
    job.slot.el.textContent = piece.join('');
    void job.slot.el.offsetWidth;   // 当场排掉：字形数据就是这时候算的
    for (const c of piece) job.slot.done.add(c);
    if (!job.chars.length) queue.shift();
    if (performance.now() - t0 > BUDGET) break;
  }
  if (queue.length) later(() => pump(t));
}

/** 按下一本书时调：把它在书详情里要显示的、还没排过的字先排一遍 */
export function warmBook(book) {
  if (!book || typeof document === 'undefined') return;
  if (!slots) build();
  const jobs = [];
  for (const slot of slots) {
    let text = '';
    try { text = slot.text(book) || ''; } catch {}   // 个别书源的书缺字段：少热一块，不影响点开
    const chars = [...new Set(text)].filter(c => c.trim() && !slot.done.has(c));
    if (chars.length) jobs.push({ slot, chars });
  }
  const t = ++token;   // 新按下的书顶掉没排完的上一本
  queue = [];
  if (!jobs.length) return;
  // 衬线字先确认分片下好了（一般早就下好了；没下的这时开始下，比点开再下早），不然排的是后备字体，白排
  const serif = jobs.filter(j => j.slot.serif).map(j => j.chars.join('')).join('');
  (serif ? loadSerif(serif, 400) : Promise.resolve()).then(() => {
    if (t !== token) return;
    queue = jobs;
    pump(t);
  });
}

/** 书的按钮上展开用：{...pressBook(book)} */
export const pressBook = (book) => ({ onPointerDown: () => warmBook(book) });

/** 按下以后变成了拖动 / 滚动，不是要点开：停下没排完的 */
export function stopWarm() { token++; queue = []; }

// 手指一动变成滚动，浏览器会发 pointercancel；自己处理拖动的（光盘）在拖起来时调 stopWarm
if (typeof window !== 'undefined') window.addEventListener('pointercancel', stopWarm, true);
