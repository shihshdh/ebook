// 书内全文搜索（C2）
//
// 每一章先拼成一整段纯文字再找：词被 <span>、<ruby> 拆成几段文字节点也能搜到（注音 <rt>/<rp> 不算正文，跳过）。
// 块级元素之间补一个换行，免得上一段的结尾和下一段的开头拼出一个书里没有的词。
// 结果按章一批批交出去（async generator），换关键词时 signal 一中止就停；
// 每章的文字索引按 book 缓存，同一本书第二次搜几乎是瞬时的。

const SKIP = new Set(['script', 'style', 'rt', 'rp', 'noscript', 'head', 'title']);
const BLOCK = new Set(['p', 'div', 'br', 'hr', 'li', 'ul', 'ol', 'dl', 'dt', 'dd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre',
  'section', 'article', 'header', 'footer', 'aside', 'nav', 'figure', 'figcaption', 'table', 'tr', 'td', 'th']);

const cache = new WeakMap();   // book → Map(spine 序号 → { text, nodes, starts })

function buildIndex(doc) {
  const nodes = [], starts = [];
  let text = '';
  const gap = () => { if (text && text[text.length - 1] !== '\n') text += '\n'; };
  const walk = (el) => {
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) {
        if (n.data) { nodes.push(n); starts.push(text.length); text += n.data; }
      } else if (n.nodeType === 1) {
        const tag = (n.localName || '').toLowerCase();
        if (SKIP.has(tag)) continue;
        const block = BLOCK.has(tag);
        if (block) gap();
        walk(n);
        if (block) gap();
      }
    }
  };
  walk(doc.getElementsByTagName('body')[0] || doc.documentElement);
  return { text, nodes, starts };
}

// 拼接文字里的第 pos 个字落在哪个文字节点的第几位
function locate({ nodes, starts }, pos) {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; }
  return [nodes[lo], pos - starts[lo]];
}

const squash = s => s.replace(/\s+/g, ' ');
function excerpt(text, s, e) {
  let before = squash(text.slice(Math.max(0, s - 48), s)).replace(/^ /, '');
  if (before.length > 24 || s > 48) before = '…' + before.slice(-24);
  let after = squash(text.slice(e, e + 80));
  if (after.length > 46) after = after.slice(0, 46) + '…';
  return { before, match: squash(text.slice(s, e)), after };
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 逐章搜索。每章交出一批：{ spine, hits: [{cfi, before, match, after}], scanned, of, more }
 *   scanned/of：已搜章数 / 总章数（给界面显示进度）；more：命中数到了 limit，后面不再找
 * 英文不分大小写；关键词里的空格可以匹配正文里任意空白（含换行）。
 */
export async function* searchBook(book, query, { signal, limit = 1000 } = {}) {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return;
  const pattern = words.map(escapeRe).join('\\s+');
  let map = cache.get(book);
  if (!map) cache.set(book, map = new Map());
  const sections = book.spine.spineItems;
  let total = 0;
  for (let i = 0; i < sections.length; i++) {
    if (signal?.aborted) return;
    const section = sections[i];
    let idx = map.get(section.index);
    if (!idx) {
      try {
        const contents = await section.load(book.load.bind(book));
        idx = buildIndex(contents.ownerDocument);
      } catch { idx = { text: '', nodes: [], starts: [] }; }
      map.set(section.index, idx);
      // 让出主线程：大书一章章建索引时，输入框和翻页不卡
      await new Promise(r => setTimeout(r));
      if (signal?.aborted) return;
    }
    const hits = [], re = new RegExp(pattern, 'gi');
    for (let m; total < limit && (m = re.exec(idx.text));) {
      if (!m[0]) { re.lastIndex++; continue; }
      const s = m.index, e = s + m[0].length;
      try {
        const [sn, so] = locate(idx, s), [en, eo] = locate(idx, e - 1);
        const range = sn.ownerDocument.createRange();
        range.setStart(sn, so); range.setEnd(en, eo + 1);
        hits.push({ cfi: section.cfiFromRange(range), ...excerpt(idx.text, s, e) });
        total++;
      } catch { /* 个别节点算不出位置就跳过 */ }
    }
    yield { spine: section.index, hits, scanned: i + 1, of: sections.length, more: total >= limit };
    if (total >= limit) return;
  }
}
