// 搜索池：书目里的书（轻小说文库、公版古籍）和各书源现搜到的书放进同一个结果列表，不分来源。
// 同一本书（书名一样、作者对得上）合成一条，所有来源的下载入口一起列在详情里；
// 每个入口记着自己的插件（source）和书架键（shelfKey），下载时各走各的，以前下过的照样认得出。
import { toBook } from './legado.js';

// 书名、作者比较前：全角转半角，去掉括号里的附注（精校版、全本、作者名…），去空白和标点，不分大小写
const half = (s) => s.replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/　/g, ' ');
const norm = (s) => {
  const t = half(String(s || ''));
  const bare = t.replace(/[(（【\[][^)）】\]]*[)）】\]]/g, '');
  return (bare.trim() ? bare : t).replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
};
export const normTitle = norm;
const normAuthor = (s) => norm(String(s || '').replace(/^\s*(?:作者|作\s*者)\s*[:：]?/, '').replace(/\s*著\s*$/, ''));
// 作者对得上：一样、互相包含（「爱潜水的乌贼」和「爱潜水的乌贼著」），或者有一边没写
const sameAuthor = (a, b) => !a || !b || a === b || a.includes(b) || b.includes(a);
const altsOf = (b) => String(b.alt || '').split(/[/／、,，;；|]/).map(s => s.trim()).filter(Boolean);

/**
 * @param library 书目里搜到的书（已按相关度排好）
 * @param remote  书源现搜的结果 [{ entry, item }]，按回来的先后
 * @param labelOf 书目里的书显示成哪个来源（插件简称）
 * @param byAuthor 想找的作者（首页推荐点进来时带着）：同名的书里这位作者的排第一
 * @returns 合并后的书，多了 poolSources（来源名单，按先后）
 */
export function pool(library, remote, term, labelOf = () => '书目', byAuthor = '') {
  const key = norm(term);
  const groups = [], byTitle = new Map();
  const index = (title, g) => {
    const k = norm(title);
    if (!k) return;
    if (!byTitle.has(k)) byTitle.set(k, []);
    byTitle.get(k).push(g);
    g.names.push(k);
  };
  for (const b of library) {
    const g = { book: { ...b, downloads: [...b.downloads], poolSources: [labelOf(b)] }, author: normAuthor(b.author), names: [], order: groups.length };
    groups.push(g);
    index(b.title, g);
    for (const a of altsOf(b)) index(a, g);
  }
  for (const { entry, item } of remote) {
    const b = toBook(entry, item), name = entry.source.bookSourceName, author = normAuthor(b.author);
    const download = {
      ...b.downloads[0], source: 'legado', shelfKey: `${b.id}:txt`, label: name,
      note: item.latestChapter ? `整本下载 · 最新：${item.latestChapter}` : '整本下载（按目录逐章）',
    };
    const g = (byTitle.get(norm(b.title)) || []).find(x => sameAuthor(x.author, author));
    if (!g) {
      const fresh = { book: { ...b, downloads: [download], poolSources: [name] }, author, names: [], order: groups.length };
      groups.push(fresh);
      index(b.title, fresh);
      continue;
    }
    const t = g.book;
    if (t.downloads.some(d => d.shelfKey === download.shelfKey)) continue;
    t.downloads.push(download);
    if (!t.poolSources.includes(name)) t.poolSources.push(name);
    if (!g.author && author) { g.author = author; t.author = b.author; }
    if (!t.coverSrc && b.coverSrc) t.coverSrc = b.coverSrc;
    if (!t.description && b.description) t.description = b.description;
  }
  // 书名（或别名）和关键词完全一样的排前面，其次是包含关键词的；
  // 同档里：指定作者的在前，再按来源多少（同名的同人、跟风书一般只有一两个站有），最后书目在前、书源按回来的先后
  const rank = (g) => Math.min(...g.names.map(n => n === key ? 0 : n.includes(key) ? 1 : 2), 2);
  const want = normAuthor(byAuthor);
  const mine = (g) => want && g.author && (g.author.includes(want) || want.includes(g.author)) ? 0 : 1;
  return groups.map(g => [rank(g), mine(g), -g.book.poolSources.length, g.order, g.book])
    .sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || x[3] - y[3]).map(x => x[4]);
}
