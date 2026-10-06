// 导航：桌面是顶部一条玻璃胶囊，手机是底部玻璃标签栏——同一个组件，只是排版不同。
// 选中态是一滴会流动的玻璃（LiquidSpring：前沿先冲、后沿慢半拍，移动中被拉长），不是换颜色。
import { useEffect, useLayoutEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { LiquidSpring, prefersReduced } from '../lib/motion.js';
import { useTheme } from '../lib/theme.js';
import AccountMenu from './AccountMenu.jsx';

export const TABS = [
  { to: '/', label: '首页', en: 'HOME', icon: 'home' },
  { to: '/explore', label: '探索', en: 'EXPLORE', icon: 'explore' },
  { to: '/search', label: '搜索', en: 'SEARCH', icon: 'search' },
  { to: '/shelf', label: '书架', en: 'SHELF', icon: 'shelf' },
  { to: '/plugins', label: '插件', en: 'PLUGINS', icon: 'plugin' },
];

function useLiquidThumb(trackRef, thumbRef, activeIndex) {
  const spring = useRef(null);
  const raf = useRef(0);
  useLayoutEffect(() => {
    const track = trackRef.current, thumb = thumbRef.current;
    if (!track || !thumb) return;
    const items = track.querySelectorAll('[data-tab]');
    const el = items[activeIndex];
    if (!el) { thumb.style.opacity = '0'; return; }
    thumb.style.opacity = '1';
    const target = { left: el.offsetLeft, right: el.offsetLeft + el.offsetWidth };
    if (!spring.current || prefersReduced()) {
      spring.current = new LiquidSpring(target);
      thumb.style.transform = `translate3d(${target.left}px,0,0)`;
      thumb.style.width = `${target.right - target.left}px`;
      return;
    }
    spring.current.setTarget(target);
    let last = 0;
    const tick = (now) => {
      const dt = Math.min(.05, last ? (now - last) / 1000 : .016); last = now;
      const s = spring.current;
      const moving = s.step(dt);
      // 宽度变化交给 scaleX（只动 transform），以左边为原点
      const w = Math.max(8, s.right - s.left), base = target.right - target.left;
      thumb.style.width = `${base}px`;
      thumb.style.transform = `translate3d(${s.left}px,0,0) scale(${w / base},${s.squash})`;
      if (moving) raf.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(tick);
  }, [activeIndex]);
  // 窗口尺寸变了，直接落到新位置
  useEffect(() => {
    const onResize = () => {
      const el = trackRef.current?.querySelectorAll('[data-tab]')[activeIndex];
      if (!el || !thumbRef.current) return;
      const t = { left: el.offsetLeft, right: el.offsetLeft + el.offsetWidth };
      spring.current?.setTarget(t, true);
      thumbRef.current.style.width = `${t.right - t.left}px`;
      thumbRef.current.style.transform = `translate3d(${t.left}px,0,0)`;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activeIndex]);
  // 只在卸载时停动画：切页时这个 effect 的清理会跑在新动画启动之后，在这里取消会把滑块定在旧位置
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
}

export default function NavBar({ hidden }) {
  const { pathname } = useLocation();
  const active = TABS.findIndex(t => t.to === '/' ? pathname === '/' : pathname.startsWith(t.to));
  const topTrack = useRef(null), topThumb = useRef(null);
  const botTrack = useRef(null), botThumb = useRef(null);
  useLiquidThumb(topTrack, topThumb, active);
  useLiquidThumb(botTrack, botThumb, active);
  const [theme, setTheme] = useTheme();

  return (
    <>
      <header className={`topbar ${hidden ? 'is-hidden' : ''}`} data-tauri-drag-region="deep">
        <NavLink to="/" className="wordmark" aria-label="EBOOK 首页" data-wordmark>
          <span className="wordmark-latin">EBOOK</span>
        </NavLink>
        <nav className="topnav glass" ref={topTrack} aria-label="主导航">
          <span className="liquid-thumb" ref={topThumb} aria-hidden="true" />
          {TABS.map(t => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'} data-tab className="topnav-item">
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-side">
          <AccountMenu />
          <button className="theme-toggle glass" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label={theme === 'light' ? '切换到深色' : '切换到浅色'} title={theme === 'light' ? '深色' : '浅色'} data-mode={theme}>
            <span className="tt-sun" aria-hidden="true" /><span className="tt-moon" aria-hidden="true" />
          </button>
        </div>
      </header>

      <nav className={`tabbar glass ${hidden ? 'is-hidden' : ''}`} ref={botTrack} aria-label="主导航">
        <span className="liquid-thumb" ref={botThumb} aria-hidden="true" />
        {TABS.map(t => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} data-tab className="tabbar-item">
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
