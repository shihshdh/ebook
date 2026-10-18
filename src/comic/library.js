// 看漫画：在启用的漫画源里搜、打开详情和章节、取图，记阅读进度。源怎么装、沙箱怎么开见 sources.js。
//
//   搜：启用的源一起搜（同时 4 个），谁先回来先显示；单个源 20 秒没回算超时。不同源的结果不合并（书名写法各不相同），按源分组
//   取图：正文图（同时 4 张）和封面（同时 6 张）各排各的队；封面 Blob 留在有上限的内存缓存，组件各自拥有显示地址，
//        正文页由阅读器自己管（翻走的章节整章放掉）
//   进度：当前账户 kv 的 comic:progress（一条记录存全部，最多 200 本，最近看的在前）——「最近在看」和「继续看」都用它
import { useEffect, useState } from 'react';
import { idbGet, idbSet } from '../lib/idb.js';
import { listComicSources, withSource } from './sources.js';
import { fetchImage } from './images.js';
import { coverLoader, firstCover } from './cover-loader.js';
import { firstPageCache } from './first-page-cache.js';
import { loadCover, saveCover, loadDetails, saveDetails } from './cover-cache.js';
import { isIOS, mobileUI } from '../lib/native.js';
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
// 手机上并发调低：漫画源的沙箱（源脚本、解析网页、取图回调）和页面挤在同一个主线程上，iOS 的 WKWebView 尤其如此。
// 正文图同时 3 张（正在看的那张排在最前，见 pageURL 的 front），封面同时 3 张（封面大多已经存在本机，cover-cache.js）
const pageSlot = limiter(mobileUI ? 3 : 4);

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
// 详情存在本机（cover-cache.js）：有的源取一次要 3–4 秒（拷贝漫画、漫画柜），点开一部看过 / 找过的漫画不该再干等。
// 存的有章节就马上用；存了超过 6 小时的，同时在后台重取一份换上（新出的话下次打开就有）。没章节的不存（多半是被下架，下次再试）
const DETAIL_FRESH = 6 * 3600e3, DETAIL_KEEP = 14 * 864e5;
// 失败了隔 1.2 秒再试一次：源偶尔一下没响应、拷贝漫画限流（210），一次失败就去别的源找一圈要十几秒
const fetchDetails = (sourceId, comicId) => {
  const once = () => withSource(sourceId, box => box.call('info', [comicId], { timeout: 20000 }));
  return once().catch(() => new Promise(r => setTimeout(r, 1200)).then(once)).then(d => localizeDetails(d, sourceId));
};
export const comicDetails = (sourceId, comicId) => remember(details, `${sourceId}|${comicId}`, async () => {
  const key = `${sourceId}|${comicId}`, saved = await loadDetails(key), now = Date.now();
  if (saved && now - saved.at < DETAIL_KEEP && chaptersOf(saved.v).length) {
    if (now - saved.at > DETAIL_FRESH) fetchDetails(sourceId, comicId).then(d => { if (chaptersOf(d).length) { saveDetails(key, d); details.set(key, Promise.resolve(d)); } }, () => {});
    return saved.v;
  }
  const d = await fetchDetails(sourceId, comicId);
  if (chaptersOf(d).length) saveDetails(key, d);
  return d;
});
/** 提前取详情（手指按下一部漫画、光盘转到跟前）：点开时章节已经在了。取不到不报错 */
export function prefetchComic(book) {
  const c = book?.comics?.find(x => !coversBlocked(x.sourceId)) || book?.comics?.[0];
  return c ? comicDetails(c.sourceId, c.comicId).catch(() => {}) : Promise.resolve();
}
/** 提前取一话的图片列表（详情出来后「开始看 / 继续看」那一话），点开阅读器少等一轮 */
const firstPages = firstPageCache();
const pageKey = (sourceId, comicId, epId, url) => JSON.stringify([sourceId, comicId, epId, url]);
export function prefetchChapter(sourceId, comicId, epId, page = 0) {
  chapterImages(sourceId, comicId, epId).then(images => {
    const url = images[Math.min(Math.max(0, page), images.length - 1)];
    if (url) firstPages.warm(pageKey(sourceId, comicId, epId, url), () =>
      pageSlot(() => withSource(sourceId, box => fetchImage(box, url, { comicId, epId }))));
  }).catch(() => {});
}
/** 某一话的图片地址。epId 为 null：整本一卷 */
export const chapterImages = (sourceId, comicId, epId) => remember(episodes, `${sourceId}|${comicId}|${epId}`,
  () => withSource(sourceId, box => box.call('ep', [comicId, epId], { timeout: 30000 })).then(r => r.images));

/** 详情里的章节按阅读顺序编号：章节为空且是整本一卷时给一个「全一卷」 */
export const chaptersOf = (d) => (d.single ? [{ id: null, title: '全一卷', group: '' }] : d.chapters);

// ---------- 图 ----------
/** 取一张正文图：返回 blob 地址，用完调用方自己 URL.revokeObjectURL */
export async function pageURL(sourceId, url, { comicId, epId, signal, front } = {}) {
  signal?.throwIfAborted();
  const cached = firstPages.take(pageKey(sourceId, comicId, epId, url), signal);
  let blob;
  if (cached) {
    try { blob = await cached; }
    catch (error) { if (signal?.aborted) throw error; } // 预取失败照常重试，不让后台失败挡住阅读。
  }
  if (!blob) blob = await pageSlot(() => withSource(sourceId, box => fetchImage(box, url, { comicId, epId, signal, front })), { signal, front });
  signal?.throwIfAborted();
  return URL.createObjectURL(blob);
}

// 封面好不好取，按源记：有的源图床把我们整个拦掉（包子漫画的 static-tw.baozimh.com 一律 Cloudflare 403，加什么请求头都没用）。
// 一个源连着失败 3 张、一张没成过，就记成「封面取不到」，本机记 3 天（期间不再去取，省得占着排队名额）：
// 同一部漫画有别的源时封面用别的源的（comicCover）、找名作时它排到后面、探索书墙里它的书往后放（comic/catalog.js）
const COVER_BAD = 'comic:cover-bad:v2', BAD_DAYS = 3;
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

// Blobs can leave the LRU without invalidating a mounted disc or book tile.
const getCoverBlob = coverLoader({
  load: loadCover, save: saveCover, max: mobileUI ? 6 : 8, keep: isIOS ? 120 : 240,
  fetch: async (sourceId, url, signal) => {
    if (coversBlocked(sourceId)) throw new Error('这个源的封面取不到');
    try {
      const blob = await withSource(sourceId, box => {
        signal.throwIfAborted();
        return fetchImage(box, url, { thumb: true, signal });
      });
      noteCover(sourceId, true);
      return blob;
    } catch (error) {
      // Network timeouts are transient, not proof that a whole source is blocked.
      if (!signal.aborted && /HTTP (403|404|410)|不是图片/.test(error.message)) noteCover(sourceId, false);
      throw error;
    }
  },
});
export const prioritizeComicCovers = () => getCoverBlob.refresh();
/** Caller owns this URL and must revoke it after use. */
export async function coverURL(sourceId, url, { near } = {}) {
  if (!url) throw new Error('没有封面');
  return URL.createObjectURL(await getCoverBlob(sourceId, url, near));
}
export async function comicCover(book, { near } = {}) {
  const list = (book?.comics || []).filter(c => c.cover)
    .map((c, i) => ({ c, i, bad: coversBlocked(c.sourceId) ? 1 : 0 }))
    .sort((a, b) => a.bad - b.bad || a.i - b.i).map(x => x.c);
  const blob = await firstCover(list, c => getCoverBlob(c.sourceId, c.cover, near));
  return URL.createObjectURL(blob);
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

// ---------- 换个源找同一部 ----------
// 已知的源都没章节（版权作品在漫画人、GoDa 常被下架：详情页还在，章节列表空了）：按书名去其他打开的源里搜，书名对得上的接上
const bare = (s) => String(s || '').replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
  .replace(/[(（【\[][^)）】\]]*[)）】\]]/g, '').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
/** @returns {Promise<{ sourceId, sourceName, comicId, cover, title }[]>} 书名对得上、而且有章节的别的源 */
export async function findOtherSources(book, { signal } = {}) {
  const names = new Set([book.title, book.alt, ...(book.comics || []).map(c => c.title)].map(bare).filter(Boolean));
  const have = new Set((book.comics || []).map(c => c.sourceId));
  const hits = [];
  await searchComics(book.title, { signal, timeout: 12000, onResult: ({ source, comics }) => {
    if (have.has(source.id)) return;
    const c = comics.find(x => names.has(bare(x.title)));
    if (c) hits.push({ sourceId: source.id, sourceName: source.name, comicId: c.id, cover: c.cover || '', title: c.title });
  } });
  const ok = await Promise.all(hits.map(h => comicDetails(h.sourceId, h.comicId).then(d => chaptersOf(d).length > 0, () => false)));
  return hits.filter((_, i) => ok[i]).sort((a, b) => coversBlocked(a.sourceId) - coversBlocked(b.sourceId));
}
