// ③ 设计灵感站式瀑布流：多列错落 + 一格快切的"翻页书" + 悬停像素故障。
//   · 封面统一 5:7，错落感来自穿插的"文字卡"（简介摘句，衬线大字）和"翻页书"格
//   · 翻页书：插图版的封面每 0.26s 快切一次，进视口才翻、先解码好全部帧，标签显示序号
//   · 无限滚动：哨兵离视口还有两屏就多挂一页
//   · 分列：自己按列放（每张放进估计最矮的那一列），不用 CSS columns。CSS 多栏每加一页都要把全部卡片重新平衡一遍，
//     一次排两千多个元素、一帧七十多毫秒，而且已有的卡片会在栏之间跳。按顺序放的话前面的卡片位置只取决于前面的卡片，
//     加一页时旧卡片纹丝不动、只排新的那几张
import { memo, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import Cover from '../components/Cover.jsx';
import { useCover } from '../lib/covers.js';
import { isTouch, prefersReduced } from '../lib/motion.js';
import { usePixelGlitch } from './usePixelGlitch.js';
import { atMost, loadSerif } from '../lib/fonts.js';
import './MasonryWall.css';

// 卡片和整面墙都 memo：点世界、改筛选时上面整页重渲染，书单没变的话这里一张都不用重来（手机上一次七八十毫秒）
const BookTile = memo(function BookTile({ book, onOpen, index }) {
  const tile = useRef(null), canvas = useRef(null);
  usePixelGlitch(tile, canvas);
  return (
    <figure ref={tile} className="mw-tile" style={{ '--i': index % 12 }} onClick={() => onOpen(book, tile.current)}
      role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(book, tile.current); }} aria-label={book.title}>
      <Cover book={book} alt="" />
      <canvas ref={canvas} className="mw-glitch" aria-hidden="true" />
      {book.illustrated ? <span className="mw-badge">插图</span> : book.taiban ? <span className="mw-badge is-taiban" title="台版 EPUB，带官方彩插">台版</span> : null}
      <figcaption>
        <strong>{book.title}</strong>
        <span>{book.author}{book.status ? ` · ${book.status}` : ''}</span>
      </figcaption>
    </figure>
  );
});

const quoteLine = (book) => (book.description || '').replace(/…$/, '').split(/[。！？]/).filter(s => s.length > 8)[0];

// 文字卡也是 content-visibility: auto（见 MasonryWall.css）：没排过时按估计的高度 h 占位，排过一次记住实际高度
const QuoteTile = memo(function QuoteTile({ book, line, h, onOpen }) {
  return (
    <div className="mw-tile mw-quote" style={{ containIntrinsicSize: `auto ${h}px` }} role="button" tabIndex={0} onClick={(e) => onOpen(book, e.currentTarget)}>
      <p className="serif">{line.slice(0, 46)}<span className="mw-dot" aria-hidden="true" />。</p>
      <small>—《{book.title}》</small>
    </div>
  );
});

function FlipFrame({ book, active }) {
  const { url, onError } = useCover(book, true);
  return <img src={url} alt="" className={active ? 'on' : ''} decoding="async" draggable="false" onError={onError} />;
}

function FlipbookTile({ books, onOpen }) {
  const ref = useRef(null);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReduced() || books.length < 2) return;
    let timer = 0;
    const io = new IntersectionObserver(([e]) => {
      clearInterval(timer);
      if (e.isIntersecting) timer = setInterval(() => setFrame(f => (f + 1) % books.length), 260);
    }, { threshold: .2 });
    io.observe(el);
    return () => { io.disconnect(); clearInterval(timer); };
  }, [books.length]);
  const cur = books[frame];
  return (
    <figure ref={ref} className="mw-tile mw-flip" role="button" tabIndex={0} onClick={() => onOpen(cur, ref.current)}
      aria-label="插图重制版轮播，点击打开当前这本">
      {/* 所有帧叠在一起只切 opacity：提前解码，快切不闪白 */}
      {books.map((b, i) => <FlipFrame key={b.id} book={b} active={i === frame} />)}
      <figcaption className="always">
        <strong>插图重制 · {cur?.title}</strong>
        <span className="num">{String(frame + 1).padStart(2, '0')} / {String(books.length).padStart(2, '0')}</span>
      </figcaption>
    </figure>
  );
}

// 一次铺多少张：手机一屏只看得到七八张，先铺 18 张、滚到附近再补（以前一上来 48 张，第一次进探索页手机上要卡一秒）
const PAGE = isTouch() ? 18 : 36;
// 衬线字一次预取几页（为什么见 lib/fonts.js）。每个分片下到时浏览器都要把屏幕附近所有衬线字重排一遍
// （手机上 4 倍降速十几到二十几毫秒），哪怕下到的字页面上还没有。所以不一页一页地下，攒够几页一起下：
// 到达挤在一起，同一帧里到的只重排一次。往后每页平均只多一两个分片，多下几页没多少流量
const FONT_PAGES = 4;
// 哨兵到了、下一页的衬线字还没下好时，最多等多久再挂（网络慢、离线时照样挂，字先用后备字体顶着）
const FONT_WAIT = 500;

// 穿插：第 2 格放翻页书，之后每 9 本插一张文字卡。from / to 是书的序号范围
function tilesOf(books, from, to, hasFlip) {
  const out = [];
  books.slice(from, to).forEach((b, k) => {
    const i = from + k;
    if (i === 2 && hasFlip) out.push({ kind: 'flip', key: 'flip' });
    const line = i > 0 && i % 9 === 5 && quoteLine(b);
    if (line) out.push({ kind: 'quote', key: 'q' + b.id, book: b, line });
    out.push({ kind: 'book', key: b.id, book: b, index: i });
  });
  return out;
}
// 卡片上用衬线字的：书名、摘句（作者行、出处行是无衬线的系统字，不用下）
const serifText = (tiles) => tiles.map(t => t.kind === 'quote' ? t.line.slice(0, 46) + '。' : t.kind === 'book' ? t.book.title : '').join('');
// 和原来的 CSS 一致：宽屏最多 5 列、每列至少 200px，窄屏（≤760px）2 列
const narrowMQ = '(max-width: 760px)';
const layoutFor = (width) => {
  const narrow = matchMedia(narrowMQ).matches, gap = narrow ? 10 : 16;
  const n = narrow ? 2 : Math.max(1, Math.min(5, Math.floor((width + gap) / (200 + gap))));
  return { n, gap, colW: (width - gap * (n - 1)) / n, narrow };
};
// 估计一张卡多高（只用来决定放哪一列，差一点也没关系）：封面卡 5:7；文字卡按字数、字号、列宽算行数
function estimate(t, { colW, narrow }) {
  if (t.kind !== 'quote') return colW * 7 / 5;
  const size = narrow ? 17 : 21, perLine = Math.max(4, Math.floor((colW - 40) / size));
  return 22 + Math.ceil((t.line.slice(0, 46).length + 2) / perLine) * size * 1.5 + 14 + 20 + 18 + 2;
}

export default memo(function MasonryWall({ books, onOpen, flip = [], pageSize = PAGE }) {
  // 铺了几本。换了书单就从第一页重新铺——当场算，不等 effect：等 effect 的话新书单先按旧的张数整个渲染、排一遍，下一帧再砍掉
  const [shown, setShown] = useState({ books, n: pageSize });
  const count = shown.books === books ? shown.n : pageSize;
  const sentinel = useRef(null);

  // 衬线字先下好再上屏（为什么见 lib/fonts.js）：书名、摘句要用的分片一次下 FONT_PAGES 页，下一页快不在里面了再下一批；
  // 哨兵到了等它下完再挂（一般早下完了，最多等 FONT_WAIT）。没下好就挂，挂上那一帧要逐字现查后备字体，手机上几十毫秒
  const fonts = useRef({ books: null, to: 0, ready: null });   // 这份书单的前 to 本已经在下（或下好了）
  useEffect(() => {
    const f = fonts.current;
    if (f.books !== books) Object.assign(f, { books, to: 0, ready: Promise.resolve() });
    if (count + 2 * pageSize <= f.to) return;   // 下一页、再下一页的都已经在下了
    const to = Math.max(f.to, count) + FONT_PAGES * pageSize;
    f.ready = Promise.all([f.ready, loadSerif(serifText(tilesOf(books, f.to, to, flip.length > 1)))]);
    f.to = to;
  }, [books, count, pageSize, flip.length]);
  useEffect(() => { loadSerif('插图重制 · ' + flip.map(b => b.title).join('')); }, [flip]);   // 翻页书每 0.26s 换一个书名
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    let alive = true, waiting = false;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || waiting) return;
      waiting = true;
      atMost(fonts.current.ready, FONT_WAIT).then(() => {
        waiting = false;
        // 后台分片渲染（React 每 5ms 让一次主线程）：一页十几张卡一口气渲染要二三十毫秒（手机上）
        if (alive) startTransition(() => setShown(s => ({ books, n: Math.min(books.length, (s.books === books ? s.n : pageSize) + pageSize) })));
      });
      // 提前两屏挂：比 content-visibility: auto 的「附近」（Chrome 是视口上下各 1.5 屏）还远，新挂的卡片先只占位、不排版，
      // 滚过去时一两张一两张地排。以前提前 900px，新卡片一挂上就在附近，挂上那一帧连排带画整页卡片
    }, { rootMargin: '200% 0px' });
    io.observe(el);
    return () => { alive = false; io.disconnect(); };
  }, [books, pageSize]);

  const tiles = useMemo(() => tilesOf(books, 0, count, flip.length > 1), [books, count, flip.length]);

  // 列数、列宽跟着容器宽度走。起步按版心宽度算（视口减两边 --gutter: clamp(16px, 4vw, 56px)），不读 DOM：
  // 挂载时一读 clientWidth 就逼浏览器当场把整页排一遍（第一次进探索页那一帧四十多毫秒，后台预渲染时也会被拖着排版）。
  // 之后 ResizeObserver 报实际宽度（浏览器排完版顺手给的，不额外花钱），差了再改
  const grid = useRef(null);
  const [layout, setLayout] = useState(() => layoutFor(innerWidth - 2 * Math.min(56, Math.max(16, innerWidth * .04))));
  useEffect(() => {
    const el = grid.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      if (w > 0) setLayout(prev => { const next = layoutFor(w); return next.n === prev.n && Math.abs(next.colW - prev.colW) < .5 ? prev : next; });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const columns = useMemo(() => {
    const cols = Array.from({ length: layout.n }, () => []), heights = new Array(layout.n).fill(0);
    for (const t of tiles) {
      const i = heights.indexOf(Math.min(...heights));
      cols[i].push(t);
      heights[i] += estimate(t, layout) + layout.gap;
    }
    return cols;
  }, [tiles, layout]);

  return (
    <div className="mw">
      <div ref={grid} className="mw-grid">
        {columns.map((col, c) => (
          <div key={c} className="mw-col">
            {col.map(t => t.kind === 'flip' ? <FlipbookTile key={t.key} books={flip} onOpen={onOpen} />
              : t.kind === 'quote' ? <QuoteTile key={t.key} book={t.book} line={t.line} h={Math.round(estimate(t, layout))} onOpen={onOpen} />
              : <BookTile key={t.key} book={t.book} index={t.index} onOpen={onOpen} />)}
          </div>
        ))}
      </div>
      {count < books.length && <div ref={sentinel} className="mw-more muted">继续往下翻…</div>}
    </div>
  );
});
