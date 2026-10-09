// ③ 设计灵感站式瀑布流：多列错落 + 一格快切的"翻页书" + 悬停像素故障。
//   · 封面统一 5:7，错落感来自穿插的"文字卡"（简介摘句，衬线大字）和"翻页书"格
//   · 翻页书：插图版的封面每 0.26s 快切一次，进视口才翻、先解码好全部帧，标签显示序号
//   · 无限滚动：哨兵进入视口就多挂一页
//   · 分列：自己按列放（每张放进估计最矮的那一列），不用 CSS columns。CSS 多栏每加一页都要把全部卡片重新平衡一遍，
//     一次排两千多个元素、一帧七十多毫秒，而且已有的卡片会在栏之间跳。按顺序放的话前面的卡片位置只取决于前面的卡片，
//     加一页时旧卡片纹丝不动、只排新的那几张
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import Cover from '../components/Cover.jsx';
import { useCover } from '../lib/covers.js';
import { isTouch, prefersReduced } from '../lib/motion.js';
import { usePixelGlitch } from './usePixelGlitch.js';
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

const QuoteTile = memo(function QuoteTile({ book, line, onOpen }) {
  return (
    <div className="mw-tile mw-quote" role="button" tabIndex={0} onClick={(e) => onOpen(book, e.currentTarget)}>
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
  const [count, setCount] = useState(pageSize);
  const sentinel = useRef(null);
  useEffect(() => { setCount(pageSize); }, [books, pageSize]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setCount(c => Math.min(books.length, c + pageSize)); }, { rootMargin: '900px' });
    io.observe(el);
    return () => io.disconnect();
  }, [books.length, pageSize]);

  // 穿插：第 2 格放翻页书，之后每 9 本插一张文字卡
  const tiles = useMemo(() => {
    const out = [];
    books.slice(0, count).forEach((b, i) => {
      if (i === 2 && flip.length > 1) out.push({ kind: 'flip', key: 'flip' });
      const line = i > 0 && i % 9 === 5 && quoteLine(b);
      if (line) out.push({ kind: 'quote', key: 'q' + b.id, book: b, line });
      out.push({ kind: 'book', key: b.id, book: b, index: i });
    });
    return out;
  }, [books, count, flip.length]);

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
              : t.kind === 'quote' ? <QuoteTile key={t.key} book={t.book} line={t.line} onOpen={onOpen} />
              : <BookTile key={t.key} book={t.book} index={t.index} onOpen={onOpen} />)}
          </div>
        ))}
      </div>
      {count < books.length && <div ref={sentinel} className="mw-more muted">继续往下翻…</div>}
    </div>
  );
});
