// 封面图：先给生成封面，进入视口后再去查真封面，查到就无缝替换
import { forwardRef, useEffect, useRef, useState } from 'react';
import { useCover } from '../lib/covers.js';

const Cover = forwardRef(function Cover({ book, className = '', alt, eager = false, imgRef, ...rest }, ref) {
  const box = useRef(null);
  const [visible, setVisible] = useState(eager);
  useEffect(() => {
    if (eager || !box.current) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(box.current);
    return () => io.disconnect();
  }, [eager]);
  // 排队加载时判断这本此刻在不在屏幕附近（上下各留半屏），屏幕上的先加载
  const near = () => { const r = box.current?.getBoundingClientRect(); return !!r && r.bottom > -innerHeight / 2 && r.top < innerHeight * 1.5 && r.right > 0 && r.left < innerWidth; };
  const { url, real, onError } = useCover(book, visible, near);
  return (
    <span ref={(el) => { box.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; }}
      className={`cover ${real ? 'is-real' : 'is-gen'} ${className}`} {...rest}>
      <img ref={imgRef} src={url} alt={alt ?? book?.title ?? ''} loading={eager ? 'eager' : 'lazy'} decoding="async" draggable="false" onError={onError} />
    </span>
  );
});
export default Cover;
