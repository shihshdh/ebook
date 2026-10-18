// mojimoon/wenku8 书源插件。
//
// 上游：https://github.com/mojimoon/wenku8 （MIT，GitHub Actions 每天自动更新）
// 它已经把反爬、抓取、打包全做完了，我们只读它产出的三份静态文件：
//   out/wenku_catalog.json  全站目录（书名、作者、文库、标签、简介、状态、字数、更新日期）
//   out/merged.csv          每本书的下载来源：蓝奏云 EPUB（链接+提取码）、TXT 转的 EPUB（GitHub 直链）
//   out/epub_index.json     "重制版"：带封面插图、按卷生成的 EPUB，放在 GitHub Releases；
//                           以及轻小说文库已下架正文、无法重制的书（blocked）——这些书照常提供其它来源的下载，只是没有插图版
// 三份合起来约 3MB，缓存在 IndexedDB，过期（6 小时）后在后台刷新，先用旧的。
import { idbGet, idbSet } from '../../lib/idb.js';
import { getBinary, getText, releaseAssetUrls, repoFileUrls } from '../../lib/net.js';
import { build as buildCatalog } from './build.js';
import { isNative } from '../../lib/native.js';

export const id = 'mojimoon';
export const kind = 'catalog';
export const name = '轻小说文库 · mojimoon';
export const short = '轻小说文库';
export const description = '轻小说文库（wenku8）的 EPUB 整合站。插图重制版按卷下载，含封面、插图与分卷目录；其余提供纯文本 EPUB 与蓝奏云链接。';
export const homepage = 'https://wenku.mojimoon.top/';
export const repo = 'https://github.com/mojimoon/wenku8';
export const license = 'MIT';
export const version = '1.0.0';

const OWNER = 'mojimoon', REPO = 'wenku8', BRANCH = 'main';
const LANZOU = 'https://wenku8.lanzov.com/';
const CACHE_KEY = 'plugin:mojimoon:v1';
const TTL = 6 * 60 * 60 * 1000;

const file = (path) => repoFileUrls(OWNER, REPO, BRANCH, path);

async function fetchAll(onStatus) {
  onStatus?.('正在取书目…');
  const [catalog, csv, index] = await Promise.all([
    getText(file('out/wenku_catalog.json')),
    getText(file('out/merged.csv')),
    getText(file('out/epub_index.json')),
  ]);
  return { catalog, csv, index, fetchedAt: Date.now() };
}

// 保留同步导出供脚本使用；应用启动时走独立 Worker，JSON/CSV 和下载候选不再堵住开屏。
export const build = raw => buildCatalog(raw, { native: isNative });
async function buildAsync(raw) {
  if (typeof Worker === 'undefined') return build(raw);
  try {
    return await new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./build.worker.js', import.meta.url), { type: 'module' });
      const done = (fn, value) => { clearTimeout(timer); worker.terminate(); fn(value); };
      const timer = setTimeout(() => done(reject, new Error('书目后台整理超时')), 20000);
      worker.onmessage = ({ data }) => data.error ? done(reject, new Error(data.error)) : done(resolve, data.books);
      worker.onerror = event => { event.preventDefault(); done(reject, new Error(event.message || '书目 Worker 不可用')); };
      worker.postMessage({ raw, native: isNative });
    });
  } catch (error) {
    console.warn('[mojimoon] 后台整理不可用，使用兼容路径', error);
    return build(raw);
  }
}

/**
 * 请上游生成插图版：打开 mojimoon/wenku8 预填好的 Issue（格式照抄上游网页的「请求生成」），用户用自己的 GitHub 账号提交，
 * 上游的 GitHub Actions 从源站重新生成带封面插图的 EPUB（按卷），几十分钟到几小时后进 epub_index.json，书目刷新后这里就能按卷下载。
 * 上游限流：每个账号 1 小时 5 条、24 小时 10 条，全站每天新生成 50 本，超出排队。EBOOK 自己不抓源站。
 */
export function requestBuildUrl(book) {
  const body = `aid: ${book.aid}
volumes: all
max_side: 1000
images: yes

（由 EBOOK 预填，直接提交即可；GitHub Actions 将自动生成并回复下载链接。）`;
  return `https://github.com/${OWNER}/${REPO}/issues/new?template=build-request.md&title=${encodeURIComponent(`[build] ${book.aid} ${book.title}`)}&body=${encodeURIComponent(body)}`;
}

let memo = null;

/**
 * 读取书目。先给缓存（哪怕过期），过期则后台刷新后再回调一次 onUpdate。
 * @returns {Promise<{books: Book[], fetchedAt: number, stale: boolean}>}
 */
export async function load({ force = false, onStatus, onUpdate } = {}) {
  if (memo && !force) return memo;
  const cached = force ? null : await idbGet('kv', CACHE_KEY).catch(() => null);
  if (cached) {
    memo = { books: await buildAsync(cached), fetchedAt: cached.fetchedAt, stale: Date.now() - cached.fetchedAt > TTL };
    if (memo.stale) {
      fetchAll().then(async raw => {
        await idbSet('kv', CACHE_KEY, raw);
        memo = { books: await buildAsync(raw), fetchedAt: raw.fetchedAt, stale: false };
        onUpdate?.(memo);
      }).catch(err => console.warn('[mojimoon] 后台刷新失败', err));
    }
    return memo;
  }
  const raw = await fetchAll(onStatus);
  onStatus?.('正在整理书目…');
  await idbSet('kv', CACHE_KEY, raw).catch(() => {});
  memo = { books: await buildAsync(raw), fetchedAt: raw.fetchedAt, stale: false };
  return memo;
}

/**
 * 下载一卷/一本。返回 Blob（EPUB）。
 * @param {object} target  { urls }（来自 download.urls 或 volume.urls）
 */
export async function download(target, onProgress) {
  return getBinary(target.urls, onProgress, { expectZip: true });
}
