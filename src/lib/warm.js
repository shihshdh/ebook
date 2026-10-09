// 后台页面分块预排版（App.jsx 的空闲预渲染用）。
//
// 后台页面挂着 content-visibility: hidden，不排版不画；第一次点进去时整页现排，手机上一两百毫秒，切页动画顿一下。
// 以前空闲时一口气把整页排好：卡顿从切页挪到了空闲——首页唱片转着转着顿一下，书架、插件页各一两百毫秒。
// 现在一小块一小块排：这页挂 is-warming（解除 content-visibility，但高 0、裁掉、不可见），里面还没排的块单独
// 挂 content-visibility: hidden（见 app.css），从外往里一块块放开：
//   页面骨架 → 每个区块（里面的项先不排）→ 区块里的每一项 → 项里的各块（整块排完）
// 每段最多排 BUDGET 毫秒，排完让浏览器先画一帧再接着排。放开过的块打上 data-warm，排版结果留着；
// 这页最后收回 content-visibility: hidden，content-visibility 会留着排好的结果，点进去只剩绘制。
//
// 页面里自己带 content-visibility: auto 的项（瀑布流卡片、搜索结果行）另算：排的时候整页被裁成 0 高，它们都算
// 「不在屏幕附近」，一张都不会排，点进去第一屏还得现排（探索页手机上八十毫秒）。所以最后再把页面前 LAZY_SCREENS 屏
// 以内的逐个排好：读一下它里面的尺寸，浏览器就会把它排出来，content-visibility: auto 会留着结果

const BUDGET = 6;   // 每段最多排多久（毫秒）
const LAZY = '.mw-tile, .result-list > li';
const LAZY_SCREENS = 2.5;
const DEPTH = 4;    // 拆到第几层：页面(1) → 区块(2) → 区块里的项(3) → 项里的各块(4)，第 4 层整块排。
                    // 拆到第 3 层时，瀑布流网格、插件卡片、世界切换的场景层单块要排 35~40ms（手机上），再拆一层都在 20ms 内

/**
 * @param page  这页的根元素（.route 下面那一层）
 * @returns 做一段的函数：返回 true 表示还有没排的
 */
export function warmer(page) {
  const queue = [[page, 1]];
  let lazy = null;   // 第二步：前几屏里 content-visibility: auto 的项
  return () => {
    const t0 = performance.now();
    while (queue.length) {
      const [el, depth] = queue.shift();
      if (!el.isConnected || el.dataset.warm === 'all') continue;
      if (depth < DEPTH) {
        el.dataset.warm = 'part';   // 放开这一块，它的子块先不排
        queue.unshift(...[...el.children].map(child => [child, depth + 1]));
      } else el.dataset.warm = 'all';
      void el.offsetHeight;   // 当场排掉这一块：排版落在这一段里，不拖到下一帧
      if (performance.now() - t0 > BUDGET) return true;
    }
    if (!lazy) {
      const top = page.getBoundingClientRect().top;
      lazy = [...page.querySelectorAll(LAZY)].filter(el => el.getBoundingClientRect().top - top < innerHeight * LAZY_SCREENS);
    }
    while (lazy.length) {
      const el = lazy.shift();
      if (el.isConnected) void el.firstElementChild?.offsetHeight;
      if (performance.now() - t0 > BUDGET) break;
    }
    return lazy.length > 0;
  };
}

