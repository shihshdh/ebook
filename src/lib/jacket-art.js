// 生成封面（"精装书衣"）的画法：按书名哈希挑配色和纹样，竖排书名 + 金箔线框，300×420。
// 同一份版面两种画法，画出来一样：
//   · jacketCanvas：画到 Canvas 上（后台线程里画，见 jacket.worker.js / jacket.js）
//   · jacketSvg：SVG data URL（没有后台线程可用时退回这个）
// 这个文件不碰 DOM，后台线程也能引。
import { hash } from './motion.js';

const JACKETS = [
  { bg: '#3a1418', bg2: '#22090c', ink: '#f1dcc0', foil: '#d9b46c' }, // 牛血红
  { bg: '#10302f', bg2: '#081a1a', ink: '#dfe9dc', foil: '#cfae6a' }, // 深青
  { bg: '#16213a', bg2: '#0a1022', ink: '#e4e2f0', foil: '#d6b878' }, // 墨蓝
  { bg: '#1f2a1a', bg2: '#10170c', ink: '#e8e4cf', foil: '#c9a660' }, // 苔绿
  { bg: '#2c1a33', bg2: '#170c1c', ink: '#eadff0', foil: '#d8b97c' }, // 梅紫
  { bg: '#26221d', bg2: '#13110e', ink: '#efe6d4', foil: '#e0c084' }, // 炭黑
  { bg: '#4a3115', bg2: '#2a1a08', ink: '#f6e8cc', foil: '#f0d394' }, // 赭石
  { bg: '#e9e1cf', bg2: '#d6cbb2', ink: '#2a2118', foil: '#9a6f2a' }, // 象牙（少数浅色，瀑布流里提亮节奏）
];
const MOTIFS = ['moon', 'sun', 'arc', 'stars', 'rule', 'diamond'];
const SERIF = '"Noto Serif SC", "Songti SC", STSong, SimSun, serif';
const SERIF_AUTHOR = '"Noto Serif SC", "Songti SC", SimSun, serif';
const LATIN = 'Cinzel, Georgia, serif';
// SVG 当图片用时载不了页面里的网络字体，出版方那行一直是用 Georgia 显示的；Canvas 版照这个样子画，换了画法看不出来
const LATIN_SHOWN = 'Georgia, serif';

export function cleanTitle(title = '') {
  return String(title)
    .replace(/[（(【\[].*?[)）】\]]/g, '')
    .replace(/※.*$/, '')
    .replace(/\s+/g, ' ')
    .trim() || String(title).trim();
}

export const jacketKey = ({ title = '', author = '' }) => title + '|' + author;
/** 这本书的配色（底色渐变在封面图出来之前先垫着） */
export const jacketPalette = (book) => JACKETS[hash(jacketKey(book)) % JACKETS.length];

// 纹样：一组图形（圆、线、路径），SVG 和 Canvas 各按这组图形画
function motif(kind, j, h) {
  const f = j.foil;
  switch (kind) {
    case 'moon': return [{ t: 'circle', cx: 214, cy: 104, r: 34, stroke: f, w: 1.2, o: .8 }, { t: 'circle', cx: 226, cy: 96, r: 30, fill: j.bg }];
    case 'sun': return [{ t: 'circle', cx: 210, cy: 108, r: 22, fill: f, o: .85 }, ...Array.from({ length: 12 }, (_, i) => {
      const a = i * Math.PI / 6;
      return { t: 'line', x1: 210 + Math.cos(a) * 30, y1: 108 + Math.sin(a) * 30, x2: 210 + Math.cos(a) * 40, y2: 108 + Math.sin(a) * 40, stroke: f, w: 1 };
    })];
    case 'arc': return [{ t: 'path', d: 'M150 186 A70 70 0 0 1 270 120', stroke: f, w: 1.1, o: .75 }, { t: 'path', d: 'M162 196 A60 60 0 0 1 270 140', stroke: f, w: .6, o: .5 }];
    case 'stars': return Array.from({ length: 7 }, (_, i) => ({ t: 'circle', cx: 150 + ((h >> (i * 3)) & 127) % 110, cy: 60 + ((h >> (i * 2 + 5)) & 255) % 140, r: 1 + (i % 3) * .7, fill: f }));
    case 'diamond': return [{ t: 'path', d: 'M214 70 L238 104 L214 138 L190 104 Z', stroke: f, w: 1.1 }, { t: 'path', d: 'M214 84 L228 104 L214 124 L200 104 Z', fill: f, o: .35 }];
    default: return [{ t: 'line', x1: 150, y1: 104, x2: 270, y2: 104, stroke: f, w: 1 }, { t: 'line', x1: 150, y1: 110, x2: 240, y2: 110, stroke: f, w: .5 }];
  }
}

// ---------- 竖排书名 ----------
// 照日文竖排的规矩排（CSS 的 text-orientation: mixed 那一套）：
//   · 汉字、假名一字一格；最多两列、每列最多 9 格，字号随长度收；两列还放不下，末尾换成「…」
//   · 连着的英文按词横躺、顺时针转 90°，一个词占它自己那么长——以前一个字母一格往下堆，「海街diary」竖成一串，
//     「SPY×FAMILY」还被拆到两列（「SPY×F」「AMILY」）
//   · 一两位的数字、大写字母并排挤进一格（纵中横：「3月的狮子」「86」）；「ー」「—」「～」「…」、括号转 90°；「，」「。」挪到格子右上角
// 长度的单位是字号，一格 CELL。英文词多宽：Canvas 那条量得到就量（measure），SVG 那条退路按字母估
const CELL = 1.08, MAX_CELLS = 9, CAP = MAX_CELLS * CELL;
const PAD = .32, SPACE = .2;   // 横躺的词前后各留一点；同一串英文里词和词之间多空一点
const LAT = '[\\x21-\\x7e\\u00c0-\\u024f\\u00d7\\u2019]';
const TOKEN = new RegExp(`(${LAT}+(?: ${LAT}+)*)|(\\S)`, 'gu');
const TURN = new Set([...'ー—―–‐～〜…‥：；（）「」『』《》〈〉【】〔〕']);
const CORNER = new Set([...'，。、．']);
const estimate = (w) => [...w].reduce((s, c) => s + (/[ijlI.,:;'!|]/.test(c) ? .3 : /[ft\-]/.test(c) ? .36 : /[MW]/.test(c) ? .9
  : /[mw]/.test(c) ? .74 : /[A-Z]/.test(c) ? .68 : /[a-z]/.test(c) ? .5 : /[0-9]/.test(c) ? .52 : .56), 0);
const cell = (kind, text) => ({ kind, text, len: CELL, lead: 0 });

function pieces(title, measure) {
  const out = [];
  for (const [, run, ch] of cleanTitle(title).matchAll(TOKEN)) {
    if (ch) { out.push(cell(CORNER.has(ch) ? 'corner' : TURN.has(ch) ? 'turn' : 'char', ch)); continue; }
    run.split(' ').forEach((word, k) => {
      // 词两头的横线、波浪线单独竖过来：「86-不存在的战区-」是 86 纵中横 + 一道竖线
      const [, head, core, tail] = word.match(/^([-~]*)(.*?)([-~]*)$/);
      for (const c of head) out.push(cell('turn', c));
      if (/^(?:[0-9]{1,2}|[A-Z]{1,2}|[!?]{1,2})$/.test(core)) out.push(cell('tcy', core));
      else if (core.length === 1) out.push(cell('turn', core));
      else if (core) {
        // 一个词比一整列还长：压窄塞进一列
        const lead = k > 0 ? SPACE : 0, w = Math.min(measure(core), CAP - PAD - lead);
        out.push({ kind: 'word', text: core, w, len: lead + w + PAD, lead });
      }
      for (const c of tail) out.push(cell('turn', c));
    });
  }
  return out;
}

// 分列：一列放得下就一列；否则两列，右边那列先排、略长一点（看每一项的中点过没过一半）
function columns(items) {
  const total = items.reduce((s, p) => s + p.len, 0);
  if (total <= CAP + 1e-6) return [items];
  const cols = [[], []], used = [0, 0], half = total / 2;
  let ci = 0, acc = 0, cut = false;
  for (const p of items) {
    if (ci === 0 && used[0] > 0 && (acc + p.len / 2 > half || used[0] + p.len > CAP + 1e-6)) ci = 1;
    if (used[ci] + p.len > CAP + 1e-6) { cut = true; break; }
    cols[ci].push(p); used[ci] += p.len; acc += p.len;
  }
  if (cut) {
    while (cols[1].length && used[1] + CELL > CAP + 1e-6) used[1] -= cols[1].pop().len;
    cols[1].push(cell('turn', '…'));
  }
  return cols.filter(c => c.length);
}

/** 版面：配色、纹样、竖排书名每一项的位置（x 是列中线，y 是这一项的上沿）。measure：英文词的宽度（单位字号），不给就估 */
function layout({ title = '', author = '', publisher = '' }, measure = estimate) {
  const h = hash(jacketKey({ title, author }));
  const j = JACKETS[h % JACKETS.length];
  const cols = columns(pieces(title, measure));
  const cells = Math.max(0, ...cols.map(c => c.reduce((s, p) => s + p.len, 0))) / CELL;
  const size = Math.max(22, Math.min(40, Math.floor(300 / Math.max(cells, 6))));
  const glyphs = cols.flatMap((col, ci) => {
    let y = 62;
    return col.map(p => { const g = { ...p, x: 92 - ci * (size + 10), y }; y += p.len * size; return g; });
  });
  return { j, shapes: motif(MOTIFS[(h >> 5) % MOTIFS.length], j, h), glyphs, size, author: author.slice(0, 12), publisher: (publisher || 'EBOOK').slice(0, 14) };
}
// 竖着、转过来、纵中横的这几种都按中心点画：一格的中心和旁边汉字的字身中心对齐；横躺的词在扣掉前面空隙的那段里居中
const middle = (g, size) => g.y + (g.lead + (g.len - g.lead - (CELL - 1)) / 2) * size;
const tcySize = (g, size) => (g.text.length > 1 ? .72 : .92) * size;
// 「，」「。」在横排字形里落在格子左下，竖排要在右上：整个字往右上挪
const CORNER_DX = .58, CORNER_DY = .56;

// ---------- SVG ----------
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const svgShape = (s) => {
  const paint = `fill="${s.fill || 'none'}"${s.stroke ? ` stroke="${s.stroke}" stroke-width="${s.w}"` : ''}${s.o != null ? ` opacity="${s.o}"` : ''}`;
  if (s.t === 'circle') return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" ${paint}/>`;
  if (s.t === 'line') return `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" ${paint}/>`;
  return `<path d="${s.d}" ${paint}/>`;
};
const svgGlyph = (g, size) => {
  if (g.kind === 'char' || g.kind === 'corner') {
    const [x, y] = g.kind === 'corner' ? [g.x + size * CORNER_DX, g.y - size * CORNER_DY] : [g.x, g.y];
    return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="hanging">${esc(g.text)}</text>`;
  }
  const at = `translate(${g.x} ${middle(g, size)})${g.kind === 'tcy' ? '' : ' rotate(90)'}`;
  // 估的宽度和实际字宽对不上时压到估的长度，免得戳出这一段
  const fit = g.kind === 'word' ? ` textLength="${g.w * size}" lengthAdjust="spacingAndGlyphs"` : '';
  return `<text transform="${at}" font-size="${g.kind === 'tcy' ? tcySize(g, size) : size}" text-anchor="middle" dominant-baseline="central"${fit}>${esc(g.text)}</text>`;
};
const svgCache = new Map();
/** SVG data URL，可直接当 <img> */
export function jacketSvg(book) {
  const key = jacketKey(book);
  if (svgCache.has(key)) return svgCache.get(key);
  const { j, shapes, glyphs, size, author, publisher } = layout(book);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420" width="300" height="420">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${j.bg}"/><stop offset="1" stop-color="${j.bg2}"/></linearGradient>
<linearGradient id="f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${j.foil}" stop-opacity=".6"/><stop offset=".5" stop-color="#fff4d6" stop-opacity=".95"/><stop offset="1" stop-color="${j.foil}" stop-opacity=".6"/></linearGradient></defs>
<rect width="300" height="420" fill="url(#g)"/>
<rect x="14" y="14" width="272" height="392" fill="none" stroke="url(#f)" stroke-width="1"/>
<rect x="20" y="20" width="260" height="380" fill="none" stroke="${j.foil}" stroke-width=".5" opacity=".5"/>
<line x1="128" y1="40" x2="128" y2="380" stroke="${j.foil}" stroke-width=".5" opacity=".45"/>
${shapes.map(svgShape).join('')}
<g fill="${j.ink}" font-family="${SERIF.replace(/"/g, '')}" font-weight="600">${glyphs.map(g => svgGlyph(g, size)).join('')}</g>
<text x="270" y="384" fill="${j.ink}" opacity=".75" font-family="${SERIF_AUTHOR.replace(/"/g, '')}" font-size="13" text-anchor="end">${esc(author)}</text>
<text x="270" y="364" fill="${j.foil}" font-family="${LATIN}" font-size="9" letter-spacing="2.5" text-anchor="end">${esc(publisher)}</text>
</svg>`;
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  svgCache.set(key, url);
  return url;
}

// ---------- Canvas ----------
const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`;
function drawShape(ctx, s) {
  ctx.globalAlpha = s.o ?? 1;
  let path;
  if (s.t === 'circle') { path = new Path2D(); path.arc(s.cx, s.cy, s.r, 0, Math.PI * 2); }
  else if (s.t === 'line') { path = new Path2D(); path.moveTo(s.x1, s.y1); path.lineTo(s.x2, s.y2); }
  else path = new Path2D(s.d);
  if (s.fill) { ctx.fillStyle = s.fill; ctx.fill(path); }
  if (s.stroke) { ctx.strokeStyle = s.stroke; ctx.lineWidth = s.w; ctx.stroke(path); }
  ctx.globalAlpha = 1;
}
/** 在 300×420 的坐标里画（调用方先按需要的清晰度 scale） */
export function jacketCanvas(ctx, book) {
  const { j, shapes, glyphs, size, author, publisher } = layout(book, (w) => { ctx.font = `600 100px ${SERIF}`; return ctx.measureText(w).width / 100; });
  // 底色：SVG 里是按包围盒的对角渐变（0,0 → 1,1），在单位方块里画再拉伸到 300×420，和它一模一样
  ctx.save();
  ctx.scale(300, 420);
  const g = ctx.createLinearGradient(0, 0, 1, 1);
  g.addColorStop(0, j.bg); g.addColorStop(1, j.bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1, 1);
  ctx.restore();
  // 金箔外框（横向渐变）、内框、书脊线
  const f = ctx.createLinearGradient(14, 0, 286, 0);
  f.addColorStop(0, rgba(j.foil, .6)); f.addColorStop(.5, 'rgba(255, 244, 214, .95)'); f.addColorStop(1, rgba(j.foil, .6));
  ctx.strokeStyle = f; ctx.lineWidth = 1; ctx.strokeRect(14, 14, 272, 392);
  drawShape(ctx, { t: 'path', d: 'M20 20 H280 V400 H20 Z', stroke: j.foil, w: .5, o: .5 });
  drawShape(ctx, { t: 'line', x1: 128, y1: 40, x2: 128, y2: 380, stroke: j.foil, w: .5, o: .45 });
  for (const s of shapes) drawShape(ctx, s);
  // 竖排书名
  ctx.fillStyle = j.ink;
  ctx.textAlign = 'center';
  for (const g of glyphs) {
    if (g.kind === 'char' || g.kind === 'corner') {
      ctx.font = `600 ${size}px ${SERIF}`; ctx.textBaseline = 'hanging';
      if (g.kind === 'corner') ctx.fillText(g.text, g.x + size * CORNER_DX, g.y - size * CORNER_DY);
      else ctx.fillText(g.text, g.x, g.y);
      continue;
    }
    ctx.save();
    ctx.translate(g.x, middle(g, size));
    if (g.kind !== 'tcy') ctx.rotate(Math.PI / 2);
    ctx.font = `600 ${g.kind === 'tcy' ? tcySize(g, size) : size}px ${SERIF}`; ctx.textBaseline = 'middle';
    if (g.kind === 'word') ctx.fillText(g.text, 0, 0, g.w * size);
    else if (g.kind === 'tcy') ctx.fillText(g.text, 0, 0, size * .98);
    else ctx.fillText(g.text, 0, 0);
    ctx.restore();
  }
  // 作者、出版方
  ctx.textAlign = 'end'; ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = .75; ctx.font = `13px ${SERIF_AUTHOR}`; ctx.fillText(author, 270, 384);
  ctx.globalAlpha = 1; ctx.fillStyle = j.foil; ctx.font = `9px ${LATIN_SHOWN}`;
  if ('letterSpacing' in ctx) { ctx.letterSpacing = '2.5px'; ctx.fillText(publisher, 270, 364); ctx.letterSpacing = '0px'; }
  else ctx.fillText(publisher, 270, 364);
}
