import { splitTop, UnsupportedRuleError } from './safety.js';
import { parseLenientJson } from './lenient-json.js';

const KEY = /^[\p{L}\p{N}_$-]+$/u;
export function variableKey(text) {
  const key = text.trim();
  if (!KEY.test(key)) throw new UnsupportedRuleError('变量名无效');
  return key;
}
export function getVariable(context, key) {
  key = variableKey(key);
  return Object.hasOwn(context.variables || {}, key) ? String(context.variables[key] ?? '') : '';
}
export function validateGets(text) {
  const rest = text.replace(/@get:\{([^{}]*)\}/g, (_, key) => { variableKey(key); return ''; });
  if (rest.includes('@get:')) throw new UnsupportedRuleError('@get 必须使用 {变量名}');
}

// 只在顶层找 @put，括号和引号里的选择器/模板/正则文本不当指令执行。
export function takePuts(rule) {
  const puts = [];
  let rest = '', quote = '', depth = 0;
  for (let i = 0; i < rule.length; i++) {
    const ch = rule[i];
    if (quote) {
      rest += ch;
      if (ch === '\\') rest += rule[++i] || '';
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; rest += ch; continue; }
    if (!depth && rule.startsWith('##', i)) { rest += rule.slice(i); break; }
    if (!depth && rule.startsWith('@put:', i)) {
      let start = i + 5;
      while (/\s/.test(rule[start] || '') && start < rule.length) start++;
      if (rule[start] !== '{') throw new UnsupportedRuleError('@put 缺少对象');
      let end = start + 1, level = 1, quoted = '';
      for (; end < rule.length && level; end++) {
        const c = rule[end];
        if (quoted) { if (c === '\\') end++; else if (c === quoted) quoted = ''; }
        else if (c === '"' || c === "'") quoted = c;
        else if (c === '{') level++;
        else if (c === '}') level--;
      }
      if (level) throw new UnsupportedRuleError('@put 对象未闭合');
      for (const pair of splitTop(rule.slice(start + 1, end - 1), ',').filter(s => s.trim())) {
        const parts = splitTop(pair, ':');
        if (parts.length < 2) throw new UnsupportedRuleError('@put 必须是变量名与规则的映射');
        const rawKey = parts.shift().trim(), rawRule = parts.join(':').trim();
        const key = variableKey(/^["']/.test(rawKey) ? parseLenientJson(rawKey) : rawKey);
        const value = /^["']/.test(rawRule) ? parseLenientJson(rawRule) : rawRule;
        if (typeof value !== 'string' || !value.trim()) throw new UnsupportedRuleError('@put 缺少规则');
        puts.push([key, value]);
      }
      i = end - 1;
      continue;
    }
    if ('[{('.includes(ch)) depth++;
    if (']})'.includes(ch)) depth--;
    rest += ch;
  }
  return { rule: rest.trim(), puts };
}
