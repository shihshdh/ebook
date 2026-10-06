// 公版书源：Project Gutenberg 的中文书（四大名著、诸子、史书、明清小说、鲁迅……约 430 本，全部公有领域）。
//
// 书目随应用打包（catalog.json，由同目录的 make-catalog.mjs 从 Gutenberg 官方目录生成）：
//   Gutendex 这类检索接口套着 Cloudflare 人机验证，客户端里调不了；这批书又基本不变，打包进来最省事，离线也能搜。
//   书名存繁体原文和简体，搜「西游记」「西遊記」都能找到。
// 下载用纯文本（UTF-8）：Gutenberg 自动生成的 EPUB 目录只有「书名 + 版权页」两项，没法用。
//   纯文本去掉首尾的英文声明、把每行 36 字的硬换行接回段落，再按「第X回/章/卷」切章，转成 EPUB 放进书架。
//   地址：gutenberg.org 和两个官方镜像 + GITenberg 的 GitHub 镜像（走 jsDelivr，带 CORS、国内线路多），一起竞速。
// 维基文库（zh.wikisource.org）在国内直连打不开，不符合「国内不开代理也能用」，没有接。
// 简体版：下载时用 OpenCC（opencc-js 的 t2cn，按词转换，「頭髮→头发」「著急→着急」「乾坤」不误转）把正文和目录转成简体，
// 转换表 50KB（gzip）只在下简体版时才加载；繁体原文照旧可下。
import { getBinary, repoFileUrls } from '../../lib/net.js';
import { CHAPTER } from '../../reader/chapter.js';

export const id = 'public';
export const kind = 'catalog';
export const name = '公版古籍 · Project Gutenberg';
export const short = '公版古籍';
export const description = 'Project Gutenberg 收录的中文公版书：四大名著、诸子百家、史书、明清小说、鲁迅等约 430 本。繁体原文，下载时自动按回 / 章分好目录。';
export const homepage = 'https://www.gutenberg.org/browse/languages/zh';
export const license = '公有领域';
export const version = '1.0.0';

const GUTENBERG = ['www.gutenberg.org', 'gutenberg.pglaf.org', 'aleph.pglaf.org'];
const urlsOf = (b) => [
  ...(b.gh ? repoFileUrls('GITenberg', b.gh, 'master', b.f) : []),
  ...GUTENBERG.map(h => `https://${h}/cache/epub/${b.n}/pg${b.n}.txt`),
];

const toBook = (b) => ({
  id: `${id}:${b.n}`, source: id, aid: String(b.n),
  title: b.s, alt: b.t !== b.s ? b.t : '', author: b.a, publisher: 'Project Gutenberg',
  status: '', animated: false, tags: b.tags, length: '', updated: b.issued, illustrated: false,
  description: b.d || '公有领域的中文典籍，繁体原文。下载后自动按回 / 章分好目录。',
  downloads: [
    { kind: 'txt', key: 'txt-s', label: '整本 · 简体', note: '由繁体原文自动转换 · 自动分章', urls: urlsOf(b), title: b.s, simplified: true },
    { kind: 'txt', label: '整本 · 繁体原文', note: '公有领域 · 自动分章', urls: urlsOf(b), title: b.t },
  ],
});

let memo = null;
export async function load() {
  if (memo) return memo;
  // 书目单独成块，打开书库时才加载，不占首屏
  const { default: catalog } = await import('./catalog.json');
  memo = { books: catalog.books.map(toBook), fetchedAt: catalog.generatedAt, stale: false };
  return memo;
}

const looksHtml = async (blob) => /^\s*<(!doctype|html|\?xml)/i.test(await blob.slice(0, 256).text());

const END_PUNCT = /[。！？；：，、」』”’…—）)!?.:;,]$/;
const LEAD_PUNCT = /^[、，。；：？！」』”’）)]/;   // 标点不会开一个新段落：一定是上一行被硬换行切断的
const SEPARATOR = /^[-=_*~·•\s　]{3,}$/;

/**
 * 把 Gutenberg 纯文本整理成「一段一行」，并找出章节标题。返回 { text, headings }。
 *
 * 这批 2007 年前后录入的古籍格式五花八门，没法只靠空行：
 *   · 大多每行硬换行在 36 字左右——先量出这本书的折行宽度 W：满宽的行说明段落还没完，下一行接上去
 *   · 有的通篇双倍行距（《呐喊》每行后面都空一行），这种书空行不代表分段
 *   · 标题：「第X回/章」那种（CHAPTER），以及前后都空着、不超过 20 字、不以标点结尾的短行
 *     （《呐喊》的「狂人日記」、《论语》的「學而第一」、《史记》的「史記 五帝本紀」）
 *   · 标题永远单独成段：有的书「第二回」下一行紧跟正文或一行 ----，不能接进标题里
 */
export function parseGutenberg(raw) {
  let t = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const s = t.search(/^\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG/m);
  if (s >= 0) t = t.slice(t.indexOf('\n', s) + 1);
  const e = t.search(/^\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/m);
  if (e >= 0) t = t.slice(0, e);
  t = t.replace(/^\s+/, '').replace(/^(Produced by|E-text prepared by|Transcribed by)[^\n]*\n/i, '');
  // 有的书下一回的标题直接粘在上一回末尾「……且聽下回分解。第三回 姬昌解圍進妲己」（《封神演义》），先断开
  t = t.replace(/(下回分解[。．.！!]?[」”]?)[ \t　]*(第[〇○零一二三四五六七八九十百千]+回)/g, '$1\n$2');
  // 反过来，正文第一句接在标题同一行「第一零四回　醉金剛小鰍生大浪 話說賈雨村……」（《红楼梦》），在「話說/卻說/且說」前断开
  t = t.replace(/^([ \t　]*第[〇○零一二三四五六七八九十百千]+回[^\n]{2,40}?)[ \t　]+((?:話|话|卻|却|且)說)/gm, '$1\n$2');
  const lines = t.split('\n').map(l => l.replace(/\s+$/, ''));
  const blank = (i) => i < 0 || i >= lines.length || !lines[i].trim() || SEPARATOR.test(lines[i].trim());

  // 折行宽度：长度 ≥16 的行里最常见的长度 W；落在 W±1 的行占三成以上，才算硬换行。
  // 按显示宽度折行的书（标点、半角字混排）满行会在 W 往下几个字里浮动：往下数，还常见的长度都算「满行」
  const counts = new Map();
  let long = 0, blanks = 0;
  for (const l of lines) { const n = l.trim().length; if (!n) blanks++; else if (n >= 16) { counts.set(n, (counts.get(n) || 0) + 1); long++; } }
  let W = 0, top = 0;
  for (const [n, c] of counts) if (c > top) { top = c; W = n; }
  let near = 0;
  for (const [n, c] of counts) if (Math.abs(n - W) <= 1) near += c;
  const wrapped = long > 20 && near / long >= 0.3;
  let low = W;
  while (low > W - 6 && (counts.get(low - 1) || 0) >= top * 0.15) low--;
  const full = (l) => wrapped && l.trim().length >= low;
  // 双倍行距（硬换行的每一行后面都空一行）：空行不算分段，标题前要空两行以上
  const doubled = wrapped && blanks >= (lines.length - blanks) * 0.8;
  const gap = doubled ? 2 : 1;
  const isolated = (i) => { for (let k = 1; k <= gap; k++) if (!blank(i - k)) return false; return blank(i + 1); };
  // 「第X回」标题明显比满行短；满行附近的是正文里恰好以「第二回……」开头的一行
  const isChapter = (tl) => CHAPTER.test(tl) && !/[，、；]$/.test(tl) && !(wrapped && tl.length >= low * 0.85);
  // 「第X回」够多的书（章回小说）就只认它，独占一段的短行（「詩云」、一百单八将名单）不当标题
  let chapters = 0;
  for (const l of lines) if (isChapter(l.trim())) chapters++;
  const useTitles = chapters < 30;

  const out = [], headings = new Set();
  let cur = null, curFull = false, sawBlank = false;
  const flush = () => { if (cur !== null) out.push(cur); cur = null; };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], tl = l.trim();
    if (!tl || SEPARATOR.test(tl)) { sawBlank = true; continue; }
    const chapter = isChapter(tl);
    const title = useTitles && !chapter && tl.length <= 20 && !END_PUNCT.test(tl) && !/^\d+[.、．]/.test(tl) && isolated(i);
    if (chapter || title) { flush(); out.push(tl); headings.add(tl); sawBlank = false; continue; }
    const joins = cur !== null && (curFull || LEAD_PUNCT.test(tl)) && !(sawBlank && !doubled);
    if (joins) cur += tl;
    else { flush(); cur = l; }
    curFull = full(l); sawBlank = false;
  }
  flush();
  return { text: out.join('\n'), headings };
}

/** 下载整本：纯文本 → 清理 → 切章 → EPUB（Blob） */
export async function download(target, onProgress) {
  const blob = await getBinary(target.urls, onProgress, {
    validate: async (b) => { if (await looksHtml(b)) throw new Error('镜像回了一个网页，不是正文'); },
  });
  const bytes = await blob.arrayBuffer();
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { text = new TextDecoder('gb18030').decode(bytes); }
  let { text: body, headings } = parseGutenberg(text);
  if (body.length < 200) throw new Error('下载到的正文是空的');
  if (target.simplified) {
    // tw→cn：「著」作助词时转成「着」（鐫著→镌着），t→cn 会漏掉这一类
    const { Converter } = await import('opencc-js/t2cn');
    const t2s = Converter({ from: 'tw', to: 'cn' });
    body = t2s(body);
    headings = new Set([...headings].map(h => t2s(h)));
  }
  const { txtToEpub } = await import('../../reader/txt.js');   // 带 JSZip，用到时才加载，不进首屏
  const epub = await txtToEpub(new Blob([body]), target.title || '', { isHeading: (line) => headings.has(line.trim()) });
  return new Blob([epub], { type: 'application/epub+zip' });
}
