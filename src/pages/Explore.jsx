import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import WorldSwitch from '../effects/WorldSwitch.jsx';
import MasonryWall, { PAGE_SLOTS, firstPageText } from '../effects/MasonryWall.jsx';
import { atMost, loadSerif } from '../lib/fonts.js';
import { warmIdle } from '../lib/glyph-warm.js';
import { artRank, classicScore, worldScore, searchBooks, useLibrary, WORLDS, isLightNovel } from '../lib/library.js';
import { useUIActions } from '../lib/ui.jsx';

const SORTS = [
  { id: 'classic', label: '精选优先' },
  { id: 'updated', label: '最近更新' },
  { id: 'illustrated', label: '插图优先' },
  { id: 'length', label: '篇幅最长' },
];
const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn) : setTimeout(() => fn({ timeRemaining: () => 8 }), 200));
const parseLen = (s = '') => parseFloat(s) * (/K/i.test(s) ? 1e3 : /M/i.test(s) ? 1e6 : 1) || 0;

// 换世界提前准备。以前第一次换世界：镜头停稳、换上新书单那一帧排版 43ms——新书单第一页的书名分片还没下（书单自己的预取要挂上以后才开始），
// 逐字现查后备字体，分片到了又整片重排两次；字形也是冷的（第一次以这个字重 × 字号出现要现算，见 lib/glyph-warm.js）。
// 现在把五个世界默认书单（和下面 books 同一套算法：不加筛选、精选优先）第一页要用的衬线分片提前一次下齐，下好以后按卡片的样式把这些字排热。
// HTTP 缓存长期有效，同一台设备只下一回。只下第一页：试过连往后四页一起下（墙挂上时自己要预取的那么多），一口气多下二十几个分片，
// 字形数据占的内存让垃圾回收更容易落在滑动当中（探索页滚动最长帧四次都到 130ms，切页卡顿 0 → 11）；往后几页还是挂上以后墙自己下。
// 不放到点世界时才做：那时镜头动画正在跑（逐帧写 clip-path，靠主线程），分片一到要重排屏幕附近所有衬线字，会顿到镜头。
// **由 App 的空闲流水线来调，放在后台预排探索页之前、等分片到了才往下走**：试过书库一到就自己在空闲里做，分片晚到，
// 把 warm.js 已经预排好的后台页整片作废，切到探索页、往下滚反而卡了（A/B：探索页滚动卡顿 0 → 53，切页 1 → 28）。
/** 算一个世界算一步（搜四千多本 + 排序），全算完发出分片预取；done 在分片下好（最多 FONT_WAIT）时调。返回 { stop } */
export function prepareWorlds(books, done) {
  const flip = books.filter(b => b.illustrated).slice(0, 12);   // 和下面的 flip 一样
  const pages = [];
  let stopped = false, h = 0;
  const next = (deadline) => {
    if (stopped) return;
    while (pages.length < WORLDS.length && (deadline.timeRemaining() > 4 || !pages.length)) {
      const w = WORLDS[pages.length];
      const list = searchBooks(books, '', { tags: [w.tag] });
      list.sort((a, b) => worldScore(b, w.id) - worldScore(a, w.id));
      pages.push(firstPageText(list, flip));
    }
    if (pages.length < WORLDS.length) { h = idle(next); return; }
    const texts = PAGE_SLOTS.map((_, k) => pages.map(p => p[k]).join(''));
    atMost(loadSerif(texts[0] + texts[1], 600), FONT_WAIT).then(() => { warmIdle(PAGE_SLOTS, texts); if (!stopped) done(); });
  };
  h = idle(next);
  return { stop: () => { stopped = true; window.cancelIdleCallback?.(h); } };
}
const FONT_WAIT = 3000;

export default function Explore() {
  const { world } = useParams();
  const navigate = useNavigate();
  const lib = useLibrary();
  const { openBook } = useUIActions();
  const active = WORLDS.find(w => w.id === world)?.id || null;
  const [status, setStatus] = useState('');
  const [params] = useSearchParams();
  const [onlyIll, setOnlyIll] = useState(() => params.get('art') === '1');
  const [extra, setExtra] = useState([]);
  const [sort, setSort] = useState('classic');

  // 每个世界的拼贴：该题材的精选（近年佳作）在前的 14 本
  const collage = useMemo(() => Object.fromEntries(WORLDS.map(w => {
    const list = lib.books.filter(b => b.tags.includes(w.tag));
    list.sort((a, b) => worldScore(b, w.id) - worldScore(a, w.id));
    return [w.id, list.slice(0, 14)];
  })), [lib.books]);

  const worldTag = WORLDS.find(w => w.id === active)?.tag;
  // 顶上的镜头动画马上跟着点击走；下面的书单用延后的筛选条件在后台分片重排、重渲染，不和动画抢同一帧
  const filters = useMemo(() => ({ worldTag, extra, status, onlyIll, sort, active }), [worldTag, extra, status, onlyIll, sort, active]);
  // 换世界时，书单等镜头推进 / 拉远停稳了再换（WorldSwitch 的 onSettle；兜底 1.8 秒）：书单在面板下面，这时基本不在屏幕上，
  // 新书单的排版、绘制不和镜头动画抢帧（手机上以前推进到一半卡一下）。标签、状态、排序这些马上换
  const [listFilters, setListFilters] = useState(filters);
  const latest = useRef(filters); latest.current = filters;
  useEffect(() => {
    if (listFilters.active === filters.active) { setListFilters(filters); return; }
    const t = setTimeout(() => setListFilters(latest.current), 1800);
    return () => clearTimeout(t);
  }, [filters]);
  const onSettle = useCallback(() => setListFilters(prev => (prev === latest.current ? prev : latest.current)), []);
  const f = useDeferredValue(listFilters);
  const books = useMemo(() => {
    const list = searchBooks(lib.books, '', { tags: [f.worldTag, ...f.extra].filter(Boolean), status: f.status, illustrated: f.onlyIll });
    // 精选优先：进了某个世界就按该世界的精选排，没选世界按全站的细腻之选排
    if (f.sort === 'classic') list.sort(f.active ? (a, b) => worldScore(b, f.active) - worldScore(a, f.active) : (a, b) => classicScore(b) - classicScore(a));
    if (f.sort === 'illustrated') list.sort((a, b) => artRank(b) - artRank(a) || classicScore(b) - classicScore(a));
    if (f.sort === 'length') list.sort((a, b) => parseLen(b.length) - parseLen(a.length));
    return list;
  }, [lib.books, f]);
  const flip = useMemo(() => lib.books.filter(b => b.illustrated).slice(0, 12), [lib.books]);
  const topTags = lib.tags.filter(([t]) => t !== worldTag).slice(0, 14);

  const toggleTag = (t) => setExtra(x => x.includes(t) ? x.filter(y => y !== t) : [...x, t]);

  return (
    <div className="page explore">
      <WorldSwitch worlds={WORLDS} active={active} total={lib.books.filter(isLightNovel).length} collage={collage} onSettle={onSettle}
        onChange={(id) => navigate(id ? `/explore/${id}` : '/explore', { replace: true })} />

      <div className="filters">
        <div className="filters-row">
          <div className="seg" role="group" aria-label="状态">
            {[['', '全部'], ['连载中', '连载中'], ['已完结', '已完结']].map(([v, l]) =>
              <button key={l} className="chip" aria-pressed={status === v} onClick={() => setStatus(v)}>{l}</button>)}
          </div>
          <button className="chip" aria-pressed={onlyIll} onClick={() => setOnlyIll(v => !v)} title="插图重制版 + 台版（官方彩插）">有插图</button>
          <span className="filters-spacer" />
          <label className="select">
            <span className="muted">排序</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
        <div className="filters-tags" role="group" aria-label="标签">
          {topTags.map(([t, c]) => (
            <button key={t} className="chip" aria-pressed={extra.includes(t)} onClick={() => toggleTag(t)}>
              {t}<span className="chip-count num">{c}</span>
            </button>
          ))}
        </div>
        <p className="filters-count muted"><span className="num">{books.length.toLocaleString()}</span> 本{f.worldTag ? ` · ${f.worldTag}` : ''}{f.extra.length ? ` · ${f.extra.join(' · ')}` : ''}</p>
      </div>

      {lib.status === 'loading' && <div className="loading-line"><span />{lib.message}</div>}
      {lib.status === 'error' && <p className="center-note">{lib.message}</p>}
      <MasonryWall books={books} flip={flip} onOpen={openBook} />
    </div>
  );
}
