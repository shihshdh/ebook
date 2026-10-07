// 帧调度：给所有持续动画限帧，省电。
//
// 为什么要限：requestAnimationFrame 跟着屏幕刷新率跑。用户的笔记本是 300Hz 屏，
// 不限帧时书页之河、光盘轮播每秒要画 300 次——看书软件完全不需要，效果在 60 帧和 300 帧下几乎看不出差别，
// 耗电却差好几倍。缓慢的环境动效（纸页漂移、唱片自转）在 20 帧下肉眼也看不出卡顿。
//
// 做法：两帧之间先用 setTimeout 睡到"下一帧该来"的前几毫秒，再用 rAF 对齐垂直同步。
// 这样高刷屏上不会每 3ms 被叫醒一次，也不会画出撕裂的帧。

// 盖住页面的面板（详情页）打开时，底下的效果全部停帧：看不见还在画，手机上会拖慢面板滑入、整页掉帧
let paused = false;
const parked = new Set();
/** on=true 停下所有限帧动画（已挂的回调留着），false 时接着跑 */
export function pauseEffects(on) {
  paused = !!on;
  if (!paused) { const list = [...parked]; parked.clear(); list.forEach(resume => resume()); }
}

/** 有人在操作（拖、划、指针在效果上）时的帧率 */
export const FPS_ACTIVE = 60;
/** 只剩环境动效（缓慢漂移、自转）时的帧率 */
export const FPS_IDLE = 20;

/**
 * 限帧版 requestAnimationFrame。每个实例同一时刻只挂一个回调（新的覆盖旧的），用法和 rAF 一样：
 *   const fr = cappedRaf(60);
 *   fr.request(loop);   // 在 loop 里继续 fr.request(loop)
 *   fr.cancel();
 *   fr.fps = 20;        // 随时改
 * 回调收到的时间戳和 rAF 的同源（performance.now 时间线）。
 */
export function cappedRaf(fps = FPS_ACTIVE) {
  let last = 0, raf = 0, timer = 0, cb = null, rate = fps;
  const fire = (now) => {
    raf = 0;
    if (!cb) return;
    if (paused) { parked.add(resume); return; }
    const iv = 1000 / rate;
    // 高刷屏上 rAF 来早了：再睡一会儿
    if (last && now - last < iv - 2) return wait(iv - (now - last));
    last = now;
    const f = cb; cb = null;
    f(now);
  };
  const wait = (ms) => {
    if (ms > 6) timer = setTimeout(() => { timer = 0; raf = requestAnimationFrame(fire); }, ms - 4);
    else raf = requestAnimationFrame(fire);
  };
  // 恢复后从头计时：各效果的 dt 都有上限，不会因为停过一阵就猛跳
  const resume = () => { if (cb && !raf && !timer) { last = 0; wait(0); } };
  const api = {
    get fps() { return rate; },
    // 提速时（比如指针刚进来）不等旧的长间隔睡完，马上按新帧率重排
    set fps(v) {
      const faster = v > rate;
      rate = v;
      if (faster && timer) { clearTimeout(timer); timer = 0; wait(1000 / rate - (performance.now() - last)); }
    },
    request(f) {
      cb = f;
      if (!raf && !timer) wait(last ? 1000 / rate - (performance.now() - last) : 0);
    },
    cancel() {
      cb = null;
      cancelAnimationFrame(raf); clearTimeout(timer);
      raf = timer = 0;
    },
    get pending() { return !!cb; },
  };
  return api;
}

/**
 * 把高频事件（pointermove 在 300Hz 屏上每秒 300 次）合并成不超过 fps 次的处理。
 * 只保留最后一次事件的参数。
 */
export function throttleFrames(fn, fps = FPS_ACTIVE) {
  const fr = cappedRaf(fps);
  let args = null;
  const run = () => { const a = args; args = null; if (a) fn(...a); };
  const wrapped = (...a) => { args = a; if (!fr.pending) fr.request(run); };
  wrapped.cancel = () => { args = null; fr.cancel(); };
  return wrapped;
}
