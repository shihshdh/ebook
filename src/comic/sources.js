// 漫画源（Venera 格式）：订阅源索引、装 / 更新 / 停用 / 删除、每个源的设置和存档、「测一遍」。
//
//   源从哪来：随包附带白名单里的源（default-sources.js，scripts/comic-bundle-defaults.mjs 按固定提交生成），首次使用自动装上；
//            更新、再加别的从 venera-configs（Venera 官方）和 EZvenera 社区仓库的 index.json 拉（net.js 的镜像竞速）。
//            注意：这两个仓库都没有写许可证
//   收哪些：  policy.js 的白名单，成人站不显示
//   存在哪：  当前账户的 IndexedDB（kv）
//              comic:sources          装好的源（连脚本一起存）
//              comic:runtime:<仓库>   那个仓库的 _venera_.js（源脚本依赖的 Venera 接口定义）
//              comic:data:<源>        源自己存的东西：设置、设备号、cookie（换账户各是各的，账户备份带上）
//   怎么跑：  每个源一个沙箱（runtime/host.js），同时最多开 6 个，最久没用的先关
import { useEffect, useState } from 'react';
import { idbDel, idbGet, idbSet } from '../lib/idb.js';
import { getText, repoFileUrls } from '../lib/net.js';
import { isIOS, isNative, mobileUI } from '../lib/native.js';
import { comicSkipReason, isSelfHosted } from './policy.js';

export const REPOS = [
  { id: 'venera', name: 'Venera 官方源', owner: 'venera-app', repo: 'venera-configs', branch: 'main' },
  { id: 'ezvenera', name: 'EZvenera 社区源', owner: 'WEP-56', repo: 'EZvenera-config', branch: 'main' },
];
const repoById = Object.fromEntries(REPOS.map(r => [r.id, r]));
const fileUrls = (repo, path) => repoFileUrls(repo.owner, repo.repo, repo.branch, path);

/**
 * 哪里能用漫画源：
 *   网页版：连不上漫画网站（浏览器跨域限制，漫画站不给 CORS 头）
 *   iPhone：WKWebView 的原生桥对子 frame 开放、Capacitor 不查来源（见 runtime/sandbox.js），原生侧加上主 frame 检查之前不开放
 */
export const comicSupported = isNative && (!isIOS || window.__EBOOK_BRIDGE_GUARD__ === 'main-frame');
export const comicUnsupportedWhy = !isNative ? '网页版受浏览器的跨域限制，连不上漫画网站。漫画源请在 Windows、安卓或新版 iPhone 客户端里使用。'
  : !comicSupported ? '此 iPhone 版本缺少漫画源安全防护，请更新客户端后使用。' : '';

const KEY = 'comic:sources';
const runtimeKey = (repo) => `comic:runtime:${repo}`;
const dataKey = (id) => `comic:data:${id}`;
const classNameOf = (code) => /\bclass\s+([A-Za-z_$][\w$]*)\s+extends\s+ComicSource\b/.exec(code)?.[1] || '';
export const newer = (a, b) => {   // 版本号 a 比 b 新
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; }
  return false;
};

// ---------- 装好的源 ----------
let cache = null, loading = null;
const subs = new Set();
const emit = () => subs.forEach(fn => fn(cache));

// 装过默认源的标记：值是装到的内置包版本
const DEFAULTS_KEY = 'comic:defaults';
/**
 * 首次使用装上随包附带的源（同默认书源）：已经有的（同一个 id）不动，用户的开关、设置、自己装的新版都优先；
 * 删掉的不会再补回来（标记记着装过哪一版）。内置包里的 _venera_.js 比本机的新才换
 */
async function installDefaults(list) {
  const { default: bundled } = await import('./default-sources.js');
  const have = new Set(list.map(e => e.id)), now = Date.now(), added = [];
  for (const s of bundled.sources) {
    const id = `${bundled.repo}:${s.fileName.replace(/\.js$/, '')}`;
    if (have.has(id)) continue;
    added.push({ id, repo: bundled.repo, key: s.key, name: s.name, version: s.version, fileName: s.fileName, className: s.className, code: s.code,
      enabled: s.enabled, autoOff: s.autoOff, addedAt: now, updatedAt: now, builtin: bundled.version });
    // 默认设置（包子漫画换个能用的域名）：源还没有自己的存档才写
    if (s.settings && !(await idbGet('kv', dataKey(id)))) await idbSet('kv', dataKey(id), { settings: s.settings });
  }
  const runtime = await idbGet('kv', runtimeKey(bundled.repo));
  if (!runtime?.code || (runtime.builtin && runtime.builtin < bundled.version)) await idbSet('kv', runtimeKey(bundled.repo), { code: bundled.runtime, at: now, builtin: bundled.version });
  // 列表先写，标记后写：中途失败下次重来，按 id 去重不会装两遍
  const next = [...list, ...added];
  if (added.length) await idbSet('kv', KEY, next);
  await idbSet('kv', DEFAULTS_KEY, bundled.version);
  return next;
}

/** @returns {Promise<{id, repo, key, name, version, fileName, className, code, enabled, autoOff?, builtin?, addedAt, updatedAt, test?}[]>} */
export async function listComicSources() {
  if (cache) return cache;
  if (!loading) loading = (async () => {
    // 读失败不能当成新账户（会把用户的列表盖掉）：这里出错就整个抛出去
    const [stored, installed] = await Promise.all([idbGet('kv', KEY), idbGet('kv', DEFAULTS_KEY)]);
    let list = Array.isArray(stored) ? stored : [];
    if (comicSupported && !installed) list = await installDefaults(list);
    return (cache = list);
  })().finally(() => { loading = null; });
  return loading;
}
async function save(list) { await idbSet('kv', KEY, list); cache = list; emit(); }
async function patch(id, change) {
  await save((await listComicSources()).map(e => (e.id === id ? { ...e, ...change } : e)));
}

export function useComicSources() {
  const [list, setList] = useState(cache);
  useEffect(() => {
    let alive = true;
    listComicSources().then(l => { if (alive) setList(l); }).catch(() => { if (alive) setList([]); });
    subs.add(setList);
    return () => { alive = false; subs.delete(setList); };
  }, []);
  return list;
}

// ---------- 源索引 ----------
/**
 * 拉某个仓库的源索引，标上收不收、装没装、有没有新版。
 * 同一个 key 有多个文件时（拷贝漫画有个「多账号」版）只列和 key 同名的那个
 */
export async function fetchIndex(repoId) {
  const repo = repoById[repoId];
  if (!repo) throw new Error('没有这个源仓库');
  let list;
  try { list = JSON.parse(await getText(fileUrls(repo, 'index.json'))); } catch { throw new Error('源索引读不到'); }
  if (!Array.isArray(list)) throw new Error('源索引格式不对');
  const installed = new Map((await listComicSources()).map(e => [e.id, e]));
  const items = list
    .filter(e => e && typeof e.key === 'string' && /^[\w.-]+\.js$/.test(e.fileName || ''))
    .map(e => {
      const id = `${repoId}:${e.fileName.replace(/\.js$/, '')}`, have = installed.get(id);
      return {
        id, repo: repoId, key: e.key, name: String(e.name || e.key), fileName: e.fileName, version: String(e.version || ''),
        description: String(e.description || ''), skip: comicSkipReason({ key: e.key, name: e.name }),
        installed: !!have, update: !!have && newer(e.version, have.version),
      };
    });
  return items.filter(e => !items.some(o => o !== e && o.key === e.key && o.fileName === `${o.key}.js` && e.fileName !== `${e.key}.js`));
}

/** 装一个源（再装一次 = 更新：保留开关和存档，上次「测一遍」的结果作废） */
export async function installSource(item) {
  if (comicSkipReason(item)) throw new Error('这个源不收');
  const repo = repoById[item.repo];
  const [code, runtime] = await Promise.all([getText(fileUrls(repo, item.fileName)), getText(fileUrls(repo, '_venera_.js'))]);
  const className = classNameOf(code);
  if (!className) throw new Error('不是 Venera 漫画源脚本');
  if (!/\bclass\s+ComicSource\b/.test(runtime)) throw new Error('仓库里的 _venera_.js 不对');
  await idbSet('kv', runtimeKey(repo.id), { code: runtime, at: Date.now() });
  const list = [...await listComicSources()], now = Date.now();
  const entry = { id: item.id, repo: item.repo, key: item.key, name: item.name, version: item.version, fileName: item.fileName, className, code, enabled: true, addedAt: now, updatedAt: now };
  const at = list.findIndex(e => e.id === item.id);
  if (at >= 0) list[at] = { ...entry, enabled: list[at].enabled, addedAt: list[at].addedAt };
  else list.push(entry);
  closeSource(item.id);
  await save(list);
  return entry;
}

/** 装好的源里，索引上有新版的：[索引条目] */
export async function checkUpdates() {
  const repos = [...new Set((await listComicSources()).map(e => e.repo))];
  const all = await Promise.all(repos.map(r => fetchIndex(r).catch(() => [])));
  return all.flat().filter(e => e.update && !e.skip);
}

export async function setComicSourceEnabled(id, on) { await patch(id, { enabled: on, autoOff: false }); if (!on) closeSource(id); }
export async function removeComicSource(id) {
  closeSource(id);
  dropPreview(id);
  clearTimeout(timers.get(id)); timers.delete(id); stores.delete(id);
  await idbDel('kv', dataKey(id));
  await save((await listComicSources()).filter(e => e.id !== id));
}

// ---------- 源的存档（load_data / save_data / 设置 / cookie） ----------
const stores = new Map();   // id → 存档对象（沙箱开着时的那份）
const timers = new Map();
function remember(id, key, value) {
  const data = stores.get(id);
  if (!data) return;
  if (value === undefined) delete data[key]; else data[key] = value;
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => { timers.delete(id); idbSet('kv', dataKey(id), data).catch(e => console.warn('漫画源存档失败', e)); }, 400));
}

// ---------- 沙箱 ----------
// 同时开着的沙箱：每个都是一个 iframe（源脚本 + 兼容层常驻内存）。iOS 的 WKWebView 内存上限低（超了整页白屏重载），
// 手机上少开；闲着超过一分钟（电脑三分钟）的关掉，要用再开（开一个几十毫秒）
const MAX_LIVE = isIOS ? 3 : mobileUI ? 4 : 6;
const IDLE_MS = mobileUI ? 60000 : 180000;
const live = new Map();   // id → { box: Promise<Sandbox>, sandbox?: Sandbox, used, leases }
if (typeof window !== 'undefined') setInterval(() => {
  const now = Date.now();
  for (const [k, h] of live) if (!h.leases && h.sandbox && !h.sandbox.busy && now - h.used > IDLE_MS) closeSource(k);
}, 30000);

// 开太多时关掉最久没用、而且空闲的那个：正在用的（有人租着、有调用没回来、有图在下）不关，宁可暂时多开几个
function evict(keep) {
  const idle = [...live.entries()].filter(([k, h]) => k !== keep && !h.leases && h.sandbox && !h.sandbox.busy).sort((a, b) => a[1].used - b[1].used);
  for (let i = 0; live.size > MAX_LIVE && i < idle.length; i++) closeSource(idle[i][0]);
}

/** 用一个源做一串事（测一遍、以后的阅读器）：期间这个沙箱不会被回收 */
export async function withSource(id, fn) {
  const box = await openSource(id), hit = live.get(id);
  if (hit) hit.leases = (hit.leases || 0) + 1;
  try { return await fn(box); }
  finally { if (hit) { hit.leases--; hit.used = Date.now(); evict(); } }
}

/** 打开（或拿已经开着的）源沙箱，等源装载好 */
export async function openSource(id) {
  const hit = live.get(id);
  if (hit) { hit.used = Date.now(); return hit.box; }
  const box = (async () => {
    const entry = (await listComicSources()).find(e => e.id === id);
    if (!entry) throw new Error('这个漫画源已经删掉了');
    const [runtime, data] = await Promise.all([idbGet('kv', runtimeKey(entry.repo)), idbGet('kv', dataKey(id))]);
    if (!runtime?.code) throw new Error('缺少 _venera_.js，重新添加一次这个源');
    // 上次关沙箱时还没写进去的存档以内存里的为准
    const store = stores.get(id) || (data && typeof data === 'object' ? data : {});
    stores.set(id, store);
    const { Sandbox } = await import('./runtime/host.js');
    const sandbox = new Sandbox({
      code: entry.code, runtime: runtime.code, className: entry.className, data: store, allowPrivate: isSelfHosted(entry.key),
      onData: (key, value) => remember(id, key, value),
      onUi: (m) => window.dispatchEvent(new CustomEvent('librarium:comic-ui', { detail: { source: entry.name, ...m } })),
    });
    await sandbox.ready;
    return sandbox;
  })();
  const hit2 = { box, used: Date.now(), leases: 0 };
  live.set(id, hit2);
  box.then(sandbox => { hit2.sandbox = sandbox; }, () => { if (live.get(id) === hit2) live.delete(id); });
  evict(id);
  return box;
}
export function closeSource(id) {
  const hit = live.get(id);
  if (!hit) return;
  live.delete(id);
  hit.box.then(box => box.close(), () => {});
}

/** 源的设置（展开设置时调）：[{ key, title, type, options, value, buttonText }] */
export async function sourceSettings(id) { return (await openSource(id)).meta.settings; }
export async function setSourceSetting(id, key, value) { return (await openSource(id)).call('setSetting', [key, value]); }
export async function runSettingCallback(id, key) { return (await openSource(id)).call('callback', [key]); }

// ---------- 测一遍 ----------
// 搜这些词，一个搜不到换下一个（繁体站、日文站、英文站各有各的词）
const KEYWORDS = {
  // MangaDex 上 One Piece 这类官方连载只有外链，没有图
  manga_dex: ['Frieren', 'Dungeon Meshi'], comick: ['One Piece', 'Frieren'],
  comic_walker: ['異世界', '魔法'], shonen_jump_plus: ['怪獣', '魔法'],
  Komiic: ['航海王', '鬼滅之刃', '海賊王'], mycomic: ['航海王', '鬼滅之刃', '海賊王'], ccc: ['愛', '王'],
};
const DEFAULT_KEYWORDS = ['海贼王', '航海王', '鬼灭之刃', '海賊王'];

const previews = new Map();   // id → 第一页图片的 blob 地址（只在本次运行里留着）
export const previewOf = (id) => previews.get(id);
function dropPreview(id) { const url = previews.get(id); if (url) URL.revokeObjectURL(url); previews.delete(id); }

const shortError = (err) => {
  const m = String(err?.message || err || '出错了');
  if (/HTTP\s*[45]\d\d|status code:?\s*[45]\d\d|状态码\s*[45]\d\d/i.test(m)) return `网站返回错误 ${/[45]\d\d/.exec(m)[0]}`;
  if (!/imported module/i.test(m) && /error sending request|failed to fetch|network|connect|dns|refused|证书|certificate|timed? ?out|超时/i.test(m)) return '连不上网站';
  return m.slice(0, 60);
};

async function testOne(entry, signal) {
  let stage = '源加载失败', box;
  try {
    return await withSource(entry.id, async (sandbox) => {
      box = sandbox;
      const meta = box.meta;
      if (!meta.search) throw new Error('这个源不支持搜索');
      const options = meta.searchOptions.map(o => o.default);
      stage = '搜不到漫画';
      let comics = [];
      for (const keyword of KEYWORDS[entry.key] || DEFAULT_KEYWORDS) {
        comics = (await box.call('search', [keyword, options, 1, null], { signal, timeout: 25000 })).comics;
        if (comics.length) break;
      }
      if (!comics.length) throw new Error('搜不到漫画');
      // 第一本下架了、没有章节就换下一本，最多试三本
      stage = '详情打不开';
      let comic, details;
      for (const [i, c] of comics.slice(0, 3).entries()) {
        try { details = await box.call('info', [c.id], { signal, timeout: 25000 }); comic = c; }
        catch (err) { if (signal?.aborted || i === Math.min(2, comics.length - 1)) throw err; continue; }
        if (details.single || details.chapters.length) break;
      }
      const chapter = details.chapters[0];
      if (!details.single && !chapter) throw new Error('没有章节');
      stage = '章节打不开';
      const { images } = await box.call('ep', [comic.id, chapter?.id ?? null], { signal, timeout: 25000 });
      if (!images.length) throw new Error('章节里没有图片');
      stage = '图片取不到';
      const { fetchImage } = await import('./images.js');
      const blob = await fetchImage(box, images[0], { comicId: comic.id, epId: chapter?.id ?? null, signal });
      dropPreview(entry.id);
      previews.set(entry.id, URL.createObjectURL(blob));
      return { ok: true, title: details.title || comic.title, comics: comics.length, chapters: details.chapters.length || 1, images: images.length, at: Date.now() };
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    const why = box?.challenged ? `被 Cloudflare 人机验证拦下（${box.challenged}）` : /^(搜不到漫画|没有章节|章节里没有图片|这个源不支持搜索)$/.test(err?.message) ? err.message : `${stage}：${shortError(err)}`;
    return { ok: false, why, at: Date.now() };
  }
}

/**
 * 「测一遍」：每个源真搜一次 → 打开第一本 → 第一章 → 取第一张图，都拿到才算能用。结果记在源上。
 * onProgress(已测, 总数)；signal 中止时测到哪算哪
 */
export async function testComicSources(ids, { onProgress, signal, concurrency = 3 } = {}) {
  const queue = (await listComicSources()).filter(e => ids.includes(e.id));
  const total = queue.length, results = new Map();
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, async () => {
    for (let e; !signal?.aborted && (e = queue.shift());) {
      const ctl = new AbortController(), stop = () => ctl.abort();
      const timer = setTimeout(stop, 60000);
      signal?.addEventListener('abort', stop);
      try { results.set(e.id, await testOne(e, ctl.signal)); }
      catch { if (!signal?.aborted) results.set(e.id, { ok: false, why: '超时', at: Date.now() }); }
      finally { clearTimeout(timer); signal?.removeEventListener('abort', stop); }
      onProgress?.(results.size, total);
    }
  }));
  // 同书源：没通过的停用（搜索时不再等它）；之前因为没通过被停用的（autoOff），这次通过了就重新启用。用户自己关掉的不动
  await save((await listComicSources()).map(e => {
    const t = results.get(e.id);
    if (!t) return e;
    if (!t.ok) return { ...e, test: t, enabled: false, autoOff: e.enabled || !!e.autoOff };
    return { ...e, test: t, enabled: e.autoOff ? true : e.enabled, autoOff: false };
  }));
  const all = [...results.values()];
  return { ok: all.filter(t => t.ok).length, failed: all.filter(t => !t.ok).length, total };
}
