// 导航：桌面是顶部一条玻璃胶囊，手机是底部玻璃标签栏——同一个组件，只是排版不同。
// 选中态是一滴会流动的玻璃（LiquidSpring：前沿先冲、后沿慢半拍，移动中被拉长、变细），不是换颜色。
import { useEffect, useLayoutEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { LiquidSpring, prefersReduced } from '../lib/motion.js';
import { useTheme } from '../lib/theme.js';
import AccountMenu from './AccountMenu.jsx';
import { useRss } from '../lib/rss.js';

export const TABS = [
  { to: '/', label: '首页', en: 'HOME', icon: 'home' },
  { to: '/explore', label: '探索', en: 'EXPLORE', icon: 'explore' },
  { to: '/search', label: '搜索', en: 'SEARCH', icon: 'search' },
  { to: '/shelf', label: '书架', en: 'SHELF', icon: 'shelf' },
  { to: '/plugins', label: '插件', en: 'PLUGINS', icon: 'plugin' },
];

// 选中的那滴玻璃要两头始终是正圆的胶囊（像 iOS 的标签栏），而且全程只动位移和缩放：
//   · 形状：拆成左右两半，各是一个和整条导航一样长的胶囊（--lt-big），套在 overflow: hidden 的框里，只露出从自己那头到拼接点的一截，
//     两半在胶囊中段平直的地方拼起来。拉长只是两半各自位移；移动中变细用等比缩放，圆头还是正圆。以前整块 scaleX 拉伸，圆头被拉扁
//   · 动画：弹簧整条轨迹一次算好（每 1/120 秒一个点），交给合成线程用 WAAPI 播：切页那几帧主线程再忙，滑块也不停；
//     只动 translate / scale，不重绘、不重排（改宽度的话每帧都要重绘，切页最重的两帧各多 20 多毫秒，4 倍降速）。
//     每个动画只有起止两帧，曲线写在 linear() 缓动里：一百多个关键帧的话，建动画时浏览器要逐对建插值，切页那帧多十几二十毫秒。
//     曲线的点也要省：拼出来、让浏览器解析都要时间（每秒 240 个点时一次切页四五毫秒，4 倍降速）
//   · 拼接点必须是整 CSS 像素（框自己的坐标里）：不是整数时，合成器把两个框都往外扩成整数，中间那一列被半透明的滑块画两遍，
//     是一条亮线（实测：3 倍屏上 70.333px 也会，哪怕正好是整设备像素；容器本身在屏幕上偏半个像素倒没关系）。
//     所以两个框跳格（取整），能不动就不动、快出平直段了才跳，胶囊的曲线里同一时刻把框跳的那一下扣回来，胶囊本身照样平滑地动
//   · 平时不占合成层（不写 will-change）：动画一开始浏览器自己给它们建层，播完撤掉。常驻的话首页滚动每帧分层、提交都多一截
//   · 中途又点了别的：从当前位置和速度接着弹，不跳
const STEP = 1 / 120;   // 弹簧自己按 1/240 秒积分（LiquidSpring.step），这里只是多久取一个点
// 位移动画一律从 0 到 SPAN px，曲线给的是 位移 / SPAN：整数除以 2 的幂在浮点里是精确的，合成器算回来还是整数，拼接点不差一丝
const SPAN = 1024;
const canAnimate = typeof CSS !== 'undefined' && CSS.supports?.('transition-timing-function', 'linear(0, 1)')
  && typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
// 拼接点在 a 到下一点 b 这一段里能待的范围：胶囊平直的那段（离两头各一个圆头半径）
const room = (g, a, b = a) => [Math.max(a.l + g.R * a.q, b.l + g.R * b.q), Math.min(a.r - g.R * a.q, b.r - g.R * b.q)];
// 取整的拼接点：尽量取中间
function seam(g, a, b = a) {
  const [lo, hi] = room(g, a, b), s = Math.round(Math.min(hi, Math.max(lo, (a.l + a.r) / 2)));
  return s < lo && Math.ceil(lo) <= hi ? Math.ceil(lo) : s > hi && Math.floor(hi) >= lo ? Math.floor(hi) : s;
}
// 六条曲线：[元素序号, 属性, 跟不跟着拼接点跳, 跟不跟着形状变, 值(形状 p, 这一段的拼接点 s)]。元素：左框、左胶囊、右框、右胶囊。
// 胶囊在框里面，框跳了胶囊要反着补回来：值里减掉框的位移
const TRACKS = [
  [0, 'translate', true, false, (g, p, s) => s - g.big], [1, 'translate', true, true, (g, p, s) => p.l - (s - g.big)], [1, 'scale', false, true, (g, p) => p.q],
  [2, 'translate', true, false, (g, p, s) => s], [3, 'translate', true, true, (g, p, s) => p.r - g.big - s], [3, 'scale', false, true, (g, p) => p.q],
];
const css = (prop, v) => prop === 'scale' ? String(v) : `${v}px`;
// 一条曲线 → linear() 缓动。位移的进度 = 值 / SPAN；缩放从 1 到 0，进度 = 1 - 值。at：各点的时刻（几条曲线共用）。
// 拼接点跳的那一刻放两个点：先「旧拼接点、这一刻的形状」，再换新的。只跟拼接点走的（框）只在起止和跳的时候放点
function easing(g, path, at, [, prop, stepped, shaped, value]) {
  const last = path.length - 1;
  // 框的值是整数，除以 2 的幂原样写出（精确）；胶囊的位移、缩放是小数，留够精度就行
  const prog = (v) => prop === 'scale' ? (1 - v).toFixed(4) : shaped ? (v / SPAN).toFixed(6) : String(v / SPAN);
  const pts = [];
  path.forEach((p, i) => {
    const jump = stepped && i > 0 && p.s !== path[i - 1].s;
    if (jump) pts.push(`${prog(value(g, p, path[i - 1].s))} ${at[i]}`);
    if (shaped || jump || i === 0 || i === last) pts.push(`${prog(value(g, p, p.s))} ${at[i]}`);
  });
  return `linear(${pts.join(', ')})`;
}
// 从 state（两条边的位置、速度）弹到 target 的整条轨迹
function trajectory(state, target) {
  const sp = new LiquidSpring(state);
  sp.vl = state.vl; sp.vr = state.vr;
  sp.setTarget(target);
  const out = [{ l: sp.left, r: sp.right, vl: sp.vl, vr: sp.vr, q: sp.squash }];
  for (let i = 0; i < 480; i++) {
    const moving = sp.step(STEP);
    out.push({ l: sp.left, r: sp.right, vl: sp.vl, vr: sp.vr, q: sp.squash });
    if (!moving) break;
  }
  return out;
}

function useLiquidThumb(trackRef, thumbRef, activeIndex, count) {
  const geom = useRef(null);  // 量好的：{ big 导航宽, R 圆头半径, items: [{ l, r }] }
  const run = useRef(null);   // 正在播的：{ path, anims, g }
  const rest = useRef(null);  // 停着的位置 { l, r }
  const parts = () => thumbRef.current.querySelectorAll('.lt-clip, .lt-cap');
  // 各格的位置在 ResizeObserver 里量（那时刚排完版，读位置不花钱），切页时直接用，不在点击的那一下逼浏览器当场排版
  const measure = () => {
    const track = trackRef.current, thumb = thumbRef.current;
    if (!track || !thumb) return null;
    return geom.current = {
      big: track.clientWidth, R: thumb.clientHeight / 2,
      items: [...track.querySelectorAll('[data-tab]')].map(el => ({ l: el.offsetLeft, r: el.offsetLeft + el.offsetWidth })),
    };
  };
  const place = (g, l, r) => {
    run.current?.anims.forEach(a => a.cancel());
    run.current = null;
    thumbRef.current.style.setProperty('--lt-big', `${g.big}px`);
    const ps = parts(), p = { l, r, q: 1 }, s = seam(g, p);
    for (const [j, prop, , , value] of TRACKS) ps[j].style[prop] = css(prop, value(g, p, s));
    rest.current = { l, r };
  };
  useLayoutEffect(() => {
    const track = trackRef.current, thumb = thumbRef.current;
    if (!track || !thumb) return;
    let g = geom.current;
    if (!g || g.items.length !== count) g = measure();
    const target = g.items[activeIndex];
    if (!target) { thumb.style.opacity = '0'; return; }
    thumb.style.opacity = '1';
    // 第一次、减少动态效果、这条导航此刻没显示（手机上的顶栏、电脑上的底栏）、很旧的 WebView：直接落位
    // （不能看 offsetParent：手机底栏是 position: fixed，offsetParent 永远是 null，以前因此每次都瞬移、液态动画从没播过）
    if (!rest.current || prefersReduced() || !g.big || !canAnimate) { place(g, target.l, target.r); return; }
    // 从哪儿出发：正在弹的从它此刻的位置、速度接着弹，停着的从停的位置
    let from = { left: rest.current.l, right: rest.current.r, vl: 0, vr: 0 };
    const cur = run.current;
    if (cur) {
      if (cur.g !== g) { place(g, target.l, target.r); return; }
      const t = Math.max(0, (cur.anims[0].currentTime || 0) / 1000 / STEP), i = Math.min(cur.path.length - 1, Math.floor(t));   // 第几个点之后
      const a = cur.path[i], b = cur.path[Math.min(cur.path.length - 1, i + 1)], k = Math.min(1, t - i);
      const mix = (x, y) => x + (y - x) * k;
      from = { left: mix(a.l, b.l), right: mix(a.r, b.r), vl: mix(a.vl, b.vl), vr: mix(a.vr, b.vr) };
    }
    const path = trajectory(from, { left: target.l, right: target.r });
    if (path.length < 3) { place(g, target.l, target.r); return; }
    const last = path.length - 1;
    // 拼接点能不动就不动：还在这一段的平直范围里就留着，出去了才重新取（跳得少，框的曲线点就少）
    path.forEach((p, i) => {
      const prev = i > 0 ? path[i - 1].s : null, [lo, hi] = room(g, p, path[Math.min(last, i + 1)]);
      p.s = prev !== null && prev >= lo && prev <= hi ? prev : seam(g, p, path[Math.min(last, i + 1)]);
    });
    cur?.anims.forEach(a => a.cancel());
    const ps = parts(), duration = last * STEP * 1000, at = path.map((_, i) => `${(i / last * 100).toFixed(3)}%`);
    const anims = TRACKS.map(track => ps[track[0]].animate(
      { [track[1]]: track[1] === 'scale' ? ['1', '0'] : ['0px', `${SPAN}px`] },
      { duration, easing: easing(g, path, at, track), fill: 'forwards' }));
    const mine = { path, anims, g };
    run.current = mine;
    rest.current = { l: target.l, r: target.r };
    anims[0].finished.then(() => { if (run.current === mine) place(g, target.l, target.r); }, () => {});
  }, [activeIndex, count]);
  // 尺寸变了（窗口、字体到了）：重新量，真变了才直接落到新位置（ResizeObserver 一开始观察就会回调一次，那次什么都没变）
  const activeNow = useRef(activeIndex); activeNow.current = activeIndex;
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const relayout = () => {
      const old = geom.current, g = measure(), t = g?.items[activeNow.current];
      if (!t || !rest.current) return;
      const same = old && old.big === g.big && old.R === g.R && old.items.every((x, i) => x.l === g.items[i]?.l && x.r === g.items[i]?.r);
      if (same) { geom.current = old; return; }   // 留着旧对象：正在播的动画认得它
      place(g, t.l, t.r);
    };
    const ro = new ResizeObserver(relayout);
    ro.observe(track);
    track.querySelectorAll('[data-tab]').forEach(el => ro.observe(el));
    window.addEventListener('resize', relayout);
    return () => { ro.disconnect(); window.removeEventListener('resize', relayout); };
  }, [count]);
  // 只在卸载时停动画：切页时这个 effect 的清理会跑在新动画启动之后，在这里取消会把滑块定在旧位置
  useEffect(() => () => run.current?.anims.forEach(a => a.cancel()), []);
}

// 左右两半：框（裁剪、跳格）> 胶囊（见上面）
const Half = ({ right }) => <span className={`lt-clip${right ? ' lt-r' : ''}`}><span className="lt-cap" /></span>;
const Thumb = ({ refEl }) => <span className="liquid-thumb" ref={refEl} aria-hidden="true"><Half /><Half right /></span>;

// 「订阅」只在导入过订阅源后出现，没用这功能的人导航不多一格
const RSS_TAB = { to: '/rss', label: '订阅', en: 'FEEDS', icon: 'rss' };

export default function NavBar({ hidden }) {
  const { pathname } = useLocation();
  const rss = useRss();
  const tabs = rss?.length ? [...TABS.slice(0, 4), RSS_TAB, TABS[4]] : TABS;
  const active = tabs.findIndex(t => t.to === '/' ? pathname === '/' : pathname.startsWith(t.to));
  const topTrack = useRef(null), topThumb = useRef(null);
  const botTrack = useRef(null), botThumb = useRef(null);
  useLiquidThumb(topTrack, topThumb, active, tabs.length);
  useLiquidThumb(botTrack, botThumb, active, tabs.length);
  const [theme, setTheme] = useTheme();

  return (
    <>
      <header className={`topbar ${hidden ? 'is-hidden' : ''}`} data-tauri-drag-region="deep">
        <NavLink to="/" className="wordmark" aria-label="EBOOK 首页" data-wordmark>
          <span className="wordmark-latin">EBOOK</span>
        </NavLink>
        <nav className="topnav glass" ref={topTrack} aria-label="主导航">
          <Thumb refEl={topThumb} />
          {tabs.map(t => (
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
        <Thumb refEl={botThumb} />
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} data-tab className="tabbar-item">
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
