// 看漫画：在启用的漫画源里搜、打开详情和章节、取图，记阅读进度。源怎么装、沙箱怎么开见 sources.js。
//
//   搜：启用的源一起搜（同时 4 个），谁先回来先显示；单个源 20 秒没回算超时。不同源的结果不合并（书名写法各不相同），按源分组
//   取图：正文图（同时 4 张）和封面（同时 8 张，见 getCoverBlob）各排各的队；封面 Blob 留在有上限的内存缓存，组件各自拥有显示地址，
//        正文页由阅读器自己管（翻走的章节整章放掉）
//   进度：当前账户 kv 的 comic:progress（一条记录存全部，最多 200 本，最近看的在前）——「最近在看」和「继续看」都用它
import { useEffect, useState } from 'react';
import { idbGet, idbSet } from '../lib/idb.js';
import { listComicSources, withSource } from './sources.js';
import { fetchImage, fetchImageDirect } from './images.js';
import { checkUrl } from './policy.js';
import { measureSource, sourcePriority } from './source-metrics.js';
import { requestBudget, transientComicError } from './request-budget.js';
import { coverLoader, firstCover } from './cover-loader.js';
import { firstPageCache } from './first-page-cache.js';
import { loadCover, saveCover, loadDetails, saveDetails } from './cover-cache.js';
import { isIOS, mobileUI } from '../lib/native.js';
import { localizeComics, localizeDetails, bestLanguage } from './translate.js';

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
// 正文图同时 3 张（正在看的那张排在最前，见 pageURL 的 front）；封面另排（getCoverBlob），大多不经沙箱
const pageSlot = limiter(mobileUI ? 3 : 4);

// ---------- 搜 ----------
/** 在启用的漫画源里搜。每个源一有结果就 onResult({ source: {id, name, key}, comics, error })，全部结束后 resolve */
export async function searchComics(keyword, { signal, onResult, timeout = 12000, concurrency = mobileUI ? 6 : 8 } = {}) {
  const queue = (await listComicSources()).filter(e => e.enabled).sort((a,b)=>sourcePriority(a)-sourcePriority(b));
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (let e; !signal?.aborted && (e = queue.shift());) {
      const source = { id: e.id, name: e.name, key: e.key };
      try {
        const comics = await measureSource(e, () => requestBudget(bounded => withSource(e.id, async (box) => {
          bounded.throwIfAborted();
          const options = box.meta.searchOptions.map(o => o.default);
          return (await box.call('search', [keyword, options, 1, null], { signal: bounded, timeout })).comics;
        }), { timeout, signal }));
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
// One total deadline: retry only early transient errors, never stack full timeouts.
const fetchDetails = (sourceId, comicId) => {
  let received;
  return requestBudget(async signal => {
  const started = Date.now();
  const once = () => withSource(sourceId, box => {
    signal.throwIfAborted();
    return box.call('info', [comicId], { timeout: 12000, signal });
  });
  let d;
  try { d = await once(); }
  catch (error) {
    signal.throwIfAborted();
    // Retry only an early transient failure; never start another full timeout.
    if (!transientComicError(error) || Date.now() - started > 3000) throw error;
    await new Promise(r => setTimeout(r, 400));
    signal.throwIfAborted(); d = await once();
  }
  received = bestLanguage(d);
  return localizeDetails(d, sourceId);
  }, { fallback: () => received });
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
      pageSlot(() => requestBudget(signal => withSource(sourceId, box => { signal.throwIfAborted(); return fetchImage(box, url, { comicId, epId, signal }); }), { timeout: 8000 })));
  }).catch(() => {});
}
/** 某一话的图片地址。epId 为 null：整本一卷 */
export const chapterImages = (sourceId, comicId, epId) => remember(episodes, `${sourceId}|${comicId}|${epId}`,
  () => requestBudget(signal => withSource(sourceId, box => { signal.throwIfAborted(); return box.call('ep', [comicId, epId], { timeout: 15000, signal }); }).then(r => r.images), { timeout: 15000, message: '章节目录响应超时，请重试或切换漫画源' }));

/** 详情里的章节按阅读顺序编号：章节为空且是整本一卷时给一个「全一卷」 */
export const chaptersOf = (d) => (d.single ? [{ id: null, title: '全一卷', group: '' }] : d.chapters);

// ---------- 图 ----------
/** 取一张正文图：返回 blob 地址，用完调用方自己 URL.revokeObjectURL */
export async function pageURL(sourceId, url, { comicId, epId, signal, front } = {}) {
  const blob = await requestBudget(async bounded => {
    const cached = firstPages.take(pageKey(sourceId, comicId, epId, url), bounded);
    if (cached) {
      try { return await cached; } catch (error) { bounded.throwIfAborted(); }
    }
    return pageSlot(() => withSource(sourceId, box => {
      bounded.throwIfAborted();
      return fetchImage(box, url, { comicId, epId, signal: bounded, front });
    }), { signal: bounded, front });
  }, { timeout: 18000, signal, message: '漫画图片响应超时，点一下重试或换源' });
  signal?.throwIfAborted();
  return URL.createObjectURL(blob);
}

// 封面好不好取，按源记：有的源图床把我们整个拦掉（包子漫画的 static-tw.baozimh.com 一律 Cloudflare 403，加什么请求头都没用）。
// 一个源连着被拒 3 张（403 / 404 / 不是图片）、一张没成过，就记成「封面取不到」，本机记 3 天（期间不占排队名额）：
// 同一部漫画有别的源时封面用别的源的（comicCover）、找名作时它排到后面、探索书墙里它的书往后放（comic/catalog.js）。
// 记着的源每次打开 App 还会再试一张（probed）：以前一记就是整整 3 天，换了网络、源站好了也不知道，名作封面一直是生成的书衣
const COVER_BAD = 'comic:cover-bad:v2', BAD_DAYS = 3;
const coverStats = new Map();   // 源 → { ok, fail, hard（被拒的次数）, ms（成功的总耗时）, why（最近一次失败） }
const probed = new Set();       // 这次运行里已经重新试过的「取不到」的源
let badCovers;
const badMap = () => {
  if (!badCovers) { try { badCovers = JSON.parse(localStorage.getItem(COVER_BAD)) || {}; } catch { badCovers = {}; } }
  return badCovers;
};
const saveBad = () => { try { localStorage.setItem(COVER_BAD, JSON.stringify(badCovers)); } catch { /* 存不下就只管这次 */ } };
/** 这个源的封面现在取不到（记着的 3 天内） */
export function coversBlocked(sourceId) { const at = badMap()[sourceId]; return !!at && Date.now() - at < BAD_DAYS * 864e5; }
const healthSubs = new Set();
let healthTimer = 0;
const healthChanged = () => { if (!healthTimer) healthTimer = setTimeout(() => { healthTimer = 0; healthSubs.forEach(fn => fn()); }, 800); };
const coverWhy = (error) => {
  const m = String(error?.message || error || '');
  const code = /HTTP\s*(\d{3})/.exec(m)?.[1];
  if (code) return `图床返回 ${code}`;
  if (/不是图片/.test(m)) return '取到的不是图片（多半被防盗链挡了）';
  if (/超时|timed? ?out/i.test(m)) return '超时';
  if (/network|connect|fetch|dns|refused|reset|证书|certificate|tls|ssl/i.test(m)) return '连不上图床';
  return m.slice(0, 40) || '出错了';
};
function noteCover(sourceId, ok, { ms = 0, error, hard = false } = {}) {
  const s = coverStats.get(sourceId) || { ok: 0, fail: 0, hard: 0, ms: 0, why: '' };
  if (ok) { s.ok++; s.ms += ms; } else { s.fail++; s.why = coverWhy(error); if (hard) s.hard++; }
  coverStats.set(sourceId, s);
  healthChanged();
  const m = badMap();
  if (ok && m[sourceId]) { delete m[sourceId]; saveBad(); window.dispatchEvent(new CustomEvent('librarium:comic-covers', { detail: sourceId })); }
  else if (!ok && hard && !s.ok && s.hard >= 3 && !coversBlocked(sourceId)) {
    m[sourceId] = Date.now(); saveBad();
    window.dispatchEvent(new CustomEvent('librarium:comic-covers', { detail: sourceId }));   // 书单换掉这个源的名作（catalog.js）
  }
}
/** 插件页看的：这次运行里这个源的封面取得怎么样。{ ok, fail, avg（秒）, why, blocked } */
export function coverHealth(sourceId) {
  const s = coverStats.get(sourceId);
  return { ok: s?.ok || 0, fail: s?.fail || 0, avg: s?.ok ? s.ms / s.ok / 1000 : 0, why: s?.why || '', blocked: coversBlocked(sourceId) };
}
/** 「再试试」：不再记成取不到，马上重新取 */
export function unblockCovers(sourceId) {
  const m = badMap();
  if (m[sourceId]) { delete m[sourceId]; saveBad(); }
  const s = coverStats.get(sourceId);
  if (s) s.hard = 0;
  healthChanged();
  window.dispatchEvent(new CustomEvent('librarium:comic-covers', { detail: sourceId }));
}
/** 封面情况变了就重渲染（插件页的漫画源列表） */
export function useCoverHealth() {
  const [, setTick] = useState(0);
  useEffect(() => { const fn = () => setTick(t => t + 1); healthSubs.add(fn); return () => healthSubs.delete(fn); }, []);
}

// 封面的请求头记在本机，同一个图床以后不用再开源的沙箱：
//   源的封面钩子（onThumbnailLoad）只是给几个固定的请求头（Referer、UA），没写钩子的源就是浏览器 UA + 这个图床的 cookie。
//   以前每张封面都要经那个源的沙箱问一遍——iPhone 上同时只留 3 个沙箱，封面分散在十几个源里，
//   实测冷启动 40 秒开了 50 次沙箱、关了 46 次，图片请求反而没发出去几个。
//   现在每个源、每个图床第一张封面经沙箱取，源给的请求只是「原地址 + 请求头」（没有改地址、解密、拼图）就把请求头记下来，
//   之后同一图床直接用原生 HTTP 取。记 3 天；直接取被拒（403、不是图片）就忘掉，退回经沙箱取
const THUMB_KEY = 'comic:thumb-headers:v1', THUMB_DAYS = 3;
let thumbMemo;
const thumbMap = () => {
  if (!thumbMemo) { try { thumbMemo = JSON.parse(localStorage.getItem(THUMB_KEY)) || {}; } catch { thumbMemo = {}; } }
  return thumbMemo;
};
const thumbKey = (sourceId, url) => { try { return `${sourceId}|${new URL(url).host}`; } catch { return ''; } };
let thumbSave = 0;
const saveThumbs = () => { clearTimeout(thumbSave); thumbSave = setTimeout(() => { try { localStorage.setItem(THUMB_KEY, JSON.stringify(thumbMemo)); } catch { /* 存不下就只管这次 */ } }, 1000); };
function thumbHeaders(sourceId, url) {
  const hit = thumbMap()[thumbKey(sourceId, url)];
  return hit && Date.now() - hit.at < THUMB_DAYS * 864e5 ? hit.headers : null;
}
function rememberThumb(sourceId, url, req) {
  const key = thumbKey(sourceId, url);
  if (!key) return;
  try { checkUrl(url); } catch { return; }   // 自建的源（局域网）只能经沙箱取，不记
  const plain = req && req.url === url && req.method === 'GET' && req.body == null && !req.onResponse && !req.modifyImage;
  const m = thumbMap();
  if (plain) m[key] = { headers: req.headers || {}, at: Date.now() }; else if (m[key]) delete m[key]; else return;
  saveThumbs();
}
function forgetThumb(sourceId, url) {
  const m = thumbMap(), key = thumbKey(sourceId, url);
  if (m[key]) { delete m[key]; saveThumbs(); }
}

// Blobs can leave the LRU without invalidating a mounted disc or book tile.
// 屏幕外同时 3 张（以前 1 张），同一图床同时 4 张（以前 2 张）：手机原生 HTTP 一个图床本来就开 4–6 条连接
const getCoverBlob = coverLoader({
  load: loadCover, save: saveCover, max: 8, perHost: 4, low: 3, timeout: 10000, keep: isIOS ? 120 : 240,
  fetch: async (sourceId, url, signal) => {
    if (coversBlocked(sourceId)) {
      if (probed.has(sourceId)) throw new Error('这个源的封面取不到');
      probed.add(sourceId);   // 这次运行头一回：再试一张，成了就解除
    }
    const t0 = performance.now();
    try {
      let blob;
      const headers = thumbHeaders(sourceId, url);
      if (headers) {
        try { blob = await fetchImageDirect(url, headers, { signal }); }
        catch (error) {
          // 超时、断网照常算这次失败（排队器会再试）；被拒了才是记下的请求头不灵了，经沙箱重新问
          if (signal.aborted || !/HTTP 4\d\d|不是图片|网址|局域网/.test(error.message)) throw error;
          forgetThumb(sourceId, url);
        }
      }
      if (!blob) {
        let req;
        blob = await withSource(sourceId, box => {
          signal.throwIfAborted();
          return fetchImage(box, url, { thumb: true, signal, onRequest: r => { req = r; } });
        });
        rememberThumb(sourceId, url, req);
      }
      noteCover(sourceId, true, { ms: performance.now() - t0 });
      return blob;
    } catch (error) {
      // Network timeouts are transient, not proof that a whole source is blocked.（排队器只在超时时中止，所以中止了就是超时）
      noteCover(sourceId, false, { error: signal.aborted ? new Error('超时') : error, hard: !signal.aborted && /HTTP (403|404|410)|不是图片/.test(error.message) });
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
  const blob = await firstCover(list, (c, hooks) => getCoverBlob(c.sourceId, c.cover, near, hooks));
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
  const controller = new AbortController();
  try {
    return await requestBudget(async bounded => {
      const cancel = () => controller.abort();
      bounded.addEventListener('abort', cancel, { once: true });
      const names = new Set([book.title, book.alt, ...(book.comics || []).map(c => c.title)].map(bare).filter(Boolean));
      const have = new Set((book.comics || []).map(c => c.sourceId));
      const checks = [];
      let first;
      const ready = new Promise(resolve => { first = resolve; });
      const search = searchComics(book.title, { signal: controller.signal, timeout: 5000, concurrency: 6, onResult: ({ source, comics }) => {
        if (have.has(source.id)) return;
        const c = comics.find(x => names.has(bare(x.title)));
        if (!c) return;
        const hit = { sourceId: source.id, sourceName: source.name, comicId: c.id, cover: c.cover || '', title: c.title };
        checks.push(comicDetails(source.id, c.id).then(d => {
          if (!chaptersOf(d).length) return null;
          first([hit]); return hit;
        }, () => null));
      } });
      try {
        return await Promise.race([ready, search.then(() => Promise.all(checks)).then(list => list.filter(Boolean))]);
      } finally { bounded.removeEventListener('abort', cancel); }
    }, { timeout: 12000, signal, message: '其他漫画源暂时没有回应，请稍后重试' });
  } finally { controller.abort(); }
}
