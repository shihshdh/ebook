// ① Dream Machine 式"镜头推进"：打开一本书时，封面原地长成全屏。
// clip-path: inset(...) round R 从封面的矩形插值到全屏，圆角同时收小；
// 封面图跟着放大、慢慢淡出，露出阅读器主题色的底——然后切路由，阅读器在同色背景上淡入，接缝看不见。
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../lib/ui.jsx';
import { getPrefs, READER_THEMES } from '../lib/prefs.js';
import { prefersReduced } from '../lib/motion.js';

export default function OpenTransition() {
  const { opening, endOpening } = useUI();
  const navigate = useNavigate();
  const layer = useRef(null);

  useEffect(() => {
    if (!opening) return;
    const el = layer.current;
    const go = () => navigate(`/read/${encodeURIComponent(opening.item.id)}`);
    if (!el || prefersReduced()) { go(); endOpening(); return; }
    const W = innerWidth, H = innerHeight;
    const r = opening.rect || { left: W / 2 - 60, top: H / 2 - 84, width: 120, height: 168, right: W / 2 + 60, bottom: H / 2 + 84 };
    const from = `inset(${r.top}px ${W - r.right}px ${H - r.bottom}px ${r.left}px round 10px)`;
    const to = 'inset(0px 0px 0px 0px round 0px)';
    const img = el.querySelector('img');
    // 封面图按"铺满屏幕"的最终尺寸渲染，起始时缩到封面框大小——全程是缩小的大图，不会被放大糊掉
    const a = r.width / r.height;
    const fw = Math.max(W, H * a), fh = fw / a;
    const s0 = r.width / fw;
    const cx = r.left + r.width / 2 - W / 2, cy = r.top + r.height / 2 - H / 2;
    const ease = 'cubic-bezier(.7,0,.2,1)';
    el.animate([{ clipPath: from }, { clipPath: to }], { duration: 760, easing: ease, fill: 'forwards' });
    if (img) {
      img.style.width = fw + 'px'; img.style.height = fh + 'px';
      img.animate([
        { transform: `translate(${cx}px,${cy}px) scale(${s0})`, opacity: 1, filter: 'blur(0px)' },
        { transform: 'translate(0,0) scale(.94)', opacity: 1, offset: .7, filter: 'blur(0px)' },
        { transform: 'translate(0,0) scale(1.02)', opacity: 0, filter: 'blur(8px)' },
      ], { duration: 1000, easing: ease, fill: 'forwards' });
    }
    const t1 = setTimeout(go, 700);
    const t2 = setTimeout(() => {
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease-out', fill: 'forwards' }).onfinish = endOpening;
    }, 1150);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [opening]);

  if (!opening) return null;
  const theme = READER_THEMES[getPrefs().readerTheme] || READER_THEMES.night;
  return (
    <div ref={layer} className="open-layer" style={{ background: theme.chrome }} aria-hidden="true">
      {opening.cover && <img src={opening.cover} alt="" />}
    </div>
  );
}
