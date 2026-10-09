// 全局书库：合并所有启用的 catalog 插件给出的书，组件用 useLibrary() 订阅。
import { useSyncExternalStore } from 'react';
import { enabledPlugins } from '../plugins/registry.js';

const state = {
  status: 'idle',      // idle | loading | ready | error
  message: '',
  books: [],
  byId: new Map(),
  tags: [],            // [[tag, count]] 按数量降序
  fetchedAt: 0,
  error: null,
};
let snapshot = { ...state };
const subs = new Set();
const emit = () => { snapshot = { ...state }; subs.forEach(fn => fn()); };

function ingest(results) {
  const books = results.flatMap(r => r.books);
  books.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  const byId = new Map(books.map(b => [b.id, b]));
  const counts = new Map();
  for (const b of books) for (const t of b.tags) counts.set(t, (counts.get(t) || 0) + 1);
  Object.assign(state, {
    books, byId, status: 'ready', message: '', error: null,
    tags: [...counts].sort((a, b) => b[1] - a[1]),
    fetchedAt: Math.max(0, ...results.map(r => r.fetchedAt || 0)),
  });
  emit();
}

let inflight = null;
export function loadLibrary({ force = false } = {}) {
  if (inflight && !force) return inflight;
  state.status = state.books.length ? state.status : 'loading';
  state.message = '正在打开书库…';
  emit();
  const catalogs = enabledPlugins().filter(p => p.kind === 'catalog');
  inflight = Promise.all(catalogs.map(p => p.load({
    force,
    onStatus: (m) => { state.message = m; emit(); },
    onUpdate: () => { inflight = null; loadLibrary(); },
  }).catch(err => { console.error(`[${p.id}]`, err); return { books: [], error: err }; })))
    .then(results => {
      const errors = results.filter(r => r.error);
      if (errors.length === results.length && results.length) {
        Object.assign(state, { status: 'error', error: errors[0].error, message: '书库打不开：' + (errors[0].error?.message || '网络错误') });
        emit();
      } else ingest(results);
    })
    .finally(() => { inflight = null; });
  return inflight;
}

export function useLibrary() {
  return useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn); }, () => snapshot);
}
export const getBook = (id) => state.byId.get(id);
/** 当前书库里的全部书（不订阅变化；空闲预取封面这类一次性的事用） */
export const libraryBooks = () => state.books;
/** 只订阅一本书（书架条目按 bookId 借书目里的封面、别名用）：书目没动这本书时不会让组件重渲染 */
export function useCatalogBook(id) {
  return useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn); }, () => (id ? state.byId.get(id) : undefined));
}

// ---------- 检索 ----------
const fold = (s = '') => s.toLowerCase().replace(/[\s·・:：!！?？,，.。、~～\-—_'"“”‘’「」『』《》()（）]/g, '');

/** 轻小说（mojimoon 书源）。书库里还有公版古籍，界面上写「N 本轻小说」的地方只数这些 */
export const isLightNovel = (b) => b.source === 'mojimoon';

/** 有插图：应用内的插图重制版，或台版 EPUB（官方彩插） */
export const hasArt = (b) => !!(b.illustrated || b.taiban);
/** 排序用：插图版 2、只有台版 1、都没有 0 */
export const artRank = (b) => b.illustrated ? 2 : b.taiban ? 1 : 0;

/** 书名/别名/作者检索；输入纯数字时按 wenku8 aid 匹配。illustrated=true 只留"有插图"的书（见 hasArt） */
// 书名 / 别名 / 作者 / 标签折叠后的写法：每本书只算一次（每敲一个字都要扫全部书，以前每次都重新折叠）
const folded = new WeakMap();
const foldedOf = (b) => {
  let f = folded.get(b);
  if (!f) folded.set(b, f = { t: fold(b.title), a: fold(b.alt), au: fold(b.author), tags: b.tags.map(fold) });
  return f;
};
/**
 * 趁空闲把每本书的折叠写法先算好（搜索页一挂上就开始）。第一次搜索要把四千多本书一本本折叠，
 * 在搜索页的渲染里一口气做完（手机上四五十毫秒，React 也拆不开），敲第一个字那一下就顿
 * @returns 停止函数
 */
export function prepareSearch(books) {
  if (typeof requestIdleCallback !== 'function') return () => {};
  let i = 0, id = 0;
  const work = (deadline) => {
    while (i < books.length && deadline.timeRemaining() > 1) foldedOf(books[i++]);
    id = i < books.length ? requestIdleCallback(work) : 0;
  };
  id = requestIdleCallback(work);
  return () => cancelIdleCallback(id);
}
export function searchBooks(books, q, { tags = [], status = '', illustrated = false } = {}) {
  const k = fold(q);
  const out = [];
  for (const b of books) {
    if (illustrated && !hasArt(b)) continue;
    if (status && b.status !== status) continue;
    if (tags.length && !tags.every(t => b.tags.includes(t))) continue;
    if (!k) { out.push([0, b]); continue; }
    if (/^\d+$/.test(k) && b.aid === k) { out.push([100, b]); continue; }
    const { t, a, au, tags: ft } = foldedOf(b);
    let s = 0;
    if (t === k || a === k) s = 50;
    else if (t.startsWith(k) || a.startsWith(k)) s = 30;
    else if (t.includes(k) || a.includes(k)) s = 20;
    else if (au.includes(k)) s = 10;
    else if (ft.includes(k)) s = 6;
    if (s) out.push([s + (b.illustrated ? 2 : 0), b]);
  }
  // 更新日期是 2026-10-09 这种写法，直接比字符串，和 localeCompare 排出来一样，快得多
  const newer = (x, y) => { const p = x[1].updated || '', q2 = y[1].updated || ''; return p < q2 ? 1 : p > q2 ? -1 : 0; };
  return out.sort((x, y) => y[0] - x[0] || newer(x, y)).map(x => x[1]);
}

// ---------- "世界"：探索页的五个题材入口（效果 ①） ----------
export const WORLDS = [
  { id: 'fantasy', tag: '奇幻', glyph: '幻', color: '#7c6bd6', glow: 'rgba(124,107,214,.55)', tagline: '剑与魔法，龙与远方的地图' },
  { id: 'campus', tag: '校园', glyph: '青', color: '#e58a73', glow: 'rgba(229,138,115,.55)', tagline: '放学后的天台，和没说出口的话' },
  { id: 'scifi', tag: '科幻', glyph: '星', color: '#4fa3c7', glow: 'rgba(79,163,199,.55)', tagline: '机械、星海，和更远一点的明天' },
  { id: 'romance', tag: '恋爱', glyph: '恋', color: '#d9738f', glow: 'rgba(217,115,143,.55)', tagline: '心跳比翻页声更响的那些夜晚' },
  { id: 'mystery', tag: '悬疑', glyph: '谜', color: '#c9a35c', glow: 'rgba(201,163,92,.55)', tagline: '每一行字都可能是线索' },
];

// ---------- 推荐 ----------
// 首页、探索默认排序、书架都用它。2026-10-06 按用户口味重排：
//   以前是凉宫、禁书、夏娜这类老经典，用户嫌「太老了」——现在推荐**近几年口碑好的日轻**，偏文笔细腻、唯美，
//   尤其是《三日间的幸福》这样的短篇佳作；五个世界（奇幻/校园/科幻/恋爱/悬疑）也各有一份精选。
// 名单按 wenku8 编号手挑（都确认过书目里有、能下载），名单外的书按「越新越前 + 已动画化 + 已完结 + 主流文库」补位。

/** 首页光盘「细腻之选」、今日一本：文笔细腻唯美的近年佳作，短篇和单卷完结优先 */
export const PICKS = [
  1779, 3027, 2353, 2607, 3111, 2032, 2177, 3110, 2922, 4099, 2214, 2102,   // 三日间的幸福 通往夏天的隧道 薇尔莉特 你的故事 即使这份恋情… 胰脏 言叶之庭 春夏秋冬代行者 我的幸福婚约 世界上最透明的故事 恋爱寄生虫 你的名字
  4218, 3646, 2906, 3414, 2255, 3394, 2015, 3384, 2907, 3203, 3740, 2554,   // 无止尽的冬天 你最后留下的歌 Unnamed Memory 青空与阴天 魔女之旅 无尽的夏日… 痛痛飞走吧 铃芽之旅 恋入膏肓 可塑性记忆 在谎言的世界里… Hello,Hello and Hello
];
/** 首页「近年佳作 TOP 10」：近几年口碑和人气都高的 */
export const TOP_RECENT = [2784, 2231, 3057, 3110, 3027, 2906, 2580, 2816, 2700, 2255];   // 千岁同学 86 败北女角 春夏秋冬代行者 通往夏天的隧道 Unnamed Memory 天使大人 间谍教室 侦探已经死了 魔女之旅
/** 五个世界各自的精选（排在该题材的最前面），近年作品在前 */
export const WORLD_PICKS = {
  campus: [2784, 3057, 2580, 3027, 3111, 2883, 3646, 2993, 3734, 2797, 2930, 2254, 1683, 1614],      // 千岁同学 败北女角 天使大人 通往夏天 即使这份恋情 义妹生活 你最后留下的歌 银荆的告白 献给你的故事 图书委员 艾莉同学 弱角友崎 安达与岛村 青春猪头
  mystery: [2700, 4099, 3394, 2693, 2797, 2015, 2907, 886, 1163, 4395, 4253, 3322, 1863, 1168],     // 侦探已经死了 世界上最透明的故事 无尽的夏日 虚构推理 图书委员 痛痛飞走吧 恋入膏肓 小市民 古典部 吸猫侦探 猫丸前辈 黑牢城 樱子小姐 Another
  romance: [1779, 3111, 2032, 2922, 2214, 3749, 3646, 2177, 2102, 4121, 3740, 2554, 2607, 3734],    // 三日间的幸福 即使这份恋情 胰脏 幸福婚约 恋爱寄生虫 恋爱与之后的一切 你最后留下的歌 言叶之庭 你的名字 星辰不可爱人 在谎言的世界里 Hello… 你的故事 献给你的故事
  fantasy: [3110, 2906, 2353, 2255, 3656, 3621, 2922, 3384, 2601, 2651, 2514],                       // 春夏秋冬代行者 Unnamed Memory 薇尔莉特 魔女之旅 芙莉莲前奏 半梦半醒之间 幸福婚约 铃芽之旅 天气之子 处刑少女 Babel
  scifi: [2231, 2607, 3027, 4218, 3203, 2102, 3394, 2700, 2983, 3979],                               // 86 你的故事 通往夏天 无止尽的冬天 可塑性记忆 你的名字 无尽的夏日 侦探已经死了 Perfect friend 泰坦
};
const MAJOR = /电击|角川|富士见|MF文库|GA文库|Fami通|讲谈社|小学馆|集英社|Sneaker|HJ文库/;
const rankOf = (list) => new Map(list.map((aid, i) => [String(aid), i]));
const PICK_RANK = rankOf(PICKS);
const WORLD_RANK = Object.fromEntries(Object.entries(WORLD_PICKS).map(([k, v]) => [k, rankOf(v)]));

/** 名单外的书怎么排：越新越前（wenku8 编号越大收录越晚），再看动画化、完结、主流文库、插图 */
function baseScore(b) {
  const aid = +b.aid || 0;
  return (aid >= 3000 ? 4 : aid >= 2500 ? 3.5 : aid >= 2000 ? 2.5 : aid >= 1500 ? 1 : 0)
    + (b.animated ? 1.5 : 0) + (b.status === '已完结' ? 1 : 0) + (MAJOR.test(b.publisher || '') ? 1 : 0)
    + (b.illustrated ? 1 : b.taiban ? .5 : 0);
}
// 分数是一本书固定的属性：每本只算一次（排序时比较函数要调上十几万次，每次都跑正则，首页挂载、切世界会卡一帧）
const scores = new WeakMap(), worldScores = new Map();
export function classicScore(b) {
  let s = scores.get(b);
  if (s === undefined) {
    // 名单是 wenku8 编号：别让公版书源里编号碰巧相同的书顶上来
    s = b.source === 'mojimoon' && PICK_RANK.has(b.aid) ? 1000 - PICK_RANK.get(b.aid) : b.source === 'mojimoon' ? baseScore(b) : -1;
    scores.set(b, s);
  }
  return s;
}
/** 某个世界里的排序：该世界的精选在前，其余同 classicScore */
export function worldScore(b, world) {
  let cache = worldScores.get(world);
  if (!cache) worldScores.set(world, cache = new WeakMap());
  let s = cache.get(b);
  if (s === undefined) {
    const r = b.source === 'mojimoon' && WORLD_RANK[world]?.get(b.aid);
    s = r !== undefined && r !== false ? 2000 - r : classicScore(b);
    cache.set(b, s);
  }
  return s;
}
/** 按编号名单取书（只要能下载的），保持名单顺序 */
export function pickList(books, aids) {
  const byAid = new Map(books.filter(b => b.source === 'mojimoon' && b.downloads.length).map(b => [b.aid, b]));
  return aids.map(a => byAid.get(String(a))).filter(Boolean);
}
/**
 * 推荐位（今日一本、光盘、排行、书单）用：只出能下载的书——上游有 49 本只有书目、没有任何下载来源
 * （包括《魔法禁书目录》《零之使魔》《月姬》），推荐给用户却点不开下载，体验很差。
 * 探索、搜索照常列出它们，详情里会说明暂无来源。
 */
// 排好的结果按书库（books 数组）缓存：首页每次挂载、切回来都要，书库没变就不重排
const ranked = new WeakMap();
export function classics(books, n = Infinity) {
  let all = ranked.get(books);
  if (!all) {
    all = books.filter(b => b.source !== 'mojimoon' || b.downloads.length).sort((a, b) => classicScore(b) - classicScore(a));
    ranked.set(books, all);
  }
  return all.slice(0, n);
}
