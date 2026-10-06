// 明暗主题：light（象牙纸，默认）/ dark（黑金夜读）。
// 写在 <html data-theme>；index.html 里有一段内联脚本在首帧前就设好，避免闪一下深色。
// WebGL 效果（书页之河、玻璃折射）在初始化时读一次主题，切换时由页面用 key 让它们重建。
import { useEffect, useState } from 'react';
import { setSystemBars, win } from './native.js';
import { acctKey } from './accounts.js';

const KEY = acctKey('librarium.theme');   // 跟着账户走；index.html 的首帧脚本也按账户读
export function getTheme() {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}
export function applyTheme(t = getTheme()) {
  document.documentElement.setAttribute('data-theme', t);
  const bg = t === 'dark' ? '#080706' : '#f4efe6';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  // 客户端窗口底色跟着换：拖动改大小时露出来的那一下也是对的颜色
  win.setBackground(bg);
  setSystemBars({ dark: t === 'dark' });
}
export function setTheme(t) {
  try { localStorage.setItem(KEY, t); } catch {}
  // 换主题时整页淡一下，不是生硬地跳色
  const root = document.documentElement;
  root.classList.add('theme-fade');
  applyTheme(t);
  setTimeout(() => root.classList.remove('theme-fade'), 500);
  window.dispatchEvent(new CustomEvent('librarium:theme', { detail: t }));
}
export function useTheme() {
  const [t, set] = useState(getTheme);
  useEffect(() => {
    const on = (e) => set(e.detail);
    window.addEventListener('librarium:theme', on);
    return () => window.removeEventListener('librarium:theme', on);
  }, []);
  return [t, setTheme];
}
export const isLight = () => document.documentElement.getAttribute('data-theme') !== 'dark';
