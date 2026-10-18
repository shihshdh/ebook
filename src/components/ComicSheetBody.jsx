// 详情面板（BookSheet）里漫画的那一截：换源、开始 / 继续看、章节列表。
// 搜索池把不同漫画源里的同一部合成一条（book.comics），默认用看过的那个源，没看过用第一个。
import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import { comicDetails, chaptersOf, useComicProgress, readPath, prefetchChapter, findOtherSources } from '../comic/library.js';
import '../styles/comic.css';
import { useShelf } from '../lib/useShelf.js';
import { ensureComicShelf } from '../comic/shelf.js';
import { comicShelfId } from '../comic/book.js';

export default function ComicSheetBody({ book: given, onRead }) {
  // 已知的源都没章节时去别的源按书名找来的（findOtherSources），接在后面
  const [more, setMore] = useState([]);
  const book = useMemo(() => (more.length ? { ...given, comics: [...given.comics, ...more] } : given), [given, more]);
  const recent = useComicProgress();
  const { items } = useShelf();
  const [adding, setAdding] = useState(false);
  const [shelfError, setShelfError] = useState('');
  const seen = useMemo(() => book.comics.findIndex(c => recent?.some(p => p.sourceId === c.sourceId && p.comicId === c.comicId)), [book.comics, recent]);
  const [picked, setPicked] = useState(null);
  // 没手动选过源：当前这个打不开、没章节（下架了），自动换下一个
  const [fallback, setFallback] = useState(0);
  const pick = picked ?? (seen >= 0 ? seen : fallback);
  const c = book.comics[pick] || book.comics[0];
  const onShelf = items.some(it => it.id === comicShelfId(c.sourceId, c.comicId));
  const progress = recent?.find(p => p.sourceId === c.sourceId && p.comicId === c.comicId);
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [reverse, setReverse] = useState(false);
  useEffect(() => {
    let alive = true;
    setD(null); setError('');
    comicDetails(c.sourceId, c.comicId).then(v => alive && setD(v), e => alive && setError(e.message || '打不开'));
    return () => { alive = false; };
  }, [c.sourceId, c.comicId, retry]);

  // Hedge a slow first-time source. Explicit selections and the source with
  // existing reading progress stay under the reader's control.
  useEffect(() => {
    if (d || error || picked != null || seen >= 0 || book.comics.length < 2) return;
    let alive = true;
    const timer = setTimeout(() => {
      const others = book.comics.map((x, i) => ({ x, i })).filter(v => v.i !== pick).slice(0, 2);
      for (const { x, i } of others) comicDetails(x.sourceId, x.comicId).then(value => {
        if (alive && chaptersOf(value).length) { alive = false; setFallback(i); }
      }, () => {});
    }, 1500);
    return () => { alive = false; clearTimeout(timer); };
  }, [c.sourceId, c.comicId, d, error, picked, seen, book.comics]);

  const chapters = useMemo(() => (d ? chaptersOf(d) : []), [d]);
  const empty = !!error || (d && !chapters.length);
  useEffect(() => {
    if (empty && picked == null && seen < 0 && fallback < book.comics.length - 1) setFallback(f => f + 1);
  }, [empty, picked, seen, fallback, book.comics.length]);
  // 已知的源都试完还是没章节（版权作品常被下架）：按书名去别的源找，找到就接上、自动换过去
  const [looking, setLooking] = useState(false);
  const exhausted = empty && picked == null && (seen >= 0 || fallback >= book.comics.length - 1);
  useEffect(() => {
    if (!exhausted || looking || more.length) return;
    const ctl = new AbortController();
    setLooking(true);
    findOtherSources(given, { signal: ctl.signal }).then(list => { if (list.length) { setMore(list); setFallback(given.comics.length); } }, () => {}).finally(() => setLooking(false));
    return () => ctl.abort();
  }, [exhausted]);
  // 详情出来了：「开始看 / 继续看」那一话的图片列表先取上，点开阅读器少等一轮
  useEffect(() => {
    if (!d || !chapters.length) return;
    const ep = chapters[Math.min(progress?.index || 0, chapters.length - 1)];
    prefetchChapter(c.sourceId, c.comicId, ep.id, progress?.page || 0);
  }, [d]);
  const list = useMemo(() => chapters.map((x, i) => ({ ...x, i })), [chapters]);
  const ordered = reverse ? [...list].reverse() : list;
  const groups = [...new Set(ordered.map(x => x.group))];
  const read = (i, page = 0) => onRead(readPath(c.sourceId, c.comicId, i), { title: book.title || d?.title, cover: d?.cover || c.cover, page, at: Date.now() });
  const tags = book.tags.length ? [] : (d?.tags || []).flatMap(([, vs]) => vs).slice(0, 8);

  return (
    <>
      {!book.description && d?.description && <p className="sheet-desc">{d.description}</p>}
      {tags.length > 0 && <div className="sheet-tags">{tags.map((t, i) => <span key={i} className="chip chip-static">{t}</span>)}</div>}

      {book.comics.length > 1 && (
        <div className="cs-pick">
          <span className="muted">{book.comics.length} 个漫画源里都有</span>
          <div className="seg" role="radiogroup" aria-label="用哪个源看">
            {book.comics.map((x, i) => (
              <button key={x.sourceId} className="chip" role="radio" aria-checked={i === pick} aria-pressed={i === pick} onClick={() => setPicked(i)}>{x.sourceName}</button>
            ))}
          </div>
        </div>
      )}

      <section className="dl-block cs-read">
        <div className="cs-read-row">
          <button className="btn btn-ghost" disabled={onShelf || adding} onClick={async () => {
            setAdding(true); setShelfError('');
            try { await ensureComicShelf({ ...c, title: book.title || d?.title, cover: d?.cover || c.cover, author: book.author }); }
            catch (e) { setShelfError(e.message || '没加上，请重试'); }
            finally { setAdding(false); }
          }}>{onShelf ? '已在书架' : adding ? '正在加入…' : '加入书架'}</button>
          {progress && chapters[progress.index]
            ? <button className="btn btn-gold" onClick={() => read(progress.index, progress.page)}><Icon name="book" size={17} />继续看 {progress.chapter}{progress.page ? ` · 第 ${progress.page + 1} 张` : ''}</button>
            : chapters.length > 0 && <button className="btn btn-gold" onClick={() => read(0)}><Icon name="book" size={17} />从{chapters[0].title}开始看</button>}
          {chapters.length > 1 && <button className="btn btn-ghost sm" onClick={() => setReverse(v => !v)}>{reverse ? '从新到旧' : '从旧到新'}</button>}
        </div>
        {shelfError && <p role="alert">{shelfError}</p>}
        {!d && !error && <p className="sheet-note">正在打开章节目录…</p>}
        {looking && <p className="sheet-note">「{c.sourceName}」里没有章节，正在别的漫画源里找这一部…</p>}
        {error && <div role="alert"><p className="sheet-note">{error}</p><button className="btn btn-ghost sm" onClick={() => setRetry(n => n + 1)}><Icon name="refresh" size={15} />重新加载章节</button></div>}
        {!looking && d && !chapters.length && <p className="sheet-note">这部漫画在「{c.sourceName}」里没有章节（可能下架了）{book.comics.length > 1 ? '，换个源试试' : ''}。</p>}
        {chapters.length > 1 && groups.map(g => (
          <div key={g} className="cx-chapter-group">
            {groups.length > 1 && <h3 className="muted">{g}</h3>}
            <ol className="cx-chapter-list">
              {ordered.filter(x => x.group === g).map(x => (
                <li key={x.i}><button className={progress?.index === x.i ? 'is-current' : ''} onClick={() => read(x.i)} title={x.title}>{x.title}</button></li>
              ))}
            </ol>
          </div>
        ))}
      </section>
      <p className="sheet-source muted">来源：{c.sourceName}（Venera 漫画源）{d?.updateTime ? ` · 更新于 ${d.updateTime}` : ''}{chapters.length ? ` · 共 ${chapters.length} 话` : ''}</p>
    </>
  );
}
