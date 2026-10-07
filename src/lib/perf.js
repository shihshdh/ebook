// 画质：全自动，不给用户调。
//
// 一、开机先按硬件打分（同步，首帧就能用）：
//     显卡型号（WebGL 的 UNMASKED_RENDERER：RTX/RX/Apple M 系 → 强；Intel 核显、Mali、老 Adreno、软件渲染 → 弱）
//     + CPU 核数 + 内存 + 要画的像素量（4K 高分屏同样的效果要多画 4 倍）
//     + 省流量模式、减少动态效果、触屏
// 二、再看实际跑得动不动（异步）：重效果开始画以后量 3 秒帧率，掉到 45fps 以下就降一档、通知各效果重建；
//     降过的档按显卡记在本机，下次直接从降过的档起步，不再先卡一下。
// 三、省电：笔记本拔了电源且电量低于 30% 时，自动降一档。
//
// 档位：ultra / high / balanced / low。各效果只读 tier()，并监听 'librarium:tier' 事件重建。
import { isTouch, prefersReduced } from './motion.js';

const ORDER = ['low', 'balanced', 'high', 'ultra'];
const LEARN_KEY = 'librarium.tier.learned';

let gpuName = null;
export function gpu() {
  if (gpuName !== null) return gpuName;
  gpuName = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    gpuName = String(gl ? gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : '');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {}
  return gpuName;
}

function gpuScore(name) {
  const n = name.toLowerCase();
  if (!n) return 1;
  if (/swiftshader|llvmpipe|microsoft basic|software/.test(n)) return 0;
  if (/rtx|gtx 1[0-9]{3}|gtx 9[0-9]0|radeon rx|radeon pro|arc a[0-9]|apple m[1-9]/.test(n)) return 3;
  if (/adreno \(tm\) ?[78][0-9]{2}|adreno [78][0-9]{2}|apple gpu|immortalis|mali-g7[1-9]|mali-g[6-9][0-9]0|radeon (680|780|880)m|iris xe/.test(n)) return 2;
  if (/intel|mali|adreno|powervr|vivante/.test(n)) return 1;
  return 2;
}

function hardwareTier() {
  if (prefersReduced()) return 'low';
  if (navigator.connection?.saveData) return 'low';
  const g = gpuScore(gpu());
  if (g === 0) return 'low';
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || (isTouch() ? 4 : 8);
  // 要画的像素：超过 2560×1600 的屏，同样的效果开销明显上去
  const px = screen.width * screen.height * Math.min(devicePixelRatio || 1, 2) ** 2;
  let score = g * 2 + (cores >= 12 ? 2 : cores >= 8 ? 1 : 0) + (mem >= 8 ? 1 : mem >= 4 ? 0 : -1) - (px > 9e6 ? 1 : 0) - (isTouch() ? 1 : 0);
  // 手机：屏小、散热差，再好的芯片也最多「均衡」——效果照样有，粒子数和分辨率减半，滑起来不掉帧
  if (isTouch()) return score >= 3 ? 'balanced' : 'low';
  return score >= 7 ? 'ultra' : score >= 5 ? 'high' : score >= 3 ? 'balanced' : 'low';
}

let current = null;
function learned() {
  try { const v = JSON.parse(localStorage.getItem(LEARN_KEY) || 'null'); return v && v.gpu === gpu() ? v.tier : null; } catch { return null; }
}
export function tier() {
  if (current) return current;
  const hw = hardwareTier(), lr = learned();
  current = lr && ORDER.indexOf(lr) < ORDER.indexOf(hw) ? lr : hw;   // 学到的档只会往下压，不会越过手机的上限
  return current;
}
function setCurrent(t, why) {
  if (t === current) return;
  current = t;
  try { localStorage.setItem(LEARN_KEY, JSON.stringify({ gpu: gpu(), tier: t })); } catch {}
  console.info(`[perf] 画质 → ${t}（${why}）`);
  window.dispatchEvent(new CustomEvent('librarium:tier', { detail: t }));
}
const down = (why) => { const i = ORDER.indexOf(tier()); if (i > 0) setCurrent(ORDER[i - 1], why); };

// ---------- 实际帧率：重效果开始渲染时调用 watchFps()，量 3 秒 ----------
let watching = false;
export function watchFps() {
  if (watching || tier() === 'low') return;
  watching = true;
  let frames = 0, slow = 0, last = 0, start = 0;
  const step = (now) => {
    if (document.hidden) { watching = false; return; }
    if (!start) start = now;
    if (last) { frames++; if (now - last > 26) slow++; }
    last = now;
    if (now - start < 3000) { requestAnimationFrame(step); return; }
    watching = false;
    const fps = frames / ((now - start) / 1000);
    // 平均帧率低，或者三分之一以上的帧超过 26ms（明显掉帧）
    if (fps < 45 || slow / Math.max(1, frames) > .33) down(`实测 ${Math.round(fps)}fps`);
  };
  // 等页面入场动画过去再量
  setTimeout(() => requestAnimationFrame(step), 1200);
}

// ---------- 电池：拔电源且电量低 → 降一档 ----------
try {
  navigator.getBattery?.().then(b => {
    const check = () => { if (!b.charging && b.level < .3) down('电量低且未充电'); };
    check();
    b.addEventListener('chargingchange', check); b.addEventListener('levelchange', check);
  }).catch(() => {});
} catch {}

export const TIER_LABEL = { ultra: '极致', high: '高', balanced: '均衡', low: '省电' };
export function canWebGL2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}
/** 给人看的显卡名："ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Ti Laptop GPU (0x2F18) Direct3D11 …)" → "NVIDIA GeForce RTX 5070 Ti Laptop GPU" */
export function gpuLabel() {
  const raw = gpu().replace(/^ANGLE \((.*)\)$/, '$1');
  const parts = raw.split(', ');
  return (parts.length > 1 ? parts[1] : parts[0]).replace(/\s*\(0x[0-9a-f]+\).*$/i, '').replace(/\s*Direct3D.*$/i, '').trim();
}
