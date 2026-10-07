// 订阅源（阅读 App 的「订阅」/ RSS 源）：存取、分类、取文章列表、取正文。
//
// 和书源一样：订阅源永远是用户自己导入的，应用不内置；源里的脚本（<js>、@js:、java.*、{{表达式}}）一律不执行。
// 每个源按能做到的程度分三种打开方式，尽量都能用：
//   list  规则（ruleArticles / ruleTitle / ruleLink）走得通：EBOOK 里列文章；有 ruleContent 的在 EBOOK 里读正文
//   rss   没写列表规则：按标准 RSS / Atom 解析
//   web   只给了网址（singleUrl），或者列表规则要执行脚本：在 EBOOK 自带的浏览器里打开它的网页
// 只有连网址都要靠脚本拼出来的才算用不了。
import { useEffect, useState } from 'react';
import { idbGet, idbSet } from './idb.js';
import { nativeRequest } from './native.js';

const KEY = 'legado:rss';
const rules = () => import('../plugins/legado/rules.js');
const request = () => import('../plugins/legado/request.js');
const hash = (str) => { let h = 2166136261; for (const c of str) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
export const rssIdOf = (s) => hash(`${s.sourceUrl}|${s.sourceName}`);
/** 阅读 App 的订阅源：有 sourceUrl、没有 bookSourceUrl */
export const isRssSource = (e) => !!e && typeof e === 'object' && !Array.isArray(e) && typeof e.sourceUrl === 'string' && !e.bookSourceUrl;

// buildRequest 认书源的字段名：借个壳
const shell = (s) => ({ bookSourceUrl: /^https?:\/\//i.test(s.sourceUrl) ? s.sourceUrl : 'https://invalid.invalid/', header: s.header });
const SCRIPT = /<\s*js\b|@js\s*:|\bjava\s*\./i;

/** 分类，只看规则写法、不联网。返回 { mode, content, sorts, issues, drop } */
export async function classify(s) {
  const { validateRule } = await rules();
  const { buildRequest } = await request();
  const issues = [], drop = [];
  const ok = (rule, list = false) => { try { validateRule(rule, list); return true; } catch { return false; } };
  // 网址本身打得开吗
  let home = '';
  try { home = buildRequest(shell(s), s.sourceUrl.split('\n')[0], { page: 1 }).url; } catch { /* 网址要靠脚本拼 */ }
  if (!/^https?:\/\//i.test(home)) return { mode: 'bad', content: false, sorts: [], issues: ['网址要执行脚本才能得到'], drop };
  // 分类：「名字::网址」一行一个（也有用 && 隔开的）；写成脚本的不认，只用首页
  let sorts = [];
  if (s.sortUrl && SCRIPT.test(s.sortUrl)) issues.push('分类要执行脚本，只显示首页');
  else if (s.sortUrl) {
    sorts = String(s.sortUrl).split(/\n|&&/).map(line => line.trim()).filter(Boolean).map(line => {
      const at = line.indexOf('::');
      return at < 0 ? { name: '首页', url: line } : { name: line.slice(0, at).trim(), url: line.slice(at + 2).trim() };
    }).filter(x => x.url && (() => { try { return /^https?:/i.test(buildRequest(shell(s), x.url, { page: 1 }).url); } catch { return false; } })());
  }
  if (s.singleUrl) return { mode: 'web', content: false, sorts: [], issues, drop, home };
  let headerOk = true;
  try { buildRequest(shell(s), home, { page: 1 }); } catch { headerOk = false; issues.push('请求头要执行脚本，直接打开网页'); }
  if (!headerOk) return { mode: 'web', content: false, sorts: [], issues, drop, home };
  // 没写列表规则：地址像订阅源（.xml / rss / feed / atom）才按 RSS 解析，否则就是个普通网页，直接打开
  if (!String(s.ruleArticles || '').trim()) {
    const feedLike = /\.(xml|rss|atom)(\?|$)|\/(rss|feed|atom)(\/|\?|$)|[?&](rss|feed)=|rsshub|feedburner/i.test(home);
    return { mode: feedLike ? 'rss' : 'web', content: false, sorts: feedLike ? sorts : [], issues, drop, home };
  }
  const articles = String(s.ruleArticles).trim().replace(/^[-+]/, '');
  if (!ok(articles, true) || !s.ruleLink || !ok(s.ruleLink) || (s.ruleTitle && !ok(s.ruleTitle))) {
    issues.push('文章列表规则要执行脚本或写法不认识，直接打开网页');
    return { mode: 'web', content: false, sorts: [], issues, drop, home };
  }
  for (const f of ['ruleImage', 'rulePubDate', 'ruleDescription', 'ruleNextPage']) {
    const r = s[f];
    if (r && !(f === 'ruleNextPage' && /^page$/i.test(String(r).trim())) && !ok(r)) drop.push(f);
  }
  const content = !!(s.ruleContent && ok(s.ruleContent));
  if (s.ruleContent && !content) issues.push('正文规则用不了，文章在浏览器里打开');
  return { mode: 'list', content, sorts, issues, drop, home };
}

// ---------- 存取 ----------
let cache = null, loading = null;
const subs = new Set();
const emit = () => subs.forEach(fn => fn(cache));
// 默认订阅：只放官方站点和公版古籍（古诗文网、读书网·国学、豆瓣读书、知乎日报、少数派、果壳、IT之家），每个账户第一次打开时放进去一次；
// 删掉了就不再补回来
const SEEDED = 'legado:rss-seeded';
export async function listRss() {
  if (cache) return cache;
  loading ||= (async () => {
    cache = (await idbGet('kv', KEY).catch(() => null)) || [];
    if (!(await idbGet('kv', SEEDED).catch(() => 1))) {
      await idbSet('kv', SEEDED, 1).catch(() => {});
      const { default: defaults } = await import('./rss-defaults.json');
      await importRss(defaults);
    }
  })();
  await loading;
  return cache;
}
async function save(list) { cache = list; await idbSet('kv', KEY, list); emit(); }
export function useRss() {
  const [list, setList] = useState(cache);
  useEffect(() => {
    let alive = true;
    listRss().then(l => { if (alive) setList(l); });
    const fn = (l) => setList(l);
    subs.add(fn);
    return () => { alive = false; subs.delete(fn); };
  }, []);
  return list;
}

/** 导入订阅源对象数组。同名同址的再导一次就覆盖，保留原来的开关 */
export async function importRss(entries) {
  const list = [...await listRss()];
  const index = new Map(list.map((e, i) => [e.id, i]));
  let added = 0, updated = 0, bad = 0, invalid = 0;
  for (const raw of entries) {
    if (!isRssSource(raw) || !String(raw.sourceName || '').trim() || !raw.sourceUrl.trim()) { invalid++; continue; }
    const source = { ...raw, sourceName: raw.sourceName.trim(), sourceUrl: raw.sourceUrl.trim() };
    const id = rssIdOf(source), c = await classify(source);
    if (c.mode === 'bad') bad++;
    const entry = { id, source, ...c, enabled: c.mode !== 'bad' && source.enabled !== false, addedAt: Date.now() };
    if (index.has(id)) { const old = list[index.get(id)]; list[index.get(id)] = { ...entry, enabled: old.enabled && c.mode !== 'bad', addedAt: old.addedAt }; updated++; }
    else { index.set(id, list.length); list.push(entry); added++; }
  }
  if (added + updated) await save(list);
  return { added, updated, bad, invalid };
}
export async function setRssEnabled(ids, on) {
  const set = new Set([].concat(ids));
  await save((await listRss()).map(e => set.has(e.id) && e.mode !== 'bad' ? { ...e, enabled: on } : e));
}
export async function removeRss(ids) {
  const set = new Set([].concat(ids));
  await save((await listRss()).filter(e => !set.has(e.id)));
}
export const groupsOf = (s) => String(s.sourceGroup || '').split(/[,，;；]/).map(g => g.trim()).filter(Boolean);

// ---------- 取内容 ----------
const absolute = (u, base) => { if (!u) return ''; try { const x = new URL(String(u).trim(), base); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };
const textOf = (html) => {
  if (!/[<&]/.test(html)) return html.trim();
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};
const firstImg = (html, base) => absolute(/<img[^>]+?(?:data-src|data-original|src)\s*=\s*["']([^"']+)/i.exec(html || '')?.[1], base);

async function load(entry, url, page, signal) {
  const { buildRequest } = await request();
  const req = buildRequest(shell(entry.source), url, { page, signal, base: entry.source.sourceUrl });
  const res = await nativeRequest(req);
  if (res.status >= 400) throw new Error(`网站返回 ${res.status}`);
  return { text: res.text, base: res.url || req.url };
}

/** 标准 RSS 2.0 / RDF / Atom。不是订阅格式就抛错（界面上改成「打开网页」） */
export function parseFeed(xml, base) {
  let doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) doc = new DOMParser().parseFromString(xml, 'text/html');
  const nodes = [...doc.getElementsByTagName('item'), ...doc.getElementsByTagName('entry')];
  if (!nodes.length) throw new Error('不是 RSS 订阅');
  const tag = (n, ...names) => { for (const name of names) { const el = n.getElementsByTagName(name)[0]; if (el?.textContent?.trim()) return el.textContent.trim(); } return ''; };
  return nodes.map(n => {
    const linkEl = [...n.getElementsByTagName('link')].find(l => !l.getAttribute('rel') || l.getAttribute('rel') === 'alternate');
    const link = absolute(linkEl?.getAttribute('href') || linkEl?.textContent || tag(n, 'guid'), base);
    const html = tag(n, 'content:encoded', 'content', 'description', 'summary');
    const media = n.getElementsByTagName('media:thumbnail')[0] || n.getElementsByTagName('media:content')[0];
    const enclosure = [...n.getElementsByTagName('enclosure')].find(e => /^image\//.test(e.getAttribute('type') || ''));
    return {
      title: textOf(tag(n, 'title')), link, html,
      pubDate: tag(n, 'pubDate', 'published', 'updated', 'dc:date'),
      description: textOf(html).slice(0, 160),
      image: absolute(media?.getAttribute('url') || enclosure?.getAttribute('url'), base) || firstImg(html, base),
    };
  }).filter(i => i.title || i.link);
}

/**
 * 取一页文章。url 是首页或某个分类的地址（可带 {{page}}）。
 * @returns {{ items: {title, link, pubDate, description, image, html?}[], next: null | {url, page} }}
 */
export async function fetchArticles(entry, url, page = 1, { signal } = {}) {
  const { text, base } = await load(entry, url, page, signal);
  if (entry.mode === 'rss') return { items: parseFeed(text, base), next: null };
  const R = await rules();
  const s = entry.source;
  let doc;
  try { doc = JSON.parse(text); } catch { doc = R.parseDocument(text); }
  let rule = String(s.ruleArticles).trim(), reverse = false;
  if (rule.startsWith('-')) { reverse = true; rule = rule.slice(1); } else if (rule.startsWith('+')) rule = rule.slice(1);
  const nodes = R.evaluateRule(doc, rule, 0, true).flatMap(v => Array.isArray(v) ? v : [v]);
  if (reverse) nodes.reverse();
  const one = (node, field) => {
    const r = s[field];
    if (!r || entry.drop?.includes(field)) return '';
    try { return R.strings(node, r)[0]?.trim() || ''; } catch { return ''; }
  };
  const items = nodes.map(n => {
    const description = one(n, 'ruleDescription');
    return {
      title: textOf(one(n, 'ruleTitle')), link: absolute(one(n, 'ruleLink'), base), pubDate: one(n, 'rulePubDate'),
      description: textOf(description).slice(0, 160), image: absolute(one(n, 'ruleImage'), base) || firstImg(description, base),
    };
  }).filter(i => i.link);
  let next = null;
  const np = String(s.ruleNextPage || '').trim();
  if (/^page$/i.test(np)) next = /\{\{\s*page/.test(url) ? { url, page: page + 1 } : null;
  else if (np && !entry.drop?.includes('ruleNextPage')) {
    const u = absolute(one(doc, 'ruleNextPage'), base);
    if (u && u !== base) next = { url: u, page: 1 };
  }
  return { items, next };
}

/** 正文：按 ruleContent 取出 HTML，清洗后返回（只留排版用的标签，脚本、样式、表单、内嵌框架一律去掉） */
export async function fetchContent(entry, link, { signal } = {}) {
  const { text, base } = await load(entry, link, 1, signal);
  const R = await rules();
  let doc;
  try { doc = JSON.parse(text); } catch { doc = R.parseDocument(text); }
  const values = R.evaluateRule(doc, entry.source.ruleContent).flat();
  const html = values.map(v => v && typeof v === 'object' && 'nodeType' in v ? (v.innerHTML ?? v.textContent ?? '') : String(v ?? '')).filter(x => x.trim()).join('\n');
  if (!html.trim()) throw new Error('正文是空的');
  return sanitize(html, base);
}

const KEEP = new Set(['p', 'br', 'div', 'span', 'section', 'article', 'img', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'em', 'strong', 'b', 'i', 'u', 's', 'del', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr', 'sup', 'sub', 'small', 'ruby', 'rt', 'rp']);
const DROP = new Set(['script', 'style', 'noscript', 'template', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea', 'link', 'meta', 'svg', 'canvas', 'video', 'audio', 'frame', 'frameset']);

/** 只留排版：标签白名单；img 只留 src / alt（懒加载的 data-src 换成 src），a 只留 http(s) 的 href */
export function sanitize(html, base) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 8) { child.remove(); continue; }
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();
      if (DROP.has(tag)) { child.remove(); continue; }
      walk(child);
      if (!KEEP.has(tag)) { child.replaceWith(...child.childNodes); continue; }
      const keep = {};
      if (tag === 'img') {
        const src = absolute(child.getAttribute('data-src') || child.getAttribute('data-original') || child.getAttribute('data-lazy-src') || child.getAttribute('src'), base);
        if (!src) { child.remove(); continue; }
        keep.src = src; keep.alt = child.getAttribute('alt') || ''; keep.loading = 'lazy'; keep.referrerpolicy = 'no-referrer';
      } else if (tag === 'a') {
        const href = absolute(child.getAttribute('href'), base);
        if (href) keep.href = href;
      } else if (tag === 'td' || tag === 'th') {
        for (const a of ['colspan', 'rowspan']) if (child.getAttribute(a)) keep[a] = child.getAttribute(a);
      }
      for (const a of [...child.attributes]) child.removeAttribute(a.name);
      for (const [k, v] of Object.entries(keep)) child.setAttribute(k, v);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}
