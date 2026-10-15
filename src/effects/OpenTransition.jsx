// ① Dream Machine 式"镜头推进"：打开一本书时，封面原地长成全屏。
// clip-path: inset(...) round R 从封面的矩形插值到全屏，圆角同时收小；
// 封面图跟着放大、慢慢淡出，露出阅读器主题色的底——然后切路由，阅读器在同色背景上淡入，接缝看不见。
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../lib/ui.jsx';
import { getPrefs, READER_THEMES } from '../lib/prefs.js';
import { prefersReduced } from '../lib/motion.js';
import { comicShelfLocation } from '../comic/book.js';
import { mobileUI } from '../lib/native.js';

export default function OpenTransition() {
  const { opening, endOpening } = useUI();
  const navigate = useNavigate();
  const layer = useRef(null);

  useEffect(() => {
    if (!opening) return;
    const el = layer.current;
    const go = () => {
      if (opening.item.ext === 'comic') {
        const { pathname, state } = comicShelfLocation(opening.item, opening.item.openAt);
        navigate(pathname, { state });
      } else navigate(`/read/${encodeURIComponent(opening.item.id)}`);
    };
    if (!el || prefersReduced()) { go(); endOpening(); return; }
    if (mobileUI) {
      // 手机：封面原地放大铺满屏幕（iOS 的缩放转场），只动 transform / opacity，交给合成线程；
      // 阅读器同时开始加载（下一帧就切路由），它第一次渲染再重，放大也不卡，也不用像电脑那样先等 700ms
      const W = innerWidth, H = innerHeight;
      const r = opening.rect || { left: W / 2 - 60, top: H / 2 - 84, width: 120, height: 168 };
      const img = el.querySelector('img'), bg = el.querySelector('.open-bg');
      const a = r.width / r.height, fw = Math.max(W, H * a), fh = fw / a, s0 = r.width / fw;
      const cx = r.left + r.width / 2 - W / 2, cy = r.top + r.height / 2 - H / 2;
      const ease = 'cubic-bezier(.32,.72,0,1)';
      const anims = [];
      if (bg) anims.push(bg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out', fill: 'forwards' }));
      if (img) {
        // 圆角写死成「缩小时 6px」：铺满时正好接近 iPhone 屏幕的圆角；不做圆角动画（那要逐帧重画整张大图）
        img.style.width = fw + 'px'; img.style.height = fh + 'px'; img.style.borderRadius = `${6 / s0}px`;
        anims.push(img.animate([
          { transform: `translate(${cx}px,${cy}px) scale(${s0})`, opacity: 1 },
          { transform: 'translate(0,0) scale(1)', opacity: 1, offset: .72 },
          { transform: 'translate(0,0) scale(1.04)', opacity: 0 },
        ], { duration: 640, easing: ease, fill: 'forwards' }));
      }
      const t = requestAnimationFrame(() => setTimeout(go, 0));
      const t2 = setTimeout(() => {
        anims.push(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out', fill: 'forwards' }));
        anims.at(-1).onfinish = endOpening;
      }, 620);
      return () => { cancelAnimationFrame(t); clearTimeout(t2); };
    }
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
    <div ref={layer} className="open-layer" style={{ background: mobileUI ? undefined : theme.chrome }} aria-hidden="true">
      {mobileUI && <div className="open-bg" style={{ position: 'absolute', inset: 0, background: theme.chrome, opacity: 0 }} />}
      {opening.cover && <img src={opening.cover} alt="" />}
    </div>
  );
}
