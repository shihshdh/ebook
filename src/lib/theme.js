// 明暗主题：light（象牙纸，默认）/ dark（黑金夜读）/ system（跟随系统：iPhone、安卓、Windows 切深色时跟着变）。
// 存的是选择（pref），页面上用的是算出来的明暗（getTheme）；写在 <html data-theme>。
// index.html 里有一段内联脚本在首帧前就设好（同样认 system），避免闪一下深色。
// WebGL 效果（书页之河、玻璃折射）在初始化时读一次主题，切换时由页面用 key 让它们重建——跟随系统时系统一变也发同一个事件。
import { useEffect, useState } from 'react';
import { setSystemBars, win } from './native.js';
import { acctKey } from './accounts.js';

const KEY = acctKey('librarium.theme');   // 跟着账户走；index.html 的首帧脚本也按账户读
const dark = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

/** 用户的选择：'light' | 'dark' | 'system'（没选过是 light） */
export function getThemePref() {
  try { const v = localStorage.getItem(KEY); return v === 'dark' || v === 'system' ? v : 'light'; } catch { return 'light'; }
}
/** 现在实际用的明暗：'light' | 'dark' */
export function getTheme(pref = getThemePref()) {
  return pref === 'system' ? (dark?.matches ? 'dark' : 'light') : pref;
}
export function applyTheme(t = getTheme()) {
  document.documentElement.setAttribute('data-theme', t);
  const bg = t === 'dark' ? '#080706' : '#f4efe6';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  // 客户端窗口底色跟着换：拖动改大小时露出来的那一下也是对的颜色
  win.setBackground(bg);
  setSystemBars({ dark: t === 'dark' });
}
function show(t) {
  if (document.documentElement.getAttribute('data-theme') === t) return;
  // 换主题时整页淡一下，不是生硬地跳色
  const root = document.documentElement;
  root.classList.add('theme-fade');
  applyTheme(t);
  setTimeout(() => root.classList.remove('theme-fade'), 500);
  window.dispatchEvent(new CustomEvent('librarium:theme', { detail: t }));
}
/** 设成 'light' | 'dark' | 'system' */
export function setTheme(pref) {
  try { localStorage.setItem(KEY, pref); } catch {}
  window.dispatchEvent(new CustomEvent('librarium:theme-pref', { detail: pref }));
  show(getTheme(pref));
}
// 跟随系统：系统切明暗时跟着换（只在选了「跟随系统」时）
dark?.addEventListener?.('change', () => { if (getThemePref() === 'system') show(getTheme('system')); });

/** [现在的明暗, setTheme]：导航栏的太阳 / 月亮按钮用（点一下就是明确选浅色或深色） */
export function useTheme() {
  const [t, set] = useState(() => getTheme());
  useEffect(() => {
    const on = (e) => set(e.detail);
    window.addEventListener('librarium:theme', on);
    return () => window.removeEventListener('librarium:theme', on);
  }, []);
  return [t, setTheme];
}
/** [选择, setTheme]：插件页「外观」三选一用 */
export function useThemePref() {
  const [p, set] = useState(getThemePref);
  useEffect(() => {
    const on = (e) => set(e.detail);
    window.addEventListener('librarium:theme-pref', on);
    return () => window.removeEventListener('librarium:theme-pref', on);
  }, []);
  return [p, setTheme];
}
export const isLight = () => document.documentElement.getAttribute('data-theme') !== 'dark';
