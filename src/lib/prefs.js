// 阅读偏好：跨书一致，改了立即生效并写盘（localStorage，同步读，阅读器打开不用等）。
import { useEffect, useState } from 'react';
import { acctKey } from './accounts.js';

export const READER_THEMES = {
  night: { label: '夜读', page: '#0d0b09', text: '#d9d2c3', link: '#e9cb8b', chrome: '#080706' },
  paper: { label: '纸白', page: '#f6f3ec', text: '#2f2b25', link: '#9a6f2a', chrome: '#ebe6dc' },
  sepia: { label: '羊皮', page: '#efe3c8', text: '#4e3f2b', link: '#9a5b1e', chrome: '#e3d5b6' },
  oled: { label: '纯黑', page: '#000000', text: '#a8a39a', link: '#c9ad73', chrome: '#000000' },
};
export const READER_FONTS = {
  serif: { label: '宋体', stack: '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif' },
  sans: { label: '黑体', stack: '-apple-system, "PingFang SC", "Microsoft YaHei UI", sans-serif' },
  kai: { label: '楷体', stack: '"Kaiti SC", "STKaiti", "KaiTi", serif' },
};

const DEFAULTS = {
  readerTheme: 'night',
  readerFont: 'serif',
  fontSize: 108,        // 百分比
  lineHeight: 1.85,
  readerMode: 'paginated', // 'paginated' | 'scrolled'
};
const KEY = acctKey('librarium.prefs');   // 跟着账户走
const listeners = new Set();

export function getPrefs() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}
export function setPrefs(patch) {
  const next = { ...getPrefs(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach(fn => fn(next));
  return next;
}
export function usePrefs() {
  const [prefs, set] = useState(getPrefs);
  useEffect(() => { listeners.add(set); return () => listeners.delete(set); }, []);
  return [prefs, setPrefs];
}
