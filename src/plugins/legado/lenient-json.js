import { UnsupportedRuleError } from './safety.js';

// 数据解析器，不把输入转换成 JavaScript：只扩展引号、对象键和尾逗号。
export function parseLenientJson(input) {
  const text = String(input);
  let at = 0;
  const fail = () => { throw new UnsupportedRuleError(`无效的宽松 JSON（位置 ${at}）`); };
  const space = () => { while (/\s/.test(text[at] || '') && at < text.length) at++; };
  const quoted = () => {
    const quote = text[at++];
    let out = '';
    while (at < text.length) {
      let char = text[at++];
      if (char === quote) return out;
      if (char < ' ') fail();
      if (char === '\\') {
        char = text[at++];
        const escapes = { '"': '"', "'": "'", '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
        if (char === 'u') {
          const hex = text.slice(at, at + 4);
          if (!/^[0-9a-f]{4}$/i.test(hex)) fail();
          out += String.fromCharCode(parseInt(hex, 16)); at += 4;
        } else if (Object.hasOwn(escapes, char)) out += escapes[char];
        else fail();
      } else out += char;
    }
    fail();
  };
  const value = (depth = 0) => {
    if (depth > 64) fail();
    space();
    if (text[at] === '"' || text[at] === "'") return quoted();
    if (text[at] === '{' || text[at] === '[') {
      const object = text[at++] === '{', end = object ? '}' : ']';
      const out = object ? {} : [];
      space();
      if (text[at] === end) { at++; return out; }
      while (at < text.length) {
        space();
        let key;
        if (object) {
          if (text[at] === '"' || text[at] === "'") key = quoted();
          else {
            const match = /^[\p{L}_$][\p{L}\p{N}_$-]*/u.exec(text.slice(at));
            if (!match) fail();
            key = match[0]; at += key.length;
          }
          space(); if (text[at++] !== ':') fail();
        }
        const child = value(depth + 1);
        if (object) Object.defineProperty(out, key, { value: child, enumerable: true, writable: true, configurable: true });
        else out.push(child);
        space();
        if (text[at] === end) { at++; return out; }
        if (text[at++] !== ',') fail();
        space(); if (text[at] === end) { at++; return out; }
      }
      fail();
    }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at));
    if (!match) fail();
    at += match[0].length;
    const parsed = JSON.parse(match[0]);
    if (typeof parsed === 'number' && !Number.isFinite(parsed)) fail();
    return parsed;
  };
  const result = value(); space();
  if (at !== text.length) fail();
  return result;
}
