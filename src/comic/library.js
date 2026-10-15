// 看漫画：在启用的漫画源里搜、打开详情和章节、取图，记阅读进度。源怎么装、沙箱怎么开见 sources.js。
//
//   搜：启用的源一起搜（同时 4 个），谁先回来先显示；单个源 20 秒没回算超时。不同源的结果不合并（书名写法各不相同），按源分组
//   取图：正文图（同时 4 张）和封面（同时 6 张）各排各的队；封面的 blob 地址留着（最多 300 张，最久没看的先放掉），
//        正文页由阅读器自己管（翻走的章节整章放掉）
//   进度：当前账户 kv 的 comic:progress（一条记录存全部，最多 200 本，最近看的在前）——「最近在看」和「继续看」都用它
import { useEffect, useState } from 'react';
import { idbGet, idbSet } from '../lib/idb.js';
import { listComicSources, withSource } from './sources.js';
import { fetchImage } from './images.js';
import { loadCover, saveCover } from './cover-cache.js';
import { localizeComics, localizeDetails } from './translate.js';

// ---------- 地址 ----------
export { readPath } from './book.js';

// ---------- 并发 ----------
function limiter(max) {
  let running = 0;
  const queue = [];
  const next = () => {
    while (running < max && queue.length) {
      const { job, resolve, reject, signal } = queue.shift();
      if (signal?.aborted) { reject(new DOMException('已取消', 'AbortError')); continue; }
      running++;
      job().then(resolve, reject).finally(() => { running--; next(); });
    }
  };
  return (job, { signal, front = false } = {}) => new Promise((resolve, reject) => {
    queue[front ? 'unshift' : 'push']({ job, resolve, reject, signal });
    next();
  });
}
// 正文图和封面各排各的队：搜索结果、探索页一下要几十张封面，慢的站一张要等十几秒，不能把正在看的那一页堵在后面
const pageSlot = limiter(4), coverSlot = limiter(6);

// ---------- 搜 ----------
/** 在启用的漫画源里搜。每个源一有结果就 onResult({ source: {id, name, key}, comics, error })，全部结束后 resolve */
export async function searchComics(keyword, { signal, onResult, timeout = 20000, concurrency = 4 } = {}) {
  const queue = (await listComicSources()).filter(e => e.enabled);
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (let e; !signal?.aborted && (e = queue.shift());) {
      const source = { id: e.id, name: e.name, key: e.key };
      try {
        const comics = await withSource(e.id, async (box) => {
          const options = box.meta.searchOptions.map(o => o.default);
          return (await box.call('search', [keyword, options, 1, null], { signal, timeout })).comics;
        });
        const list = await localizeComics(comics, e.key);   // 外文源的书名、简介翻成中文（translate.js）
        if (!signal?.aborted) onResult?.({ source, comics: list });
      } catch (err) {
        if (!signal?.aborted) onResult?.({ source, comics: [], error: /超时|timed? ?out/i.test(err?.message) ? '超时' : (err?.message || '出错了').slice(0, 60) });
      }
    }
  }));
}

// ---------- 详情、章节（这次运行里记着，来回翻不用重拉） ----------
const details = new Map(), episodes = new Map();
const remember = (map, key, load) => {
  if (!map.has(key)) {
    const p = load();
    map.set(key, p);
    p.catch(() => map.delete(key));   // 失败的不记，下次重试
    if (map.size > 100) map.delete(map.keys().next().value);
  }
  return map.get(key);
};
/** @returns {Promise<{title, subtitle, cover, description, tags: [string, string[]][], chapters: {id, title, group}[], single, updateTime}>} */
export const comicDetails = (sourceId, comicId) => remember(details, `${sourceId}|${comicId}`,
  () => withSource(sourceId, box => box.call('info', [comicId], { timeout: 30000 })).then(d => localizeDetails(d, sourceId)));
/** 某一话的图片地址。epId 为 null：整本一卷 */
export const chapterImages = (sourceId, comicId, epId) => remember(episodes, `${sourceId}|${comicId}|${epId}`,
  () => withSource(sourceId, box => box.call('ep', [comicId, epId], { timeout: 30000 })).then(r => r.images));

/** 详情里的章节按阅读顺序编号：章节为空且是整本一卷时给一个「全一卷」 */
export const chaptersOf = (d) => (d.single ? [{ id: null, title: '全一卷', group: '' }] : d.chapters);

// ---------- 图 ----------
/** 取一张正文图：返回 blob 地址，用完调用方自己 URL.revokeObjectURL */
export function pageURL(sourceId, url, { comicId, epId, signal, front } = {}) {
  return pageSlot(() => withSource(sourceId, box => fetchImage(box, url, { comicId, epId, signal })), { signal, front })
    .then(blob => URL.createObjectURL(blob));
}

// 封面好不好取，按源记：有的源图床把我们整个拦掉（包子漫画的 static-tw.baozimh.com 一律 Cloudflare 403，加什么请求头都没用）。
// 一个源连着失败 3 张、一张没成过，就记成「封面取不到」，本机记 3 天（期间不再去取，省得占着排队名额）：
// 同一部漫画有别的源时封面用别的源的（comicCover）、找名作时它排到后面、探索书墙里它的书往后放（comic/catalog.js）
const COVER_BAD = 'comic:cover-bad', BAD_DAYS = 3;
const coverStats = new Map();   // 源 → { ok, fail }
let badCovers;
const badMap = () => {
  if (!badCovers) { try { badCovers = JSON.parse(localStorage.getItem(COVER_BAD)) || {}; } catch { badCovers = {}; } }
  return badCovers;
};
const saveBad = () => { try { localStorage.setItem(COVER_BAD, JSON.stringify(badCovers)); } catch { /* 存不下就只管这次 */ } };
/** 这个源的封面现在取不到（记着的 3 天内） */
export function coversBlocked(sourceId) { const at = badMap()[sourceId]; return !!at && Date.now() - at < BAD_DAYS * 864e5; }
function noteCover(sourceId, ok) {
  const s = coverStats.get(sourceId) || { ok: 0, fail: 0 };
  if (ok) s.ok++; else s.fail++;
  coverStats.set(sourceId, s);
  const m = badMap();
  if (ok && m[sourceId]) { delete m[sourceId]; saveBad(); }
  else if (!ok && !s.ok && s.fail >= 3 && !coversBlocked(sourceId)) {
    m[sourceId] = Date.now(); saveBad();
    window.dispatchEvent(new CustomEvent('librarium:comic-covers', { detail: sourceId }));   // 书单换掉这个源的名作（catalog.js）
  }
}

const covers = new Map();   // key → Promise<blob 地址>，Map 的顺序就是最近用过的顺序
const MAX_COVERS = 300;
/** 封面（走源的 onThumbnailLoad），blob 地址缓存着，不要自己 revoke */
export function coverURL(sourceId, url) {
  if (!url) return Promise.reject(new Error('没有封面'));
  const key = `${sourceId}|${url}`;
  let p = covers.get(key);
  if (p) { covers.delete(key); covers.set(key, p); return p; }
  // 先看本机存着没有（cover-cache.js），没有才排队经源下载；下好的存起来
  p = loadCover(key).then(saved => {
    if (saved) return saved;
    if (coversBlocked(sourceId)) throw new Error('这个源的封面取不到');
    const net = coverSlot(() => withSource(sourceId, box => fetchImage(box, url, { thumb: true })));
    net.then(blob => { noteCover(sourceId, true); saveCover(key, blob); }, (err) => { if (!/取消|abort/i.test(err?.message || '')) noteCover(sourceId, false); });
    return net;
  }).then(blob => URL.createObjectURL(blob));
  p.catch(() => covers.delete(key));
  covers.set(key, p);
  while (covers.size > MAX_COVERS) {
    const [oldKey, old] = covers.entries().next().value;
    covers.delete(oldKey);
    old.then(u => URL.revokeObjectURL(u), () => {});
  }
  return p;
}

/** 一部漫画的封面：几个源里都有时一个个试，封面取不到的源放最后（搜索池、名作并进来的源都在 book.comics 里） */
export async function comicCover(book) {
  const list = (book?.comics || []).filter(c => c.cover)
    .map((c, i) => ({ c, i, bad: coversBlocked(c.sourceId) ? 1 : 0 })).sort((a, b) => a.bad - b.bad || a.i - b.i);
  for (const { c } of list) {
    try { return await coverURL(c.sourceId, c.cover); } catch { /* 换下一个源 */ }
  }
  throw new Error('没有取得到的封面');
}

// ---------- 进度 ----------
const PROGRESS = 'comic:progress';
let progress = null;
const progressSubs = new Set();
async function loadProgress() {
  if (!progress) progress = (await idbGet('kv', PROGRESS).catch(() => null)) || [];
  return progress;
}
/**
 * @typedef {object} ComicProgress
 * @property {string} sourceId
 * @property {string} sourceName
 * @property {string} comicId
 * @property {string} title
 * @property {string} cover
 * @property {number} index       第几话（chaptersOf 的下标）
 * @property {string} chapter     那一话的标题
 * @property {number} page        那一话里第几张（从 0 开始）
 * @property {number} pages       那一话一共几张
 * @property {number} at
 */
export async function getProgress(sourceId, comicId) {
  return (await loadProgress()).find(p => p.sourceId === sourceId && p.comicId === comicId) || null;
}
let saveTimer = 0;
/** 阅读器翻页时调；写入防抖 600ms */
export async function saveProgress(entry) {
  const list = (await loadProgress()).filter(p => !(p.sourceId === entry.sourceId && p.comicId === entry.comicId));
  progress = [{ ...entry, at: Date.now() }, ...list].slice(0, 200);
  progressSubs.forEach(fn => fn(progress));
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => idbSet('kv', PROGRESS, progress).catch(e => console.warn('漫画进度没存上', e)), 600);
}
export async function removeProgress(sourceId, comicId) {
  progress = (await loadProgress()).filter(p => !(p.sourceId === sourceId && p.comicId === comicId));
  progressSubs.forEach(fn => fn(progress));
  await idbSet('kv', PROGRESS, progress);
}
/** 最近在看的漫画（最近的在前） */
export function useComicProgress() {
  const [list, setList] = useState(progress);
  useEffect(() => {
    let alive = true;
    loadProgress().then(l => alive && setList(l));
    progressSubs.add(setList);
    return () => { alive = false; progressSubs.delete(setList); };
  }, []);
  return list;
}
