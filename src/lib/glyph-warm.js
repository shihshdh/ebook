// 书详情的字形预热：手指按下一本书时，在屏幕外按面板里的字重、字号把这本书的字先排一遍，抬手点开时字形已经是热的。
//
// 为什么：一个字第一次以某个「字重 × 字号」出现，浏览器要现算它的字形数据（分片早就下好了也一样，和下载无关）。
// 4 倍降速下每个新字 0.5–1ms；书详情的书名（700、24px）、简介（400、15px）是别处没用过的组合，每本书点开那一帧
// 光排字就二三十毫秒。同一本书关了再开（字形全热），最长帧 37–53 → 13–20ms。
// 字形数据按「字 × 字体 × 字号」记，和字在哪段话里无关——所以只排没排过的字，每次一小段，排完让出主线程。
//
// 从按下到点开（click）一般有七八十毫秒，够排完一本书的字；没排完的，点开那一帧照旧现算，不会比原来更慢。
//
// 滚动、拖动也是从按在书上开始的，这时候预热不能添乱（探索页滚动实测过两种添乱，都去掉了）：
// - 不下新分片：只排衬线分片已经下好的字（见下面 serifReady）。按下就去下简介里的字，分片在滚动当中到达，
//   浏览器会把屏幕附近所有衬线字重排一遍（每片十几到二十几毫秒）。没下好的字留给点开时，和原来一样。
// - 不在按下的那个事件里排，也不连着排：一帧排一段（见 later），手指一动（超过 SLOP）、抬手、pointercancel 都停。
//   每次只放 CHUNK 个字：冷字一个可能 1ms 多，一次放 12 个字实测排了 15ms。
//
// 槽位的类名、标签要和 BookSheet.jsx 里一致（字重、字号全靠它们），面板改了样式这里跟着改。

const BUDGET = 5;    // 每帧最多排多久（毫秒）：手机 60 帧一帧 16.7ms，留出画帧的时间
const CHUNK = 4;     // 每次往一个槽位里放几个字
const SLOP = 8;      // 按下后移动超过这么多像素就是拖动 / 滚动，不是点
const FAMILY = 'Noto Serif SC';   // 衬线网络字体（tokens.css 引的那份，按字切片）

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

let slots = null, host = null;
// 屏幕外盒子里建一个槽位：tag 写成 'div.dl-head>h3' 这样（外层带类名、最里层用 cls）
function makeSlot(tag, cls) {
  let parent = host, el;
  for (const part of tag.split('>')) {
    const [name, pcls] = part.split('.');
    el = document.createElement(name);
    if (pcls) el.className = pcls;
    parent.appendChild(el);
    parent = el;
  }
  if (cls) el.className = cls;
  return el;
}
function build() {
  host = document.createElement('div');
  host.className = 'glyph-warm';
  host.setAttribute('aria-hidden', 'true');
  slots = SLOTS.map(([tag, cls, serif, text]) => ({ el: makeSlot(tag, cls), serif, text, done: new Set() }));
  document.body.appendChild(host);
}

// 空闲预热：一批到处都会用到的字（比如搜索结果行的标签、出版社、状态）按指定样式先排一遍。
// 和按下时的预热共用屏幕外那个盒子；只在 requestIdleCallback 里一小段一小段地排（这一段空闲用完就停、下次空闲接着排），
// 不和滚动、动画、按下时的预热抢主线程。只排无衬线（系统字体）的槽位：衬线字没下好的分片会被排字触发下载（见开头）
const idleJobs = [];
let idleScheduled = false;
const whenIdle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn) : setTimeout(() => fn({ timeRemaining: () => 4 }), 200));
function idlePump(deadline) {
  idleScheduled = false;
  while (idleJobs.length && deadline.timeRemaining() > 2) {
    const job = idleJobs[0];
    job.el.textContent = job.chars.splice(0, CHUNK).join('');
    void job.el.offsetWidth;   // 当场排掉：字形数据就是这时候算的
    if (!job.chars.length) { idleJobs.shift(); job.top.remove(); }   // 排完就拿掉，盒子里不留东西
  }
  if (idleJobs.length && !idleScheduled) { idleScheduled = true; whenIdle(idlePump); }
}
/** spec：[[标签, 类名], ...]（写法同 SLOTS）；texts：每个槽位要排的字 */
export function warmIdle(spec, texts) {
  if (typeof document === 'undefined') return;
  if (!slots) build();
  spec.forEach(([tag, cls], k) => {
    const chars = [...new Set(texts[k] || '')].filter(c => c.trim());
    if (!chars.length) return;
    const el = makeSlot(tag, cls);
    let top = el;
    while (top.parentElement !== host) top = top.parentElement;
    idleJobs.push({ el, top, chars });
  });
  if (idleJobs.length && !idleScheduled) { idleScheduled = true; whenIdle(idlePump); }
}

let queue = [], token = 0;
// 一帧只排一段，放在 rAF 里。不用 scheduler.postTask / setTimeout 一段接一段地排：实测按下以后那一串任务连着跑了
// 五六十到一百毫秒，中间一帧都没画——Chrome 把触摸移动、pointercancel 对齐到下一帧才派发，帧画不出来，停下的信号也送不到，
// 滚动开头就顿那一下（探索页滚动 >33ms 的帧 4 → 14）。rAF 里排：输入事件在 rAF 之前派发，手指一动这一帧就停了，也挡不住画帧
const later = (fn) => requestAnimationFrame(fn);

function pump(t) {
  if (t !== token) return;
  const t0 = performance.now();
  while (queue.length) {
    const s = performance.now();
    const job = queue[0];
    const piece = job.chars.splice(0, CHUNK);
    job.slot.el.textContent = piece.join('');
    void job.slot.el.offsetWidth;   // 当场排掉：字形数据就是这时候算的
    for (const c of piece) job.slot.done.add(c);
    if (!job.chars.length) queue.shift();
    const now = performance.now();
    if (now - t0 + (now - s) > BUDGET) break;   // 下一小段照这一段的耗时估，排完会超就留到下一帧
  }
  if (queue.length) later(() => pump(t));
}

// 这个字所在的衬线分片下好了没有。不能用 document.fonts.check：本机装了同名字体（Noto Serif SC）时 Chrome 一律说「好了」，
// 可页面里照样用网络分片，排的时候还是会去下（实测）。所以直接按 unicode-range 找到这个字归哪个 FontFace，看它的 status。
// 各字重同一片是同一个文件、状态一起变，只看 400 的就够。
// 码位表：码位 → 第几片（0 = 哪片都不是）。一百来片、上万段范围，4 倍降速下一口气解析完要十几毫秒，不能放在按下时，
// 所以空闲时一片一片地填；没填完之前按下的书先不排衬线字（少热一块，不影响点开）。
let faces = null, table = null, filled = 0, preparing = false;
const wide = [];   // 超出 0xFFFF 的范围（很少）：[起, 止, 第几片]
const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(() => fn({ timeRemaining: () => 4 }), 50));
function prepare(deadline) {
  if (!faces) {
    faces = [...document.fonts].filter(f => f.family.replace(/["']/g, '') === FAMILY && f.weight === '400');
    if (!faces.length) { faces = null; preparing = false; return; }   // 字体 CSS 还没到：下次按下再排上
    table = new Uint16Array(0x10000);
  }
  while (filled < faces.length) {
    const k = filled + 1;
    for (const part of faces[filled].unicodeRange.split(',')) {
      const [x, y = x] = part.trim().slice(2).split('-');   // U+4E00-4E0F / U+3000 / U+4??
      const a = parseInt(x.replace(/\?/g, '0'), 16), b = parseInt(y.replace(/\?/g, 'F'), 16);
      if (!(a <= b)) continue;
      if (a < 0x10000) table.fill(k, a, Math.min(b, 0xFFFF) + 1);
      if (b >= 0x10000) wide.push([Math.max(a, 0x10000), b, k]);
    }
    filled++;
    if (deadline.timeRemaining() < 1) break;
  }
  if (filled < faces.length) idle(prepare);
  else { preparing = false; if (!slots) build(); }   // 屏幕外的盒子也趁空闲建好，第一次按下不用现建
}
function startPrepare() {
  if (preparing || (faces && filled === faces.length)) return;
  preparing = true;
  idle(prepare);
}
const ready = new Set();   // 下好了就不会再变回没下，记住免得每次再找
function serifReady(c) {
  if (ready.has(c)) return true;
  if (!faces || filled < faces.length) { startPrepare(); return false; }
  const cp = c.codePointAt(0);
  const k = cp < 0x10000 ? table[cp] : (wide.find(([a, b]) => cp >= a && cp <= b)?.[2] || 0);
  // 哪片都不是的字（拉丁标点之类）排的是后备字体，不会去下分片，可以排
  const ok = !k || faces[k - 1].status === 'loaded';
  if (ok) ready.add(c);
  return ok;
}

/** 按下一本书时调：把它在书详情里要显示的、还没排过的字先排一遍 */
export function warmBook(book) {
  if (!book || typeof document === 'undefined') return;
  if (!slots) build();
  const jobs = [];
  for (const slot of slots) {
    let text = '';
    try { text = slot.text(book) || ''; } catch {}   // 个别书源的书缺字段：少热一块，不影响点开
    // 衬线字只排分片已经下好的：没下好的排了会去下分片（见开头），而且排出来是后备字体，白排
    const chars = [...new Set(text)].filter(c => c.trim() && !slot.done.has(c) && (!slot.serif || serifReady(c)));
    if (chars.length) jobs.push({ slot, chars });
  }
  const t = ++token;   // 新按下的书顶掉没排完的上一本
  queue = jobs;
  if (jobs.length) later(() => pump(t));
}

/** 书的按钮上展开用：{...pressBook(book)} */
export const pressBook = (book) => ({ onPointerDown: () => warmBook(book) });

/** 按下以后变成了拖动 / 滚动，不是要点开：停下没排完的 */
export function stopWarm() { token++; queue = []; }

// 按下的位置（捕获阶段记，比书按钮上的 onPointerDown 先到）；移动超过 SLOP 就停。
// 滚动开始时浏览器才发 pointercancel，比手指开始动要晚；抬手以后马上就是点开，剩下的字点开那一帧自己会排，不用再占主线程。
// 自己处理拖动的（光盘）在拖起来时也调 stopWarm
if (typeof window !== 'undefined') {
  document.fonts?.ready.then(startPrepare);
  let down = null;
  window.addEventListener('pointerdown', (e) => { down = { id: e.pointerId, x: e.clientX, y: e.clientY }; }, true);
  window.addEventListener('pointermove', (e) => {
    if (!queue.length || !down || e.pointerId !== down.id) return;
    if (Math.abs(e.clientX - down.x) > SLOP || Math.abs(e.clientY - down.y) > SLOP) stopWarm();
  }, { capture: true, passive: true });
  window.addEventListener('pointerup', stopWarm, true);
  window.addEventListener('pointercancel', stopWarm, true);
}
