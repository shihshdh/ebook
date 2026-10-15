import { useEffect, useRef, useState } from 'react';
import { LiquidSpring, prefersReduced } from '../lib/motion';
import { mobileUI } from '../lib/native';
import Icon from '../components/Icon.jsx';
const FLING = .2, DIST = 40;
export function swipeDir(dx, track, x, t) {
  const from = track.find(([, tt]) => t - tt <= 100);   // 松手前 100ms 内最早的点；手指停住不动再松手就没有，速度算 0
  const v = from && t - from[1] >= 8 ? (x - from[0]) / (t - from[1]) : 0;
  if (Math.abs(v) >= FLING) return Math.sign(v) === Math.sign(dx) ? -Math.sign(dx) : 0;
  return Math.abs(dx) >= DIST ? -Math.sign(dx) : 0;
}
/** 液态分段选择：选中态是一滴会流动的玻璃（左右两条边各挂一根弹簧，前沿先冲、后沿慢半拍） */
export function LiquidTabs({ items, value, onChange, className = '' }) {
  const track = useRef(null), thumb = useRef(null), spring = useRef(null), raf = useRef(0);
  const index = items.findIndex(i => i.id === value);
  useEffect(() => {
    const el = track.current?.querySelectorAll('[data-seg]')[index];
    const th = thumb.current;
    if (!th) return;
    if (!el) { th.style.opacity = '0'; return; }
    th.style.opacity = '1';
    const target = { left: el.offsetLeft, right: el.offsetLeft + el.offsetWidth };
    if (mobileUI || !spring.current || prefersReduced()) {   // 手机：滑块的移动交给 CSS 过渡（mobile.css，带回弹）
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

export function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 30000); return () => clearInterval(i); }, []);
  return <span className="num">{t.toTimeString().slice(0, 5)}</span>;
}

