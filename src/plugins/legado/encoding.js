import { UnsupportedRuleError } from './safety.js';

// GBK 反查表：汉字 → 双字节。WebView 只有 UTF-8 TextEncoder，第一次要编码汉字时用系统解码器现建。
// 所有双字节组合（首字节 0x81–0xFE，尾字节 0x40–0xFE 跳过 0x7F）中间夹换行拼成一段，一次解码；
// 结果记在 64K 的类型数组里（字符编码 → 第几个组合 + 1）。以前两万多个组合逐个解码、逐个放 Map，
// 手机上第一次搜 GBK 书源要卡近一百毫秒，现在几毫秒
const LOWS = 190;   // 每个首字节下的尾字节个数
const pairOf = (i) => { const k = i % LOWS; return [0x81 + (i / LOWS | 0), 0x40 + k + (k >= 0x3f ? 1 : 0)]; };
let gbkTable;
function table() {
  if (gbkTable) return gbkTable;
  const count = (0xfe - 0x81 + 1) * LOWS, bytes = new Uint8Array(count * 3);
  for (let i = 0; i < count; i++) { const [high, low] = pairOf(i); bytes.set([high, low, 0x0a], i * 3); }
  const text = new TextDecoder('gbk').decode(bytes), result = new Uint16Array(0x10000);
  // 能解出的组合是「一个字 + 换行」；解不出的是替换符（尾字节是 ASCII 时后面还跟着那个字母），跳到下一个换行
  for (let i = 0, j = 0; i < count; i++) {
    const code = text.charCodeAt(j);
    if (text.charCodeAt(j + 1) === 0x0a) { if (code !== 0xfffd && !result[code]) result[code] = i + 1; j += 2; }
    else j = text.indexOf('\n', j) + 1;
  }
  gbkTable = result;
  return result;
}

export function encodeGbk(text) {
  let output = '';
  for (const character of String(text)) {
    const code = character.codePointAt(0);
    if (code < 0x80) { output += encodeURIComponent(character); continue; }
    if (character === '€') { output += '%80'; continue; }
    const index = code <= 0xffff ? table()[code] : 0;
    if (!index) throw new UnsupportedRuleError(`GBK 无法编码字符：${character}`);
    output += pairOf(index - 1).map(byte => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join('');
  }
  return output;
}

export function keywordEncoder(charset) {
  const name = String(charset || 'utf-8').trim().toLowerCase();
  if (['gbk', 'gb2312', 'cp936', 'ms936'].includes(name)) return encodeGbk;
  if (['utf-8', 'utf8'].includes(name)) return encodeURIComponent;
  throw new UnsupportedRuleError(`关键词编码暂不支持 ${name}，仅支持 UTF-8/GBK`);
}
