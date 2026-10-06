// ③ 设计灵感站式瀑布流：多列错落 + 一格快切的"翻页书" + 悬停像素故障。
//   · 封面统一 5:7，错落感来自穿插的"文字卡"（简介摘句，衬线大字）和"翻页书"格
//   · 翻页书：插图版的封面每 0.26s 快切一次，进视口才翻、先解码好全部帧，标签显示序号
//   · 无限滚动：哨兵进入视口就多挂 48 本
import { useEffect, useMemo, useRef, useState } from 'react';
import Cover from '../components/Cover.jsx';
import { useCover } from '../lib/covers.js';
import { prefersReduced } from '../lib/motion.js';
import { usePixelGlitch } from './usePixelGlitch.js';
import './MasonryWall.css';

function BookTile({ book, onOpen, index }) {
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
}

function QuoteTile({ book, onOpen }) {
  const line = (book.description || '').replace(/…$/, '').split(/[。！？]/).filter(s => s.length > 8)[0];
  if (!line) return null;
  return (
    <div className="mw-tile mw-quote" role="button" tabIndex={0} onClick={(e) => onOpen(book, e.currentTarget)}>
      <p className="serif">{line.slice(0, 46)}<span className="mw-dot" aria-hidden="true" />。</p>
      <small>—《{book.title}》</small>
    </div>
  );
}

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

export default function MasonryWall({ books, onOpen, flip = [], pageSize = 48 }) {
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
      if (i > 0 && i % 9 === 5 && b.description) out.push({ kind: 'quote', key: 'q' + b.id, book: b });
      out.push({ kind: 'book', key: b.id, book: b, index: i });
    });
    return out;
  }, [books, count, flip.length]);

  return (
    <div className="mw">
      <div className="mw-grid">
        {tiles.map(t => t.kind === 'flip' ? <FlipbookTile key={t.key} books={flip} onOpen={onOpen} />
          : t.kind === 'quote' ? <QuoteTile key={t.key} book={t.book} onOpen={onOpen} />
          : <BookTile key={t.key} book={t.book} index={t.index} onOpen={onOpen} />)}
      </div>
      {count < books.length && <div ref={sentinel} className="mw-more muted">继续往下翻…</div>}
    </div>
  );
}
