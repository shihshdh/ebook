// 漫画阅读器。地址 /read/comic/:源/:漫画/:第几话（跟文字书的阅读器一样在 /read/ 下：全屏、藏导航）。
//
//   条漫：一话的图从上到下连着排，滚着看（国漫、韩漫、条漫）
//   翻页：一屏一张，点左右或按方向键翻，可以改成从右往左（日漫）；翻过最后一张进下一话
//   点屏幕中间呼出 / 收起上下两条；Esc 退出
//   取图：只取当前位置前后几张（条漫按离屏幕的远近、翻页按往后几张），离开缓冲窗口的放掉——一话一两百张全留着手机吃不消；
//         放掉的图记着宽高比，占位不塌，滚回来再取
//   进度：翻到哪记到哪（lib：comic:progress），从详情「继续看」、漫画页「最近在看」接着看
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { haptic, onBackButton, mobileUI, isIOS, setImmersive } from '../lib/native.js';
import { readerBuffer } from '../comic/reader-buffer.js';
import { acctKey } from '../lib/accounts.js';
import { useComicSources } from '../comic/sources.js';
import { comicDetails, chaptersOf, chapterImages, prefetchChapter, pageURL, getProgress, saveProgress, readPath } from '../comic/library.js';
import { ensureComicShelf, comicShelfProgress, persistComicProgress } from '../comic/shelf.js';
import '../styles/comic.css';
import '../styles/reader.css';
import { LiquidTabs, Clock, swipeDir } from '../reader/chrome.jsx';
import { READER_THEMES } from '../lib/prefs.js';
import { isTouch } from '../lib/motion.js';
import { useReadingClock } from '../lib/readstats.js';
import { listBookmarks, addBookmark, removeBookmark } from '../lib/shelf.js';

const PREFS = acctKey('librarium.comic.reader');
// Keep compressed page URLs ahead of reading; only nearby page-mode images mount.
const AHEAD = mobileUI ? 4 : 6;
const readPrefs = () => { try { return { mode: 'scroll', rtl: false, theme: 'night', spread: false, ...JSON.parse(localStorage.getItem(PREFS) || '{}') }; } catch { return { mode: 'scroll', rtl: false, theme: 'night', spread: false }; } };

// Decode before committing an image, and keep its geometry after eviction.
// WKWebView can reject decode() for an otherwise loaded image: load is the
// fallback, never a retry loop. No createImageBitmap/canvas copy on iOS 15.
async function preparedPage(url, signal, decode) {
  const image = new Image();
  image.decoding = 'async';
  let abort;
  try {
    await new Promise((resolve, reject) => {
      abort = () => { image.removeAttribute('src'); reject(new DOMException('已取消', 'AbortError')); };
      image.onload = resolve;
      image.onerror = () => reject(new Error('图片无法解码'));
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) return abort();
      image.src = url;
    });
    if (decode && image.decode) {
      if (isIOS) await image.decode().catch(() => {});
      else await image.decode();
    }
    if (signal.aborted) throw new DOMException('已取消', 'AbortError');
    return { url, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    signal.removeEventListener('abort', abort);
    image.onload = image.onerror = null;
  }
}
export default function ComicReader() {
  const { sourceId = '', comicId = '', index = '0' } = useParams();
  const { state } = useLocation();
  const nav = useNavigate();
  const sources = useComicSources();
  const sourceName = sources?.find(e => e.id === sourceId)?.name || '';
  const at = Math.max(0, Number(index) || 0);

  const [prefs, setPrefsState] = useState(readPrefs);
  const setPrefs = (patch) => setPrefsState(p => { const n = { ...p, ...patch }; try { localStorage.setItem(PREFS, JSON.stringify(n)); } catch {} return n; });
  const [chrome, setChrome] = useState(true);
  const [panel, setPanel] = useState('');
  const [pinned, setPinned] = useState(false);
  const [marks, setMarks] = useState([]);
  const [toast, setToast] = useState('');
  const [scrub, setScrub] = useState(null);
  const [wide, setWide] = useState(() => innerWidth >= 1000);
  const touchUI = useMemo(() => mobileUI || isTouch(), []);
  const stamp = useReadingClock();
  const id = `comic:${sourceId}:${comicId}`;
  const theme = READER_THEMES[prefs.theme] || READER_THEMES.night;
  const sidebar = panel === 'toc' && !touchUI;
  const spread = prefs.mode === 'page' && prefs.spread && wide;

  const [details, setDetails] = useState(null);
  const [images, setImages] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [pages, setPages] = useState({});     // 第几张 → { url } | { error }
  const ratios = useRef({});                    // 第几张 → 高 / 宽（放掉的图占位用）
  const [cur, setCur] = useState(0);
  const [displayed, setDisplayed] = useState(null);
  const [displayedURL, setDisplayedURL] = useState('');
  const paintedCurrent = displayedURL && pages[displayed]?.url === displayedURL;
  const scroller = useRef(null);
  const bookmarkPage = prefs.mode === 'page' && paintedCurrent ? displayed : cur;
  const bookmarkRef = `${at}:${bookmarkPage}`;
  const bookmarked = marks.some(m => m.ref === bookmarkRef);
  useEffect(() => { let alive = true; listBookmarks(id).then(m => alive && setMarks(m)); return () => { alive = false; }; }, [id]);
  useEffect(() => { const resize = () => setWide(innerWidth >= 1000); addEventListener('resize', resize); return () => removeEventListener('resize', resize); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 1800); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (panel === 'toc') document.querySelector('.rd-toc .is-current')?.scrollIntoView({ block: 'center' }); }, [panel, at]);

  const pendingProgress = useRef(null), progressTimer = useRef(0), loadedKey = useRef('');
  const flushProgress = () => {
    clearTimeout(progressTimer.current);
    const entry = pendingProgress.current; pendingProgress.current = null;
    if (entry) persistComicProgress(entry.id, entry.progress).catch(() => {});
  };
  useEffect(() => {
    const flushHidden = () => { if (document.visibilityState === 'hidden') flushProgress(); };
    document.addEventListener('visibilitychange', flushHidden);
    return () => { document.removeEventListener('visibilitychange', flushHidden); flushProgress(); };
  }, [id]);
  const buffer = useRef(null);
  const stage = useRef(null);
  const [carry, setCarry] = useState([]);
  const carryRef = useRef([]);
  const carryTarget = useRef('');
  const releaseCarry = () => { carryRef.current.forEach(p => URL.revokeObjectURL(p.url)); carryRef.current = []; };
  useEffect(() => () => releaseCarry(), []);
  useEffect(() => {
    if (paintedCurrent && carryRef.current.length && carryTarget.current === `${id}:${at}` && loadedKey.current === carryTarget.current && pages[displayed]?.url) { releaseCarry(); setCarry([]); }
  }, [displayed, displayedURL, images, id, at]);
  const direction = useRef(1);
  const previousCur = useRef(0);
  const startAt = useRef(null);                 // 进这一话时要停在第几张


  const chapters = useMemo(() => (details ? chaptersOf(details) : []), [details]);
  const chapter = chapters[at];
  const title = state?.title || details?.title || '';   // 打开时带来的书名优先（名作用名单里的简体写法），源里的原名只是兜底
  const cover = details?.cover || state?.cover || '';

  useEffect(() => { setImmersive(true); return () => setImmersive(false); }, []);

  // 详情（章节表）→ 这一话的图片地址
  useEffect(() => {
    let alive = true;
    flushProgress(); loadedKey.current = '';
    // 上一话的图：没取完的中止，取到的放掉
    buffer.current?.destroy(); buffer.current = null;
    setError(''); setImages(null); setPages({}); setDisplayed(null); setDisplayedURL(''); ratios.current = {}; direction.current = 1;
    (async () => {
      const d = await comicDetails(sourceId, comicId);
      if (!alive) return;
      await ensureComicShelf({ sourceId, sourceName, comicId, title: state?.title || d.title || '', cover: d.cover || state?.cover || '' });
      if (!alive) return;
      setDetails(d);
      const list = chaptersOf(d), c = list[at];
      if (!c) throw new Error('没有这一话');
      const urls = await chapterImages(sourceId, comicId, c.id);
      if (!alive) return;
      if (!urls.length) throw new Error('这一话没有图片（可能只在官方平台上）');
      // 停在哪：明确要的（上一话翻回来是最后一张）> 进度里记的同一话 > 第一张
      const saved = await getProgress(sourceId, comicId);
      if (!alive) return;
      // 导航带来的页码只在比记下的进度新时才算（刷新页面时 history 里还留着当初的 page: 0，不能盖掉后来看到的地方）
      const asked = state?.page != null && !(saved?.index === at && saved.at > (state.at || 0));
      const want = asked ? (state.page === -1 ? urls.length - 1 : state.page) : saved?.index === at ? saved.page : 0;
      startAt.current = Math.min(Math.max(0, want || 0), urls.length - 1);
      previousCur.current = startAt.current; curRef.current = startAt.current;
      setCur(startAt.current);
      loadedKey.current = `${id}:${at}`;
      setImages(urls);
    })().catch(e => { if (alive) setError(e?.message || '打不开'); });
    return () => { alive = false; };
    // state 只在进这一话时读一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, comicId, at, retry]);

  const epId = chapter?.id ?? null;
  const curRef = useRef(cur);
  curRef.current = cur;
  useEffect(() => {
    if (!images || loadedKey.current !== `${id}:${at}`) return;
    const pool = readerBuffer({ length: images.length, ahead: AHEAD,
      load: async (i, { signal, front }) => {
        const url = await pageURL(sourceId, images[i], { comicId, epId, signal, front });
        try { return await preparedPage(url, signal, front || Math.abs(i - curRef.current) <= 1); }
        catch (error) { URL.revokeObjectURL(url); throw error; }
      },
      change: next => {
        for (const [i, page] of Object.entries(next)) if (page.width) ratios.current[i] = page.height / page.width;
        setPages(next);
      },
    });
    buffer.current = pool;
    return () => { pool.destroy(); if (buffer.current === pool) buffer.current = null; };
  }, [images, sourceId, comicId, epId, id, at]);

  const currentReady = !!pages[cur]?.url;
  useEffect(() => {
    if (cur !== previousCur.current) direction.current = cur < previousCur.current ? -1 : 1;
    previousCur.current = cur;
    const pin = !paintedCurrent ? [] : [displayed, ...(spread ? [displayed + 1] : [])];
    if (loadedKey.current === `${id}:${at}`) buffer.current?.window(cur, { pin, reverse: direction.current < 0 });
  }, [cur, images, displayed, displayedURL, spread, id, at]);
  const again = i => buffer.current?.retry(i);

  // Keep the last painted page until all images of the next spread have loaded.
  // Stable image nodes prevent a decoded page being replaced by a blank <img>.
  const showPrepared = () => {
    if (prefs.mode !== 'page' || !stage.current || loadedKey.current !== `${id}:${at}`) return;
    const wanted = [cur, ...(spread && cur + 1 < (images?.length || 0) ? [cur + 1] : [])];
    if (wanted.every(i => { const im = stage.current.querySelector(`[data-image="${i}"]`); return im?.complete && im.naturalWidth > 0 && im.src === pages[i]?.url; })) { setDisplayedURL(pages[cur].url); setDisplayed(cur); }
  };
  useEffect(showPrepared, [cur, pages, spread, prefs.mode]);

  // Near the end, warm the next chapter metadata and first image before crossing.
  useEffect(() => {
    const next = chapters[at + 1];
    if (loadedKey.current === `${id}:${at}` && images && currentReady && next && cur >= Math.max(0, images.length - 5)) {
      prefetchChapter(sourceId, comicId, next.id);
    }
  }, [images, currentReady, cur, at, chapters, sourceId, comicId, id]);

  // 进度
  useEffect(() => {
    if (!images || !chapter || loadedKey.current !== `${id}:${at}`) return;
    const page = prefs.mode === 'page' ? (paintedCurrent ? displayed : null) : cur;
    if (page == null) return;
    saveProgress({ sourceId, sourceName, comicId, title, cover, index: at, chapter: chapter.title, page, pages: images.length });
    const progress = comicShelfProgress({ index: at, page, pages: images.length, chapters: chapters.length, chapter: chapter.title });
    pendingProgress.current = { id, progress };
    clearTimeout(progressTimer.current);
    progressTimer.current = setTimeout(flushProgress, 500);
    return () => clearTimeout(progressTimer.current);
  }, [cur, displayed, displayedURL, prefs.mode, images, chapter, at, sourceId, comicId, sourceName, title, cover]);

  // ---------- 条漫：滚动 ----------
  const scrollMode = prefs.mode === 'scroll';
  useEffect(() => {
    if (!scrollMode || !images || !scroller.current) return;
    const root = scroller.current;
    const els = [...root.querySelectorAll('[data-page]')];
    // 跳到要停的那张（只在刚进这一话时）
    if (startAt.current != null) { els[startAt.current]?.scrollIntoView({ block: 'start' }); startAt.current = null; }
    // 屏幕中线压着的那张就是「当前页」
    const middle = new IntersectionObserver((es) => es.forEach(e => e.isIntersecting && setCur(Number(e.target.dataset.page))), { root, rootMargin: '-49% 0px -49% 0px' });
    els.forEach(el => middle.observe(el));
    return () => middle.disconnect();
  }, [scrollMode, images]);

  // ---------- 翻章 ----------
  const go = useCallback((i, page = 0) => {
    if (i < 0 || i >= chapters.length) return;
    if (!scrollMode && paintedCurrent) {
      const outgoing = [displayed, ...(spread ? [displayed + 1] : [])].map(n => buffer.current?.detach(n)).filter(Boolean);
      if (outgoing.length) { releaseCarry(); carryRef.current = outgoing; setCarry(outgoing); }
    }
    if (carryRef.current.length) carryTarget.current = `${id}:${i}`;
    nav(readPath(sourceId, comicId, i), { replace: true, state: { title, cover, page, at: Date.now() } });
  }, [chapters.length, nav, sourceId, comicId, title, cover, scrollMode, displayed, displayedURL, spread, id]);
  const leave = useCallback(() => (window.history.state?.idx > 0 ? nav(-1) : nav('/explore?kind=comic', { replace: true })), [nav]);

  // ---------- 翻页 ----------
  const flip = useCallback((d) => {
    if (!images) return;
    const n = curRef.current + d * (spread ? 2 : 1);   // 读 ref：连按几下时每一下都接着上一下翻
    if (n >= images.length) go(at + 1);
    else if (n < 0) go(at - 1, -1);
    else { curRef.current = n; setCur(n); if (scrollMode) scroller.current?.querySelector(`[data-page="${n}"]`)?.scrollIntoView({ block: 'start' }); }
  }, [images, go, at, spread, scrollMode]);

  const toggleBookmark = useCallback(async () => {
    if (prefs.mode === 'page' && !paintedCurrent) return;
    try {
      setMarks(bookmarked ? await removeBookmark(id, bookmarkRef) : await addBookmark(id, { ref: bookmarkRef, label: `${chapter?.title || title} · 第 ${bookmarkPage + 1} 张` }));
      setToast(bookmarked ? '已移除书签' : '已添加书签');
      haptic('light');
    } catch { setToast('书签没存上，请重试'); }
  }, [id, bookmarkRef, bookmarked, chapter, title, bookmarkPage, prefs.mode, paintedCurrent]);
  const escape = useCallback(() => {
    if (panel) { setPanel(''); setPinned(false); }
    else if (chrome) setChrome(false);
    else leave();
  }, [panel, chrome, leave]);
  useEffect(() => onBackButton(() => { escape(); return true; }), [escape]);
  useEffect(() => {
    const onKey = e => {
      if (e.target?.closest?.('input, select, textarea')) return;
      stamp();
      if (e.key === 'Escape') { e.preventDefault(); escape(); }
      else if (e.key.toLowerCase() === 't') { setChrome(true); setPanel(p => p === 'toc' ? '' : 'toc'); }
      else if (e.key.toLowerCase() === 'b') toggleBookmark();
      else if (e.key === '[') go(at - 1);
      else if (e.key === ']') go(at + 1);
      else if ([prefs.rtl ? 'ArrowLeft' : 'ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); flip(1); }
      else if ([prefs.rtl ? 'ArrowRight' : 'ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); flip(-1); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [prefs.rtl, flip, go, at, escape, toggleBookmark]);
  const gesture = useRef(null), suppressTap = useRef(0);
  const onTap = e => {
    if (Date.now() < suppressTap.current || e.target.closest('button')) return;
    const r = scroller.current.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
    if (x > .33 && x < .67) { setPanel(''); setChrome(c => !c); return; }
    flip((x < .33) === prefs.rtl ? 1 : -1);
  };
  const onTouchStart = e => {
    if (e.touches.length !== 1) { gesture.current = null; suppressTap.current = Date.now() + 700; return; }
    const { clientX: x, clientY: y } = e.touches[0];
    gesture.current = { x, y, track: [[x, e.timeStamp]] };
  };
  const onTouchMove = e => {
    const g = gesture.current;
    if (!g || e.touches.length !== 1) { gesture.current = null; return; }
    g.track.push([e.touches[0].clientX, e.timeStamp]);
    g.track = g.track.filter(([, t]) => e.timeStamp - t <= 150);
  };
  const onTouchEnd = e => {
    const g = gesture.current; gesture.current = null;
    if (!g) return;
    const { clientX: x, clientY: y } = e.changedTouches[0], dx = x - g.x, dy = y - g.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 8) suppressTap.current = Date.now() + 500;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      const d = swipeDir(dx, g.track, x, e.timeStamp); if (d) flip(prefs.rtl ? -d : d);
    } else if (dy >= 72 && g.y < 100 && (!scrollMode || scroller.current?.scrollTop === 0)) toggleBookmark();
  };

  // 翻页模式：滚轮也翻（一下一页，连着滚不连翻）
  const wheelAt = useRef(0);
  const onWheel = (e) => {
    if (e.ctrlKey || scrollMode || Math.abs(e.deltaY) < 20 || performance.now() - wheelAt.current < 350) return;
    wheelAt.current = performance.now();
    flip(e.deltaY > 0 ? 1 : -1);
  };

  const jump = (i) => {
    curRef.current = i; setCur(i);
    if (scrollMode) scroller.current?.querySelector(`[data-page="${i}"]`)?.scrollIntoView({ block: 'start' });
  };

  const page = (i) => {
    const p = pages[i];
    if (p?.url) return <img src={p.url} decoding="async" width={p.width} height={p.height} alt={`第 ${i + 1} 张`} draggable="false" onLoad={(e) => { const im = e.currentTarget; if (im.naturalWidth) ratios.current[i] = im.naturalHeight / im.naturalWidth; }} />;
    if (p?.error) return <button className="cr-ph is-error" onClick={(e) => { e.stopPropagation(); again(i); }}>第 {i + 1} 张没取到（{p.error}）· 点一下重试</button>;
    return <span className="cr-ph num">{i + 1}</span>;
  };
  const next = chapters[at + 1];
  const staged = new Map(carry.map((p, i) => [p.url, { ...p, i: null, visible: !paintedCurrent, second: carry.length > 1 && i === 1 }]));
  const stagedIndices = new Set([displayed, ...(spread && displayed != null ? [displayed + 1] : []), cur, cur + 1, ...(spread ? [cur + 2] : [])]);
  for (const i of stagedIndices) {
    if (i == null || i < 0 || i >= (images?.length || 0) || !pages[i]?.url) continue;
    if (staged.has(pages[i].url) && !paintedCurrent) continue;
    const visible = paintedCurrent && (i === displayed || (spread && i === displayed + 1));
    staged.set(pages[i].url, { ...pages[i], i, visible, second: spread && i === (visible ? displayed : cur) + 1 });
  }

  const tabs = [{ id: 'toc', label: '目录', icon: 'grid' }, { id: 'progress', label: '进度', icon: 'explore' }, { id: 'marks', label: '书签', icon: 'copy' }, { id: 'mode', label: '阅读方式', icon: 'book' }, { id: 'theme', label: '纸张', icon: 'sparkle' }];
  const progressBar = <div className="rd-progress"><span className="num">{images ? `${cur + 1} / ${images.length}` : '—'}</span><div className="rd-slider"><div className="rd-track"><i style={{ width: `${cur / Math.max(1, (images?.length || 1) - 1) * 100}%` }} /></div>
    {scrub != null && <span className="rd-bubble glass" style={{ left: `${scrub / Math.max(1, (images?.length || 1) - 1) * 100}%` }}><b>第 {scrub + 1} 张</b><span>{chapter?.title}</span></span>}
    <input type="range" min="0" max={Math.max(0, (images?.length || 1) - 1)} value={scrub ?? cur} aria-label="本话进度" disabled={!images}
      onChange={e => { const n = +e.target.value; setScrub(n); jump(n); }} onPointerUp={() => setScrub(null)} onBlur={() => setScrub(null)} onKeyUp={() => setScrub(null)} />
  </div></div>;
  return (
    <main className={`reader2 comic-reader2 ${touchUI ? 'is-touch' : 'is-desk'} ${chrome ? 'is-open' : ''} ${sidebar ? 'toc-open' : ''} ${sidebar && pinned ? 'has-sidebar' : ''} mode-${scrollMode ? 'scrolled' : 'paginated'}`}
      data-theme={['paper', 'sepia'].includes(prefs.theme) ? 'light' : 'dark'} style={{ background: theme.chrome, '--rd-page': theme.page, '--rd-text': theme.text, '--rd-link': theme.link }}
      onPointerDown={stamp} onWheel={stamp} onPointerMove={e => { if (!touchUI && (e.clientY < 45 || e.clientY > innerHeight - 55)) setChrome(true); }}>
      <div className="rd-stage">
        <div className="rd-ambient rd-ambient-top">{chapter?.title || title}</div>
        <div className="cr-scroll" ref={scroller} onClick={onTap} onWheel={onWheel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={() => { gesture.current = null; }}>
        {error && (
          <div className="cr-message is-error">
            <p>{error}</p>
            <div className="cr-message-actions">
              <button className="btn sm" onClick={(e) => { e.stopPropagation(); setRetry(n => n + 1); }}><Icon name="refresh" size={15} />再试一次</button>
              {next && <button className="btn btn-ghost sm" onClick={(e) => { e.stopPropagation(); go(at + 1); }}>下一话</button>}
            </div>
          </div>
        )}
        {!error && !images && !carry.length && <div className="cr-message"><p>正在打开{chapter ? `「${chapter.title}」` : ''}…</p></div>}
        {images && scrollMode && (
          <>
            {images.map((_, i) => (
              <div key={i} className={`cr-page ${pages[i]?.url ? 'is-loaded' : ratios.current[i] ? 'has-ratio' : ''}`} data-page={i} style={ratios.current[i] ? { aspectRatio: `1 / ${ratios.current[i]}` } : undefined}>{page(i)}</div>
            ))}
            <div className="cr-end">
              <p>{chapter?.title} 完</p>
              {next ? <button className="btn btn-gold" onClick={(e) => { e.stopPropagation(); go(at + 1); }}>下一话：{next.title}</button> : <p className="muted">已经是最后一话</p>}
            </div>
          </>
        )}
        {(images || carry.length > 0) && !scrollMode && <div ref={stage} className={`cr-stage cr-buffered ${spread ? 'is-spread' : ''}`} aria-busy={!paintedCurrent || displayed !== cur || !images}>
          {[...staged.values()].map(p => <div key={p.url} className={`cr-frame ${p.visible ? 'is-visible' : ''}`} aria-hidden={!p.visible} style={{ width: spread ? '50%' : '100%', left: spread && (p.second !== prefs.rtl) ? '50%' : 0 }}>
            <img data-image={p.i ?? undefined} src={p.url} decoding="async" width={p.width} height={p.height} alt={p.i == null ? '上一话末页' : `第 ${p.i + 1} 张`} draggable="false" onLoad={showPrepared} />
          </div>)}
          {(!paintedCurrent || displayed !== cur || !images) && <div className={`cr-page-status ${paintedCurrent || carry.length ? 'over-page' : ''}`} role="status">
            {pages[cur]?.error || (spread && pages[cur + 1]?.error) ? <button className="cr-ph is-error" onClick={e => { e.stopPropagation(); again(pages[cur]?.error ? cur : cur + 1); }}>第 {cur + 1} 张加载失败 · 点一下重试</button> : <span>{images ? `正在准备第 ${cur + 1} 张…` : '正在准备章节…'}</span>}
          </div>}
        </div>}
      </div>

        <div className="rd-ambient rd-ambient-bottom"><span>本话 第 {cur + 1} / {images?.length || '—'} 张 · 还剩 {Math.max(0, (images?.length || 1) - cur - 1)} 张</span><Clock /></div>
      </div>
      {touchUI && !chrome && <button className="rd-menu-trigger" aria-label="打开阅读菜单" onClick={() => setChrome(true)}><Icon name="grid" size={18} /></button>}
      <button className={`rd-ribbon ${bookmarked ? 'on' : ''}`} aria-label={bookmarked ? '移除本页书签' : '为本页加书签'} aria-pressed={bookmarked} onClick={toggleBookmark}><svg viewBox="0 0 22 40"><path d="M1 0h20v38l-10-8-10 8z" /></svg></button>
      {!touchUI && !scrollMode && <><button className="rd-edge l glass" aria-label="上一页" onClick={() => flip(prefs.rtl ? 1 : -1)}><Icon name="back" /></button><button className="rd-edge r glass" aria-label="下一页" onClick={() => flip(prefs.rtl ? -1 : 1)}><Icon name="arrow" /></button></>}
      <header className={`rd-top glass ${chrome ? 'show' : ''}`}>
        <button className="rd-btn" onClick={leave} aria-label="退出阅读"><Icon name="back" size={20} /><span className="hide-sm">书架</span></button>
        <div className="rd-title"><strong>{title || 'EBOOK'}</strong><small>{chapter?.title}</small></div>
        <div className="rd-group">{!touchUI && <button className="rd-btn" onClick={() => setPanel(p => p === 'toc' ? '' : 'toc')}><Icon name="grid" size={18} />目录</button>}<button className={`rd-btn ${bookmarked ? 'on' : ''}`} aria-label="书签" onClick={toggleBookmark}><Icon name="book" size={18} /></button></div>
      </header>
      <footer className={`rd-bottom ${chrome ? 'show' : ''}`}>
        {touchUI ? <div className="rd-dock glass"><LiquidTabs value={panel} onChange={setPanel} className="dock" items={tabs} /></div> : <div className="rd-deskbar glass"><button className="rd-btn" aria-label="上一话" disabled={at <= 0} onClick={() => go(at - 1)}>«</button>{progressBar}<button className="rd-btn" aria-label="下一话" disabled={!next} onClick={() => go(at + 1)}>»</button><span className="rd-sep" /><LiquidTabs value={panel} onChange={setPanel} items={tabs.slice(2)} /></div>}
      </footer>
      {panel && !(sidebar && pinned) && <div className={`rd-scrim ${sidebar ? 'light' : ''}`} onClick={() => setPanel('')} />}
      {panel && <section className={`rd-panel glass ${sidebar ? 'as-sidebar' : 'as-pop'} panel-${panel}`} role="dialog" aria-label={tabs.find(t => t.id === panel)?.label}>
        <div className="rd-panel-head"><h2 className="serif">{tabs.find(t => t.id === panel)?.label}</h2>{sidebar && <button className={`rd-btn sm ${pinned ? 'on' : ''}`} onClick={() => setPinned(v => !v)}>{pinned ? '已固定' : '固定'}</button>}<button className="rd-btn sm" aria-label="关闭面板" onClick={() => setPanel('')}><Icon name="close" size={16} /></button></div>
        {panel === 'toc' && <><div className="rd-panel-sub">共 {chapters.length} 话</div><ol className="rd-toc">{chapters.map((c, i) => <li key={i} className={`${i === at ? 'is-current' : ''} ${i < at ? 'is-read' : ''}`}><button onClick={() => { go(i); if (!pinned || touchUI) setPanel(''); }}>{c.title}</button></li>)}</ol></>}
        {panel === 'progress' && <div className="rd-progress-panel"><p className="rd-now serif">{chapter?.title}</p>{progressBar}<div className="rd-row"><button className="rd-btn" disabled={at <= 0} onClick={() => go(at - 1)}>上一话</button><button className="rd-btn" onClick={() => flip(-1)}>上一张</button><button className="rd-btn" onClick={() => flip(1)}>下一张</button><button className="rd-btn" disabled={!next} onClick={() => go(at + 1)}>下一话</button></div></div>}
        {panel === 'marks' && <><button className="rd-btn" onClick={toggleBookmark}>{bookmarked ? '移除本页书签' : '＋ 本页书签'}</button><ol className="rd-toc rd-notes">{marks.map(m => <li key={m.ref} className="rd-mark"><button onClick={() => { const [i, p] = m.ref.split(':').map(Number); if (i === at) jump(p); else go(i, p); setPanel(''); }}>{m.label}<small>{new Date(m.createdAt).toLocaleDateString()}</small></button><button className="rd-btn" aria-label="删除书签" onClick={async () => setMarks(await removeBookmark(id, m.ref))}><Icon name="close" size={16} /></button></li>)}</ol>{!marks.length && <p className="rd-empty">点右上角丝带，记下这一张。</p>}</>}
        {panel === 'mode' && <div className="rd-settings"><label>阅读方式</label><LiquidTabs value={prefs.mode} onChange={v => { if (v) { startAt.current = cur; setPrefs({ mode: v }); } }} items={[{ id: 'scroll', label: '上下条漫' }, { id: 'page', label: '左右翻页' }]} /><label>阅读方向</label><LiquidTabs value={prefs.rtl ? 'rtl' : 'ltr'} onChange={v => v && setPrefs({ rtl: v === 'rtl' })} items={[{ id: 'ltr', label: '从左往右' }, { id: 'rtl', label: '从右往左' }]} /><label>宽屏翻页</label><LiquidTabs value={prefs.spread ? 'double' : 'single'} onChange={v => v && setPrefs({ spread: v === 'double' })} items={[{ id: 'single', label: '单页' }, { id: 'double', label: '双页' }]} /></div>}
        {panel === 'theme' && <div className="rd-settings"><label>纸张</label><div className="rd-papers">{Object.entries(READER_THEMES).map(([key, t]) => <button key={key} className={prefs.theme === key ? 'on' : ''} aria-pressed={prefs.theme === key} style={{ background: t.page, color: t.text }} onClick={() => setPrefs({ theme: key })}><span className="rd-paper-lines" /><b>{t.label}</b></button>)}</div></div>}
      </section>}
      {toast && <div className="rd-toast glass" role="status">{toast}</div>}
    </main>
  );
}
