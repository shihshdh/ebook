// 字节 → 文字：书源网页、导入的 EPUB / TXT 共用。
// 中文网站和老书大量是 GBK / Big5，而且常常不声明编码、或者声明错（服务器统一回 utf-8 头，网页其实是 GBK）。
// 阅读 App 是按内容判断的，这里也一样：
//   1. 有 BOM 就按 BOM
//   2. 字节是合法 UTF-8 就当 UTF-8（一大段 GBK 中文恰好是合法 UTF-8 几乎不可能，纯 ASCII 两种解法一样）
//   3. 不是 UTF-8：声明了别的编码、且解得干干净净就信它；否则在 GB18030 / Big5 里挑解出来最像中文的

const strictUtf8 = new TextDecoder('utf-8', { fatal: true });
const count = (s, re) => (s.match(re) || []).length;
// GB18030 几乎什么字节都解得开，不能只看有没有替换符：解错了会冒出假名、西里尔字母、扩展区生僻字、私用区，
// 解对了是常用汉字和中文标点
const score = (s) => count(s, /[一-鿿]/g) + 2 * count(s, /[　-〿＀-￯]/g)
  - 5 * count(s, /[぀-ヿͰ-ӿ㐀-䶿-]/g) - 10 * count(s, /�/g);

/** 网页 / XML 开头声明的编码（<?xml encoding>、<meta charset>），没有就 '' */
export function declaredCharset(bytes) {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 8192));
  return /<\?xml[^>]*encoding\s*=\s*["']([\w-]+)["']/i.exec(head)?.[1]
    || /<meta\b[^>]*charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1] || '';
}

/** 能不能按 UTF-8 原样读（读不了说明是 GBK / Big5 这类老编码） */
export function isUtf8(bytes) {
  try { strictUtf8.decode(bytes); return true; } catch { return false; }
}

/**
 * @param {Uint8Array} bytes
 * @param {(string|undefined)[]} hints 书源指定的、响应头里的、网页里声明的编码，按可信程度排
 */
export function decodeBytes(bytes, hints = []) {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes.subarray(3));
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  try { return strictUtf8.decode(bytes); } catch { /* 不是 UTF-8 */ }
  const labels = [...new Set(hints.filter(Boolean).map(h => String(h).trim().toLowerCase()))]
    .filter(l => !/^utf-?8$/.test(l));
  for (const label of labels) {
    let text;
    try { text = new TextDecoder(label).decode(bytes); } catch { continue; }   // 写错的编码名：跳过
    if (!text.includes('�')) return text;
  }
  let best = null, bestScore = -Infinity;
  for (const label of [...labels, 'gb18030', 'big5']) {
    let text;
    try { text = new TextDecoder(label).decode(bytes); } catch { continue; }
    const sc = score(text.length > 200000 ? text.slice(0, 200000) : text);
    if (sc > bestScore) { best = text; bestScore = sc; }
  }
  return best ?? new TextDecoder('utf-8').decode(bytes);
}
