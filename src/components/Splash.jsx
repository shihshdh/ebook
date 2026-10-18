// R12 · two geometric directions; switch to 'unfold' for the alternative.
import { useLayoutEffect, useRef } from 'react';
import { prefersReduced } from '../lib/motion.js';
export const SPLASH_DIRECTION = 'unfold';
export const SPLASH_DURATION = 2800;
const KEY = 'librarium.splash';
export function shouldShowSplash() {
  try { return !sessionStorage.getItem(KEY); } catch { return true; }
}
export default function Splash({ onDone }) {
  const done = useRef(false);
  const root = useRef(null);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    try { sessionStorage.setItem(KEY, '1'); } catch {}
    onDone?.();
  };
  useLayoutEffect(() => {
    document.documentElement.removeAttribute('data-splash-boot');
    const skip = () => finish();
    window.addEventListener('keydown', skip);
    // CSS runs on the compositor; this timer is a cleanup fallback.
    const timer = setTimeout(finish, prefersReduced() ? 500 : SPLASH_DURATION + 120);
    return () => { clearTimeout(timer); window.removeEventListener('keydown', skip); };
  }, []);
  return (
    <div ref={root} className={`splash splash-${SPLASH_DIRECTION}`} onClick={finish}
      onAnimationEnd={e => { if (e.target === root.current) finish(); }} role="presentation">
      <svg className="splash-symbol" viewBox="0 0 1024 1024" aria-hidden="true">
        <defs><clipPath id="splash-left"><rect width="512" height="1024" /></clipPath>
          <clipPath id="splash-right"><rect x="512" width="512" height="1024" /></clipPath>
          <path id="splash-book" d="M276 230H748Q772 230 772 254V770Q772 794 748 794H276Q252 794 252 770V254Q252 230 276 230Z M438 230V568L512 514L586 568V230Z" fillRule="evenodd" />
        </defs>
        <g className="splash-half splash-left" clipPath="url(#splash-left)"><use href="#splash-book" /></g>
        <g className="splash-half splash-right" clipPath="url(#splash-right)"><use href="#splash-book" /></g>
      </svg>
      <span className="splash-caption" aria-hidden="true">EBOOK</span>
      <button className="splash-skip" onClick={e => { e.stopPropagation(); finish(); }}>跳过</button>
    </div>
  );
}
