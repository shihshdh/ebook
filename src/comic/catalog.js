// 探索页「漫画」标签的书单。不分源：所有打开的漫画源混在一起，界面上不出现源的名字（详情里才看得到）。
//
//   全部：各源探索页（推荐、热门、最新……）的第一页，各源轮流交错排（不让一个源刷屏），同名的合成一条（同搜索池）
//   世界：奇幻 / 校园 / 科幻 / 恋爱 / 悬疑（和轻小说同一套 WORLDS）——在每个源的分类里找名字对得上的那个
//         （奇幻 ← 奇幻、魔幻、玄幻、异世界……），各取第一页，同样交错合并
//   这次运行里记着：切世界、来回切标签不重拉
import { useEffect, useState } from 'react';
import { listComicSources, withSource } from './sources.js';
import { comicBook } from './book.js';
import { normTitle } from '../lib/pool.js';

// 世界 → 分类名里出现这些就算（繁简、日文、英文的写法都有）
const WORLD_WORDS = {
  fantasy: /奇幻|魔幻|玄幻|异世界|異世界|魔法|仙侠|仙俠|fantasy/i,
  campus: /校园|校園|学园|學園|青春|school/i,
  scifi: /科幻|机战|機戰|机甲|機甲|sci-?fi|mecha/i,
  romance: /恋爱|戀愛|爱情|愛情|纯爱|純愛|romance/i,
  mystery: /悬疑|懸疑|推理|侦探|偵探|惊悚|驚悚|mystery|thriller/i,
};
const TIMEOUT = 30000;

function limiter(max) {
  let running = 0;
  const queue = [];
  const next = () => { while (running < max && queue.length) { const { job, resolve, reject } = queue.shift(); running++; job().then(resolve, reject).finally(() => { running--; next(); }); } };
  return (job) => new Promise((resolve, reject) => { queue.push({ job, resolve, reject }); next(); });
}
const slot = limiter(4);

/** 各源的列表交错合并：第 1 个源的第 1 本、第 2 个源的第 1 本……同名（作者对得上或没写）的合成一条 */
function blend(perSource) {
  const out = [], byTitle = new Map(), max = Math.max(0, ...perSource.map(s => s.comics.length));
  for (let i = 0; i < max; i++) {
    for (const { source, comics } of perSource) {
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
  return out;
}

const categories = new Map();   // 源 → Promise<[{ label, category, param }]>
const categoriesOf = (id) => {
  if (!categories.has(id)) {
    const p = withSource(id, box => box.call('categories', [], { timeout: TIMEOUT }));
    p.catch(() => categories.delete(id));
    categories.set(id, p);
  }
  return categories.get(id);
};

/** 一个源在这个书单里给的漫画（'all' 或世界 id）；源出错、没有对得上的分类就是空的 */
async function fromSource(source, key) {
  try {
    if (key === 'all') {
      return await slot(() => withSource(source.id, async box => {
        if (!box.meta.explore.length) return [];
        const { parts } = await box.call('explore', [0, 1], { timeout: TIMEOUT });
        const seen = new Set();
        return parts.flatMap(p => p.comics).filter(c => !seen.has(c.id) && seen.add(c.id));
      }));
    }
    const words = WORLD_WORDS[key];
    const cat = (await slot(() => categoriesOf(source.id))).find(c => words.test(c.label));
    if (!cat) return [];
    return (await slot(() => withSource(source.id, box => box.call('category', [cat.category, cat.param, 1], { timeout: TIMEOUT })))).comics;
  } catch { return []; }
}

const lists = new Map();   // 'all' | 世界 id → { books, done, subs }
function load(key) {
  let entry = lists.get(key);
  if (entry) return entry;
  entry = { books: [], done: false, subs: new Set() };
  lists.set(key, entry);
  const emit = () => entry.subs.forEach(fn => fn());
  (async () => {
    const sources = (await listComicSources()).filter(e => e.enabled);
    const got = sources.map(source => ({ source, comics: [] }));
    // 谁先回来先显示：每回来一个源就重新混一遍
    await Promise.all(got.map(async (g) => { g.comics = await fromSource(g.source, key); entry.books = blend(got); emit(); }));
    entry.done = true;
    emit();
  })().catch(() => { entry.done = true; emit(); });
  return entry;
}

/** @returns {{ books: object[], done: boolean }} key：'all' 或世界 id */
export function useComicList(key) {
  const [, bump] = useState(0);
  const entry = key ? load(key) : null;
  useEffect(() => {
    if (!entry) return;
    const fn = () => bump(n => n + 1);
    entry.subs.add(fn);
    return () => entry.subs.delete(fn);
  }, [entry]);
  return entry || { books: [], done: true };
}

/** 世界的拼贴封面：后台把五个世界的书单都拉一遍（同时 4 个请求），拉到哪个显示哪个 */
export function useComicCollage(worlds, on) {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!on) return;
    const fn = () => bump(n => n + 1);
    const entries = worlds.map(w => load(w.id));
    entries.forEach(e => e.subs.add(fn));
    return () => entries.forEach(e => e.subs.delete(fn));
  }, [on]);
  return Object.fromEntries(worlds.map(w => [w.id, lists.get(w.id)?.books.slice(0, 14) || []]));
}

/** 漫画源有开关变化（插件页）：书单作废，下次重拉 */
export function forgetComicLists() { lists.clear(); categories.clear(); }
