// 封面图：先给生成封面，进入视口后再去查真封面，查到就无缝替换
import { forwardRef, memo, useEffect, useRef, useState } from 'react';
import { useCover } from '../lib/covers.js';
import { jacketPalette } from '../lib/jacket-art.js';
import { jacketScale } from '../lib/jacket.js';

// 生成封面还没画好、真封面也没到时：图片给一张透明小图（不显示替代文字、不触发出错），底下垫这本书书衣的底色渐变
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// memo：上层重渲染、这本书没变时不重来（一页几十个封面，每个都带好几个 hook）
// 全部封面共用两个 IntersectionObserver（一页几十个封面，各开各的观察器白白多几十份开销）：
//   start：离屏幕上下 800px 内就开始找真封面——滚到之前图已经在路上了（以前 200px，往下翻常看到生成的书衣再换）
//   near ：此刻在不在屏幕上（上下各宽出四分之一屏）。排队时屏幕上的先加载；以前每次排队都对每本 getBoundingClientRect，
//          滚动中一批图片下完、排队挑下一本时会逼浏览器同步排版
const watch = new Map();   // 元素 → { start(), near }
const startIO = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { const w = watch.get(e.target); if (w) { w.start(); startIO.unobserve(e.target); } }
}, { rootMargin: '800px 600px' });
const nearIO = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
  for (const e of entries) { const w = watch.get(e.target); if (w) w.near = e.isIntersecting; }
}, { rootMargin: '25% 0px' });
//   size ：封面显示多大，生成封面按这个画（jacket.js 的三档）。只往大里换：悬停放大、光盘抬起这种变化不重画
const sizeRO = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver((entries) => {
  for (const e of entries) { const w = watch.get(e.target); if (w && e.contentRect.width > 0) w.size(jacketScale(e.contentRect.width)); }
});

const Cover = memo(forwardRef(function Cover({ book, className = '', alt, eager = false, imgRef, ...rest }, ref) {
  const box = useRef(null);
  const [visible, setVisible] = useState(eager);
  const [scale, setScale] = useState(0);
  const watched = useRef({ near: eager, start: () => setVisible(true), size: (s) => setScale(prev => Math.max(prev, s)) });
  useEffect(() => {
    const el = box.current;
    if (!el || !startIO) return;
    watch.set(el, watched.current);
    if (!eager) startIO.observe(el);
    nearIO.observe(el);
    sizeRO?.observe(el);
    if (!sizeRO) watched.current.size(jacketScale(180));
    return () => { startIO.unobserve(el); nearIO.unobserve(el); sizeRO?.unobserve(el); watch.delete(el); };
  }, [eager]);
  const near = () => watched.current.near;
  const { url, real, onError } = useCover(book, visible, near, scale);
  const j = !real && book ? jacketPalette(book) : null;
  const style = j ? { background: `linear-gradient(to bottom right, ${j.bg}, ${j.bg2})`, ...rest.style } : rest.style;
  return (
    <span ref={(el) => { box.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; }}
      className={`cover ${real ? 'is-real' : 'is-gen'} ${className}`} {...rest} style={style}>
      <img ref={imgRef} src={url || BLANK} alt={url ? alt ?? book?.title ?? '' : ''} loading={eager ? 'eager' : 'lazy'} decoding="async" draggable="false" onError={onError} />
    </span>
  );
}));
export default Cover;
