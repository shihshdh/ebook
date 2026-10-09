// 生成封面交给后台线程画（jacket.worker.js），主线程拿到的是一张 JPEG。
// 以前每本书的生成封面是一个 SVG data URL：浏览器给每张 SVG 图单独建一份文档（页面、框架、解析、排字），
// 手机上一张七八毫秒，首页一打开三十多张挤在一秒里，唱片转着转着就顿一下。
//   · 按封面实际显示的大小画（300 / 600 / 900 宽三档），不糊也不白画大图
//   · 封面一挂上、知道多大就排队画（不等滚到附近：拼贴、光盘这些被裁在框外的封面，转进来时得已经画好）；
//     同时最多两张在画，屏幕上的先画；画好的记住，同一本书再出现（切页回来、换个地方显示）直接用
//   · 没有后台线程或 OffscreenCanvas（很旧的系统 WebView）就退回原来的 SVG
import { jacketKey, jacketSvg } from './jacket-art.js';

const canWork = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
  && typeof OffscreenCanvas.prototype.convertToBlob === 'function';
let worker = null, broken = !canWork;
const done = new Map();      // 书 → Map(档位 → 图片地址)
const waiting = new Map();   // `${书}@${档位}` → { book, scale, near: [在不在屏幕附近], waiters: [画好的回调] }
const running = new Map();   // 任务号 → 等待项 key
let seq = 0;
const MAX = 2;

/** 显示宽度（CSS 像素）→ 档位：画成 300 × 档位 宽，够这块地方在本机屏幕上清晰显示 */
export function jacketScale(cssWidth) {
  const px = cssWidth * Math.min(globalThis.devicePixelRatio || 1, 3);
  return px <= 300 ? 1 : px <= 600 ? 2 : 3;
}

/** 已经画好的：优先要的档位，没有就给已有的最大一档（先顶着，大的画好再换）；没有返回 '' */
export function jacketNow(book, scale = 0) {
  if (broken) return jacketSvg(book);
  const have = done.get(jacketKey(book));
  if (!have) return '';
  if (scale && have.has(scale)) return have.get(scale);
  return have.get(Math.max(...have.keys()));
}
/** 要的这一档已经有了 */
export const jacketReady = (book, scale) => broken || !!done.get(jacketKey(book))?.has(scale);

function finish(key, url) {
  const w = waiting.get(key);
  if (!w) return;
  waiting.delete(key);
  if (url) {
    const k = jacketKey(w.book);
    if (!done.has(k)) done.set(k, new Map());
    done.get(k).set(w.scale, url);
  }
  for (const cb of w.waiters) cb(url || jacketSvg(w.book));
}

function start() {
  if (worker || broken) return worker;
  try {
    worker = new Worker(new URL('./jacket.worker.js', import.meta.url), { type: 'module' });
  } catch { broken = true; return null; }
  worker.onmessage = ({ data: { id, blob } }) => {
    const key = running.get(id);
    running.delete(id);
    finish(key, blob ? URL.createObjectURL(blob) : '');
    pump();
  };
  // 后台线程起不来（被拦、脚本加载失败）：之后都用 SVG，排着的也用 SVG 交差
  worker.onerror = () => {
    broken = true;
    worker = null;
    for (const key of [...running.values(), ...waiting.keys()]) finish(key, '');
    running.clear();
  };
  return worker;
}

function pump() {
  while (running.size < MAX) {
    const busy = new Set(running.values());
    let pick = null;
    for (const [key, w] of waiting) {
      if (busy.has(key)) continue;
      if (!pick) pick = key;
      if (w.near.some(f => f())) { pick = key; break; }
    }
    if (!pick) return;
    const wk = start();
    if (!wk) { finish(pick, ''); continue; }
    const id = ++seq;
    running.set(id, pick);
    const { title = '', author = '', publisher = '' } = waiting.get(pick).book;
    wk.postMessage({ id, book: { title, author, publisher }, scale: waiting.get(pick).scale });
  }
}

/**
 * 要一张生成封面，画好了调 onReady(图片地址)。返回取消函数：封面卸载了、真封面先到了，就不用再画
 * （已经在画的照样画完记下来，下回用得上）。排队时屏幕上的先画，其余按要的先后。
 * @param scale  档位（jacketScale）
 * @param near   这本此刻在不在屏幕附近
 */
export function requestJacket(book, scale, near, onReady) {
  if (broken) { onReady(jacketSvg(book)); return () => {}; }
  const have = done.get(jacketKey(book))?.get(scale);
  if (have) { onReady(have); return () => {}; }
  const key = `${jacketKey(book)}@${scale}`;
  let w = waiting.get(key);
  if (!w) waiting.set(key, w = { book, scale, near: [], waiters: [] });
  w.waiters.push(onReady);
  if (near) w.near.push(near);
  pump();
  return () => {
    const x = waiting.get(key);
    if (!x) return;
    x.waiters = x.waiters.filter(f => f !== onReady);
    x.near = x.near.filter(f => f !== near);
    if (!x.waiters.length && ![...running.values()].includes(key)) waiting.delete(key);
  };
}
