// ============================================================
// 动效地基 —— 与 Pixel Reconstruction / ORACULUM 同一套规矩
//   · 动效必须有职责：确认操作 / 说清状态 / 保持连续性 / 引导注意 / 体现气质
//   · 只动 transform、opacity、clip-path，不动布局属性
//   · 一个连续量驱动全部，逐帧直接写 style，不走 React 重渲染
//   · prefers-reduced-motion 是"去掉位移"，不是"关掉一切"
// ============================================================

import { throttleFrames } from './frame.js';

export const EASE = 'cubic-bezier(.16,1,.3,1)';
export const EASE_BACK = 'cubic-bezier(.34,1.45,.64,1)';
export const D = { fb: 120, state: 220, layout: 380, hero: 640 };

export function prefersReduced() {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
export function isTouch() {
  try { return matchMedia('(pointer: coarse)').matches; } catch { return false; }
}

/** Apple 式弹簧参数：response 为无阻尼周期，dampingFraction 为阻尼比 */
export function springCoefficients(response, dampingFraction) {
  const omega = 2 * Math.PI / response;
  return { stiffness: omega * omega, damping: 2 * dampingFraction * omega };
}

/** 单值弹簧：改目标时从当前值与速度出发，连续改目标也不跳变 */
export class Spring {
  constructor(value, response = 0.45, dampingFraction = 0.86) {
    this.value = this.target = value;
    this.velocity = 0;
    ({ stiffness: this.k, damping: this.c } = springCoefficients(response, dampingFraction));
  }
  set(value) { this.value = this.target = value; this.velocity = 0; }
  step(dt) {
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.velocity += (-this.k * (this.value - this.target) - this.c * this.velocity) * h;
      this.value += this.velocity * h;
    }
    const eps = Math.max(1e-3, Math.abs(this.target) * 1e-3);
    if (Math.abs(this.value - this.target) < eps && Math.abs(this.velocity) < eps * 10) {
      this.value = this.target; this.velocity = 0; return false;
    }
    return true;
  }
}

// 液态滑块：左右两条边各挂一根弹簧，前沿硬、后沿软，移动中被拉长，读起来像一滴液体在槽里流动
const LEAD = springCoefficients(0.28, 0.78);
const TRAIL = springCoefficients(0.42, 0.86);
export class LiquidSpring {
  constructor({ left, right }) {
    this.left = left; this.right = right; this.vl = 0; this.vr = 0;
    this.target = { left, right };
  }
  setTarget(target, immediate = false) {
    this.target = { ...target };
    if (immediate) { this.left = target.left; this.right = target.right; this.vl = this.vr = 0; }
  }
  step(dt) {
    const movingRight = this.target.left + this.target.right > this.left + this.right;
    const l = movingRight ? TRAIL : LEAD, r = movingRight ? LEAD : TRAIL;
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.vl += (-l.stiffness * (this.left - this.target.left) - l.damping * this.vl) * h;
      this.vr += (-r.stiffness * (this.right - this.target.right) - r.damping * this.vr) * h;
      this.left += this.vl * h; this.right += this.vr * h;
    }
    const settled = Math.abs(this.left - this.target.left) < 0.05 && Math.abs(this.right - this.target.right) < 0.05
      && Math.abs(this.vl) < 1 && Math.abs(this.vr) < 1;
    if (settled) { this.left = this.target.left; this.right = this.target.right; this.vl = this.vr = 0; }
    return !settled;
  }
  get squash() {
    const speed = Math.abs(this.vl + this.vr) / 2;
    return Math.max(0.86, 1 - speed / 9000);
  }
}

/** 玻璃面板的指针高光：把指针位置写成 --pointer-x / --pointer-y */
export function trackPointerGlow(root = document) {
  // 每改一次变量，整块玻璃（连同 backdrop-filter）都要重画；300Hz 屏上指针事件每秒 300 次，合并到 60 次足够跟手
  const move = throttleFrames((e) => {
    const el = e.target.closest?.('.glass');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--pointer-x', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--pointer-y', `${((e.clientY - r.top) / r.height) * 100}%`);
  });
  root.addEventListener('pointermove', move, { passive: true });
  return () => { root.removeEventListener('pointermove', move); move.cancel(); };
}

/** 稳定的字符串哈希（封面配色、粒子种子都用它） */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; };
}
