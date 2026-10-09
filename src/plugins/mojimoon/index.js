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
import { parseCSV } from './csv.js';

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

const aidFromLink = (link) => (String(link || '').match(/book\/(\d+)\.htm/) || [])[1] || '';
const statusOf = (s = '') => ({ status: s.includes('完结') ? '已完结' : s.includes('连载') ? '连载中' : '', animated: s.includes('动画') });

/** 把三份原始数据拼成 Book[] */
export function build({ catalog, csv, index }) {
  const cat = JSON.parse(catalog);
  const idx = JSON.parse(index);
  const rows = parseCSV(csv.replace(/^﻿/, ''));
  const head = rows.shift() || [];
  const col = Object.fromEntries(head.map((h, i) => [h.trim(), i]));
  const get = (r, k) => (r[col[k]] ?? '').trim();

  /** @type {Map<string, any>} */
  const books = new Map();
  const ensure = (aid, seed) => {
    if (!books.has(aid)) books.set(aid, {
      id: `${id}:${aid}`, source: id, aid, title: '', alt: '', author: '', publisher: '', status: '', animated: false,
      tags: [], description: '', length: '', updated: '', illustrated: false, downloads: [], ...seed,
    });
    return books.get(aid);
  };

  for (const list of Object.values(cat.pages || {})) {
    for (const b of list) {
      const aid = String(b.aid);
      Object.assign(ensure(aid), {
        title: b.title || '', author: b.author || '', publisher: b.publisher || '',
        ...statusOf(b.status), length: b.length || '', updated: b.update || '',
        tags: String(b.tags || '').split(/\s+/).filter(Boolean),
        description: b.description || '',
        // 原站封面：img.wenku8.com 本身国内外都连不上，交给 covers.js 走图片代理
        coverSrc: b.cover_url || '',
      });
    }
  }

  for (const r of rows) {
    if (r.length < 3) continue;
    const aid = aidFromLink(get(r, 'novel_link')) || 'x' + get(r, 'main');
    const book = ensure(aid);
    if (!book.title) book.title = get(r, 'main');
    if (!book.author) book.author = get(r, 'author');
    book.alt = book.alt || get(r, 'alt');
    const upd = get(r, 'update');
    if (upd > book.updated) book.updated = upd;
    const path = get(r, 'download_url').replace(/^https:\/\/raw\.githubusercontent\.com\//, '');
    if (path) {
      const [owner, repo, branch, ...rest] = path.split('/');
      book.downloads.push({
        kind: 'txt', label: '纯文本 EPUB', note: `无插图 · ${get(r, 'txt_update') || '整本'}`,
        urls: repoFileUrls(owner, repo, branch, rest.join('/'), { big: true }),
      });
    }
    const lz = get(r, 'dl_label');
    if (lz) {
      // 「台版」是台湾正式出版的电子版，带官方封面、彩页和插图——插图来源里数量最多的一块（约 375 本）
      const taiban = get(r, 'dl_remark') === '台版';
      if (taiban) book.taiban = true;
      book.downloads.push({
        kind: 'external', label: taiban ? '蓝奏云 EPUB · 台版' : '蓝奏云 EPUB', taiban,
        note: [get(r, 'volume'), taiban ? '官方彩插' : get(r, 'dl_remark')].filter(Boolean).join(' · '),
        url: LANZOU + lz, pwd: get(r, 'dl_pwd'),
      });
    }
  }

  for (const [aid, entry] of Object.entries(idx)) {
    if (!entry) continue;
    if (entry.blocked) {
      const book = ensure(aid, { title: entry.title });
      book.blocked = entry.blocked;
      continue;
    }
    const variants = entry.volumes ? [entry] : Object.values(entry.variants || {});
    const v = variants.find(x => x.volumes?.length);
    if (!v) continue;
    const book = ensure(aid, { title: entry.title, author: entry.author });
    book.illustrated = true;
    book.builtAt = (v.built_at || '').slice(0, 10);
    // 重制版 EPUB 放在哪个仓库的 Releases：上游 2026-10 把它们搬到了 mojimoon/wenku8-epub，索引里用 repo 字段标明；
    // 以前固定拼 mojimoon/wenku8，搬家后插图版全部 404（报"网络不行"其实是地址错了）。没有 repo 字段的老索引照旧用主仓库
    const [owner, repo] = /^[\w.-]+\/[\w.-]+$/.test(v.repo || entry.repo || '') ? (v.repo || entry.repo).split('/') : [OWNER, REPO];
    book.downloads.unshift({
      kind: 'illustrated', label: '插图重制版', note: `含封面插图 · ${v.volumes.length} 卷`,
      volumes: v.volumes.map(vol => ({
        key: vol.file.replace(/\.epub$/, ''), title: vol.title, size: vol.size, images: vol.images, chapters: vol.chapters,
        urls: releaseAssetUrls(owner, repo, v.tag, `${aid}-${vol.file}`),
      })),
    });
  }

  const out = [];
  for (const b of books.values()) {
    if (!b.title) continue;
    if (b.blocked) b.blockedNote = "轻小说文库已因版权问题下架本书正文，无法重制插图版";
    // 可以请上游按需生成插图版的书：只有 TXT 源（没有蓝奏云 EPUB）、没下架、还没生成过——和上游 build_request.py 的校验一致
    b.canRequest = /^\d+$/.test(b.aid) && !b.illustrated && !b.blocked
      && b.downloads.some(d => d.kind === 'txt') && !b.downloads.some(d => d.kind === 'external');
    b.updated = b.updated || b.builtAt || '';
    if (!b.coverSrc && /^\d+$/.test(b.aid)) b.coverSrc = `http://img.wenku8.com/image/${Math.floor(b.aid / 1000)}/${b.aid}/${b.aid}s.jpg`;
    out.push(b);
  }
  return out;
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
    memo = { books: build(cached), fetchedAt: cached.fetchedAt, stale: Date.now() - cached.fetchedAt > TTL };
    if (memo.stale) {
      fetchAll().then(async raw => {
        await idbSet('kv', CACHE_KEY, raw);
        memo = { books: build(raw), fetchedAt: raw.fetchedAt, stale: false };
        onUpdate?.(memo);
      }).catch(err => console.warn('[mojimoon] 后台刷新失败', err));
    }
    return memo;
  }
  const raw = await fetchAll(onStatus);
  onStatus?.('正在整理书目…');
  await idbSet('kv', CACHE_KEY, raw).catch(() => {});
  memo = { books: build(raw), fetchedAt: raw.fetchedAt, stale: false };
  return memo;
}

/**
 * 下载一卷/一本。返回 Blob（EPUB）。
 * @param {object} target  { urls }（来自 download.urls 或 volume.urls）
 */
export async function download(target, onProgress) {
  return getBinary(target.urls, onProgress, { expectZip: true });
}
