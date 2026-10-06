export class UnsupportedRuleError extends Error {
  constructor(message) { super(message); this.name = 'UnsupportedRuleError'; }
}

export function scriptMarkers(value) {
  const text = String(value ?? '');
  return [/<\s*js\b/i.test(text) && '<js>', /@js\s*:/i.test(text) && '@js:', /\bjava\s*\./i.test(text) && 'java.*'].filter(Boolean);
}
export function assertNoScript(value) {
  const found = scriptMarkers(value);
  if (found.length) throw new UnsupportedRuleError(`不执行脚本规则：${found.join('、')}`);
}

// 分隔符只有在引号和选择器括号外才生效，避免把属性值里的 @ 或 || 拆开。
export function splitTop(text, separator) {
  const result = [];
  let start = 0, quote = '', depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') { i++; continue; }
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if ('[({'.includes(c)) depth++;
    if ('])}'.includes(c)) depth--;
    if (!depth && text.startsWith(separator, i)) { result.push(text.slice(start, i)); start = i + separator.length; i += separator.length - 1; }
  }
  result.push(text.slice(start));
  return result;
}

export function absoluteUrl(value, base) {
  if (!String(value ?? '').trim()) return '';
  const url = new URL(String(value).trim(), base);
  if (!['http:', 'https:'].includes(url.protocol)) throw new UnsupportedRuleError('仅支持 http/https 地址');
  return url.href;
}
