// 封面。四级来源，越靠前越好：
//   1. 书架里的 EPUB 自带封面（下载/导入时取出，存成 data URL）
//   2. 原站封面（轻小说文库每本书都有）：img.wenku8.com 直连不通，走公共图片代理 wsrv.nl（顺便缩到 360 宽转 webp），
//      不通再换 i0.wp.com。两个代理国内直连实测都通，约 1 秒一张
//   3. Bangumi 条目封面（原站封面加载失败时才查）
//   4. 生成封面：按书名哈希挑一套"精装书衣"配色，竖排书名 + 金箔线框（画法见 jacket-art.js，后台线程里画，见 jacket.js）
// 生成封面不是兜底的灰块，而是整站视觉的一部分——光盘、瀑布流、文件夹里大部分书会用它。
import { useEffect, useState } from 'react';
import { idbGet, idbSet } from './idb.js';
import { raceImage } from './net.js';
import { useCatalogBook } from './library.js';
import { cleanTitle } from './jacket-art.js';
import { jacketNow, jacketReady, requestJacket } from './jacket.js';
export { cleanTitle };

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
//      → 全局排队：同时最多 10 本在竞速；每次空出位置，先挑「此刻就在屏幕上」的，没有才轮到翻过去的那些
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

// 实测（2026-10-09，开着 Clash）：两个代理冷图 2–4 秒、热图 1–2 秒，原站直连连不上。所以：
//   超时放到 15 秒（一屏几十张排队时 8 秒常常没到就判失败，其实图在路上）；第二条线 2 秒后才补发（以前 0.9 秒，
//   几乎每张都发两遍，代理更堵）；失败 5 秒后就能再试（以前 15 秒，期间一直是生成的书衣）
const RACE_MAX = 12, LOW_MAX = 4, RETRY_MS = 5000;
let racing = 0, racingLow = 0;
const waiting = [];   // { run, near }：near() 说这本此刻在不在屏幕附近
function drain() {
  while (racing < RACE_MAX && waiting.length) {
    let i = waiting.length - 1;
    while (i >= 0 && !waiting[i].near()) i--;
    // 屏幕外的（翻过去的、空闲预取的）最多同时占 4 个位置，其余永远留给屏幕上的：
    // 以前预取一口气占满，点进探索页时屏幕上那几本要排在后面，十几秒才出来
    const low = i < 0;
    if (low && racingLow >= LOW_MAX) return;
    const [job] = waiting.splice(low ? waiting.length - 1 : i, 1);   // 屏幕上的优先，同是屏幕上的后来的先
    racing++; if (low) racingLow++;
    job.run().finally(() => { racing--; if (low) racingLow--; drain(); });
  }
}
const schedule = (fn, near) => new Promise(resolve => {
  waiting.push({ run: async () => { try { resolve(await fn()); } catch { resolve(null); } }, near: near || (() => true) });
  drain();
});

const tried = new Map(); // src → { p: Promise<地址|null>, at, ok, nears }
function sourceCover(src, near) {
  const t = tried.get(src);
  if (t && (t.ok !== false || Date.now() - t.at < RETRY_MS)) {
    // 同一本还在排队（比如空闲预取排进去的，那时判断「不在屏幕上」），现在屏幕上的组件也要它：
    // 把这边的判断挂上去，任何一处在屏幕上就按屏幕上的排，不会被压在预取后面
    if (near && t.ok === undefined && !t.nears.includes(near)) { t.nears.push(near); drain(); }
    return t.p;
  }
  const entry = { at: Date.now(), ok: undefined, nears: [near || (() => true)] };
  entry.p = (async () => {
    await loadKnown();
    if (known[src]) return known[src];
    const url = await schedule(() => raceImage(sourceCoverUrls(src), { stagger: 2000, timeout: 15000 }), () => entry.nears.some(f => f()));
    entry.ok = !!url;
    // 只记代理地址：原站直连通不通取决于当下的网络（开没开代理、换没换 Wi-Fi），记下来换个网络会卡很久才失败
    if (url && !/^https?:\/\/img\.wenku8\.com\//.test(url)) remember(src, url);
    return url;
  })();
  tried.set(src, entry);
  return entry.p;
}
/**
 * 空闲时先把最可能看到的封面拉进缓存（探索页第一屏、各个世界的拼贴）：之后点进去直接从磁盘缓存出图。
 * 排队优先级最低（near 恒为假），屏幕上正在看的永远先；省流量模式不预取
 */
export function prefetchCovers(books) {
  if (navigator.connection?.saveData) return;
  for (const b of books) if (b?.coverSrc) sourceCover(b.coverSrc, () => false);
}
/** 记住的地址打不开了：忘掉它，下次重新竞速 */
function forgetCover(src) {
  tried.delete(src);
  remember(src, null);
}

/**
 * 组件里用：先给生成封面（后台线程画，画好前 Cover 垫这本书的底色），visible 为真时先取原站封面、失败再查 Bangumi，拿到再换。
 * 返回的 onError 要挂到 <img> 上：真封面加载失败时退回生成封面并重新找。
 * @param {object} book  需要 title / author / publisher；书架条目可带 cover
 * @param {() => boolean} [near]  这本此刻在不在屏幕附近（排队时屏幕上的先加载）；不传当作在
 * @param {number} [scale]  生成封面画多大（jacketScale，按封面显示的宽度）；0 = 还不知道，先不画
 */
export function useCover(book, visible = true, near, scale = 0) {
  // 书架条目（下载时从 EPUB 里取封面）：纯文本版 EPUB 里没有封面，以前只能拿「化物语(物语系列一) · 上卷」这种书名去 Bangumi 碰运气，
  // 网络一抖就时有时无。现在按 bookId 借书目里那本书的原站封面，和探索页走同一条（排队 + 记住地址）的路
  const [ownBroken, setOwnBroken] = useState(false);   // EPUB 里取出的封面万一画不出来
  const own = ownBroken ? '' : book?.cover || '';
  const catalogBook = useCatalogBook(book && !own && !book.coverSrc ? book.bookId : undefined);
  const src = book?.coverSrc || catalogBook?.coverSrc || '';
  const ident = own || (book ? `${book.title || ''}|${book.author || ''}` : '');
  const [found, setFound] = useState('');   // 找到的真封面
  const [jacket, setJacket] = useState(() => (book && !own ? jacketNow(book, scale) : ''));
  const [attempt, setAttempt] = useState(0);   // 重试次数（最多 3 次，防止坏地址来回跳）
  useEffect(() => { setFound(''); setJacket(book && !own ? jacketNow(book, scale) : ''); setAttempt(0); }, [ident]);
  // 生成封面：知道显示多大就排队画（后台线程，屏幕上的先画）；已经找到真封面就不画（真封面万一显示失败，found 清空后再画）
  useEffect(() => {
    if (!book || own || found || !scale) return;
    if (jacketReady(book, scale)) { setJacket(jacketNow(book, scale)); return; }
    return requestJacket(book, scale, near, setJacket);
  }, [ident, scale, !!found]);
  useEffect(() => {
    // 本地书没有可查的书名；公版古籍去 Bangumi 只会搜到同名动画/漫画的图，统一用生成的书衣
    if (!book || own || !visible || book.source === 'local' || book.source === 'public') return;
    let alive = true, retry = 0;
    const later = () => { if (attempt < 3) retry = setTimeout(() => { if (alive) setAttempt(a => a + 1); }, 6000); };
    // 查 Bangumi 用书目里的书名和别名（书架条目的书名带「· 上卷」，搜不准）
    const viaBangumi = () => bangumiCover(catalogBook || book).then(u => {
      if (!alive) return;
      if (!u) { if (src) later(); return; }
      const im = new Image();
      im.onload = () => { if (alive) setFound(u); };
      im.src = u;
    });
    if (src) sourceCover(src, near).then(u => { if (!alive) return; if (u) setFound(u); else viaBangumi(); });
    else viaBangumi();
    return () => { alive = false; clearTimeout(retry); };
  }, [book?.id, book?.title, visible, attempt, src, own]);
  const real = !!(own || found);
  const onError = () => {
    if (own) { setOwnBroken(true); return; }
    if (!found) return;
    setFound('');
    if (src) forgetCover(src);
    setAttempt(a => (a < 3 ? a + 1 : a));
  };
  return { url: own || found || jacket, real, onError };
}
