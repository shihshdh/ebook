// 探索页的「漫画」标签：和轻小说同一套界面——题材世界（WorldSwitch）+ 瀑布流书墙（MasonryWall）。
// 书单不分源，所有打开的漫画源混在一起（comic/catalog.js），界面上不写源的名字。
// 点开和搜索结果一样进详情面板（BookSheet → ComicSheetBody）。探索页按需加载这一块，只看小说的人不背。
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import WorldSwitch from '../effects/WorldSwitch.jsx';
import MasonryWall from '../effects/MasonryWall.jsx';
import DiscShelf from '../effects/DiscShelf.jsx';
import Cover from './Cover.jsx';
import { useUIActions } from '../lib/ui.jsx';
import { usePageActive } from '../lib/pageActive.js';
import { WORLDS } from '../lib/library.js';
import { comicSupported, comicUnsupportedWhy, useComicSources } from '../comic/sources.js';
import { prefetchComic, useComicProgress } from '../comic/library.js';
import { calm } from '../lib/calm.js';
import { setComicPaneShown, useComicCollage, useComicList, useTopRated } from '../comic/catalog.js';
import { comicBook } from '../comic/book.js';
import '../styles/comic.css';

const prefetched = new Set();   // 这次运行里提前取过详情的书

export default function ComicExplore({ active, onChange, tabs, shown = true }) {
  const { openBook } = useUIActions();
  const sources = useComicSources();
  // 真被看到过才开工：App 空闲时会预渲染后台页（探索页上次停在漫画就挂上这里），以前一挂上书单、名作、封面就全开工，
  // 用户还在首页、书架，主线程却被漫画源的沙箱占着。看到过一次以后就一直开着（书单留着，切走再回来不重拉）
  const pageActive = usePageActive();
  const [seenOnce, setSeenOnce] = useState(pageActive);
  useEffect(() => { if (pageActive) setSeenOnce(true); }, [pageActive]);
  // 漫画那半看不见时，后台书单、名作查找先停着（comic/catalog.js）
  useEffect(() => { setComicPaneShown(pageActive && shown); }, [pageActive, shown]);
  useEffect(() => () => setComicPaneShown(false), []);
  const enabled = (sources || []).filter(e => e.enabled);
  const on = comicSupported && enabled.length > 0 && seenOnce;
  const list = useComicList(on ? active || 'all' : null);
  const all = useComicList(on ? 'all' : null);
  const collage = useComicCollage(WORLDS, on);
  const recent = useComicProgress();
  const top = useTopRated(on && !active);
  // 趁空闲先把光盘上的高分神作、书墙前面十几部的详情取好（存进本机）：点开时章节马上就有，不用等源（拷贝漫画一次 3.9 秒）。
  // 一部一部来，手在动就停（lib/calm.js）；这次运行里取过的不再取
  const visibleBooks = on && list.done ? [...top, ...list.books.slice(0, 16)] : [];
  useEffect(() => {
    if (!visibleBooks.length) return;
    let alive = true;
    (async () => {
      for (const b of visibleBooks) {
        if (!alive) return;
        if (prefetched.has(b.id)) continue;
        prefetched.add(b.id);
        await calm();
        await new Promise(r => setTimeout(r, 120));
        prefetchComic(b);
      }
    })();
    return () => { alive = false; };
  }, [visibleBooks.length > 0, active]);
  const world = WORLDS.find(w => w.id === active);
  const settle = useCallback(() => {}, []);

  return (
    <>
      <WorldSwitch worlds={WORLDS} active={active} total={all.books.length} unit="部漫画" collage={collage} onSettle={settle} onChange={onChange} />

      <div className="filters">
        <div className="filters-row">
          {tabs}
          <span className="filters-spacer" />
          {on && <p className="filters-count muted cx-count">
            <span className="num">{list.books.length.toLocaleString()}</span> 部{world ? ` · ${world.tag}` : ''}{!list.done && ' · 还在拉…'}
          </p>}
        </div>
      </div>

      {!comicSupported && <p className="cx-status muted">{comicUnsupportedWhy}</p>}
      {comicSupported && sources && !enabled.length && (
        <div className="cx-empty glass">
          <p className="muted">漫画源都关着。</p>
          <Link className="btn btn-ghost sm" to="/plugins#comicsources">去插件页打开</Link>
        </div>
      )}

      {/* 高分神作：漫画页最显眼的位置，和首页「细腻之选」同一种光盘架（名单见 comic/famous.js 的 TOP_RATED） */}
      {on && !active && top.length > 0 && (
        <section className="cx-top">
          <DiscShelf books={top} eyebrow="高分神作 · MASTERPIECES" onOpen={(b, el) => openBook(b, el)} />
        </section>
      )}

      {on && !active && recent?.length > 0 && (
        <section className="cx-recent">
          <h2 className="serif">最近在看</h2>
          <ol>
            {recent.slice(0, 10).map(p => {
              const book = comicBook({ sourceId: p.sourceId, sourceName: p.sourceName, comic: { id: p.comicId, title: p.title, cover: p.cover } });
              return (
                <li key={`${p.sourceId}|${p.comicId}`}>
                  <button className="cx-card" onClick={(e) => openBook(book, e.currentTarget.querySelector('.cover'))}>
                    <Cover book={book} />
                    <strong>{p.title}</strong>
                    <small className="muted">看到 {p.chapter || `第 ${p.index + 1} 话`}</small>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {on && !list.books.length && <p className="cx-status muted">{list.done ? `${world ? `「${world.tag}」` : ''}这里暂时没有漫画：漫画源可能连不上，到插件页「测一遍」看看。` : '正在打开漫画书库…'}</p>}
      {on && list.books.length > 0 && <MasonryWall key={active || 'all'} books={list.books} onOpen={openBook} grow
        onEnd={list.done && !list.exhausted ? list.more : undefined}
        endNote={list.loadingMore ? '正在从各个漫画源取更多…' : list.exhausted ? '各个漫画源都翻到底了' : '继续往下翻…'} />}
    </>
  );
}
