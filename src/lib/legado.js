// 自己导入的 Legado 书源（C6）：存取、在书源里搜书、整本下载。
//
// 规则引擎在 src/plugins/legado/（只认一个规则子集，书源里的 <js>、@js:、java.* 一律不执行）；这里管「怎么用」：
//   存：当前账户的 IndexedDB（kv 的 legado:sources），换账户各是各的，账户备份也会带上
//   搜：启用的书源一起搜（同时最多 6 个），谁先回来先显示；单个书源 15 秒没回就算超时，不拖累别的
//   下：详情 → 目录 → 各章正文（同时 3 章，失败重试一次），拼成「一章一个标题」的文本，再转成 EPUB 放进书架
// 应用不内置任何站点的书源：书源永远是用户自己导入的。
import { useEffect, useState } from 'react';
import { idbGet, idbSet } from './idb.js';
import { getText } from './net.js';
// 规则引擎、txt→EPUB（带 JSZip）都按需加载：首屏只需要书源列表和开关
const engine = () => import('../plugins/legado/index.js');

const KEY = 'legado:sources';
const hash = (str) => { let h = 2166136261; for (const c of str) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
export const sourceIdOf = (s) => hash(`${s.bookSourceUrl}|${s.bookSourceName}`);

// 这几类问题会让「搜索 → 目录 → 正文」走不通，导入后默认不启用；其余（发现页、登录、个别可选字段）不影响读书
const FATAL = /^(缺少|书源地址|搜索地址|搜索请求|搜索规则|目录规则|正文规则)/;
export const fatalOf = (check) => (check?.unsupported || []).filter(m => FATAL.test(m));

let cache = null;
const subs = new Set();
const emit = () => subs.forEach(fn => fn(cache));

/** @returns {Promise<{id, source, enabled, check: {ok, unsupported}, addedAt}[]>} */
export async function listSources() {
  if (!cache) cache = (await idbGet('kv', KEY).catch(() => null)) || [];
  return cache;
}
async function save(list) { cache = list; await idbSet('kv', KEY, list); emit(); }

export function useSources() {
  const [list, setList] = useState(cache);
  useEffect(() => {
    let alive = true;
    listSources().then(l => { if (alive) setList(l); });
    const fn = (l) => setList(l);
    subs.add(fn);
    return () => { alive = false; subs.delete(fn); };
  }, []);
  return list;
}

/** 导入一段书源 JSON（单个或数组）。同一个书源（地址 + 名字相同）再导一次就覆盖，保留原来的开关 */
export async function importSources(text) {
  const { parseSources, checkSource } = await engine();
  const { sources, errors } = parseSources(text);
  const list = [...await listSources()];
  let added = 0, updated = 0, broken = 0;
  for (const source of sources) {
    const id = sourceIdOf(source), check = checkSource(source), fatal = fatalOf(check);
    if (fatal.length) broken++;
    const at = list.findIndex(e => e.id === id);
    const entry = { id, source, check, enabled: !fatal.length && source.enabled !== false, addedAt: Date.now() };
    if (at >= 0) { list[at] = { ...entry, enabled: list[at].enabled && !fatal.length, addedAt: list[at].addedAt }; updated++; }
    else { list.push(entry); added++; }
  }
  if (sources.length) await save(list);
  return { added, updated, broken, errors };
}

/** 从网址导入（书源合集常以 JSON 链接分享） */
export async function importFromUrl(url) {
  if (!/^https?:\/\//i.test(url.trim())) throw new Error('请输入 http(s) 开头的网址');
  return importSources(await getText(url.trim()));
}

export async function setSourceEnabled(id, on) {
  await save((await listSources()).map(e => e.id === id ? { ...e, enabled: on } : e));
}
export async function removeSource(id) {
  await save((await listSources()).filter(e => e.id !== id));
}

/**
 * 在启用的书源里搜书。每个书源一有结果就 onResult({ entry, items, error })，全部结束后 resolve。
 * signal 中止时不再回调。
 */
export async function searchSources(keyword, { signal, onResult, timeout = 15000, concurrency = 6 } = {}) {
  const queue = (await listSources()).filter(e => e.enabled);
  const { search } = await engine();
  const one = async (entry) => {
    const ctl = new AbortController(), stop = () => ctl.abort();
    const timer = setTimeout(stop, timeout);
    signal?.addEventListener('abort', stop);
    try {
      const items = await search(entry.source, keyword, { signal: ctl.signal });
      if (!signal?.aborted) onResult?.({ entry, items });
    } catch (err) {
      if (!signal?.aborted) onResult?.({ entry, items: [], error: ctl.signal.aborted ? '超时' : (err?.message || '出错了') });
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', stop); }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (let e; !signal?.aborted && (e = queue.shift());) await one(e);
  }));
}

/** 书源搜索结果 → 详情面板用的 Book（字段见 plugins/registry.js） */
export function toBook(entry, item) {
  const name = entry.source.bookSourceName;
  return {
    id: `legado:${entry.id}:${hash(item.bookUrl)}`, source: 'legado', aid: '',
    title: item.name, alt: '', author: item.author || '', publisher: name, status: '', animated: false,
    tags: (item.kind || '').split(/[,，、|\s]+/).filter(Boolean).slice(0, 4),
    description: item.intro || '', length: item.wordCount || '', updated: '', illustrated: false,
    coverSrc: item.coverUrl || '',
    downloads: [{
      kind: 'txt', label: '整本 · 按目录逐章下载',
      note: item.latestChapter ? `来自「${name}」· 最新：${item.latestChapter}` : `来自「${name}」`,
      sourceId: entry.id, bookUrl: item.bookUrl, title: item.name,
    }],
  };
}

const MISSING = '（这一章没下载下来：书源暂时打不开。可以稍后重新下载，或者换个书源。）';

/** 整本下载：详情 → 目录 → 各章正文 → EPUB。onProgress(已下章数, 总章数) */
export async function downloadBook(target, onProgress) {
  const entry = (await listSources()).find(e => e.id === target.sourceId);
  if (!entry) throw new Error('这个书源已经删掉了');
  const s = entry.source;
  const { bookInfo, toc, content } = await engine();
  let tocUrl = target.bookUrl;
  try { tocUrl = (await bookInfo(s, target.bookUrl)).tocUrl || tocUrl; } catch { /* 详情页解析不了就把书籍页当目录页试试 */ }
  const chapters = await toc(s, tocUrl);
  if (!chapters.length) throw new Error('书源没给出目录');
  const texts = new Array(chapters.length);
  let next = 0, done = 0, failed = 0;
  onProgress?.(0, chapters.length);
  const worker = async () => {
    for (let i; (i = next++) < chapters.length;) {
      let text = '';
      for (let attempt = 0; attempt < 2 && !text; attempt++) {
        try { text = await content(s, chapters[i].url); } catch { /* 再试一次 */ }
      }
      if (!text) failed++;
      texts[i] = text || MISSING;
      onProgress?.(++done, chapters.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, chapters.length) }, worker));
  if (failed === chapters.length) throw new Error('正文一章都没下载下来');
  const titles = new Set(chapters.map(c => c.title.trim()));
  const body = chapters.map((c, i) => `${c.title.trim()}\n${texts[i]}`).join('\n');
  const { txtToEpub } = await import('../reader/txt.js');
  const epub = await txtToEpub(new Blob([body]), target.title || '', { isHeading: (line) => titles.has(line.trim()) });
  return new Blob([epub], { type: 'application/epub+zip' });
}
