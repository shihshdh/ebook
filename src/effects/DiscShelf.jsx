// ② A24 式弧形光盘轮播（移植自 Pixel Reconstruction 的 DiscShelf，参数沿用调好的那一套）。
// 每本书印成一张光盘，沿左下→右上的弧排开；只有一个进度 p 驱动全部光盘：
// 第 i 张的偏移 d = i - p 决定它在弧上的位置、大小、倾角和自转，rAF 里用弹簧把 p 推向目标，直接写 style。
// 左上角是"片名表"：衬线大标题 + 细线资料行，换书时淡入上移；盘下方两行"评语"取自简介和标签。
import { useCallback, useEffect, useRef, useState } from 'react';
import Cover from '../components/Cover.jsx';
import Icon from '../components/Icon.jsx';
import { prefersReduced } from '../lib/motion.js';
import { FPS_ACTIVE, FPS_IDLE, cappedRaf } from '../lib/frame.js';
import { pressBook, stopWarm, warmBook } from '../lib/glyph-warm.js';
import { haptic } from '../lib/native.js';
import './DiscShelf.css';

const WINDOW = 4;
// 拖动松手：以前只按停手位置四舍五入——快速甩一下（手指走 60px）只算 0.4 张，又弹回原来那张，得「用力」拖过半张。
// 现在看松手前 ~100ms 的速度：够快就顺着甩的方向多推一段（按 FLING_MS 的惯性估），至少换一张，一次最多 FLING_MAX 张
const FLING = .25;       // px/ms
const FLING_MS = 160;    // 惯性：按松手速度再走这么久的距离
const FLING_MAX = 3;

export default function DiscShelf({ books, onOpen, eyebrow = '本周新装订' }) {
  const n = books.length;
  const stageRef = useRef(null);
  const discRefs = useRef(new Map());
  const motion = useRef({ p: 0, v: 0, target: 0, spin: 0, last: 0, felt: 0 });   // felt：上次震过的那一张
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState([0, Math.min(n - 1, WINDOW)]);
  const reduced = useRef(false);
  const inView = useRef(true);
  // 舞台尺寸由 ResizeObserver 记下（排版完顺手给的），动画帧里只读缓存。以前每帧读 clientWidth / clientHeight，
  // 而上一帧刚写过光盘的宽高——一读就逼浏览器当场重排，手机上每帧多出十几到几十毫秒
  const stageSize = useRef(null);
  const discSize = useRef(new Map());
  // 换盘、拖动时跟屏幕刷新率；只剩唱片慢慢自转（9°/秒）时 60 帧；滚出视口完全停（帧率见 lib/frame.js）
  const fr = useRef(null);
  if (!fr.current) fr.current = cappedRaf(FPS_IDLE);
  const wake = () => { fr.current.fps = FPS_ACTIVE; };

  const go = useCallback((index) => {
    const target = Math.max(0, Math.min(n - 1, index));
    motion.current.target = target;
    wake();
    setCurrent(Math.round(target));
  }, [n]);

  // 入场：光盘从右侧沿弧线依次滑入——把 p 放在 -3.2，让弹簧带回 0
  useEffect(() => {
    reduced.current = prefersReduced();
    Object.assign(motion.current, { p: reduced.current ? 0 : -3.2, v: 0, target: 0 });
  }, []);
  useEffect(() => { if (motion.current.target > n - 1) go(n - 1); }, [n, go]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(([e]) => {
      stageSize.current = { w: e.contentRect.width, h: e.contentRect.height };
      draw.current();   // 这时还没画：马上按新尺寸摆好，不会先画一帧没摆位置的光盘
    });
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  // 只在可见时转（滚出视口就停 rAF）
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { inView.current = e.isIntersecting; window.dispatchEvent(new Event('librarium:disc-view')); }, { rootMargin: '80px' });
    if (stageRef.current) io.observe(stageRef.current);
    return () => io.disconnect();
  }, []);

  // 把光盘摆到进度 p 对应的位置。动画帧里调；舞台尺寸刚量到时（ResizeObserver 回调，还没画）也调一次，第一帧就摆好
  const draw = useRef(() => {});
  draw.current = () => {
    const m = motion.current, size0 = stageSize.current;
    if (!size0) return;
    const { w, h } = size0;
    const narrow = w < 640;
    const unit = narrow ? Math.min(w / 560, h / 360) : Math.min(w / 1100, h / 520);
    const size = (narrow ? 250 : 300) * unit;
    discRefs.current.forEach((el, i) => {
      const d = i - m.p, a = Math.abs(d);
      const x = w * .5 + d * (narrow ? 200 : 250) * unit;
      const y = h * .5 - d * 54 * unit + d * d * 5 * unit;
      const scale = Math.max(.42, Math.min(1.5, 1 + d * .15 - a * .03));
      const tilt = 34 + Math.min(a, 1.6) * 12;
      const spin = reduced.current ? -d * 40 : m.spin * (1 + i % 3 * .15) - d * 40;
      const fade = a > 3.2 ? Math.max(0, 1 - (a - 3.2) / .8) : 1;
      el.style.transform = `translate3d(${x - size / 2}px,${y - size / 2}px,0) scale(${scale}) perspective(${900 * unit}px) rotateZ(-24deg) rotateX(${tilt}deg) rotateZ(${spin}deg)`;
      // 其余几样只在变了时写：唱片静静自转时只有 transform 在变（交给合成器），
      // 以前每帧都重写宽高 / 透明度 / 层级 / --lift，逼浏览器每帧重算样式、重画投影滤镜
      const last = discSize.current.get(el) || {}, lift = Math.round(Math.max(0, 1 - a) * 1000) / 1000;
      const z = 200 - Math.round(a * 20) + (d > 0 ? 6 : 0), op = Math.round(fade * 1000) / 1000;
      if (last.size !== size) el.style.width = el.style.height = size + 'px';
      if (last.op !== op) el.style.opacity = String(op);
      if (last.z !== z) el.style.zIndex = String(z);
      if (last.lift !== lift) el.style.setProperty('--lift', String(lift));
      discSize.current.set(el, { size, op, z, lift });
    });
  };

  useEffect(() => {
    const f = fr.current;
    const tick = (now) => {
      const m = motion.current;
      if (!inView.current || document.hidden) { m.last = 0; return; }   // 停：等视口 / 可见性事件再拉起
      f.request(tick);
      const dt = Math.min(.08, m.last ? (now - m.last) / 1000 : 1 / f.fps); m.last = now;
      if (reduced.current) { m.p = m.target; m.v = 0; }
      else {
        const k = 70, c = 15;
        m.v += ((m.target - m.p) * k - m.v * c) * dt;
        m.p += m.v * dt;
        m.spin += dt * 9 + m.v * dt * 60;
      }
      draw.current();
      // 换到新的一张、盘停到位（离目标不到 0.04 张）那一下轻震（安卓；拖动中目标不是整数，不震）
      const at = Math.round(m.target);
      if (at === m.target && at !== m.felt && Math.abs(m.target - m.p) < .04) { m.felt = at; haptic('light'); }
      const lo = Math.max(0, Math.floor(m.p) - WINDOW), hi = Math.min(n - 1, Math.ceil(m.p) + WINDOW);
      setVisible(prev => prev[0] === lo && prev[1] === hi ? prev : [lo, hi]);
      f.fps = Math.abs(m.target - m.p) + Math.abs(m.v) > .002 ? FPS_ACTIVE : FPS_IDLE;
    };
    const resume = () => { if (inView.current && !document.hidden && !f.pending) f.request(tick); };
    resume();
    window.addEventListener('librarium:disc-view', resume);
    document.addEventListener('visibilitychange', resume);
    return () => { f.cancel(); window.removeEventListener('librarium:disc-view', resume); document.removeEventListener('visibilitychange', resume); };
  }, [n]);

  // 滚轮：跟手，停 140ms 吸附；到头把滚动还给页面
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let snap = 0;
    const wheel = (e) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const m = motion.current;
      if ((delta < 0 && m.target <= 0) || (delta > 0 && m.target >= n - 1)) return;
      e.preventDefault();
      m.target = Math.max(0, Math.min(n - 1, m.target + delta / 340));
      wake();
      clearTimeout(snap);
      snap = setTimeout(() => go(Math.round(motion.current.target)), 140);
    };
    stage.addEventListener('wheel', wheel, { passive: false });
    return () => { stage.removeEventListener('wheel', wheel); clearTimeout(snap); };
  }, [n, go]);

  // 拖动：横向一张盘的距离换一张；位移很小当点击
  const drag = useRef({ id: -1, x: 0, start: 0, moved: false });
  const down = (e) => { if (e.button !== 0) return; drag.current = { id: e.pointerId, x: e.clientX, start: motion.current.target, moved: false, track: [[e.clientX, e.timeStamp]] }; };
  const perDisc = () => (innerWidth < 640 ? 150 : 230);   // 拖多少像素换一张
  const move = (e) => {
    const g = drag.current;
    if (g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    g.track.push([e.clientX, e.timeStamp]);
    if (g.track.length > 12) g.track.shift();
    if (!g.moved && Math.abs(dx) > 6) { g.moved = true; stageRef.current?.setPointerCapture(e.pointerId); stopWarm(); }
    if (g.moved) { motion.current.target = Math.max(-.4, Math.min(n - .6, g.start - dx / perDisc())); wake(); }
  };
  const up = (e) => {
    const g = drag.current;
    if (g.id !== e.pointerId) return;
    drag.current.id = -1;
    if (!g.moved) return;
    let to = motion.current.target;
    const from = e.type === 'pointerup' && g.track.find(([, t]) => e.timeStamp - t <= 100);   // 被打断（pointercancel）不算甩
    const v = from && e.timeStamp - from[1] >= 8 ? (e.clientX - from[0]) / (e.timeStamp - from[1]) : 0;
    if (Math.abs(v) >= FLING) {
      const dir = v < 0 ? 1 : -1;   // 手指往左甩 = 往后翻
      to = Math.round(to - v * FLING_MS / perDisc());
      const base = Math.round(g.start);
      to = dir > 0 ? Math.min(Math.max(to, base + 1), base + FLING_MAX) : Math.max(Math.min(to, base - 1), base - FLING_MAX);
    }
    go(Math.round(to));
  };
  const at = Math.min(current, n - 1);
  const clickDisc = (i, el) => {
    if (drag.current.moved) { drag.current.moved = false; return; }
    if (i === at) onOpen(books[i], el); else go(i);
  };
  useEffect(() => {
    const keydown = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest('[role=dialog]'))) return;
      e.preventDefault();
      go(Math.round(motion.current.target) + (e.key === 'ArrowRight' ? 1 : -1));
    };
    addEventListener('keydown', keydown);
    return () => removeEventListener('keydown', keydown);
  }, [go]);

  const book = books[at];
  if (!book) return null;
  const pad = (v) => String(v).padStart(2, '0');
  const discs = [];
  for (let i = Math.max(0, visible[0]); i <= Math.min(visible[1], n - 1); i++) {
    const b = books[i];
    discs.push(
      <button key={b.id} type="button" className="disc" tabIndex={-1}
        ref={el => { if (el) discRefs.current.set(i, el); else discRefs.current.delete(i); }}
        aria-label={i === at ? '打开 ' + b.title : '转到 ' + b.title} onClick={(e) => clickDisc(i, e.currentTarget)}
        onPointerDown={i === at ? () => warmBook(b) : undefined}>
        <span className="disc-face"><Cover book={b} eager={Math.abs(i - at) < 3} alt="" /></span>
        <span className="disc-sheen" aria-hidden="true" />
        <span className="disc-hub" aria-hidden="true" />
      </button>,
    );
  }
  const quote = (book.description || '').replace(/…$/, '').split(/[。！？]/)[0];

  return (
    <section className="discshelf" aria-roledescription="轮播" aria-label="新书光盘架">
      <div key={book.id} className="disc-sheet" aria-live="polite">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="disc-title serif">{book.title}</h2>
        <dl className="disc-facts">
          {/* 没有数据的行不显示，免得一排"—" */}
          {[
            ['作者', book.author],
            ['文库', book.publisher],
            ['状态', [book.status, book.animated && '已动画化'].filter(Boolean).join(' · ')],
            ['字数', book.length],
            ['插图', book.illustrated && '有插图重制版'],
            ['更新', book.updated],
          ].filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd className={k === '字数' || k === '更新' ? 'num' : undefined}>{v}</dd></div>)}
        </dl>
      </div>
      <div ref={stageRef} className="disc-stage" tabIndex={0}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onKeyDown={(e) => { if (e.key === 'Home') go(0); if (e.key === 'End') go(n - 1); if (e.key === 'Enter') onOpen(book); }}
        aria-label="左右方向键切换，点击中央光盘打开">
        {discs}
      </div>
      <div className="disc-quotes" key={'q' + book.id}>
        {quote && <blockquote>“{quote}。”<cite>— 简介</cite></blockquote>}
        {book.tags.length > 0 && <blockquote>“{book.tags.slice(0, 4).join(' · ')}”<cite>— 标签</cite></blockquote>}
      </div>
      <div className="disc-footer">
        <button type="button" className="btn btn-gold" onClick={(e) => onOpen(book, e.currentTarget)} {...pressBook(book)}>
          {book.illustrated ? '看看插图版' : '查看这本'} <Icon name="arrow" size={16} />
        </button>
        <p className="disc-hint">滚动、拖动或用方向键翻阅</p>
        <p className="disc-counter num" aria-label={`第 ${at + 1} 本，共 ${n} 本`}><strong>{pad(at + 1)}</strong><span>/ {pad(n)}</span></p>
      </div>
    </section>
  );
}
