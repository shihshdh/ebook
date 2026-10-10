// 触屏按下反馈：手指按住书卡、搜索结果、榜单、推荐这些时轻轻收一点（和按钮的 :active 一样 0.97），抬手回弹。
//
// 以前触屏上按它们什么反应都没有（-webkit-tap-highlight-color 关了，悬停效果又只在电脑上有），点了不确定点没点上。
// 不用 CSS :active 做：这些元素各自已经有 transition（边框、背景、悬停上浮……），要加缩放得把每个的 transition 列表重抄一遍，
// 以后谁改了原来的就对不上。这里用 Web Animations 单独动 scale 属性：和 transform、原有 transition 都不打架，交给合成器。
//
// 节奏照着原生列表：按住 PRESS_DELAY 才压下去——一划就滚的手势不会先压一下再弹回（滚动时卡片闪一下）；
// 快速点一下（还没到 PRESS_DELAY 就抬手）补一个「压下—回弹」，照样有反馈；手指移动超过 SLOP、浏览器接管滚动（pointercancel）就松开。
// 只在触屏上装；电脑有悬停效果，不变。
import { isTouch, prefersReduced } from './motion.js';

const PRESSABLE = [
  '.mw-tile', '.result', '.rank li button', '.illus-card', '.fresh-card', '.starter-list button', '.pick-cover',
  '.sp-rec-list button', '.sp-note-list button', '.sp-cover', '.continue-card', '.shelf-cover', '.world-card',
  '.rss-card', '.rss-item', '.chip', '.ff-card', '.ws-cap', '.ws-all',
].join(',');
const SCALE = .97;
const PRESS_DELAY = 80;   // ms
const SLOP = 8;           // px
const DOWN = 120, UP = 220;   // 压下 = --d-fb，回弹 = --d-state（tokens.css）
const EASE = 'cubic-bezier(.16,1,.3,1)';

let cur = null;   // { el, id, x, y, timer, anim }

function release(quick) {
  const c = cur; cur = null;
  if (!c) return;
  clearTimeout(c.timer);
  const { el } = c;
  if (c.anim) {
    // 从当前（可能还没压到底）回到 1
    const now = getComputedStyle(el).scale;
    c.anim.cancel();
    el.animate([{ scale: now === 'none' ? '1' : now }, { scale: '1' }], { duration: UP, easing: EASE });
  } else if (quick) {
    el.animate([{ scale: '1' }, { scale: String(SCALE), offset: DOWN / (DOWN + UP) }, { scale: '1' }], { duration: DOWN + UP, easing: EASE });
  }
}

function install() {
  addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || !e.isPrimary) return;
    release(false);
    const el = e.target.closest?.(PRESSABLE);
    if (!el || el.disabled || el.closest('[aria-disabled="true"]')) return;
    const c = cur = { el, id: e.pointerId, x: e.clientX, y: e.clientY, anim: null };
    c.timer = setTimeout(() => {
      if (cur !== c) return;
      c.anim = el.animate([{ scale: '1' }, { scale: String(SCALE) }], { duration: DOWN, easing: EASE, fill: 'forwards' });
    }, PRESS_DELAY);
  }, { capture: true, passive: true });
  addEventListener('pointermove', (e) => {
    if (!cur || e.pointerId !== cur.id) return;
    if (Math.abs(e.clientX - cur.x) > SLOP || Math.abs(e.clientY - cur.y) > SLOP) release(false);
  }, { capture: true, passive: true });
  addEventListener('pointerup', (e) => { if (cur && e.pointerId === cur.id) release(true); }, { capture: true, passive: true });
  addEventListener('pointercancel', () => release(false), { capture: true, passive: true });
}

if (typeof window !== 'undefined' && isTouch() && !prefersReduced()) install();
