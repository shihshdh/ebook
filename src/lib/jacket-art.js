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

/** 版面：配色、纹样、竖排书名每个字的位置（最多两列，每列最多 9 个字，字号随字数收） */
function layout({ title = '', author = '', publisher = '' }) {
  const h = hash(jacketKey({ title, author }));
  const j = JACKETS[h % JACKETS.length];
  const chars = [...cleanTitle(title).replace(/\s/g, '')];
  const perCol = chars.length > 9 ? Math.ceil(Math.min(chars.length, 18) / 2) : chars.length;
  const cols = [chars.slice(0, perCol), chars.slice(perCol, perCol * 2)].filter(c => c.length);
  const size = Math.max(22, Math.min(40, Math.floor(300 / Math.max(perCol, 6))));
  const glyphs = cols.flatMap((col, ci) => col.map((ch, i) => ({ ch, x: 92 - ci * (size + 10), y: 62 + i * (size * 1.08) })));
  return { j, shapes: motif(MOTIFS[(h >> 5) % MOTIFS.length], j, h), glyphs, size, author: author.slice(0, 12), publisher: (publisher || 'EBOOK').slice(0, 14) };
}

// ---------- SVG ----------
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const svgShape = (s) => {
  const paint = `fill="${s.fill || 'none'}"${s.stroke ? ` stroke="${s.stroke}" stroke-width="${s.w}"` : ''}${s.o != null ? ` opacity="${s.o}"` : ''}`;
  if (s.t === 'circle') return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" ${paint}/>`;
  if (s.t === 'line') return `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" ${paint}/>`;
  return `<path d="${s.d}" ${paint}/>`;
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
<g fill="${j.ink}" font-family="${SERIF.replace(/"/g, '')}" font-weight="600">${glyphs.map(g => `<text x="${g.x}" y="${g.y}" font-size="${size}" text-anchor="middle" dominant-baseline="hanging">${esc(g.ch)}</text>`).join('')}</g>
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
  const { j, shapes, glyphs, size, author, publisher } = layout(book);
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
  ctx.font = `600 ${size}px ${SERIF}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'hanging';
  for (const c of glyphs) ctx.fillText(c.ch, c.x, c.y);
  // 作者、出版方
  ctx.textAlign = 'end'; ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = .75; ctx.font = `13px ${SERIF_AUTHOR}`; ctx.fillText(author, 270, 384);
  ctx.globalAlpha = 1; ctx.fillStyle = j.foil; ctx.font = `9px ${LATIN_SHOWN}`;
  if ('letterSpacing' in ctx) { ctx.letterSpacing = '2.5px'; ctx.fillText(publisher, 270, 364); ctx.letterSpacing = '0px'; }
  else ctx.fillText(publisher, 270, 364);
}
