// 后台线程：开屏书形标志的描线（见 Splash.jsx）。
// 原来是 SVG 的 stroke-dashoffset 动画，只能在主线程上逐帧算；开屏播放的同时主线程在处理书库、第一次排版首页
// （手机上各卡三四百毫秒），标志画到一半停住、再一下跳一截。挪到这里用 OffscreenCanvas 画，主线程卡住也照样走。
// 画法和原来逐项一致：同样四条路径（viewBox 0 0 120 80，画在 108×72 上）、虚线 220、各自的延迟、1.1 秒、
// cubic-bezier(.65,0,.35,1)、圆头圆角，第四组细线 .9 宽、.7 不透明。改了 Splash.jsx 里的 SVG 这里要跟着改。
const PATHS = [
  ['M60 18 C46 10 28 9 10 14 V68 C28 63 46 64 60 72', 0, 1.4, 1],
  ['M60 18 C74 10 92 9 110 14 V68 C92 63 74 64 60 72', 120, 1.4, 1],
  ['M60 18 V72', 300, 1.4, 1],
  ['M22 26 C32 24 42 25 50 29 M22 36 C32 34 42 35 50 39 M70 29 C78 25 88 24 98 26 M70 39 C78 35 88 34 98 36', 500, .9, .7],
];
const DASH = 220, DUR = 1100;

// CSS 的 cubic-bezier(x1, y1, x2, y2)：按 x 解出 t（牛顿法，退化时二分），返回 y
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = X(t) - x, d = dX(t);
      if (Math.abs(e) < 1e-6) return Y(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 30; i++) { const v = X(t); if (Math.abs(v - x) < 1e-6) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return Y(t);
  };
}
const ease = bezier(.65, 0, .35, 1);

self.onmessage = ({ data: { canvas, dpr, color, start, reduced } }) => {
  const ctx = canvas.getContext('2d');
  const paths = PATHS.map(([d, delay, width, alpha]) => ({ path: new Path2D(d), delay, width, alpha }));
  const s = .9 * dpr;   // viewBox 120×80 画在 108×72（CSS 像素）上
  const draw = (now) => {
    const t = performance.timeOrigin + now - start;   // start 是主线程那边开屏第一帧的时刻（绝对时间）
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash([DASH]);
    let done = true;
    for (const p of paths) {
      const x = reduced ? 1 : Math.min(1, Math.max(0, (t - p.delay) / DUR));
      if (x < 1) done = false;
      ctx.lineWidth = p.width; ctx.globalAlpha = p.alpha;
      ctx.lineDashOffset = DASH * (1 - ease(x));
      ctx.stroke(p.path);
    }
    if (!done) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
};
