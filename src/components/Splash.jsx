// 开屏：和 Noël、ORACULUM 同一个套路——
//   书形标志描线 → 字标逐字浮现（字距收拢）→ 一道金线展开、副标题手写显现 → 字标飞进顶栏，夜幕退去
// 每个会话只播一次；点击 / 任意键跳过；减少动态效果时只做交叉淡入淡出。
import { useEffect, useRef, useState } from 'react';
import { prefersReduced } from '../lib/motion.js';

const KEY = 'librarium.splash';
const LETTERS = 'EBOOK'.split('');

export function shouldShowSplash() {
  try { return !sessionStorage.getItem(KEY); } catch { return true; }
}

export default function Splash({ onDone }) {
  const root = useRef(null);
  const mark = useRef(null);
  const [phase, setPhase] = useState('in'); // in → fly → out
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    try { sessionStorage.setItem(KEY, '1'); } catch {}
    onDone?.();
  };

  const fly = () => {
    if (phase !== 'in') return;
    setPhase('fly');
    const from = mark.current?.getBoundingClientRect();
    const target = document.querySelector('[data-wordmark] .wordmark-latin');
    const to = target?.getBoundingClientRect();
    if (from && to && to.width > 0 && !prefersReduced()) {
      // FLIP：字标从屏幕中央缩放平移到顶栏字标的位置
      const s = to.height / from.height;
      const dx = to.left - from.left, dy = to.top - from.top;
      mark.current.style.transformOrigin = '0 0';
      mark.current.animate([{ transform: 'none' }, { transform: `translate(${dx}px,${dy}px) scale(${s})` }],
        { duration: 760, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'forwards' });
    }
    setTimeout(() => setPhase('out'), prefersReduced() ? 100 : 620);
    setTimeout(finish, prefersReduced() ? 500 : 1180);
  };

  useEffect(() => {
    let t1;
    // Cinzel 到位后再开始，避免字标量到后备字体的宽度
    const start = () => { t1 = setTimeout(fly, prefersReduced() ? 900 : 2300); };
    (document.fonts?.load?.('600 40px Cinzel') || Promise.resolve()).catch(() => {}).finally(start);
    const skip = () => fly();
    window.addEventListener('keydown', skip);
    // 保险：最多挡 6 秒
    const guard = setTimeout(finish, 6000);
    return () => { clearTimeout(t1); clearTimeout(guard); window.removeEventListener('keydown', skip); };
  }, []);

  return (
    <div ref={root} className={`splash is-${phase}`} onClick={fly} role="presentation">
      <div className="splash-stage">
        <svg className="splash-glyph" viewBox="0 0 120 80" aria-hidden="true">
          <path className="g1" d="M60 18 C46 10 28 9 10 14 V68 C28 63 46 64 60 72" />
          <path className="g2" d="M60 18 C74 10 92 9 110 14 V68 C92 63 74 64 60 72" />
          <path className="g3" d="M60 18 V72" />
          <path className="g4" d="M22 26 C32 24 42 25 50 29 M22 36 C32 34 42 35 50 39 M70 29 C78 25 88 24 98 26 M70 39 C78 35 88 34 98 36" />
        </svg>
        <div ref={mark} className="splash-mark">
          {LETTERS.map((ch, i) => <span key={i} style={{ '--i': i }}>{ch}</span>)}
        </div>
        <div className="splash-rule" aria-hidden="true" />
        <div className="splash-cn serif">轻 小 说 书 库</div>
        <div className="splash-sub eyebrow">light novels · epub · {new Date().getFullYear()}</div>
      </div>
      <button className="splash-skip" onClick={(e) => { e.stopPropagation(); fly(); }}>跳过</button>
    </div>
  );
}
