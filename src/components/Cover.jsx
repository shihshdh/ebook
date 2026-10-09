// 封面图：先给生成封面，进入视口后再去查真封面，查到就无缝替换
import { forwardRef, memo, useEffect, useRef, useState } from 'react';
import { useCover } from '../lib/covers.js';

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

const Cover = memo(forwardRef(function Cover({ book, className = '', alt, eager = false, imgRef, ...rest }, ref) {
  const box = useRef(null);
  const [visible, setVisible] = useState(eager);
  const watched = useRef({ near: eager, start: () => setVisible(true) });
  useEffect(() => {
    const el = box.current;
    if (!el || !startIO) return;
    watch.set(el, watched.current);
    if (!eager) startIO.observe(el);
    nearIO.observe(el);
    return () => { startIO.unobserve(el); nearIO.unobserve(el); watch.delete(el); };
  }, [eager]);
  const near = () => watched.current.near;
  const { url, real, onError } = useCover(book, visible, near);
  return (
    <span ref={(el) => { box.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; }}
      className={`cover ${real ? 'is-real' : 'is-gen'} ${className}`} {...rest}>
      <img ref={imgRef} src={url} alt={alt ?? book?.title ?? ''} loading={eager ? 'eager' : 'lazy'} decoding="async" draggable="false" onError={onError} />
    </span>
  );
}));
export default Cover;
