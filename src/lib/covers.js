// 封面。四级来源，越靠前越好：
//   1. 书架里的 EPUB 自带封面（下载/导入时取出，存成 data URL）
//   2. 原站封面（轻小说文库每本书都有）：img.wenku8.com 直连不通，走公共图片代理 wsrv.nl（顺便缩到 360 宽转 webp），
//      不通再换 i0.wp.com。两个代理国内直连实测都通，约 1 秒一张
//   3. Bangumi 条目封面（原站封面加载失败时才查）
//   4. 生成封面：按书名哈希挑一套"精装书衣"配色，竖排书名 + 金箔线框（SVG data URL，可直接当 <img>）
// 生成封面不是兜底的灰块，而是整站视觉的一部分——光盘、瀑布流、文件夹里大部分书会用它。
import { useEffect, useState } from 'react';
import { idbGet, idbSet } from './idb.js';
import { hash } from './motion.js';
import { raceImage } from './net.js';
import { useCatalogBook } from './library.js';

// ---------- 生成封面 ----------
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
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function cleanTitle(title = '') {
  return String(title)
    .replace(/[（(【\[].*?[)）】\]]/g, '')
    .replace(/※.*$/, '')
    .replace(/\s+/g, ' ')
    .trim() || String(title).trim();
}

function motif(kind, j, h) {
  const f = j.foil;
  switch (kind) {
    case 'moon': return `<circle cx="214" cy="104" r="34" fill="none" stroke="${f}" stroke-width="1.2" opacity=".8"/><circle cx="226" cy="96" r="30" fill="${j.bg}"/>`;
    case 'sun': return `<circle cx="210" cy="108" r="22" fill="${f}" opacity=".85"/>${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<line x1="${210 + Math.cos(a) * 30}" y1="${108 + Math.sin(a) * 30}" x2="${210 + Math.cos(a) * 40}" y2="${108 + Math.sin(a) * 40}" stroke="${f}" stroke-width="1"/>`; }).join('')}`;
    case 'arc': return `<path d="M150 186 A70 70 0 0 1 270 120" fill="none" stroke="${f}" stroke-width="1.1" opacity=".75"/><path d="M162 196 A60 60 0 0 1 270 140" fill="none" stroke="${f}" stroke-width=".6" opacity=".5"/>`;
    case 'stars': return Array.from({ length: 7 }, (_, i) => { const x = 150 + ((h >> (i * 3)) & 127) % 110, y = 60 + ((h >> (i * 2 + 5)) & 255) % 140, r = 1 + (i % 3) * .7; return `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"/>`; }).join('');
    case 'diamond': return `<path d="M214 70 L238 104 L214 138 L190 104 Z" fill="none" stroke="${f}" stroke-width="1.1"/><path d="M214 84 L228 104 L214 124 L200 104 Z" fill="${f}" opacity=".35"/>`;
    default: return `<line x1="150" y1="104" x2="270" y2="104" stroke="${f}" stroke-width="1"/><line x1="150" y1="110" x2="240" y2="110" stroke="${f}" stroke-width=".5"/>`;
  }
}

const genCache = new Map();
/** 生成封面（300×420，SVG data URL）。只依赖书名/作者/文库，结果稳定 */
export function generatedCover({ title = '', author = '', publisher = '' }) {
  const key = title + '|' + author;
  if (genCache.has(key)) return genCache.get(key);
  const h = hash(key);
  const j = JACKETS[h % JACKETS.length];
  const t = cleanTitle(title);
  // 竖排书名：最多两列，每列最多 9 个字，字号随字数收
  const chars = [...t.replace(/\s/g, '')];
  const perCol = chars.length > 9 ? Math.ceil(Math.min(chars.length, 18) / 2) : chars.length;
  const cols = [chars.slice(0, perCol), chars.slice(perCol, perCol * 2)].filter(c => c.length);
  const size = Math.max(22, Math.min(40, Math.floor(300 / Math.max(perCol, 6))));
  const titleSvg = cols.map((col, ci) => {
    const x = 92 - ci * (size + 10);
    return col.map((ch, i) => `<text x="${x}" y="${62 + i * (size * 1.08)}" font-size="${size}" text-anchor="middle" dominant-baseline="hanging">${esc(ch)}</text>`).join('');
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420" width="300" height="420">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${j.bg}"/><stop offset="1" stop-color="${j.bg2}"/></linearGradient>
<linearGradient id="f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${j.foil}" stop-opacity=".6"/><stop offset=".5" stop-color="#fff4d6" stop-opacity=".95"/><stop offset="1" stop-color="${j.foil}" stop-opacity=".6"/></linearGradient></defs>
<rect width="300" height="420" fill="url(#g)"/>
<rect x="14" y="14" width="272" height="392" fill="none" stroke="url(#f)" stroke-width="1"/>
<rect x="20" y="20" width="260" height="380" fill="none" stroke="${j.foil}" stroke-width=".5" opacity=".5"/>
<line x1="128" y1="40" x2="128" y2="380" stroke="${j.foil}" stroke-width=".5" opacity=".45"/>
${motif(MOTIFS[(h >> 5) % MOTIFS.length], j, h)}
<g fill="${j.ink}" font-family="Noto Serif SC, Songti SC, STSong, SimSun, serif" font-weight="600">${titleSvg}</g>
<text x="270" y="384" fill="${j.ink}" opacity=".75" font-family="Noto Serif SC, Songti SC, SimSun, serif" font-size="13" text-anchor="end">${esc(author.slice(0, 12))}</text>
<text x="270" y="364" fill="${j.foil}" font-family="Cinzel, Georgia, serif" font-size="9" letter-spacing="2.5" text-anchor="end">${esc((publisher || 'EBOOK').slice(0, 14))}</text>
</svg>`;
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  genCache.set(key, url);
  return url;
}

// ---------- Bangumi ----------
const norm = (s = '') => cleanTitle(s).toLowerCase().replace(/[\s·・:：!！?？,，.。、~～\-—_'"“”‘’「」『』《》]/g, '');
const mem = new Map();
const queue = [];
let active = 0;
const MAX = 2;

function pump() {
  while (active < MAX && queue.length) {
    const job = queue.shift();
    active++;
    job().finally(() => { active--; pump(); });
  }
}

async function lookup(book) {
  const key = 'bgm:' + norm(book.title);
  const cached = await idbGet('kv', key).catch(() => undefined);
  if (cached !== undefined && Date.now() - cached.at < 30 * 864e5) return cached.url;
  let url = null;
  try {
    const res = await fetch('https://api.bgm.tv/v0/search/subjects?limit=6', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: cleanTitle(book.title), filter: { type: [1] } }),
    });
    if (res.ok) {
      const { data = [] } = await res.json();
      const want = [norm(book.title), norm(book.alt || '')].filter(Boolean);
      // 严格匹配：书名（或别名）规范化后相等，或互相包含且长度接近；小说优先于漫画/画集
      const score = (d) => {
        const names = [norm(d.name_cn), norm(d.name)].filter(Boolean);
        let best = 0;
        for (const n of names) for (const w of want) {
          if (n === w) best = Math.max(best, 3);
          else if ((n.includes(w) || w.includes(n)) && Math.min(n.length, w.length) / Math.max(n.length, w.length) > .72) best = Math.max(best, 2);
        }
        if (!best) return 0;
        if (d.platform === '小说') best += 1;
        if (/画集|art ?book|设定集|漫画/i.test(d.name_cn + d.name)) best -= 2;
        return best;
      };
      const hit = data.map(d => [score(d), d]).filter(([s]) => s >= 2).sort((a, b) => b[0] - a[0])[0]?.[1];
      const img = hit?.images?.large || hit?.images?.common;
      if (img) url = img.replace('/pic/cover/l/', '/r/400/pic/cover/l/').replace(/^http:/, 'https:');
    }
  } catch { return undefined; } // 网络失败不缓存，下次再试
  idbSet('kv', key, { url, at: Date.now() }).catch(() => {});
  return url;
}

/** 查 Bangumi 封面；同一本书只查一次，排队限流 */
export function bangumiCover(book) {
  const key = norm(book.title);
  if (!mem.has(key)) mem.set(key, new Promise(resolve => { queue.push(() => lookup(book).then(resolve, () => resolve(undefined))); pump(); }));
  return mem.get(key);
}

// ---------- 原站封面（图片代理 + 原站直连，错峰竞速） ----------
// img.wenku8.com 走代理时连不上，但国内直连可能是通的——也放进候选，谁快用谁，速度记在本机（见 net.js）
export function sourceCoverUrls(src) {
  if (!src) return [];
  const bare = src.replace(/^https?:\/\//, '');
  return [
    `https://wsrv.nl/?url=${encodeURIComponent(bare)}&w=360&output=webp&q=82`,
    `https://i0.wp.com/${bare}?w=360`,
    `https://${bare}`,
  ];
}
//
// 封面「一会有一会没有」的三个原因，这里逐个解决：
//   1. 一屏几十本同时竞速、每本还错峰补发，探索页快速往下翻能一下子打出几百个图片请求，代理被挤爆、纷纷超时
//      → 全局排队：同时最多 8 本在竞速；每次空出位置，先挑「此刻就在屏幕上」的，没有才轮到翻过去的那些
//   2. 某次超时就把这本记成「没有封面」，整个会话都不再试
//      → 失败的 15 秒后可以再试；组件还在屏幕上时 20 秒后自动重试一次
//   3. 每次启动都要重新竞速
//      → 每本书赢过的地址记在本机（设备共用）。两个代理都给一两年的缓存，下次直接从磁盘缓存出图，不排队也不联网；
//        万一记住的地址打不开了（图片 onError），删掉记录重新竞速
const KNOWN_KEY = 'cover-urls:v1';
let known = null, knownLoad = null, saveTimer = 0;
const loadKnown = () => knownLoad || (knownLoad = idbGet('kv', KNOWN_KEY).then(v => { known = v || {}; }, () => { known = {}; }));
function remember(src, url) {
  if (!known) return;
  if (url) known[src] = url; else delete known[src];
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => idbSet('kv', KNOWN_KEY, known).catch(() => {}), 1500);
}

const RACE_MAX = 8, RETRY_MS = 15000;
let racing = 0;
const waiting = [];   // { run, near }：near() 说这本此刻在不在屏幕附近
function drain() {
  while (racing < RACE_MAX && waiting.length) {
    let i = waiting.length - 1;
    while (i >= 0 && !waiting[i].near()) i--;
    const [job] = waiting.splice(i >= 0 ? i : waiting.length - 1, 1);   // 屏幕上的优先，同是屏幕上的后来的先
    racing++;
    job.run().finally(() => { racing--; drain(); });
  }
}
const schedule = (fn, near) => new Promise(resolve => {
  waiting.push({ run: async () => { try { resolve(await fn()); } catch { resolve(null); } }, near: near || (() => true) });
  drain();
});

const tried = new Map(); // src → { p: Promise<地址|null>, at, ok }
function sourceCover(src, near) {
  const t = tried.get(src);
  if (t && (t.ok !== false || Date.now() - t.at < RETRY_MS)) return t.p;
  const entry = { at: Date.now(), ok: undefined };
  entry.p = (async () => {
    await loadKnown();
    if (known[src]) return known[src];
    const url = await schedule(() => raceImage(sourceCoverUrls(src), { stagger: 900, timeout: 8000 }), near);
    entry.ok = !!url;
    // 只记代理地址：原站直连通不通取决于当下的网络（开没开代理、换没换 Wi-Fi），记下来换个网络会卡很久才失败
    if (url && !/^https?:\/\/img\.wenku8\.com\//.test(url)) remember(src, url);
    return url;
  })();
  tried.set(src, entry);
  return entry.p;
}
/** 记住的地址打不开了：忘掉它，下次重新竞速 */
function forgetCover(src) {
  tried.delete(src);
  remember(src, null);
}

/**
 * 组件里用：先立刻给生成封面，visible 为真时先取原站封面、失败再查 Bangumi，拿到再换。
 * 返回的 onError 要挂到 <img> 上：真封面加载失败时退回生成封面并重新找。
 * @param {object} book  需要 title / author / publisher；书架条目可带 cover
 * @param {() => boolean} [near]  这本此刻在不在屏幕附近（排队时屏幕上的先加载）；不传当作在
 */
export function useCover(book, visible = true, near) {
  // 书架条目（下载时从 EPUB 里取封面）：纯文本版 EPUB 里没有封面，以前只能拿「化物语(物语系列一) · 上卷」这种书名去 Bangumi 碰运气，
  // 网络一抖就时有时无。现在按 bookId 借书目里那本书的原站封面，和探索页走同一条（排队 + 记住地址）的路
  const [ownBroken, setOwnBroken] = useState(false);   // EPUB 里取出的封面万一画不出来
  const own = ownBroken ? '' : book?.cover || '';
  const catalogBook = useCatalogBook(book && !own && !book.coverSrc ? book.bookId : undefined);
  const src = book?.coverSrc || catalogBook?.coverSrc || '';
  const fallback = book ? (own || generatedCover(book)) : '';
  const [url, setUrl] = useState(fallback);
  const [real, setReal] = useState(!!own);
  const [attempt, setAttempt] = useState(0);   // 重试次数（最多 2 次，防止坏地址来回跳）
  useEffect(() => { setUrl(fallback); setReal(!!own); setAttempt(0); }, [fallback]);
  useEffect(() => {
    // 本地书没有可查的书名；公版古籍去 Bangumi 只会搜到同名动画/漫画的图，统一用生成的书衣
    if (!book || own || !visible || book.source === 'local' || book.source === 'public') return;
    let alive = true, retry = 0;
    const later = () => { if (attempt < 2) retry = setTimeout(() => { if (alive) setAttempt(a => a + 1); }, 20000); };
    // 查 Bangumi 用书目里的书名和别名（书架条目的书名带「· 上卷」，搜不准）
    const viaBangumi = () => bangumiCover(catalogBook || book).then(u => {
      if (!alive) return;
      if (!u) { if (src) later(); return; }
      const im = new Image();
      im.onload = () => { if (alive) { setUrl(u); setReal(true); } };
      im.src = u;
    });
    if (src) sourceCover(src, near).then(u => { if (!alive) return; if (u) { setUrl(u); setReal(true); } else viaBangumi(); });
    else viaBangumi();
    return () => { alive = false; clearTimeout(retry); };
  }, [book?.id, book?.title, visible, attempt, src, own]);
  const onError = () => {
    if (own) { setOwnBroken(true); return; }
    if (!real) return;
    setUrl(fallback); setReal(false);
    if (src) forgetCover(src);
    setAttempt(a => (a < 2 ? a + 1 : a));
  };
  return { url, real, onError };
}
