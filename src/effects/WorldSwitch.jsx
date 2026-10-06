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

export default function WorldSwitch({ worlds, active, onChange, collage, total }) {
  const hero = useRef(null), scene = useRef(null), veil = useRef(null), back = useRef(null), headline = useRef(null);
  const capsRef = useRef({});
  const [shown, setShown] = useState(active || worlds[0].id); // 场景层当前显示的世界
  const [zoomed, setZoomed] = useState(!!active);
  const spring = useRef(new Spring(active ? 1 : 0, .62, .82));
  const queue = useRef(null);
  const raf = useRef(0);

  const world = worlds.find(w => w.id === shown) || worlds[0];

  const frame = () => {
    const h = hero.current, s = scene.current;
    if (!h || !s) return;
    const p = spring.current.value;
    const H = h.getBoundingClientRect();
    const cap = capsRef.current[shown]?.getBoundingClientRect();
    // 胶囊相对 hero 的位置（拉远时场景收进这里）
    const c = cap ? { l: cap.left - H.left, t: cap.top - H.top, r: H.right - cap.right, b: H.bottom - cap.bottom, rad: cap.height / 2 }
      : { l: H.width / 2 - 30, t: H.height - 90, r: H.width / 2 - 30, b: 30, rad: 30 };
    // 先横向长宽（胶囊变宽），再纵向长高：横向用前 70% 的进度，纵向用后 80%
    const px = smooth(0, .7, p), py = smooth(.2, 1, p);
    const l = lerp(c.l, 0, px), r = lerp(c.r, 0, px), t = lerp(c.t, 0, py), b = lerp(c.b, 0, py);
    const rad = lerp(c.rad, 28, py);
    s.style.clipPath = `inset(${t}px ${r}px ${b}px ${l}px round ${rad}px)`;
    veil.current.style.opacity = String(1 - smooth(.62, .96, p));
    back.current.style.opacity = String(1 - p);
    if (headline.current) headline.current.style.opacity = String(smooth(.8, 1, p));
    h.style.setProperty('--p', p.toFixed(3));
  };

  const run = () => {
    cancelAnimationFrame(raf.current);
    let last = 0;
    const tick = (now) => {
      const dt = Math.min(.05, last ? (now - last) / 1000 : .016); last = now;
      const moving = spring.current.step(dt);
      frame();
      if (moving) raf.current = requestAnimationFrame(tick);
      else if (queue.current) { const q = queue.current; queue.current = null; q(); }
    };
    raf.current = requestAnimationFrame(tick);
  };

  const zoomTo = (target) => {
    if (prefersReduced()) { spring.current.set(target); frame(); return; }
    spring.current.target = target;
    run();
  };

  // 外部 active 变化 → 镜头运动
  useEffect(() => {
    if (!active) { setZoomed(false); zoomTo(0); return; }
    if (active === shown) { setZoomed(true); zoomTo(1); return; }
    if (spring.current.value < .05) { setShown(active); setZoomed(true); requestAnimationFrame(() => zoomTo(1)); return; }
    // 先拉远到当前世界的胶囊，换世界，再从新胶囊推进
    setZoomed(false);
    queue.current = () => { setShown(active); setZoomed(true); requestAnimationFrame(() => zoomTo(1)); };
    zoomTo(0);
  }, [active]);

  useEffect(() => {
    frame();
    const onResize = () => frame();
    addEventListener('resize', onResize);
    return () => { removeEventListener('resize', onResize); cancelAnimationFrame(raf.current); };
  }, [shown]);

  const books = collage[shown] || [];
  return (
    <section ref={hero} className="ws" style={{ '--w': world.color, '--wg': world.glow }} aria-label="题材世界">
      <div ref={back} className="ws-back" aria-hidden="true">
        <p className="ws-back-title serif">选一个世界，<br />走进去。</p>
        <p className="ws-back-sub muted">{total ? `${total.toLocaleString()} 本轻小说，按题材分成五个入口` : '正在打开书库…'}</p>
      </div>

      <div ref={scene} className="ws-scene" aria-hidden={!zoomed}>
        <div className="ws-collage">
          {books.slice(0, 14).map((b, i) => <Cover key={b.id} book={b} eager={i < 8} alt="" className={`ws-c ws-c${i}`} />)}
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
