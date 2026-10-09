// ① Luma Dream Machine 式"镜头推进 / 拉远"：探索页顶部的五个题材"世界"。
//
// 图层（从后往前）：主题色径向光晕 → 场景层（该题材的封面拼贴）→ 前景大字（题材的一个汉字，永远不动）
//   · 拉远（p→0）：场景层被 clip-path 收进下方图标排里那颗胶囊的位置，背景由黑转暖灰，底部亮起主题色光晕
//   · 推进（p→1）：胶囊原地变宽 → 长成满幅圆角矩形（先是纯色）→ 色块淡出露出拼贴 → 标语逐字打出
//   · 在世界之间切换：先拉远到当前胶囊，换世界，再从新胶囊推进
// 前景大字不动是关键：视觉锚点稳住，变化才读得出是"镜头在动"。一个进度 p 驱动全部，弹簧推动，逐帧写 style。
import { useEffect, useRef, useState } from 'react';
import Cover from '../components/Cover.jsx';
import { Spring, prefersReduced } from '../lib/motion.js';
import './WorldSwitch.css';

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function Typed({ text, run }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) { setN(0); return; }
    if (prefersReduced()) { setN(text.length); return; }
    setN(0);
    let i = 0;
    const t = setInterval(() => { i++; setN(i); if (i >= text.length) clearInterval(t); }, 32);
    return () => clearInterval(t);
  }, [text, run]);
  return <span>{text.slice(0, n)}<i className="ws-caret" aria-hidden="true" /></span>;
}

export default function WorldSwitch({ worlds, active, onChange, collage, total, onSettle }) {
  const hero = useRef(null), scene = useRef(null), veil = useRef(null), back = useRef(null), headline = useRef(null);
  const capsRef = useRef({});
  const [shown, setShown] = useState(active || worlds[0].id); // 场景层当前显示的世界
  const [zoomed, setZoomed] = useState(!!active);
  const spring = useRef(new Spring(active ? 1 : 0, .62, .82));
  const desired = useRef(active);   // 想去的世界（null = 全部）
  const settleRef = useRef(onSettle); settleRef.current = onSettle;   // 镜头停稳、不用再动时通知外面（探索页这时才换书单）
  const animating = useRef(false);
  const raf = useRef(0);
  // 动画循环跨过「换世界」那次重渲染：读 ref 拿到的总是当前世界的胶囊，不会按旧胶囊的位置算
  const shownRef = useRef(shown);
  shownRef.current = shown;
  // 各胶囊相对 hero 的位置：ResizeObserver 回调里量（那时浏览器刚排完版，读位置不额外花钱），动画帧里只读缓存。
  // 以前每帧 getBoundingClientRect，逼浏览器当场重算样式和排版；碰上下面书单刚换完，这一读就把整页排版拉进动画帧里
  const geo = useRef({});

  const world = worlds.find(w => w.id === shown) || worlds[0];

  const frame = () => {
    const h = hero.current, s = scene.current;
    if (!h || !s) return;
    const p = spring.current.value;
    // 胶囊相对 hero 的位置（拉远时场景收进这里）。还没量到（页面还在后台预渲染、没排过版）时按窗口估个底部中间，
    // 不读 DOM——一读就逼浏览器去排后台页；页面一显示，ResizeObserver 在第一次绘制前就补上真实位置
    // （只在没量到时才算：手机视口下连 innerWidth 都会逼浏览器同步排版，每帧读一次就是每帧一次强制排版）
    const c = geo.current[shownRef.current] || (() => {
      const W = innerWidth, Ht = Math.min(660, Math.max(440, innerHeight * .64));
      return { l: W / 2 - 30, t: Ht - 90, r: W / 2 - 30, b: 30, rad: 30 };
    })();
    // 先横向长宽（胶囊变宽），再纵向长高：横向用前 70% 的进度，纵向用后 80%
    const px = smooth(0, .7, p), py = smooth(.2, 1, p);
    const l = lerp(c.l, 0, px), r = lerp(c.r, 0, px), t = lerp(c.t, 0, py), b = lerp(c.b, 0, py);
    const rad = lerp(c.rad, 28, py);
    s.style.clipPath = `inset(${t}px ${r}px ${b}px ${l}px round ${rad}px)`;
    veil.current.style.opacity = String(1 - smooth(.62, .96, p));
    back.current.style.opacity = String(1 - p);
    if (headline.current) headline.current.style.opacity = String(smooth(.8, 1, p));
  };

  const run = () => {
    cancelAnimationFrame(raf.current);
    animating.current = true;
    let last = 0;
    const tick = (now) => {
      const dt = Math.min(.05, last ? (now - last) / 1000 : .016); last = now;
      const moving = spring.current.step(dt);
      frame();
      if (moving) raf.current = requestAnimationFrame(tick);
      else { animating.current = false; advance(); }
    };
    raf.current = requestAnimationFrame(tick);
  };

  /** 已经在往 target 走（或已停在那）就不重启，免得每次判断都打断弹簧。返回 true = 镜头已经停在 target、不用再动 */
  const zoomTo = (target) => {
    const s = spring.current;
    if (s.target === target && (animating.current || s.value === target)) return !animating.current;
    if (prefersReduced()) { s.set(target); frame(); advance(); return false; }
    s.target = target;
    run();
    return false;
  };

  // 镜头下一步怎么走，只看两件事：想去哪个世界、现在显示的是哪个。
  // 点了别的世界、或者弹簧停稳时都再判断一次——快速连点、中途改主意，最后都停在最后点的那个世界
  //   想去「全部」→ 拉远；想去的就是现在这个 → 推进；
  //   想去别的 → 先拉远到当前胶囊，拉远了就换世界（换完下面 [shown] 的 effect 再判断一次，从新胶囊推进）
  const advance = () => {
    const want = desired.current;
    if (!want) { setZoomed(false); if (zoomTo(0)) settleRef.current?.(); return; }
    if (want === shownRef.current) { setZoomed(true); if (zoomTo(1)) settleRef.current?.(); return; }
    setZoomed(false);
    if (spring.current.value < .05) setShown(want);
    else zoomTo(0);
  };

  useEffect(() => { desired.current = active; advance(); }, [active]);

  // 换世界时只重画一帧再判断下一步，不碰正在跑的镜头动画：这里以前顺手 cancelAnimationFrame，
  // 而 React 跑这段清理的时机可能晚于「下一帧开始推进」，推进刚起步就被掐掉，场景停在拉远状态（背景出不来）
  useEffect(() => { frame(); advance(); }, [shown]);
  useEffect(() => {
    const h = hero.current;
    const measure = () => {
      if (!h) return;
      const H = h.getBoundingClientRect(), next = {};
      for (const [id, el] of Object.entries(capsRef.current)) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        next[id] = { l: r.left - H.left, t: r.top - H.top, r: H.right - r.right, b: H.bottom - r.bottom, rad: r.height / 2 };
      }
      geo.current = next;
      frame();   // 这时还没画：用新位置重画这一帧，不会先按旧位置闪一下
    };
    // hero、胶囊排、每颗胶囊（选中时胶囊会慢慢变宽，旁边的跟着挪）任一尺寸变了就重量
    const ro = new ResizeObserver(measure);
    if (h) ro.observe(h);
    h?.querySelector('.ws-dock') && ro.observe(h.querySelector('.ws-dock'));
    Object.values(capsRef.current).forEach(el => el && ro.observe(el));
    return () => { ro.disconnect(); cancelAnimationFrame(raf.current); };
  }, []);

  const books = collage[shown] || [];
  return (
    <section ref={hero} className="ws" style={{ '--w': world.color, '--wg': world.glow }} aria-label="题材世界">
      <div ref={back} className="ws-back" aria-hidden="true">
        <p className="ws-back-title serif">选一个世界，<br />走进去。</p>
        <p className="ws-back-sub muted">{total ? `${total.toLocaleString()} 本轻小说，按题材分成五个入口` : '正在打开书库…'}</p>
      </div>

      <div ref={scene} className="ws-scene" aria-hidden={!zoomed}>
        <div className="ws-collage">
          {/* 全部 eager：拼贴平时被 clip-path 裁没了，推进时才露出来；不 eager 的封面要等「快到屏幕上」才去找真封面，
              被裁着就一直等不到，推进到一半才换图 */}
          {books.slice(0, 14).map((b, i) => <Cover key={b.id} book={b} eager alt="" className={`ws-c ws-c${i}`} />)}
        </div>
        <div className="ws-shade" />
        <div ref={veil} className="ws-veil" />
        <div ref={headline} className="ws-headline">
          <p className="eyebrow">WORLD · {world.id.toUpperCase()}</p>
          <h2 className="serif"><span className="ws-new">{world.tag}</span><em>之境</em></h2>
          <p className="ws-tagline">{world.tagline}</p>
        </div>
      </div>

      {/* 前景：题材的一个汉字，不随镜头动 */}
      <div className="ws-glyph serif foil" aria-hidden="true">{world.glyph}</div>

      <div className="ws-dock" role="tablist" aria-label="题材">
        <button role="tab" aria-selected={!active} className={`ws-all ${!active ? 'on' : ''}`} onClick={() => onChange(null)}>全部</button>
        {worlds.map(w => {
          const on = active === w.id;
          return (
            <button key={w.id} role="tab" aria-selected={on} ref={el => { capsRef.current[w.id] = el; }}
              className={`ws-cap ${on ? 'on' : ''}`} style={{ '--c': w.color }} onClick={() => onChange(on ? null : w.id)}>
              <span className="ws-cap-glyph serif">{w.glyph}</span>
              <span className="ws-cap-label">{w.tag}{on && <small><Typed text={' · ' + w.tagline} run={on} /></small>}</span>
            </button>
          );
        })}
        {!active && <span className="ws-try" aria-hidden="true">点一个试试 ↗</span>}
      </div>
    </section>
  );
}
