import { UnsupportedRuleError } from './safety.js';

let gbkTable;
function table() {
  if (gbkTable) return gbkTable;
  const result = new Map([['€', [0x80]]]);
  const decoder = new TextDecoder('gbk', { fatal: true });
  const bytes = new Uint8Array(2);
  // WebView 只有 UTF-8 TextEncoder；首次需要汉字时用系统解码器建立双字节反查表。
  for (let high = 0x81; high <= 0xfe; high++) {
    bytes[0] = high;
    for (let low = 0x40; low <= 0xfe; low++) {
      if (low === 0x7f) continue;
      bytes[1] = low;
      try {
        const character = decoder.decode(bytes);
        if ([...character].length === 1 && character !== '\ufffd' && !result.has(character)) result.set(character, [high, low]);
      } catch { /* GBK 的未分配码位不进入反查表。 */ }
    }
  }
  gbkTable = result;
  return result;
}

export function encodeGbk(text) {
  let output = '';
  for (const character of String(text)) {
    if (character.codePointAt(0) < 0x80) { output += encodeURIComponent(character); continue; }
    const bytes = table().get(character);
    if (!bytes) throw new UnsupportedRuleError(`GBK 无法编码字符：${character}`);
    output += bytes.map(byte => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join('');
  }
  return output;
}

export function keywordEncoder(charset) {
  const name = String(charset || 'utf-8').trim().toLowerCase();
  if (['gbk', 'gb2312', 'cp936', 'ms936'].includes(name)) return encodeGbk;
  if (['utf-8', 'utf8'].includes(name)) return encodeURIComponent;
  throw new UnsupportedRuleError(`关键词编码暂不支持 ${name}，仅支持 UTF-8/GBK`);
}
