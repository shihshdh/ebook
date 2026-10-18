// 探索页「漫画」标签的书单。不分源：所有打开的漫画源混在一起，界面上不出现源的名字（详情里才看得到）。
//
//   名作：最前面先放高分神作（血之辙、再见绘梨……）和大家都听过的那几十部（东京喰种、咒术回战……），见 famous.js；
//         按书名到打开的源里搜，哪个源有用哪个
//   全部：名作，然后是各源探索页（推荐、热门、最新……）的第一页，各源轮流交错排（不让一个源刷屏），同名的合成一条（同搜索池）
//   世界：这个世界的名作，然后奇幻 / 校园 / 科幻 / 恋爱 / 悬疑（和轻小说同一套 WORLDS）——在每个源的分类里找名字对得上的那个
//         （奇幻 ← 奇幻、魔幻、玄幻、异世界……），各取第一页，同样交错合并
//   这次运行里记着：切世界、来回切标签不重拉
import { useEffect, useState } from 'react';
import { listComicSources, withSource } from './sources.js';
import { comicBook } from './book.js';
import { FAMOUS, TOP_RATED } from './famous.js';
import SEED from './famous-seed.js';
import { localizeComics } from './translate.js';
import { chaptersOf, comicDetails, coversBlocked } from './library.js';
import { calm } from '../lib/calm.js';
import { mobileUI } from '../lib/native.js';
import { requestBudget } from './request-budget.js';
import { measureSource, sourcePriority } from './source-metrics.js';
import { idbGet, idbSet } from '../lib/idb.js';
import { normTitle } from '../lib/pool.js';

// 世界 → 分类名里出现这些就算（繁简、日文、英文的写法都有）
const WORLD_WORDS = {
  fantasy: /奇幻|魔幻|玄幻|异世界|異世界|魔法|仙侠|仙俠|fantasy/i,
  campus: /校园|校園|学园|學園|青春|school/i,
  scifi: /科幻|机战|機戰|机甲|機甲|sci-?fi|mecha/i,
  romance: /恋爱|戀愛|爱情|愛情|纯爱|純愛|romance/i,
  mystery: /悬疑|懸疑|推理|侦探|偵探|惊悚|驚悚|mystery|thriller/i,
};
const TIMEOUT = 15000;

function limiter(max) {
  let running = 0;
  const queue = [];
  const next = () => { while (running < max && queue.length) { const { job, resolve, reject } = queue.shift(); running++; job().then(resolve, reject).finally(() => { running--; next(); }); } };
  return (job) => new Promise((resolve, reject) => { queue.push({ job, resolve, reject }); next(); });
}
const pool4 = limiter(mobileUI ? 6 : 8);   // Concurrent independent sources; fast sources start first.
// 漫画那半看不见（切到轻小说、探索页不在前台）时，书单和名作查找先停着，显示出来再接着（ComicExplore 报给这里）。
// 不然切到轻小说滑书墙、去首页书架，漫画源还在后台拉书单、解析网页，挤的是同一个主线程
let paneShown = false;
const paneWaiters = [];
export function setComicPaneShown(v) { paneShown = v; if (v) paneWaiters.splice(0).forEach(fn => fn()); }
const whenShown = () => (paneShown ? Promise.resolve() : new Promise(r => paneWaiters.push(r)));
// 探索书单、分类：漫画那半看得见、用户的手停下来再开工（lib/calm.js）
const slot = job => pool4(() => whenShown().then(() => calm()).then(() => requestBudget(job, { timeout: TIMEOUT })));

/** 各源的列表交错合并：第 1 个源的第 1 本、第 2 个源的第 1 本……同名（作者对得上或没写）的合成一条。
 *  封面取不到的源（包子漫画）排在后面一轮：书墙前几屏都是有封面的；它的书和前面同名的照样并进去（多一个可换的源） */
function blend(perSource) {
  const out = [], byTitle = new Map();
  const rounds = [perSource.filter(s => !coversBlocked(s.source.id)), perSource.filter(s => coversBlocked(s.source.id))];
  for (const group of rounds) {
    const max = Math.max(0, ...group.map(s => s.comics.length));
    for (let i = 0; i < max; i++) {
      for (const { source, comics } of group) {
        const comic = comics[i];
        if (!comic) continue;
        const b = comicBook({ sourceId: source.id, sourceName: source.name, comic }), k = normTitle(b.title);
        const same = k && byTitle.get(k);
        if (same) {
          if (!same.comics.some(c => c.sourceId === source.id)) { same.comics.push(b.comics[0]); same.poolSources.push(source.name); }
          if (!same.description && b.description) same.description = b.description;
          continue;
        }
        if (k) byTitle.set(k, b);
        out.push(b);
      }
    }
  }
  return out;
}

const categories = new Map();   // 源 → Promise<[{ label, category, param }]>
const categoriesOf = (id, signal) => {
  if (!categories.has(id)) {
    const p = withSource(id, box => { signal?.throwIfAborted(); return box.call('categories', [], { timeout: TIMEOUT, signal }); });
    p.catch(() => categories.delete(id));
    categories.set(id, p);
  }
  return categories.get(id);
};

/** 一个源在这个书单里给的漫画（'all' 或世界 id）；源出错、没有对得上的分类就是空的 */
// 一个源在这个书单里的下一页（'all' 或世界 id）。cur：翻到哪了（{ index, page }，第一次是 undefined）。
//   全部：先翻这个源的第一个探索页，翻完（没东西、到 maxPage、或者是不能翻页的「单页多分区」）换它的下一个探索页
//   世界：分类名对得上的那个分类，一页页往后翻
// 返回 { comics, cur: 下一次从哪接着（null：这个源翻完了） }；出错就当翻完了
async function fromSource(source, key, cur) {
  try {
    if (key === 'all') {
      return await slot(signal => measureSource(source, () => withSource(source.id, async box => {
        signal.throwIfAborted();
        const ex = box.meta.explore;
        let { index = 0, page = 1 } = cur || {};
        while (index < ex.length) {
          const { parts, maxPage } = await box.call('explore', [index, page], { timeout: TIMEOUT, signal });
          const seen = new Set(), comics = parts.flatMap(p => p.comics).filter(c => !seen.has(c.id) && seen.add(c.id));
          const single = ex[index].type === 'singlePageWithMultiPart' || (maxPage && page >= maxPage);
          const next = !comics.length || single ? { index: index + 1, page: 1 } : { index, page: page + 1 };
          if (comics.length) return { comics, cur: next.index < ex.length ? next : null };
          ({ index, page } = next);
        }
        return { comics: [], cur: null };
      })));
    }
    const words = WORLD_WORDS[key];
    const cat = (await slot(signal => measureSource(source, () => categoriesOf(source.id, signal)))).find(c => words.test(c.label));
    if (!cat) return { comics: [], cur: null };
    const page = cur?.page || 1;
    const { comics, maxPage } = await slot(signal => measureSource(source, () => withSource(source.id, box => { signal.throwIfAborted(); return box.call('category', [cat.category, cat.param, page], { timeout: TIMEOUT, signal }); })));
    return { comics, cur: comics.length && (!maxPage || page < maxPage) ? { page: page + 1 } : null };
  } catch { return { comics: [], cur: null }; }
}

// ---------- 名作 ----------
// 先搜简体中文的源，这次运行里出过错、超时的源往后挪；一部最多试 4 个源。书名要对得上（famous.js 里写了繁体和别名），
// 不认「海贼王同人」这种沾边的。搜到的在本机记 7 天，没搜到的记 1 天（打开的源变了就重搜），第二次打开直接出来
// 包子漫画排到后面：书全，但封面图床把我们整个拦了（Cloudflare 403），名作要是从它那儿找的，书墙、光盘上全是没图的书衣
const PREFER = ['copy_manga', 'manhuaren', 'ManHuaGui', 'goda', 'mycomic', 'Komiic', 'baozi', 'ykmh', 'ccc', 'manga_dex'];
const FAMOUS_KEY = 'comic:famous', DAY = 864e5, HIT_DAYS = 7, MISS_DAYS = 1, TRIES = 6, SEARCH_TIMEOUT = 12000, SIG_V = 4, SEED_DAYS = 120;
const famousSlot = limiter(mobileUI ? 2 : 4);   // 和探索页、世界分类各排各的队：名作要先出来
// 同一个源同时最多搜两部、每次搜完歇 250 毫秒：几十部一起搜，拷贝漫画会限流（返回状态码 210），被拒的那几部就找不到了。
// 先按源排队、轮到了再占全局名额（反过来的话，排队等拷贝漫画的占着全局名额，别的源也动不了）
const perSource = new Map();
const sourceSlot = (id) => { if (!perSource.has(id)) perSource.set(id, limiter(2)); return perSource.get(id); };
const pause = (ms) => new Promise(r => setTimeout(r, ms));
const errors = new Map();        // 源 → 这次运行里连着出错几次；连错两次才往后挪（偶尔一次限流不算）
const shaky = { has: (id) => (errors.get(id) || 0) >= 2 };
let turn = 0;                    // 第几部：起点轮流换（见 findFamous）
const namesOf = (f) => new Set([f.title, ...(f.alias || [])].map(normTitle).filter(Boolean));
let famousCache;
const cacheOf = () => {
  if (!famousCache) { try { famousCache = JSON.parse(localStorage.getItem(FAMOUS_KEY)) || {}; } catch { famousCache = {}; } }
  return famousCache;
};
const remember = (title, value) => { cacheOf()[title] = value; try { localStorage.setItem(FAMOUS_KEY, JSON.stringify(famousCache)); } catch { /* 存不下就下次再搜 */ } };
// PREFER 里写的是源的 key（id 是「venera:copy_manga」这样带仓库前缀的）。
// 要核作者的（byRe）先找搜索结果里带作者的源（拷贝漫画、Komiic、MangaDex），包子这些不写作者的找了也不收
const WITH_AUTHOR = ['copy_manga', 'Komiic', 'manga_dex'];
const rank = (s, f) => (shaky.has(s.id) ? 100 : 0) + (coversBlocked(s.id) ? 70 : 0) + (f?.byRe && !WITH_AUTHOR.includes(s.key) ? 50 : 0)
  + (PREFER.includes(s.key) ? PREFER.indexOf(s.key) : PREFER.length);

const finding = new Map();   // 书名 → Promise<{ sourceId, sourceName, comic } | null>
function findFamous(f, sources) {
  if (finding.has(f.title)) return finding.get(f.title);
  const job = (async () => {
    // sig：名单里这一条的写法（搜的词、别名、作者核对）。改了名单，本机记着的旧结果就作废（不然认错的那本要用满 7 天）
    const ids = sources.map(s => s.id), was = cacheOf()[f.title], now = Date.now(), sig = [SIG_V, f.q || '', ...(f.alias || []), String(f.byRe || '')].join('|');
    const same = was?.sig === sig;
    // 记着的那个源封面取不到了：重新找一个（封面好的源排在前面）
    if (same && was.sourceId && ids.includes(was.sourceId) && !coversBlocked(was.sourceId) && now - was.at < HIT_DAYS * DAY) return was;
    // 随包附带的那份（scripts/comic-famous-seed.mjs 生成）：新装的人第一次打开不用等现找
    const seeded = SEED.hits[f.title];
    if (seeded && seeded.sig === sig && ids.includes(seeded.sourceId) && !coversBlocked(seeded.sourceId) && now - SEED.at < SEED_DAYS * DAY) return seeded;
    if (same && was.miss && was.sources === ids.join() && now - was.at < MISS_DAYS * DAY) return null;
    const names = namesOf(f);
    let failed = false;
    // 整个一次（开沙箱 + 搜）最多 25 秒：有的源沙箱一直起不来，没有这个兜底就永远卡在这一部上
    const once = (source) => famousSlot(() => whenShown().then(() => calm()).then(() => Promise.race([
      withSource(source.id, async box => {
        if (!box.meta.search) return [];
        const options = box.meta.searchOptions.map(o => o.default);
        return (await box.call('search', [f.q || f.title, options, 1, null], { timeout: SEARCH_TIMEOUT })).comics;
      }),
      pause(SEARCH_TIMEOUT + 6000).then(() => { throw new Error('超时'); }),
    ])));
    // 出错多半是限流：歇一下在原位再试一次（重新排队就排到几十部后面去了）
    // 排到了再看一眼：排队这会儿这个源已经连着出错了，就别再试（不然排在它后面的几十部一个个慢慢失败）
    const search = (source) => sourceSlot(source.id)(async () => {
      if (shaky.has(source.id)) throw new Error('这个源这次连着出错');
      try { return await once(source); }
      catch (err) { if (shaky.has(source.id)) throw err; await pause(3000); return await once(source); }
      finally { await pause(250); }
    });
    const order = [...sources].sort((a, b) => rank(a, f) - rank(b, f));
    // 起点轮流从前几个（封面好、没出错的）源里换：几十部一起找时别全挤在拷贝漫画上（它会限流）。要核作者的不轮，先找带作者的源
    const healthy = order.filter(s => !shaky.has(s.id) && !coversBlocked(s.id)).length, k = Math.min(4, healthy);
    if (!f.byRe && k > 1) order.unshift(...order.splice(turn++ % k, 1));
    let tried = 0;
    const found = [];
    for (const source of order) {
      if (tried >= TRIES) break;
      // 这次运行里连着出错的源不再去找：坏掉的源一次要等十几秒才报错，排着队的几十部全被它拖住
      if (shaky.has(source.id)) { failed = true; continue; }
      tried++;
      try {
        const comics = await search(source);
        errors.set(source.id, 0);
        // 名单写了 byRe 的（书名太常见）还要作者对得上，源里没写作者的也不收（包子漫画有同名的国漫「冥王」「乒乓」）
        const comic = comics.find(c => names.has(normTitle(c.title)) && (!f.byRe || f.byRe.test(c.subtitle || '')));
        // 还得真有章节：版权作品在漫画人、GoDa 常被下架（详情页还在、章节空了），选了它点开就是「没有章节」。
        // 顺带详情存进了本机（library.js），点开这部名作时章节马上就有
        if (!comic) continue;
        const n = chaptersOf(await comicDetails(source.id, comic.id)).length;
        if (!n) continue;
        // 有章节也不一定全（GoDa 的东京喰种只有 5 话）：找到两个就比一比，用章节多的，另一个留作可换的源
        found.push({ n, sourceId: source.id, sourceName: source.name, comic: { id: comic.id, title: comic.title, subtitle: comic.subtitle || '', cover: comic.cover || '', tags: (comic.tags || []).slice(0, 4), description: String(comic.description || '').slice(0, 300) } });
        if (found.length >= 2) break;
      } catch { failed = true; errors.set(source.id, (errors.get(source.id) || 0) + 1); }
    }
    if (found.length) {
      found.sort((a, b) => b.n - a.n);
      const [best, ...rest] = found;
      const hit = { at: now, sig, sourceId: best.sourceId, sourceName: best.sourceName, comic: best.comic, alts: rest.map(({ sourceId, sourceName, comic }) => ({ sourceId, sourceName, comic })) };
      remember(f.title, hit);
      return hit;
    }
    // 中途有源出错（限流、超时）的不记「没找到」：下次打开再搜
    if (!failed) remember(f.title, { at: now, sig, miss: true, sources: ids.join() });
    return null;
  })();
  finding.set(f.title, job);
  return job;
}

// 书名用名单里的简体写法（繁体源里是「東京喰種」「BLUE LOCK (藍色監獄)」），源里的原名留作别名；
// 高分神作再带上中文作者名和推荐语（blurb，光盘架上那句）
function pickBook(f, p) {
  const b = comicBook({ sourceId: p.sourceId, sourceName: p.sourceName, comic: p.comic });
  if (b.title !== f.title) { b.alt = b.title; b.title = f.title; }
  for (const a of p.alts || []) if (!b.comics.some(x => x.sourceId === a.sourceId)) { b.comics.push(comicBook({ sourceId: a.sourceId, sourceName: a.sourceName, comic: a.comic }).comics[0]); b.poolSources.push(a.sourceName); }
  if (f.by) b.author = f.by;
  if (f.note) b.blurb = f.note;
  return b;
}

/** 高分神作 + 名作，去掉重名的（「钢之炼金术师」这种两边都有的只留高分那条）。key：'all' 或世界 id */
function frontList(key) {
  const seen = new Set();
  return [...TOP_RATED, ...FAMOUS].filter(f => (key === 'all' || f.world === key) && !seen.has(f.title) && seen.add(f.title));
}

/** 漫画页顶上的「高分神作」光盘架：按名单顺序，找到一部显示一部（和书单共用同一份查找，不会搜两遍） */
export function useTopRated(on) {
  const [books, setBooks] = useState([]);
  const epoch = useCoverEpoch();
  useEffect(() => {
    if (!on) return;
    let live = true;
    (async () => {
      const sources = (await listComicSources()).filter(e => e.enabled).sort((a,b) => sourcePriority(a)-sourcePriority(b));
      const picks = TOP_RATED.map(() => null);
      const show = () => { if (live) setBooks(TOP_RATED.map((f, i) => picks[i] && pickBook(f, picks[i])).filter(Boolean)); };
      await Promise.all(TOP_RATED.map(async (f, i) => { picks[i] = await findFamous(f, sources).catch(() => null); if (picks[i]) show(); }));
    })().catch(() => {});
    return () => { live = false; };
  }, [on, epoch]);
  return books;
}

/** 名作在前（按 famous.js 的顺序），后面接探索页的；探索页里同名的并进名作那一条（多一个可换的源），不再单列 */
function compose(famous, picks, got) {
  const front = [], byName = new Map();
  famous.forEach((f, i) => {
    const p = picks[i];
    if (!p) return;
    const b = pickBook(f, p);
    front.push(b);
    for (const n of namesOf(f).add(normTitle(b.title))) byName.set(n, b);
  });
  const rest = blend(got).filter(b => {
    const same = byName.get(normTitle(b.title));
    if (!same) return true;
    for (const c of b.comics) if (!same.comics.some(x => x.sourceId === c.sourceId)) { same.comics.push(c); same.poolSources.push(c.sourceName); }
    return false;
  });
  return [...front, ...rest];
}

const lists = new Map();   // 'all' | 世界 id → { books, done, subs }
function load(key) {
  let entry = lists.get(key);
  if (entry) return entry;
  entry = { books: [], done: false, more: () => {}, loadingMore: false, exhausted: false, subs: new Set() };
  lists.set(key, entry);
  const emit = () => entry.subs.forEach(fn => fn());
  (async () => {
    const sources = (await listComicSources()).filter(e => e.enabled).sort((a,b) => sourcePriority(a)-sourcePriority(b));
    const signature = sources.map(s => `${s.id}:${s.version}`).sort().join('|');
    const cacheKey = `comic:catalog:v2:${key}`;
    const saved = await idbGet('kv', cacheKey).catch(() => null);
    let carry = saved?.signature === signature && Date.now() - saved.at < 864e5 && Array.isArray(saved.books) ? saved.books : [];
    if (carry.length) { entry.books = carry; emit(); }
    const got = sources.map(source => ({ source, comics: [], cur: undefined, ids: new Set() }));
    let saveTimer;
    const persist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => {
      if (entry.books.length) idbSet('kv', cacheKey, { signature, at: Date.now(), books: entry.books.slice(0, 160) }).catch(() => {});
    }, 700); };
    const famous = frontList(key), picks = famous.map(() => null);
    // 第一页（名作在前 + 各源第一页交错）之后，翻页取来的每一轮单独交错、接在最后（tail）：前面已经看过的一本都不挪
    let tail = [];
    const show = () => {
      const head = compose(famous, picks, got), names = new Set(head.map(b => normTitle(b.title)));
      entry.books = [...head, ...tail.filter(b => !names.has(normTitle(b.title))), ...carry.filter(b => !names.has(normTitle(b.title)) && !tail.some(t => normTitle(t.title) === normTitle(b.title)))];
      emit(); persist();
    };
    // 取一页：已经有的（同一个源翻页常有重的）不再要
    const take = async (g) => {
      const { comics, cur } = await fromSource(g.source, key, g.cur);
      g.cur = cur;
      const fresh = comics.filter(c => !g.ids.has(c.id) && g.ids.add(c.id));
      return fresh.length ? localizeComics(fresh, g.source.key) : [];
    };
    // 书墙翻到底了（ComicExplore 的 onEnd）：每个还能翻的源各再取一页
    entry.more = async () => {
      if (entry.loadingMore || entry.exhausted) return;
      const open = got.filter(g => g.cur);
      if (!open.length) { entry.exhausted = entry.done; emit(); return; }
      entry.loadingMore = true; emit();
      // Append each completed source immediately; do not wait for the slowest.
      const round = [];
      const base = tail;
      await Promise.all(open.map(async g => {
        round.push({ source: g.source, comics: await take(g) });
        const seen = new Set(compose(famous, picks, got).map(b => normTitle(b.title)));
        tail = [...base, ...blend(round).filter(b => !seen.has(normTitle(b.title)))];
        show();
      }));
      entry.loadingMore = false;
      if (entry.done && !got.some(g => g.cur)) entry.exhausted = true;
      emit();
    };
    // 谁先回来先显示：每找到一部名作、每回来一个源就重新排一遍
    // Famous-title discovery can take minutes. It must not hold pagination
    // or the ordinary source list's completion flag hostage.
    Promise.all(famous.map(async (f, i) => { picks[i] = await findFamous(f, sources).catch(() => null); if (picks[i]) show(); })).catch(() => {});
    await Promise.all(got.map(async (g) => { g.comics = await take(g); show(); }));
    // Keep the last usable list when all sources are temporarily unavailable.
    if (got.some(g => g.comics.length)) carry = [];
    entry.done = true;
    show();

  })().catch(() => { entry.done = true; emit(); });
  return entry;
}

/** @returns {{ books: object[], done: boolean, more: () => void, loadingMore: boolean, exhausted: boolean }} key：'all' 或世界 id */
export function useComicList(key) {
  const [, bump] = useState(0);
  const entry = key ? load(key) : null;
  useEffect(() => {
    if (!entry) return;
    const fn = () => bump(n => n + 1);
    entry.subs.add(fn);
    return () => entry.subs.delete(fn);
  }, [entry]);
  return entry || { books: [], done: true, more: () => {}, loadingMore: false, exhausted: true };
}

/** 世界的拼贴封面：后台把五个世界的书单都拉一遍（同时 4 个请求），拉到哪个显示哪个 */
// 以前一打开漫画标签就给五个世界各自去所有源拉分类和书单（上百次沙箱调用、解析网页），只为了这块平时裁着的拼贴，
// 打开标签那几秒明显掉帧。现在拼贴用这个世界的高分神作和名作（多半是随包附带的查找结果，不联网），
// 进过的世界书单拉过了，名作不够 14 张时拿书单补
export function useComicCollage(worlds, on) {
  const [picks, setPicks] = useState({});
  const [, bump] = useState(0);
  const epoch = useCoverEpoch();
  useEffect(() => {
    if (!on) return;
    let live = true;
    (async () => {
      const sources = (await listComicSources()).filter(e => e.enabled).sort((a,b) => sourcePriority(a)-sourcePriority(b));
      // Publish each hit as it arrives, including other worlds when one has
      // a slow or missing title. No all-world barrier for the hero artwork.
      const out = {};
      await Promise.all(worlds.map(async w => {
        const front = frontList(w.id), hits = front.map(() => null);
        await Promise.all(front.map(async (f, i) => {
          const hit = await findFamous(f, sources).catch(() => null);
          if (!live || !hit) return;
          hits[i] = pickBook(f, hit);
          out[w.id] = hits.filter(Boolean);
          setPicks({ ...out });
        }));
      }));
    })().catch(() => {});
    // 书单拉好了（用户进了某个世界）也刷新一下拼贴
    const fn = () => bump(n => n + 1);
    const entries = worlds.map(w => lists.get(w.id)).filter(Boolean);
    entries.forEach(e => e.subs.add(fn));
    return () => { live = false; entries.forEach(e => e.subs.delete(fn)); };
  }, [on, epoch]);
  return Object.fromEntries(worlds.map(w => {
    const seen = new Set(), all = [...(picks[w.id] || []), ...(lists.get(w.id)?.books || [])];
    return [w.id, all.filter(b => !seen.has(b.id) && seen.add(b.id)).slice(0, 14)];
  }));
}

/** 漫画源有开关变化（插件页）：书单作废，下次重拉 */
export function forgetComicLists() { lists.clear(); categories.clear(); finding.clear(); }

// 某个源的封面刚被认定取不到（comic/library.js 的 noteCover）：从它那儿找的名作重新找（缓存里那几条会被跳过），
// 书单按「封面好的源在前」重排一次。一般在打开漫画页的头几秒（连着 3 张封面失败）发生，每个源每次运行最多一次
let coverEpoch = 0;
const epochSubs = new Set();
function useCoverEpoch() {
  const [, bump] = useState(0);
  useEffect(() => { const fn = () => bump(n => n + 1); epochSubs.add(fn); return () => epochSubs.delete(fn); }, []);
  return coverEpoch;
}
if (typeof window !== 'undefined') {
  window.addEventListener('librarium:comic-covers', () => {
    const subs = [...lists.values()].flatMap(e => [...e.subs]);
    finding.clear(); lists.clear(); coverEpoch++;
    subs.forEach(fn => fn());
    epochSubs.forEach(fn => fn());
  });
}
