// iPhone 底栏：照 iOS 26/27 的液态玻璃标签栏做。
//
// 静止：一条浮在内容上的玻璃胶囊，选中的那格垫一块同心的灰色胶囊，图标和字是单色，选中的用强调色。
// 手指一碰：选中块轻轻浮起为透明玻璃透镜，图标轻微放大，边缘保留很淡的色散；
// 手指拖着它在格子之间走，每跨过一格轻轻一震（selection）。松手：透镜按弹簧落到最近那格，再沉回去变回灰色胶囊。
// 点另一格也一样：透镜从当前格浮起、滑过去、落下。点当前格：回到页面顶部（iOS 惯例）。
// 搜索按 HIG 拆出来，放在右边一颗单独的玻璃圆钮里。
//
// 实现：
//   · 手指按着的时候用 requestAnimationFrame 逐帧推弹簧（这时不切页，主线程是空的）；
//   · 松手 / 路由从别处变了：把剩下的整段弹簧轨迹一次算好（每 1/60 秒一个点），交给 WAAPI 在合成线程播——
//     松手那一刻立刻切页，新页面第一次渲染再重，透镜也不会卡；播到一半又按下去，从轨迹上当时的位置和速度接着来。
//   · 透镜里「放大的图标」是同一排标签的一份拷贝（aria-hidden），平移到和底下对齐、绕透镜中心放大；
//   · 色散照真实透镜的横向色差来：红光折得少、像略大，蓝光折得多、像略小，越往边缘差得越多——
//     再叠两份拷贝，一份染红放大一点、一份染蓝缩小一点，只露出外圈（中心完全干净），只在图标的边上出现细细的红蓝边。
//     WebKit 的 backdrop-filter 做不了折射，这样画是最接近的。
//   · 透镜不在的时候 visibility: hidden，不留背景模糊的开销。
import { useEffect, useLayoutEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { haptic, prepareHaptic } from '../lib/native.js';
import { prefersReduced } from '../lib/motion.js';

// 弹簧（质量 1）：拖着的时候跟得紧，透镜略微落后于手指、被速度拉长；松手后软一点，落位时像果冻一样晃两下
const SX_DRAG = { k: 1200, c: 64 };     // 阻尼比约 0.84
const SX_SETTLE = { k: 560, c: 40 };   // 阻尼比约 0.6：过冲一下、再回一下
const SL = { k: 640, c: 44 };          // 浮起时先鼓过头一点再回来（阻尼比约 0.6）
const DT = 1 / 240;                   // 积分步长
const SAMPLE = 1 / 60;                // 交给 WAAPI 的取样间隔
const MAG = 0.07;                     // 透镜里放大多少
const DISPERSE = 0.009;               // 红、蓝两色的像相对放大多少（横向色差）
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function step(s, dt) {
  for (let t = 0; t < dt; t += DT) {
    const h = Math.min(DT, dt - t);
    // 手指松开、透镜快到了才开始往下沉（不然还在半路就落下去，看着像没拖到）
    if (s.release && s.tL > 0 && Math.abs(s.x - s.tx) < 5 && Math.abs(s.vx) < 260) s.tL = 0;
    const SX = s.release ? SX_SETTLE : SX_DRAG;
    s.vx += (-SX.k * (s.x - s.tx) - SX.c * s.vx) * h; s.x += s.vx * h;
    s.vL += (-SL.k * (s.L - s.tL) - SL.c * s.vL) * h; s.L += s.vL * h;
  }
  return Math.abs(s.x - s.tx) > .3 || Math.abs(s.vx) > 4 || Math.abs(s.L - s.tL) > .004 || Math.abs(s.vL) > .02;
}

// 一个状态 → 四个元素该是什么样（transform / opacity）
function frame(g, s) {
  const L = clamp(s.L, 0, 1.05), on = clamp(L, 0, 1);
  // 速度越快拉得越长、越扁（体积大致守恒），像一滴被拖着走的水
  const stretch = Math.min(.09, Math.abs(s.vx) / 5000) * on;
  const sx = (g.W0 / g.W1 + (1 - g.W0 / g.W1) * L) * (1 + stretch);
  const sy = (g.H0 / g.H1 + (1 - g.H0 / g.H1) * L) / (1 + stretch * .55);
  const lx = s.x - g.W1 / 2, ly = (g.H - g.H1) / 2;
  const m = 1 + MAG * on, d = DISPERSE * on;
  // 拷贝那排标签：先挪到和底下对齐（透镜中心对着 s.x），再绕透镜中心放大 m 倍（transform-origin 是 0 0，放大的中心写进位移里）
  const tx = -lx, ty = -ly;
  const mag = (k) => `translate3d(${(tx + (1 - k) * s.x).toFixed(2)}px, ${(ty + (1 - k) * g.H / 2).toFixed(2)}px, 0) scale(${k.toFixed(4)})`;
  return {
    lens: { transform: `translate3d(${lx.toFixed(2)}px, ${ly.toFixed(2)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`, opacity: String(clamp(L * 2.2, 0, 1).toFixed(3)) },
    pill: { transform: `translate3d(${(s.x - g.W0 / 2).toFixed(2)}px, ${((g.H - g.H0) / 2).toFixed(2)}px, 0)`, opacity: String((1 - clamp(L * 1.8, 0, 1)).toFixed(3)) },
    mag: { transform: mag(m) },
    red: { transform: mag(m * (1 + d)) },
    blue: { transform: mag(m * (1 - d * .8)) },
  };
}

function TabItems({ tabs, activeIndex, clone }) {
  return tabs.map((t, i) => {
    const on = clone || i === activeIndex;
    const inner = (
      <>
        <Icon name={on && Icon.filled?.(t.icon) ? `${t.icon}-fill` : t.icon} size={25} stroke={on ? 2 : 1.7} />
        <span>{t.label}</span>
      </>
    );
    return clone
      ? <span key={t.to} className="lg-tab is-on">{inner}</span>
      : <NavLink key={t.to} to={t.to} end={t.to === '/'} data-tab={i} className="lg-tab" draggable={false}>{inner}</NavLink>;
  });
}

export default function GlassTabBar({ tabs, hidden, searchTab }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = tabs.findIndex(t => t.to === '/' ? pathname === '/' : pathname.startsWith(t.to));
  const searchOn = !!searchTab && pathname.startsWith(searchTab.to);
  const bar = useRef(null), lens = useRef(null), pill = useRef(null), mag = useRef(null), red = useRef(null), blue = useRef(null);
  const g = useRef(null);          // 量好的尺寸
  const s = useRef(null);          // 弹簧状态 { x, vx, tx, L, vL, tL, release }
  const raf = useRef(0), baked = useRef(null), touch = useRef(null), skipClick = useRef(false);
  const activeRef = useRef(active); activeRef.current = active;

  const measure = () => {
    const el = bar.current;
    if (!el) return null;
    const items = [...el.querySelectorAll(':scope > .lg-tabs > [data-tab]')];
    if (!items.length) return null;
    const W = items[0].getBoundingClientRect().width, H = el.clientHeight, width = el.clientWidth;
    const W0 = W - 2, H0 = H - 12;
    const H1 = H0 + 6, W1 = W0 + 8;
    const barLeft = el.getBoundingClientRect().left;
    g.current = { W, H, W0, H0, W1, H1, centers: items.map(it => it.getBoundingClientRect().left - barLeft + it.getBoundingClientRect().width / 2), width };
    const st = el.style;
    st.setProperty('--lg-w0', `${W0}px`); st.setProperty('--lg-h0', `${H0}px`); st.setProperty('--lg-w1', `${W1}px`); st.setProperty('--lg-h1', `${H1}px`);
    st.setProperty('--lg-bar-w', `${width}px`);
    return g.current;
  };
  const els = () => ({ lens: lens.current, pill: pill.current, mag: mag.current, red: red.current, blue: blue.current });
  const apply = (f) => { const e = els(); for (const k in f) Object.assign(e[k].style, f[k]); };
  const setOn = (on) => bar.current?.toggleAttribute('data-lifted', on);

  // 合成线程上正在播的那段：停下来，换回它此刻在轨迹上的状态（含速度），好接着推
  const stopBaked = () => {
    const b = baked.current;
    if (!b) return;
    baked.current = null;
    const t = clamp((b.anims[0].currentTime || 0) / 1000 / SAMPLE, 0, b.path.length - 1);
    const i = Math.floor(t), k = t - i, a = b.path[i], c = b.path[Math.min(b.path.length - 1, i + 1)];
    const mix = (p) => a[p] + (c[p] - a[p]) * k;
    Object.assign(s.current, { x: mix('x'), vx: mix('vx'), L: mix('L'), vL: mix('vL') });
    b.anims.forEach(an => an.cancel());
    apply(frame(g.current, s.current));
  };

  // 从当前状态一路推到静止，整段轨迹交给 WAAPI
  const bake = () => {
    cancelAnimationFrame(raf.current); raf.current = 0;
    stopBaked();
    const st = s.current, geo = g.current;
    const path = [{ ...st }];
    for (let i = 0; i < 180 && step(st, SAMPLE); i++) path.push({ ...st });
    path.push({ ...st, x: st.tx, vx: 0, L: st.tL, vL: 0 });
    Object.assign(st, path[path.length - 1]);
    const frames = path.map(p => frame(geo, p));
    const end = frames[frames.length - 1];
    if (path.length < 3) { apply(end); setOn(st.L > .01); return; }
    setOn(true);
    const duration = (path.length - 1) * SAMPLE * 1000;
    const e = els();
    const anims = Object.keys(e).map(key => e[key].animate(frames.map(f => f[key]), { duration, easing: 'linear', fill: 'forwards' }));
    const mine = { path, anims };
    baked.current = mine;
    anims[0].finished.then(() => {
      if (baked.current !== mine) return;
      baked.current = null;
      apply(end);
      anims.forEach(an => an.cancel());
      setOn(st.L > .01);
    }, () => {});
  };

  // 手指按着时逐帧推
  const live = () => {
    if (raf.current) return;
    let last = performance.now();
    setOn(true);
    const tick = (now) => {
      const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
      step(s.current, dt);
      apply(frame(g.current, s.current));
      // 拖着跨过一格：轻轻一震
      const i = nearest(s.current.x);
      if (touch.current && i !== touch.current.over) { touch.current.over = i; if (touch.current.moved) haptic('selection'); }
      raf.current = touch.current ? requestAnimationFrame(tick) : 0;
    };
    raf.current = requestAnimationFrame(tick);
  };
  const nearest = (x) => {
    const c = g.current.centers;
    let best = 0;
    for (let i = 1; i < c.length; i++) if (Math.abs(c[i] - x) < Math.abs(c[best] - x)) best = i;
    return best;
  };
  // 拖出两头：像橡皮筋一样越拉越难
  const rubber = (x) => {
    const c = g.current.centers, lo = c[0], hi = c[c.length - 1];
    if (x < lo) return lo - (1 - 1 / ((lo - x) / 60 + 1)) * 60;
    if (x > hi) return hi + (1 - 1 / ((x - hi) / 60 + 1)) * 60;
    return x;
  };

  // 选中格变了（点了别处的链接、浏览器返回）：滑过去。由手势发起的切换，透镜已经在路上了
  useLayoutEffect(() => {
    // 首次尺寸由 ResizeObserver 在浏览器排版后提供，避免 React 提交时强制整页排版。
    const geo = g.current;
    if (!geo || geo.centers.length !== tabs.length) return;
    const target = geo.centers[active];
    pill.current.style.visibility = active < 0 ? 'hidden' : '';
    if (active < 0) return;
    if (!s.current) {
      s.current = { x: target, vx: 0, tx: target, L: 0, vL: 0, tL: 0, release: true };
      apply(frame(geo, s.current));
      return;
    }
    if (touch.current || s.current.tx === target) return;
    if (prefersReduced()) { stopBaked(); Object.assign(s.current, { x: target, tx: target, vx: 0, L: 0, tL: 0 }); apply(frame(geo, s.current)); return; }
    stopBaked();
    Object.assign(s.current, { tx: target, release: true });
    bake();
  }, [active, tabs.length]);

  // 尺寸变了（转屏、字号、订阅那格出现）：重新量，直接落位
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf.current); raf.current = 0; touch.current = null;
      const geo = measure();
      if (!geo) return;
      pill.current.style.visibility = activeRef.current < 0 ? 'hidden' : '';
      const x = geo.centers[Math.max(0, activeRef.current)];
      if (!s.current) s.current = {};
      else stopBaked();
      Object.assign(s.current, { x, tx: x, vx: 0, L: 0, vL: 0, tL: 0, release: true });
      apply(frame(geo, s.current));
      setOn(false);
    });
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(raf.current); baked.current?.anims.forEach(a => a.cancel()); };
  }, [tabs.length]);

  const localX = (e) => e.clientX - bar.current.getBoundingClientRect().left;
  const onDown = (e) => {
    if (e.button > 0 || !e.isPrimary) return;
    const geo = g.current || measure();
    if (!geo || !s.current) return;
    prepareHaptic('selection');
    stopBaked();
    const x = localX(e);
    touch.current = { id: e.pointerId, x0: x, moved: false, over: nearest(s.current.x), start: performance.now() };
    try { bar.current.setPointerCapture(e.pointerId); } catch { /* 合成事件没有真实指针 */ }
    if (prefersReduced()) return;
    // 透镜从当前选中的地方浮起，往手指那儿去
    Object.assign(s.current, { tx: rubber(x), tL: 1, release: false });
    if (activeRef.current < 0) Object.assign(s.current, { x: rubber(x) });
    live();
  };
  const onMove = (e) => {
    const t = touch.current;
    if (!t || e.pointerId !== t.id) return;
    const x = localX(e);
    if (!t.moved && Math.abs(x - t.x0) > 6) t.moved = true;
    if (s.current) s.current.tx = rubber(x);
  };
  const finish = (e, cancelled) => {
    const t = touch.current;
    if (!t || e.pointerId !== t.id) return;
    touch.current = null;
    const geo = g.current;
    // 以手指松开的位置为准；甩的时候顺着速度最多再送小半格（手已经过了半格线才会跨过去，不会选错）
    const lead = clamp(s.current.vx * .04, -geo.W * .45, geo.W * .45);
    const i = cancelled ? activeRef.current : nearest(t.moved ? s.current.tx + lead : localX(e));
    const to = tabs[i]?.to;
    skipClick.current = true;
    setTimeout(() => { skipClick.current = false; }, 400);
    if (i < 0) {
      Object.assign(s.current, { tL: 0, L: 0, vL: 0, vx: 0 });
      cancelAnimationFrame(raf.current); raf.current = 0; apply(frame(geo, s.current)); setOn(false);
    }
    if (i >= 0 && geo) {
      Object.assign(s.current, { tx: geo.centers[i], release: true });
      if (prefersReduced()) Object.assign(s.current, { x: geo.centers[i], L: 0, tL: 0 });
      bake();
    }
    if (cancelled || !to) return;
    if (i === activeRef.current) {
      // 点当前这格：回到顶部
      if (!t.moved) window.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' });
      return;
    }
    haptic(t.moved ? 'selection' : 'soft', .7);
    navigate(to);
  };

  // 链接自己的点击：手势已经处理过就拦下（键盘回车、读屏的点击照常走链接）
  const onClickCapture = (e) => { if (skipClick.current) e.preventDefault(); };

  return (
    <div className={`lg-dock ${hidden ? 'is-hidden' : ''}`}>
      <nav ref={bar} className="lg-tabbar lg-glass" aria-label="主导航"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={e => finish(e, false)} onPointerCancel={e => finish(e, true)} onLostPointerCapture={e => finish(e, true)}
        onClickCapture={onClickCapture} onContextMenu={e => e.preventDefault()}>
        <span ref={pill} className="lg-pill" aria-hidden="true" />
        <div className="lg-tabs"><TabItems tabs={tabs} activeIndex={active} /></div>
        <span ref={lens} className="lg-lens" aria-hidden="true">
          <span ref={mag} className="lg-tabs lg-mag"><TabItems tabs={tabs} clone /></span>
          <span ref={red} className="lg-tabs lg-ca lg-ca-r"><TabItems tabs={tabs} clone /></span>
          <span ref={blue} className="lg-tabs lg-ca lg-ca-b"><TabItems tabs={tabs} clone /></span>
        </span>
      </nav>
      {searchTab && (
        <NavLink to={searchTab.to} className={`lg-search lg-glass ${searchOn ? 'is-on' : ''}`} aria-label={searchTab.label}
          onPointerDown={() => prepareHaptic('soft')} onClick={() => { if (!searchOn) haptic('soft', .7); else window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          <Icon name="search" size={24} stroke={searchOn ? 2.2 : 1.8} />
        </NavLink>
      )}
    </div>
  );
}
