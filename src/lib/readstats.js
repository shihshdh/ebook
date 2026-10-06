// 阅读时长：阅读器里「真的在读」的时间按天累计，书架页的阅读统计用。
//   · 每 15 秒记一次；窗口看不见、或者 2 分钟没翻页没动鼠标就不算（放着不动不会刷时长）
//   · 存在 localStorage（跟账户走），只留最近 120 天，体积可以忽略
import { useEffect, useState } from 'react';
import { acctKey } from './accounts.js';

const KEY = acctKey('librarium.readtime');   // { 'YYYY-MM-DD': 秒 }
const KEEP_DAYS = 120;
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
const subs = new Set();

export function addReading(seconds) {
  const all = read();
  const k = dayKey();
  all[k] = (all[k] || 0) + seconds;
  const keys = Object.keys(all).sort();
  while (keys.length > KEEP_DAYS) delete all[keys.shift()];
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
  subs.forEach(fn => fn());
}

/** { today, week: [{day, label, seconds}×7，最后一个是今天], weekTotal, streak（连续读书天数，今天没读从昨天算起）, days（读过的天数） } */
export function readingStats(now = new Date()) {
  const all = read();
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    week.push({ day: dayKey(d), label: i === 0 ? '今天' : '日一二三四五六'[d.getDay()], seconds: all[dayKey(d)] || 0 });
  }
  let streak = 0;
  const d = new Date(now);
  if (!all[dayKey(d)]) d.setDate(d.getDate() - 1);
  while ((all[dayKey(d)] || 0) >= 60) { streak++; d.setDate(d.getDate() - 1); }
  return {
    today: all[dayKey(now)] || 0, week, weekTotal: week.reduce((s, x) => s + x.seconds, 0), streak,
    days: Object.values(all).filter(s => s >= 60).length,
  };
}

export function useReadingStats() {
  const [stats, setStats] = useState(() => readingStats());
  useEffect(() => {
    const fn = () => setStats(readingStats());
    subs.add(fn);
    return () => subs.delete(fn);
  }, []);
  return stats;
}

/** 阅读器里用：每 15 秒看一眼，最近 2 分钟有动静、窗口可见就记 15 秒。返回「有动静了」的打点函数 */
export function useReadingClock() {
  const [touch] = useState(() => ({ at: Date.now() }));
  useEffect(() => {
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - touch.at < 120000) addReading(15);
    }, 15000);
    return () => clearInterval(tick);
  }, [touch]);
  return () => { touch.at = Date.now(); };
}

export const fmtMinutes = (s) => s < 60 ? (s ? '不到 1 分钟' : '0 分钟') : s < 3600 ? `${Math.round(s / 60)} 分钟` : `${(s / 3600).toFixed(s < 36000 ? 1 : 0)} 小时`;
