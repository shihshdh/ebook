// 等用户的手停下来再干后台活：漫画源的书单、封面、名作查找都跑在主线程上（沙箱里的源脚本、解析网页、原生请求的回调、
// 插进书墙的图），挤进滑动、拖光盘、翻页的那几帧就是掉帧。后台任务开工前 await calm()：
// 最近 250ms 里有滚动 / 触摸移动 / 滚轮 / 按下 / 按键就等到停手 250ms；最多等 2 秒（一直在滑也得让封面慢慢出来）。
// 漫画阅读器的正文图不走这个（正在看的那张要马上出）。
let last = 0;
if (typeof window !== 'undefined') {
  const mark = () => { last = performance.now(); };
  for (const ev of ['scroll', 'wheel', 'touchmove', 'pointerdown', 'keydown']) window.addEventListener(ev, mark, { capture: true, passive: true });
}
export function calm(quiet = 250, maxWait = 2000) {
  const t0 = performance.now();
  if (t0 - last >= quiet) return Promise.resolve();
  return new Promise(resolve => {
    const tick = () => {
      const now = performance.now();
      if (now - last >= quiet || now - t0 >= maxWait) resolve();
      else setTimeout(tick, Math.max(30, quiet - (now - last)));
    };
    tick();
  });
}
