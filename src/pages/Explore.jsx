import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import WorldSwitch from '../effects/WorldSwitch.jsx';
import MasonryWall from '../effects/MasonryWall.jsx';
import { artRank, classicScore, worldScore, searchBooks, useLibrary, WORLDS, isLightNovel } from '../lib/library.js';
import { useUIActions } from '../lib/ui.jsx';

const SORTS = [
  { id: 'classic', label: '精选优先' },
  { id: 'updated', label: '最近更新' },
  { id: 'illustrated', label: '插图优先' },
  { id: 'length', label: '篇幅最长' },
];
const parseLen = (s = '') => parseFloat(s) * (/K/i.test(s) ? 1e3 : /M/i.test(s) ? 1e6 : 1) || 0;

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
