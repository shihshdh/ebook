// 阅读器 v2 —— 交互参照 Readest（readest/readest）与微信读书，外观是我们的液态玻璃。
//
//   常驻信息   页眉：当前章节；页脚：本章第几页 · 本章还剩几页 / 总进度 · 时间（不呼出工具栏也知道读到哪）
//   呼出工具栏 电脑：鼠标移到窗口上沿/下沿自动出现，左右两侧浮出翻页按钮；手机：点屏幕中间
//   翻页       点左右三分之一 / 左右滑（页面跟手）/ 方向键空格 PageUp/Down，[ ] 换章；翻页带一点滑动
//   进度条     带章节刻度，拖动时气泡显示将跳到的章节；跳转后出现「回到原处」
//   书签       右上角丝带显示本页是否已加书签，点一下切换；手机从顶部下拉也能加（微信读书）
//   目录       电脑是左侧可固定的玻璃侧栏，手机是底部面板；当前章节高亮并自动滚到可见处
//   设置       字体 / 纸张面板从工具栏上方弹出，改了实时生效
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ePub, { EpubCFI } from 'epubjs';
import { getShelfItem, getShelfBlob, updateProgress, listBookmarks, addBookmark, removeBookmark, listNotes, saveNote, removeNote } from '../lib/shelf';
import { usePrefs, READER_THEMES, READER_FONTS } from '../lib/prefs';
import { LiquidSpring, isTouch, prefersReduced } from '../lib/motion';
import { txtToEpub } from '../reader/txt';
import { searchBook } from '../reader/search';
import { useReadingClock } from '../lib/readstats';
import Icon from '../components/Icon.jsx';
import { haptic, onBackButton, setImmersive } from '../lib/native';
import { acctKey } from '../lib/accounts';
import '../styles/reader.css';

const flatten = (items, depth = 0) => items.flatMap(item => [{ ...item, depth }, ...flatten(item.subitems || [], depth + 1)]);
const cfiCmp = new EpubCFI();
const EASE = 'cubic-bezier(.16,1,.3,1)';
// 划线四色：金、绯、青、紫（和整站点缀色一致）
const INKS = { gold: '#e2b45c', rose: '#ff8f80', jade: '#7fd4a8', lilac: '#b9a8f0' };
const hlStyle = (color, dark) => ({ fill: INKS[color] || INKS.gold, 'fill-opacity': dark ? '0.32' : '0.42', 'mix-blend-mode': dark ? 'screen' : 'multiply' });
const inRange = (ref, start, end) => {
  try { return cfiCmp.compare(ref, start) >= 0 && cfiCmp.compare(ref, end || start) <= 0; } catch { return ref === start; }
};
// 某个 spine 所属的章节：同一 spine 里最后一个目录项；没有就取它前面最近的
const chapterOf = (chapters, spine) => {
  const here = chapters.filter(c => c.spine === spine);
  return (here[here.length - 1] || [...chapters].reverse().find(c => c.spine >= 0 && c.spine < spine))?.label || '';
};
// 书内搜索：最多列 1000 处；页面上淡淡标出前 300 处（单字搜索一章能有几百处，全标会拖慢翻页），当前那处用亮橙
const SR_LIMIT = 1000, SR_PAINT = 300;
const NO_FOUND = { q: '', hits: [], done: true, more: false, scanned: 0, of: 0 };

function applyTheme(rendition, prefs) {
  const theme = READER_THEMES[prefs.readerTheme] || READER_THEMES.night;
  rendition.themes.default({
    body: { color: `${theme.text} !important`, background: `${theme.page} !important`, 'font-family': `${(READER_FONTS[prefs.readerFont] || READER_FONTS.serif).stack} !important`, 'font-size': `${prefs.fontSize}% !important`, 'line-height': `${prefs.lineHeight} !important`, 'text-align': 'justify' },
    'p, li': { 'line-height': `${prefs.lineHeight} !important` },
    a: { color: `${theme.link} !important` },
    // 插图不能比一页还高：分页模式下超高的图会被整个挤到下一栏，留下一页空白
    // 宽高都交给比例自己算（书里常写死 width:100%，和限高叠在一起会让图比一页还宽，被一路推到几十页之后）
    img: { width: 'auto !important', height: 'auto !important', 'max-width': '100% !important', 'max-height': '82vh !important', 'object-fit': 'contain', display: 'block', margin: '0 auto', 'box-sizing': 'border-box' },
    svg: { 'max-width': '100% !important', 'max-height': '82vh !important' },
    '::selection': { background: 'rgba(233,203,139,.35)' },
  });
}

/** 液态分段选择：选中态是一滴会流动的玻璃（左右两条边各挂一根弹簧，前沿先冲、后沿慢半拍） */
function LiquidTabs({ items, value, onChange, className = '' }) {
  const track = useRef(null), thumb = useRef(null), spring = useRef(null), raf = useRef(0);
  const index = items.findIndex(i => i.id === value);
  useEffect(() => {
    const el = track.current?.querySelectorAll('[data-seg]')[index];
    const th = thumb.current;
    if (!th) return;
    if (!el) { th.style.opacity = '0'; return; }
    th.style.opacity = '1';
    const target = { left: el.offsetLeft, right: el.offsetLeft + el.offsetWidth };
    if (!spring.current || prefersReduced()) {
      spring.current = new LiquidSpring(target);
      th.style.width = `${target.right - target.left}px`; th.style.transform = `translate3d(${target.left}px,0,0)`;
      return;
    }
    spring.current.setTarget(target);
    let last = 0;
    const tick = now => {
      const dt = Math.min(.05, last ? (now - last) / 1000 : .016); last = now;
      const s = spring.current, moving = s.step(dt), base = target.right - target.left;
      th.style.width = `${base}px`;
      th.style.transform = `translate3d(${s.left}px,0,0) scale(${Math.max(8, s.right - s.left) / base},${s.squash})`;
      if (moving) raf.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(tick);
  }, [index]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return (
    <div ref={track} className={`liquid-tabs ${className}`} role="tablist">
      <span ref={thumb} className="liquid-tabs-thumb" aria-hidden="true" />
      {items.map(it => (
        <button key={it.id} data-seg role="tab" aria-selected={it.id === value} className={it.id === value ? 'on' : ''} onClick={() => onChange(it.id === value ? '' : it.id)}>
          {it.icon && <Icon name={it.icon} size={20} />}<span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 30000); return () => clearInterval(i); }, []);
  return <span className="num">{t.toTimeString().slice(0, 5)}</span>;
}

export default function Reader() {
  const { id: routeId = '' } = useParams();
  let id = routeId; try { id = decodeURIComponent(routeId); } catch { /* 旧书架 id 可能含裸百分号 */ }
  const navigate = useNavigate();
  const [prefs, setPrefs] = usePrefs();
  const theme = READER_THEMES[prefs.readerTheme] || READER_THEMES.night;
  const touch = useMemo(() => isTouch(), []);

  const host = useRef(null), stage = useRef(null), engine = useRef(null), prefsRef = useRef(prefs), act = useRef({});
  const position = useRef(null), saveTimer = useRef(0), hideTimer = useRef(0), toastTimer = useRef(0), turnDir = useRef(0), history = useRef([]);
  const [item, setItem] = useState(null), [toc, setToc] = useState([]), [marks, setMarks] = useState([]);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const [ticks, setTicks] = useState([]);              // [{fraction, label}] 章节刻度
  const [loc, setLoc] = useState({ percent: 0, chapter: '', page: 0, pages: 0, start: '', end: '', spine: 0 });
  const [bars, setBars] = useState(false);              // 上下工具栏
  const [panel, setPanel] = useState('');               // toc | progress | font | theme | marks
  const [tocPinned, setTocPinned] = useState(() => { try { return localStorage.getItem(acctKey('librarium.tocPinned')) === '1'; } catch { return false; } });
  const [edge, setEdge] = useState('');                 // 电脑：鼠标靠近的左右边 'l' | 'r'
  const [scrub, setScrub] = useState(null);             // 拖动进度条时的预览 {f, label}
  const [canReturn, setCanReturn] = useState(false);
  const [toast, setToast] = useState('');
  const [pull, setPull] = useState(0);                  // 下拉书签的位移
  const [notes, setNotes] = useState([]);               // 划线与笔记
  const [sel, setSel] = useState(null);                 // 选中文字的浮层 {cfi, text, x, y, top, existing}
  const [draft, setDraft] = useState(null);             // 正在写的笔记 {cfi, text}
  const [query, setQuery] = useState('');               // 书内搜索的输入
  const [found, setFound] = useState(NO_FOUND);         // 搜索结果 {q, hits:[{cfi,before,match,after,chapter}], done, more, scanned, of}
  const [hit, setHit] = useState(-1);                   // 当前跳到第几处
  const searchRun = useRef(null), searchInput = useRef(null), srPainted = useRef(new Set()), srState = useRef({ hits: [], hit: -1 });
  // 阅读时长（书架页的阅读统计）：翻页、按键、动鼠标都算「还在读」，2 分钟没动静就不计
  const stamp = useReadingClock(), stampRef = useRef(stamp); stampRef.current = stamp;
  prefsRef.current = prefs;

  const say = (t) => { setToast(t); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 1800); };
  const flush = () => {
    clearTimeout(saveTimer.current);
    if (position.current) return updateProgress(id, position.current).catch(() => say('进度保存失败，请检查存储空间'));
  };
  const showBars = (ms = 3200) => { setBars(true); clearTimeout(hideTimer.current); if (ms) hideTimer.current = setTimeout(() => setBars(false), ms); };
  const display = (target, remember = true) => {
    const r = engine.current?.rendition;
    if (!r) return;
    if (remember && position.current?.cfi) { history.current.push(position.current.cfi); setCanReturn(true); }
    turnDir.current = 0;
    return r.display(target).then(() => { if (typeof target === 'string' && target.startsWith('epubcfi(')) settle(target); }).catch(() => say('无法跳转到该位置'));
  };
  // epub.js 一章刚渲染完就按当时的排版算目标在第几页，字号行距套上后可能差一页：落地后核对一次，不在当前页就再跳一次
  const settle = (cfi) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const r = engine.current?.rendition;
    let here = null; try { here = r?.currentLocation(); } catch {}
    if (here?.start && !inRange(cfi, here.start.cfi, here.end?.cfi)) r.display(cfi).catch(() => {});
  }));
  const turn = (dir) => {
    const r = engine.current?.rendition;
    if (!r) return;
    turnDir.current = dir;
    Promise.resolve(dir < 0 ? r.prev() : r.next()).catch(() => {});
  };
  const chapterJump = (dir) => {
    const sec = engine.current?.book?.spine.get(loc.spine + dir);
    if (sec) { turnDir.current = dir; engine.current.rendition.display(sec.href); }
  };
  const goReturn = () => {
    const cfi = history.current.pop();
    if (cfi) display(cfi, false);
    setCanReturn(history.current.length > 0);
  };

  const bookmarked = useMemo(() => !!loc.start && marks.some(m => inRange(m.ref, loc.start, loc.end)), [marks, loc.start, loc.end]);
  const toggleBookmark = async () => {
    if (!loc.start) return;
    try {
      if (bookmarked) {
        let next = marks;
        for (const m of marks) if (inRange(m.ref, loc.start, loc.end)) next = await removeBookmark(id, m.ref);
        setMarks(next); say('已移除书签'); haptic('light');
      } else {
        setMarks(await addBookmark(id, { ref: loc.start, label: `${loc.chapter || '书签'} · ${Math.round(loc.percent * 100)}%` }));
        say('已加书签'); haptic('medium');
      }
    } catch { say('书签保存失败'); }
  };
  // ---------- 划线与笔记 ----------
  const isDarkPaper = () => !['paper', 'sepia'].includes(prefsRef.current.readerTheme);
  const paintHL = (n) => {
    const r = engine.current?.rendition;
    if (!r) return;
    try { r.annotations.remove(n.cfi, 'highlight'); } catch {}
    r.annotations.highlight(n.cfi, { note: n.note }, (e) => { e?.stopPropagation?.(); openHL(n.cfi); }, 'ebook-hl', hlStyle(n.color, isDarkPaper()));
  };
  const clearSelection = () => {
    try { engine.current?.rendition.getContents().forEach(c => c.window.getSelection()?.removeAllRanges()); } catch {}
    setSel(null);
  };
  // 浮层位置：选区在 iframe 里的矩形 + iframe 在页面上的偏移
  const placeOf = (cfi) => {
    try {
      const range = engine.current.rendition.getRange(cfi);
      const rect = range.getBoundingClientRect();
      const fr = range.startContainer.ownerDocument.defaultView.frameElement.getBoundingClientRect();
      return { x: fr.left + rect.left + rect.width / 2, y: fr.top + rect.top, bottom: fr.top + rect.bottom };
    } catch { return { x: innerWidth / 2, y: innerHeight / 2, bottom: innerHeight / 2 }; }
  };
  const openHL = (cfi) => {
    const existing = notesRef.current.find(n => n.cfi === cfi);
    if (!existing) return;
    setSel({ cfi, text: existing.text, existing, ...placeOf(cfi) });
  };
  const highlight = async (color, withNote = false) => {
    if (!sel) return;
    const note = { cfi: sel.cfi, text: sel.text, color, chapter: loc.chapter, note: sel.existing?.note || '' };
    const next = await saveNote(id, note);
    setNotes(next); paintHL(note);
    if (withNote) setDraft({ cfi: sel.cfi, text: sel.text, note: note.note });
    clearSelection();
  };
  const dropHL = async (cfi) => {
    try { engine.current?.rendition.annotations.remove(cfi, 'highlight'); } catch {}
    setNotes(await removeNote(id, cfi)); clearSelection(); say('已删除划线');
  };
  const copySel = async () => { try { await navigator.clipboard.writeText(sel.text); say('已复制'); } catch { say('复制失败'); } clearSelection(); };
  const notesRef = useRef([]); notesRef.current = notes;

  // ---------- 书内搜索 ----------
  // 命中处用 epub.js 的 highlight 标出来；和某条划线位置完全相同时让划线优先（同一 cfi 只能挂一个 highlight）
  const srStyle = (on) => {
    const dark = isDarkPaper();
    return { fill: on ? '#ff9a3d' : INKS.gold, 'fill-opacity': on ? (dark ? '0.5' : '0.55') : (dark ? '0.2' : '0.28'), 'mix-blend-mode': dark ? 'screen' : 'multiply' };
  };
  const paintSR = (cfi, on) => {
    const r = engine.current?.rendition;
    if (!r || notesRef.current.some(n => n.cfi === cfi)) return;
    try { r.annotations.remove(cfi, 'highlight'); } catch {}
    r.annotations.highlight(cfi, {}, () => {}, on ? 'ebook-sr-on' : 'ebook-sr', srStyle(on));
    srPainted.current.add(cfi);
  };
  const unpaintSR = (cfi) => {
    try { engine.current?.rendition.annotations.remove(cfi, 'highlight'); } catch {}
    srPainted.current.delete(cfi);
  };
  const clearSR = () => { [...srPainted.current].forEach(unpaintSR); srPainted.current = new Set(); };
  // 换纸张（深浅不同的混合模式）、换翻页方式（整个 rendition 重建）之后重新标一遍
  const repaintSR = () => {
    const { hits, hit: k } = srState.current;
    srPainted.current = new Set();
    hits.slice(0, SR_PAINT).forEach((h, i) => paintSR(h.cfi, i === k));
    if (k >= SR_PAINT && hits[k]) paintSR(hits[k].cfi, true);
  };
  const runSearch = async (raw) => {
    const book = engine.current?.book;
    if (!book) return;
    searchRun.current?.abort();
    const ctl = new AbortController(), q = raw.trim();
    searchRun.current = ctl;
    clearSR(); srState.current = { hits: [], hit: -1 }; setHit(-1);
    if (!q) { setFound(NO_FOUND); return; }
    setFound({ ...NO_FOUND, q, done: false });
    const chapters = toc;
    let hits = [], more = false, scanned = 0, of = book.spine.spineItems.length, last = 0;
    const push = (done) => setFound({ q, hits, done, more, scanned, of });
    try {
      for await (const batch of searchBook(book, q, { signal: ctl.signal, limit: SR_LIMIT })) {
        if (ctl.signal.aborted) return;
        if (batch.hits.length) {
          const chapter = chapterOf(chapters, batch.spine);
          hits = hits.concat(batch.hits.map(h => ({ ...h, chapter })));
          srState.current = { hits, hit: srState.current.hit };
        }
        ({ more, scanned, of } = batch);
        // 结果是一章章来的：最多每 120ms 刷一次列表，大书不至于每章都整表重排
        if (performance.now() - last > 120) { last = performance.now(); push(false); }
      }
    } catch { if (!ctl.signal.aborted) say('搜索出错了'); }
    if (ctl.signal.aborted) return;
    push(true);
    const k = srState.current.hit;
    hits.slice(0, SR_PAINT).forEach((h, i) => { if (i !== k) paintSR(h.cfi, false); });
  };
  const goHit = (i) => {
    const hits = srState.current.hits;
    if (!hits.length) return;
    const k = (i + hits.length) % hits.length, prev = srState.current.hit;
    if (prev >= 0 && prev !== k && hits[prev]) { if (prev < SR_PAINT) paintSR(hits[prev].cfi, false); else unpaintSR(hits[prev].cfi); }
    srState.current = { hits, hit: k }; setHit(k);
    paintSR(hits[k].cfi, true);
    display(hits[k].cfi, prev < 0);   // 只记第一次跳走前的位置：「回到原处」回到搜索之前读到的地方
  };
  const closeSearch = () => { setQuery(''); setPanel(p => p === 'search' ? '' : p); };
  const openSearch = () => { setPanel('search'); setTimeout(() => searchInput.current?.select(), 40); };

  const back = async () => { await flush(); if (window.history.state?.idx > 0) navigate(-1); else navigate('/shelf', { replace: true }); };

  // 安卓：阅读时藏起系统栏（从边缘划一下临时呼出）；返回键和 Esc 同一套逻辑——先关选区/笔记/面板/工具栏，最后才退出
  useEffect(() => { setImmersive(true); return () => setImmersive(false); }, []);
  useEffect(() => onBackButton(() => { act.current.key?.({ key: 'Escape', target: null }); return true; }), []);

  // iframe 里和外层共用的动作（每次渲染刷新，拿到最新状态）
  act.current = {
    tap: (fraction) => {
      if (sel) { clearSelection(); return; }
      if (panel && !(panel === 'toc' && tocPinned && !touch)) { setPanel(''); return; }
      if (fraction > 1 / 3 && fraction < 2 / 3) { if (bars) setBars(false); else showBars(touch ? 0 : 3200); }
      else if (prefsRef.current.readerMode === 'paginated') { setBars(false); turn(fraction < .5 ? -1 : 1); }
    },
    turn,
    key: (e) => {
      stampRef.current();
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) { e.preventDefault?.(); openSearch(); return; }
      if (e.key === 'F3' && srState.current.hits.length) { e.preventDefault?.(); goHit(srState.current.hit + (e.shiftKey ? -1 : 1)); return; }
      if (e.target?.closest?.('input,select,textarea,[contenteditable="true"]') || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === 'Escape') { if (sel) { clearSelection(); return; } if (draft) { setDraft(null); return; } if (panel) setPanel(''); else if (bars) setBars(false); else if (found.q) closeSearch(); else back(); return; }
      if (e.key === '[' || e.key === ']') { chapterJump(e.key === '[' ? -1 : 1); return; }
      if (e.key === 't' || e.key === 'T') { setPanel(p => p === 'toc' ? '' : 'toc'); return; }
      if (e.key === 'b' || e.key === 'B') { toggleBookmark(); return; }
      if (['ArrowLeft', 'ArrowUp', 'PageUp', 'ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
        if (prefsRef.current.readerMode === 'scrolled' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return;
        e.preventDefault();
        turn(['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey) ? -1 : 1);
      }
    },
    // 手指拖动：横向页面跟手；从顶部向下拉 = 书签
    drag: (dx, dy, phase) => {
      const h = host.current;
      if (!h) return;
      if (phase === 'move') {
        if (Math.abs(dx) > Math.abs(dy)) { h.style.transition = 'none'; h.style.transform = `translate3d(${dx * .35}px,0,0)`; h.style.opacity = String(1 - Math.min(.35, Math.abs(dx) / 900)); }
        else if (dy > 0) setPull(Math.min(110, dy * .45));
        return;
      }
      h.style.transition = `transform .35s ${EASE}, opacity .35s`; h.style.transform = ''; h.style.opacity = '';
      if (phase === 'pull' && dy * .45 >= 72) toggleBookmark();
      setPull(0);
    },
  };

  // ---------- 打开书 ----------
  useEffect(() => {
    let cancelled = false, book, rendition, resize;
    const disposers = [];
    setReady(false); setError('');
    const restore = position.current?.cfi;
    (async () => {
      const [entry, blob, bookmarks] = await Promise.all([getShelfItem(id), getShelfBlob(id), listBookmarks(id)]);
      if (cancelled) return;
      if (!entry || !blob) throw new Error('这本书不在本地书架，请重新导入或下载。');
      setItem(entry); setMarks(bookmarks);
      const savedNotes = await listNotes(id); setNotes(savedNotes); notesRef.current = savedNotes;
      const data = entry.ext === 'txt' ? await txtToEpub(blob, entry.title) : await blob.arrayBuffer();
      if (cancelled) return;
      book = ePub(data); await book.ready;
      if (cancelled) { book.destroy(); return; }
      const navigation = await book.loaded.navigation;
      if (cancelled) return;
      const chapters = flatten(navigation.toc).map(c => ({ ...c, label: c.label.trim(), spine: book.spine.get(c.href.split('#')[0])?.index ?? -1 }));
      setToc(chapters);
      rendition = book.renderTo(host.current, { width: '100%', height: '100%', spread: 'none', flow: prefsRef.current.readerMode === 'scrolled' ? 'scrolled-doc' : 'paginated', manager: 'default', allowScriptedContent: false });
      engine.current = { book, rendition };
      applyTheme(rendition, prefsRef.current);
      rendition.hooks.content.register(contents => {
        const doc = contents.document;
        let t0 = null, suppress = 0;
        // 分栏 EPUB 的 iframe 比可见页宽很多，坐标要换算回阅读窗口
        const viewX = (x) => {
          const fr = contents.window.frameElement.getBoundingClientRect(), vr = host.current.getBoundingClientRect();
          return (x + fr.left - vr.left) / vr.width;
        };
        const click = e => {
          if (Date.now() < suppress || e.target.closest?.('a,button,input') || doc.getSelection()?.toString()) return;
          act.current.tap(viewX(e.clientX));
        };
        const key = e => act.current.key(e);
        const start = e => {
          if (e.touches.length !== 1) return;
          const fr = contents.window.frameElement.getBoundingClientRect();
          t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY, top: e.touches[0].clientY + fr.top < 180 };
        };
        const move = e => {
          if (!t0 || prefsRef.current.readerMode !== 'paginated') return;
          const dx = e.touches[0].clientX - t0.x, dy = e.touches[0].clientY - t0.y;
          if (Math.abs(dx) > 8 || (dy > 8 && t0.top)) act.current.drag(dx, t0.top ? dy : 0, 'move');
        };
        const end = e => {
          if (!t0) return;
          const dx = e.changedTouches[0].clientX - t0.x, dy = e.changedTouches[0].clientY - t0.y;
          if (prefsRef.current.readerMode === 'paginated') {
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) { suppress = Date.now() + 500; act.current.drag(0, 0, 'end'); act.current.turn(dx < 0 ? 1 : -1); }
            else if (t0.top && dy > 30 && dy > Math.abs(dx)) { suppress = Date.now() + 500; act.current.drag(0, dy, 'pull'); }
            else act.current.drag(0, 0, 'end');
          }
          t0 = null;
        };
        doc.addEventListener('click', click); doc.addEventListener('keydown', key);
        doc.addEventListener('touchstart', start, { passive: true }); doc.addEventListener('touchmove', move, { passive: true }); doc.addEventListener('touchend', end, { passive: true });
        disposers.push(() => { doc.removeEventListener('click', click); doc.removeEventListener('keydown', key); doc.removeEventListener('touchstart', start); doc.removeEventListener('touchmove', move); doc.removeEventListener('touchend', end); });
      });
      rendition.on('selected', (cfiRange, contents) => {
        const text = contents.window.getSelection()?.toString().trim();
        if (!text) return;
        const range = contents.range(cfiRange), rect = range.getBoundingClientRect();
        const fr = contents.window.frameElement.getBoundingClientRect();
        setSel({ cfi: cfiRange, text, x: fr.left + rect.left + rect.width / 2, y: fr.top + rect.top, bottom: fr.top + rect.bottom, existing: null });
      });
      rendition.on('relocated', location => {
        if (cancelled || !location.start) return;
        const spine = location.start.index;
        const chapter = chapterOf(chapters, spine);
        const percent = book.locations.length() ? book.locations.percentageFromCfi(location.start.cfi) : (entry.progress?.percent || 0);
        const next = { cfi: location.start.cfi, percent: Math.max(0, Math.min(1, percent || 0)), chapter };
        position.current = next;
        stampRef.current();
        setLoc({ ...next, page: location.start.displayed?.page || 0, pages: location.start.displayed?.total || 0, start: location.start.cfi, end: location.end?.cfi || '', spine });
        clearTimeout(saveTimer.current); saveTimer.current = setTimeout(flush, 500);
        // 划线 / 搜索高亮的位置是章节刚渲染时算的，那时字号行距主题可能还没套上：排版稳定后重算一次，免得框和字错开
        requestAnimationFrame(() => requestAnimationFrame(() => { if (!cancelled) try { rendition.views().forEach(v => v.pane?.render()); } catch {} }));
        // 翻页动效：新页从翻页方向滑进来一点
        const dir = turnDir.current; turnDir.current = 0;
        if (dir && host.current && !prefersReduced() && prefsRef.current.readerMode === 'paginated') {
          host.current.animate([{ transform: `translate3d(${dir * 28}px,0,0)`, opacity: .35 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: EASE });
        }
      });
      // 书架页「最近划线」点进来：一次性跳到那条划线（sessionStorage 里留的 librarium.jump）
      let jump = null;
      try { const j = JSON.parse(sessionStorage.getItem('librarium.jump') || 'null'); if (j?.id === id) { jump = j.cfi; sessionStorage.removeItem('librarium.jump'); } } catch {}
      const target = jump || restore || entry.progress?.cfi;
      try { await rendition.display(target || undefined); } catch { await rendition.display(); }
      if (cancelled) return;
      // 保险：个别书第一次 display 不出页面，空着就再来一次
      if (!host.current?.querySelector('iframe')) await rendition.display(target || undefined).catch(() => rendition.display());
      if (cancelled) return;
      notesRef.current.forEach(paintHL);
      repaintSR();
      setReady(true);
      // 只在尺寸真的变了时重排：ResizeObserver 一开始监听就会回调一次，那次 resize 会把刚渲染好的页清掉
      let size = `${host.current.clientWidth}x${host.current.clientHeight}`, rt = 0;
      resize = new ResizeObserver(() => {
        if (cancelled || !host.current) return;
        const next = `${host.current.clientWidth}x${host.current.clientHeight}`;
        if (next === size) return;
        size = next; clearTimeout(rt);
        rt = setTimeout(() => { if (!cancelled && host.current) rendition.resize(host.current.clientWidth, host.current.clientHeight); }, 120);
      });
      resize.observe(host.current);
      await book.locations.generate(1200);
      if (cancelled) return;
      // 章节刻度：每个一级目录项所在 spine 的第一个 location 在全书的位置
      const all = book.locations._locations || [];
      const firstOfSpine = new Map();
      all.forEach((cfi, i) => { try { const s = new EpubCFI(cfi).spinePos; if (!firstOfSpine.has(s)) firstOfSpine.set(s, i / Math.max(1, all.length)); } catch {} });
      // 每个 spine 只取一个刻度（同一文件里的多个目录项取最后一个，和"当前章节"的算法一致）
      const bySpine = new Map();
      chapters.forEach(c => { if (firstOfSpine.has(c.spine)) bySpine.set(c.spine, { fraction: firstOfSpine.get(c.spine), label: c.label }); });
      setTicks([...bySpine.values()].sort((x, y) => x.fraction - y.fraction));
      rendition.reportLocation();
    })().catch(e => { if (!cancelled) setError(e.message || '无法打开这本书。'); });
    const key = e => act.current.key(e);
    const pagehide = () => flush();
    addEventListener('keydown', key); addEventListener('pagehide', pagehide);
    return () => { cancelled = true; flush(); resize?.disconnect(); disposers.forEach(fn => fn()); removeEventListener('keydown', key); removeEventListener('pagehide', pagehide); engine.current = null; rendition?.destroy(); book?.destroy(); };
  }, [id, prefs.readerMode]);
  useEffect(() => { if (engine.current) applyTheme(engine.current.rendition, prefs); }, [prefs]);
  useEffect(() => { if (engine.current && ready) { notesRef.current.forEach(paintHL); repaintSR(); } }, [prefs.readerTheme]);
  // 书内搜索：边打字边搜（停顿 260ms 再开始），清空输入框 = 结束搜索
  useEffect(() => { const t = setTimeout(() => runSearch(query), query.trim() ? 260 : 0); return () => clearTimeout(t); }, [query]);
  useEffect(() => { setQuery(''); setFound(NO_FOUND); setHit(-1); srState.current = { hits: [], hit: -1 }; srPainted.current = new Set(); }, [id]);
  useEffect(() => () => searchRun.current?.abort(), []);
  useEffect(() => () => { clearTimeout(hideTimer.current); clearTimeout(toastTimer.current); }, []);
  useEffect(() => { try { localStorage.setItem(acctKey('librarium.tocPinned'), tocPinned ? '1' : '0'); } catch {} }, [tocPinned]);

  // 电脑：鼠标靠近上下沿呼出工具栏，靠近左右沿浮出翻页按钮
  const onPointerMove = (e) => {
    stamp();
    if (touch || e.pointerType === 'touch') return;
    const y = e.clientY, x = e.clientX, H = innerHeight, W = innerWidth, side = Math.min(150, W * .14);
    if (y < 72 || y > H - 96) showBars(1800);
    setEdge(x < side ? 'l' : x > W - side ? 'r' : '');
  };
  const marginTap = e => { if (ready && (e.target === e.currentTarget || e.target === stage.current)) act.current.tap(e.clientX / innerWidth); };

  const toPercent = (f) => `${Math.round(f * 1000) / 10}%`;
  const scrubLabel = (f) => [...ticks].reverse().find(t => t.fraction <= f + 1e-6)?.label || '';
  const jumpTo = (f) => { const b = engine.current?.book; if (b?.locations.length()) display(b.locations.cfiFromPercentage(f)); };
  const curTocIndex = useMemo(() => { let k = -1; toc.forEach((c, i) => { if (c.label === loc.chapter) k = i; }); return k; }, [toc, loc.chapter]);
  const tocList = useRef(null);
  useEffect(() => { if (panel === 'toc') setTimeout(() => tocList.current?.querySelector('.is-current')?.scrollIntoView({ block: 'center' }), 80); }, [panel]);

  // 搜索结果跳到当前那一条（从小胶囊点回来时）
  const srList = useRef(null);
  useEffect(() => { if (panel === 'search') setTimeout(() => srList.current?.querySelector('.is-current')?.scrollIntoView({ block: 'center' }), 80); }, [panel]);
  const srGroups = useMemo(() => {
    const groups = [];
    found.hits.forEach((h, i) => { const g = groups[groups.length - 1]; if (g && g.chapter === h.chapter) g.items.push(i); else groups.push({ chapter: h.chapter, items: [i] }); });
    return groups;
  }, [found.hits]);
  const srActive = found.hits.length > 0 && hit >= 0;

  // 电脑上目录和搜索结果都是左侧玻璃侧栏（长列表）；只有目录能固定
  const sidebar = !touch && (panel === 'toc' || panel === 'search');
  const pinned = sidebar && panel === 'toc' && tocPinned;
  const open = bars || (!!panel && !pinned);
  // 目录侧栏打开时底栏让位（不和侧栏底部叠在一起）；其它面板打开时底栏留着，可以直接切到别的标签
  const openBottom = bars || (!!panel && !sidebar);
  const leftInChapter = loc.pages ? Math.max(0, loc.pages - loc.page) : 0;

  const progressBar = (
    <div className="rd-progress">
      <div className="rd-slider">
        <div className="rd-track"><i style={{ width: toPercent(scrub ? scrub.f : loc.percent) }} /></div>
        {ticks.map((t, i) => <span key={i} className="rd-tick" style={{ left: toPercent(t.fraction) }} />)}
        <input type="range" min="0" max="1000" aria-label="跳到位置" value={Math.round((scrub ? scrub.f : loc.percent) * 1000)} disabled={!ticks.length}
          onChange={e => { const f = +e.target.value / 1000; setScrub({ f, label: scrubLabel(f) }); }}
          onPointerUp={() => { if (scrub) jumpTo(scrub.f); setScrub(null); }}
          onKeyUp={(e) => { if (scrub && /Arrow|Home|End|Page/.test(e.key)) { jumpTo(scrub.f); setScrub(null); } }} />
        {scrub && <span className="rd-bubble glass" style={{ left: toPercent(scrub.f) }}><b className="num">{toPercent(scrub.f)}</b><span>{scrub.label}</span></span>}
      </div>
      <span className="rd-pct num">{ticks.length ? toPercent(loc.percent) : '计算中'}</span>
    </div>
  );

  // 跳到某处之后的小胶囊：‹ 「远子」 3 / 47 › ✕ —— 不用再打开面板也能一处处往下看
  const srNav = srActive && (
    <div className="rd-srnav glass" onClick={e => e.stopPropagation()} onPointerMove={e => e.stopPropagation()}>
      <button className="rd-btn sm" onClick={() => goHit(hit - 1)} aria-label="上一处" title="上一处 (Shift+F3)">‹</button>
      <button className="rd-srnav-q" onClick={openSearch} title="回到搜索结果">
        <Icon name="search" size={14} /><span>{found.q}</span><b className="num">{hit + 1} / {found.hits.length}{found.more ? '+' : ''}</b>
      </button>
      <button className="rd-btn sm" onClick={() => goHit(hit + 1)} aria-label="下一处" title="下一处 (F3)">›</button>
      <button className="rd-btn sm" onClick={closeSearch} aria-label="结束搜索" title="结束搜索 (Esc)"><Icon name="close" size={14} /></button>
    </div>
  );
  const srStatus = !found.q ? '输入关键词，回车跳到下一处'
    : !found.done ? `正在搜索 ${found.scanned} / ${found.of} 章 · 已找到 ${found.hits.length} 处`
    : found.hits.length ? `共 ${found.hits.length} 处${found.more ? `（只列出前 ${SR_LIMIT} 处）` : ''}` : '这本书里没有找到';

  return (
    <main data-theme={['paper', 'sepia'].includes(prefs.readerTheme) ? 'light' : 'dark'} className={`reader2 ${touch ? 'is-touch' : 'is-desk'} ${open ? 'is-open' : ''} ${pinned ? 'has-sidebar' : ''} ${sidebar ? 'toc-open' : ''} ${srActive && !openBottom && !panel ? 'has-srnav' : ''} mode-${prefs.readerMode}`}
      onClick={marginTap} onPointerMove={onPointerMove} onPointerLeave={() => setEdge('')}
      style={{ background: theme.chrome, '--rd-page': theme.page, '--rd-text': theme.text, '--rd-link': theme.link }}>

      {/* 下拉书签：顶部露出的提示带 */}
      <div className="rd-pull" aria-hidden="true" style={{ height: pull, opacity: pull ? 1 : 0 }}>
        <span>{pull >= 72 ? (bookmarked ? '松手移除书签' : '松手添加书签') : '继续下拉加书签'}</span>
      </div>

      <div ref={stage} className="rd-stage" style={{ transform: pull ? `translate3d(0,${pull}px,0)` : undefined }}>
        <div className="rd-ambient rd-ambient-top">{loc.chapter || item?.title}</div>
        <div ref={host} className={`rd-content ${ready ? 'is-ready' : ''}`} aria-label="书籍正文" />
        <div className="rd-ambient rd-ambient-bottom">
          <span className="num">{prefs.readerMode === 'paginated' && loc.pages ? (leftInChapter ? `本章 ${loc.page} / ${loc.pages} · 还剩 ${leftInChapter} 页` : `本章 ${loc.page} / ${loc.pages} · 最后一页`) : ''}</span>
          <span className="num">{ticks.length ? toPercent(loc.percent) : ''}{ticks.length ? ' · ' : ''}<Clock /></span>
        </div>
      </div>

      {/* 书签丝带 */}
      <button className={`rd-ribbon ${bookmarked ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); toggleBookmark(); }} aria-label={bookmarked ? '移除本页书签' : '为本页加书签'} aria-pressed={bookmarked}>
        <svg viewBox="0 0 22 40" aria-hidden="true"><path d="M1 0h20v38l-10-8-10 8z" /></svg>
      </button>

      {srActive && !openBottom && !panel && <div className="rd-srnav-float">{srNav}</div>}

      {!ready && <div className="rd-status" role="status">{error || '正在翻开书页…'}{error && <button className="btn" onClick={back}>返回书架</button>}</div>}

      {/* 电脑：左右翻页按钮 */}
      {!touch && prefs.readerMode === 'paginated' && <>
        <button className={`rd-edge l glass ${edge === 'l' ? 'show' : ''}`} onClick={(e) => { e.stopPropagation(); turn(-1); }} aria-label="上一页"><Icon name="back" size={22} /></button>
        <button className={`rd-edge r glass ${edge === 'r' ? 'show' : ''}`} onClick={(e) => { e.stopPropagation(); turn(1); }} aria-label="下一页"><Icon name="back" size={22} style={{ transform: 'scaleX(-1)' }} /></button>
      </>}

      {/* 顶栏 */}
      <header data-tauri-drag-region="deep" className={`rd-top glass ${open ? 'show' : ''}`} onClick={e => e.stopPropagation()} onPointerEnter={() => !touch && showBars(0)} onPointerLeave={() => !touch && showBars(1200)}>
        <button className="rd-btn" onClick={back} aria-label="退出阅读"><Icon name="back" size={20} /><span className="hide-sm">书架</span></button>
        <div className="rd-title"><strong>{item?.title || 'EBOOK'}</strong><small>{loc.chapter}</small></div>
        <button className={`rd-btn ${panel === 'search' ? 'on' : ''}`} onClick={() => panel === 'search' ? setPanel('') : openSearch()} title="书内搜索 (Ctrl+F)" aria-label="书内搜索"><Icon name="search" size={18} /></button>
        {!touch && <button className={`rd-btn ${panel === 'toc' ? 'on' : ''}`} onClick={() => setPanel(p => p === 'toc' ? '' : 'toc')} title="目录 (T)"><Icon name="grid" size={18} /><span>目录</span></button>}
        <button className={`rd-btn ${bookmarked ? 'on' : ''}`} onClick={toggleBookmark} title="书签 (B)" aria-label="书签">
          <svg width="18" height="18" viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M6 3.5h12v17l-6-4.2-6 4.2z" /></svg>
        </button>
      </header>

      {/* 底栏：电脑是导航条，手机是四个标签 */}
      <footer className={`rd-bottom ${openBottom ? 'show' : ''}`} onClick={e => e.stopPropagation()} onPointerEnter={() => !touch && showBars(0)} onPointerLeave={() => !touch && showBars(1200)}>
        {(canReturn || (srActive && !panel)) && <div className="rd-chips">
          {canReturn && <button className="rd-return glass" onClick={goReturn}><Icon name="back" size={15} />回到原处</button>}
          {srActive && !panel && srNav}
        </div>}
        {!touch ? (
          <div className="rd-deskbar glass">
            <button className="rd-btn" onClick={() => chapterJump(-1)} title="上一章 ([)" aria-label="上一章">«</button>
            {progressBar}
            <button className="rd-btn" onClick={() => chapterJump(1)} title="下一章 (])" aria-label="下一章">»</button>
            <span className="rd-sep" />
            <LiquidTabs value={panel === 'toc' ? '' : panel} onChange={setPanel} items={[{ id: 'font', label: '字体' }, { id: 'theme', label: '纸张' }, { id: 'marks', label: '笔记' }]} />
          </div>
        ) : (
          <div className="rd-dock glass">
            <LiquidTabs value={panel} onChange={setPanel} className="dock" items={[{ id: 'toc', label: '目录', icon: 'grid' }, { id: 'progress', label: '进度', icon: 'explore' }, { id: 'marks', label: '笔记', icon: 'copy' }, { id: 'font', label: '字体', icon: 'book' }, { id: 'theme', label: '纸张', icon: 'sparkle' }]} />
          </div>
        )}
      </footer>

      {/* 面板 */}
      {panel && !pinned && <div className={`rd-scrim ${sidebar ? 'light' : ''}`} onClick={(e) => { e.stopPropagation(); setPanel(''); }} />}
      {panel && (
        <section key={sidebar ? `side-${panel}` : panel} className={`rd-panel glass ${sidebar ? 'as-sidebar' : 'as-pop'} panel-${panel}`} onClick={e => e.stopPropagation()} role="dialog" aria-label={{ toc: '目录', search: '书内搜索', progress: '进度', font: '字体', theme: '纸张', marks: '书签与笔记' }[panel]}>
          {panel === 'toc' && <>
            <div className="rd-panel-head">
              <h2 className="serif">目录</h2>
              {!touch && <button className={`rd-btn sm ${tocPinned ? 'on' : ''}`} onClick={() => setTocPinned(v => !v)} title="固定在左侧，边读边看">{tocPinned ? '已固定' : '固定'}</button>}
              <button className="rd-btn sm" onClick={() => setPanel('')} aria-label="关闭"><Icon name="close" size={16} /></button>
            </div>
            <div className="rd-panel-sub"><span className="num">已读 {toPercent(loc.percent)}</span><span className="num">{toc.length} 节</span></div>
            <ol ref={tocList} className="rd-toc">
              {toc.map((c, i) => (
                <li key={`${c.href}-${i}`} className={`${i === curTocIndex ? 'is-current' : ''} ${c.spine >= 0 && c.spine < loc.spine ? 'is-read' : ''}`} style={{ '--depth': c.depth }}>
                  <button onClick={() => { display(c.href); if (touch || !tocPinned) setPanel(''); }}>{c.label}</button>
                </li>
              ))}
              {!toc.length && <li className="rd-empty">这本书没有目录</li>}
            </ol>
          </>}

          {panel === 'search' && <>
            <div className="rd-panel-head">
              <h2 className="serif">书内搜索</h2>
              <button className="rd-btn sm" onClick={() => setPanel('')} aria-label="关闭"><Icon name="close" size={16} /></button>
            </div>
            <form className="rd-search" role="search" onSubmit={e => { e.preventDefault(); if (found.hits.length) { goHit(hit + 1); if (touch) { setPanel(''); setBars(false); } } }}>
              <Icon name="search" size={16} />
              <input ref={searchInput} autoFocus type="search" enterKeyHint="search" value={query} placeholder="在这本书里找…" aria-label="搜索关键词"
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setPanel(''); } }} />
              {query && <button type="button" className="rd-btn sm" onClick={() => { setQuery(''); searchInput.current?.focus(); }}>清空</button>}
            </form>
            <div className="rd-panel-sub" role="status"><span className="num">{srStatus}</span><span className="num">{found.hits.length ? `${srGroups.length} 章` : ''}</span></div>
            <ol ref={srList} className="rd-toc rd-results">
              {srGroups.map(g => (
                <li key={g.items[0]}>
                  <div className="rd-sr-chapter"><span>{g.chapter || '正文'}</span><span className="num">{g.items.length}</span></div>
                  <ol>
                    {g.items.map(i => {
                      const h = found.hits[i];
                      return (
                        <li key={i} className={i === hit ? 'is-current' : ''}>
                          <button onClick={() => { goHit(i); if (touch) { setPanel(''); setBars(false); } }}><span className="serif">{h.before}<mark>{h.match}</mark>{h.after}</span></button>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              ))}
              {found.done && found.q && !found.hits.length && <li className="rd-empty">没有找到「{found.q}」。<br />换个说法，或者少打几个字试试。</li>}
            </ol>
          </>}

          {panel === 'progress' && <div className="rd-progress-panel">
            <p className="rd-now serif">{loc.chapter || item?.title}</p>
            {progressBar}
            <div className="rd-row">
              <button className="rd-btn" onClick={() => chapterJump(-1)}>上一章</button>
              <button className="rd-btn" onClick={() => turn(-1)}>上一页</button>
              <button className="rd-btn" onClick={() => turn(1)}>下一页</button>
              <button className="rd-btn" onClick={() => chapterJump(1)}>下一章</button>
            </div>
          </div>}

          {panel === 'font' && <div className="rd-settings">
            <label>字体</label>
            <LiquidTabs value={prefs.readerFont} onChange={v => v && setPrefs({ readerFont: v })} items={Object.entries(READER_FONTS).map(([k, f]) => ({ id: k, label: f.label }))} />
            <label>字号 <span className="num">{prefs.fontSize}%</span></label>
            <div className="rd-stepper">
              <button className="rd-btn" onClick={() => setPrefs({ fontSize: Math.max(70, prefs.fontSize - 6) })} aria-label="字号减小"><span style={{ fontSize: 13 }}>A</span></button>
              <input type="range" min="70" max="200" step="2" value={prefs.fontSize} onChange={e => setPrefs({ fontSize: +e.target.value })} aria-label="字号" />
              <button className="rd-btn" onClick={() => setPrefs({ fontSize: Math.min(200, prefs.fontSize + 6) })} aria-label="字号增大"><span style={{ fontSize: 20 }}>A</span></button>
            </div>
            <label>行距</label>
            <LiquidTabs value={String(prefs.lineHeight)} onChange={v => v && setPrefs({ lineHeight: +v })} items={[['1.5', '紧凑'], ['1.85', '适中'], ['2.2', '宽松']].map(([v, l]) => ({ id: v, label: l }))} />
            <label>翻页方式</label>
            <LiquidTabs value={prefs.readerMode} onChange={v => v && setPrefs({ readerMode: v })} items={[{ id: 'paginated', label: '左右翻页' }, { id: 'scrolled', label: '上下滚动' }]} />
          </div>}

          {panel === 'theme' && <div className="rd-settings">
            <label>纸张</label>
            <div className="rd-papers">
              {Object.entries(READER_THEMES).map(([k, t]) => (
                <button key={k} className={prefs.readerTheme === k ? 'on' : ''} onClick={() => setPrefs({ readerTheme: k })} style={{ background: t.page, color: t.text }} aria-pressed={prefs.readerTheme === k}>
                  <span className="rd-paper-lines" /><b>{t.label}</b>
                </button>
              ))}
            </div>
          </div>}

          {panel === 'marks' && <>
            <div className="rd-panel-head"><h2 className="serif">书签与笔记</h2><button className="rd-btn sm" onClick={toggleBookmark}>{bookmarked ? '移除本页书签' : '＋ 本页书签'}</button></div>
            <div className="rd-panel-sub"><span className="num">{marks.length} 个书签</span><span className="num">{notes.length} 条划线</span></div>
            <ol className="rd-toc rd-notes">
              {marks.map(m => (
                <li key={m.ref} className="rd-mark">
                  <button onClick={() => { display(m.ref); setPanel(''); }}><span className="rd-mark-kind">书签</span>{m.label}<small className="num">{new Date(m.createdAt).toLocaleDateString('zh-CN')}</small></button>
                  <button className="rd-btn sm" aria-label="删除书签" onClick={async () => setMarks(await removeBookmark(id, m.ref))}><Icon name="close" size={14} /></button>
                </li>
              ))}
              {notes.map(n => (
                <li key={n.cfi} className="rd-mark rd-note" style={{ '--ink': INKS[n.color] }}>
                  <button onClick={() => { display(n.cfi); setPanel(''); }}>
                    <span className="rd-note-quote serif">{n.text.length > 80 ? n.text.slice(0, 80) + '…' : n.text}</span>
                    {n.note && <span className="rd-note-text">{n.note}</span>}
                    <small className="num">{n.chapter ? n.chapter + ' · ' : ''}{new Date(n.createdAt).toLocaleDateString('zh-CN')}</small>
                  </button>
                  <button className="rd-btn sm" aria-label="删除划线" onClick={() => dropHL(n.cfi)}><Icon name="close" size={14} /></button>
                </li>
              ))}
              {!marks.length && !notes.length && <li className="rd-empty">还没有书签和划线。<br />选中一段文字可以划线、写笔记；按 B 加书签。</li>}
            </ol>
          </>}
        </section>
      )}

      {sel && (() => {
        const W = innerWidth, above = sel.y > 120;
        const left = Math.max(12, Math.min(W - 12 - 300, sel.x - 150));
        return (
          <div className={`rd-sel glass ${above ? 'above' : 'below'}`} onClick={e => e.stopPropagation()} onMouseDown={e => e.preventDefault()}
            style={{ left, top: above ? sel.y - 12 : sel.bottom + 12, '--arrow': `${Math.max(16, Math.min(284, sel.x - left))}px` }}>
            <div className="rd-sel-inks">
              {Object.entries(INKS).map(([k, c]) => (
                <button key={k} className={sel.existing?.color === k ? 'on' : ''} style={{ '--c': c }} onClick={() => highlight(k)} aria-label={'划线 ' + k} />
              ))}
            </div>
            <span className="rd-sel-sep" />
            <button className="rd-btn sm" onClick={() => highlight(sel.existing?.color || 'gold', true)}><Icon name="book" size={15} />笔记</button>
            <button className="rd-btn sm" onClick={copySel}><Icon name="copy" size={15} />复制</button>
            {sel.existing && <button className="rd-btn sm" onClick={() => dropHL(sel.cfi)}><Icon name="trash" size={15} /></button>}
          </div>
        );
      })()}

      {draft && (
        <div className="rd-note-editor-wrap" onClick={e => { e.stopPropagation(); setDraft(null); }}>
          <form className="rd-note-editor glass" onClick={e => e.stopPropagation()}
            onSubmit={async (e) => { e.preventDefault(); setNotes(await saveNote(id, { cfi: draft.cfi, note: draft.note })); setDraft(null); say('笔记已保存'); }}>
            <p className="rd-note-quote serif">{draft.text.length > 120 ? draft.text.slice(0, 120) + '…' : draft.text}</p>
            <textarea autoFocus rows={4} value={draft.note} placeholder="写点什么…" onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.form.requestSubmit(); }} />
            <div className="rd-row2"><button type="button" className="rd-btn sm" onClick={() => setDraft(null)}>取消</button><button type="submit" className="btn btn-gold sm">保存 · Ctrl+Enter</button></div>
          </form>
        </div>
      )}

      {toast && <div className="rd-toast glass" role="status">{toast}</div>}
    </main>
  );
}
