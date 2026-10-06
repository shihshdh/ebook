import { assertNoScript, splitTop, UnsupportedRuleError } from './safety.js';

export function parseDocument(text) {
  if (!globalThis.DOMParser) throw new Error('当前环境缺少 DOMParser');
  return new globalThis.DOMParser().parseFromString(String(text), 'text/html');
}
const isNode = value => value && typeof value === 'object' && typeof value.nodeType === 'number';
const ownText = node => [...(node.childNodes || [])].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();

export function plainText(input) {
  const root = typeof input === 'string' ? parseDocument(input) : input;
  if (!isNode(root)) return String(input ?? '');
  const walk = node => {
    if (node.nodeType === 3) return node.textContent;
    const tag = node.tagName?.toLowerCase();
    if (['script', 'style', 'noscript', 'template'].includes(tag)) return '';
    if (tag === 'br') return '\n';
    const value = [...node.childNodes].map(walk).join('');
    return /^(p|div|section|article|h[1-6]|li|tr|blockquote|pre)$/.test(tag) ? `\n${value}\n` : value;
  };
  return walk(root).replace(/\r/g, '').split('\n').map(s => s.replace(/[\t \u00a0]+/g, ' ').trim()).filter(Boolean).join('\n');
}

function jsonTokens(path) {
  if (!path.startsWith('$')) throw new UnsupportedRuleError('JSONPath 必须以 $ 开头');
  const tokens = [];
  let rest = path.slice(1);
  while (rest) {
    let match;
    if ((match = /^(\.\.?)([\w$-]+|\*)/.exec(rest))) tokens.push({ kind: match[1] === '..' ? 'deep' : 'field', key: match[2] });
    else if ((match = /^\[(\*|\d+|'[^']*'|"[^"]*")\]/.exec(rest))) tokens.push({ kind: 'field', key: /^['"]/.test(match[1]) ? match[1].slice(1, -1) : match[1] });
    else throw new UnsupportedRuleError(`不支持的 JSONPath：${rest}`);
    rest = rest.slice(match[0].length);
  }
  return tokens;
}
function jsonSelect(input, path) {
  let values = [typeof input === 'string' ? JSON.parse(input) : input];
  for (const token of jsonTokens(path)) {
    const next = [];
    const take = (value, depth = 0) => {
      if (!value || typeof value !== 'object') return;
      if (depth > 100) throw new UnsupportedRuleError('JSON 嵌套超过 100 层');
      if (token.key === '*') next.push(...Object.values(value));
      else if (Object.hasOwn(value, token.key)) next.push(value[token.key]);
      if (token.kind === 'deep') Object.values(value).forEach(child => take(child, depth + 1));
    };
    values.forEach(value => take(value)); values = next;
  }
  return values.filter(v => v != null);
}

function indexed(nodes, index, exclude) {
  const at = Number(index) < 0 ? nodes.length + Number(index) : Number(index);
  return exclude ? nodes.filter((_, i) => i !== at) : at >= 0 && at < nodes.length ? [nodes[at]] : [];
}
function select(node, segment, css) {
  if (!isNode(node)) return [];
  if (/^!?-?\d+$/.test(segment)) return indexed([node], segment.replace('!', ''), segment.startsWith('!'));
  let selector = segment, index, exclude = false;
  if (!css) {
    const suffix = /(?:\.|(!))(-?\d+)$/.exec(selector);
    if (suffix) { index = suffix[2]; exclude = !!suffix[1]; selector = selector.slice(0, suffix.index); }
  }
  let nodes;
  if (selector === 'children') nodes = [...(node.children || [])];
  else if (!css && selector.startsWith('text.')) nodes = [...node.querySelectorAll('*')].filter(el => ownText(el).includes(selector.slice(5)));
  else {
    if (!css && selector.startsWith('class.')) selector = `[class~="${selector.slice(6).replace(/["\\]/g, '\\$&')}"]`;
    else if (!css && selector.startsWith('id.')) selector = `[id="${selector.slice(3).replace(/["\\]/g, '\\$&')}"]`;
    else if (!css && selector.startsWith('tag.')) selector = selector.slice(4);
    try { nodes = [...node.querySelectorAll(selector)]; }
    catch { throw new UnsupportedRuleError(`不支持的选择器：${segment}`); }
  }
  return index == null ? nodes : indexed(nodes, index, exclude);
}

function extract(value, kind) {
  if (!isNode(value)) return [value];
  if (kind === 'text') return [plainText(value)];
  if (kind === 'ownText') return [ownText(value)];
  if (kind === 'textNodes') return [...value.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).filter(Boolean);
  if (kind === 'html') return [value.innerHTML || ''];
  return [value.getAttribute?.(kind) || ''];
}

function simple(input, rule) {
  if (rule.startsWith('@json:')) return jsonSelect(input, rule.slice(6).trim());
  if (rule.startsWith('$')) return jsonSelect(input, rule);
  if (/^(?:@XPath:|\/\/|@put:|@get:|:)/i.test(rule)) throw new UnsupportedRuleError('不支持 XPath、变量存取或纯正则提取规则');
  const css = rule.startsWith('@css:');
  const segments = splitTop(css ? rule.slice(5) : rule, '@');
  let extraction;
  const last = segments.at(-1).trim();
  if (segments.length > 1 && !/^(?:children|!?-?\d+|(?:class|id|tag|text)\..*)$/.test(last)) extraction = segments.pop().trim();
  let values = [typeof input === 'string' ? parseDocument(input) : input];
  for (const segment of segments.map(s => s.trim()).filter(Boolean)) {
    if (/^!?-?\d+$/.test(segment)) values = indexed(values, segment.replace('!', ''), segment.startsWith('!'));
    else values = values.flatMap(node => select(node, segment, css));
  }
  if (extraction) {
    if (!/^[\w:-]+$/.test(extraction)) throw new UnsupportedRuleError(`不支持的提取方式：${extraction}`);
    values = values.flatMap(value => extract(value, extraction));
  }
  return values;
}

function replaceValues(values, expression) {
  const first = expression.endsWith('###');
  const parts = (first ? expression.slice(0, -3) : expression.endsWith('##') ? expression.slice(0, -2) : expression).split('##');
  if (parts.length > 3) throw new UnsupportedRuleError('正则替换段过多');
  const [, pattern = '', replacement = ''] = parts;
  let regex;
  try { regex = new RegExp(pattern, first ? '' : 'g'); } catch { throw new UnsupportedRuleError('无效的替换正则'); }
  return values.map(value => {
    const text = isNode(value) ? plainText(value) : String(value ?? '');
    if (first) { const match = regex.exec(text); return match ? match[0].replace(regex, replacement) : ''; }
    return text.replace(regex, replacement);
  });
}

export function evaluateRule(input, rule, depth = 0) {
  if (!rule) return [];
  if (typeof rule !== 'string') throw new UnsupportedRuleError('规则必须是字符串');
  if (depth > 32 || rule.length > 65536) throw new UnsupportedRuleError('规则过长或嵌套过深');
  assertNoScript(rule);
  const trimmed = rule.trim();
  // 正则段里的 || 不属于合并运算；组合每个分支单独求值后才抽取文字。
  const regexAt = trimmed.indexOf('##');
  const expression = regexAt < 0 ? trimmed : trimmed.slice(0, regexAt);
  let values;
  for (const separator of ['||', '&&', '%%']) {
    const parts = splitTop(expression, separator);
    if (parts.length < 2) continue;
    const groups = [];
    for (const part of parts) {
      const result = evaluateRule(input, part, depth + 1).filter(v => v != null && (typeof v !== 'string' || v.trim()));
      groups.push(result);
      if (separator === '||' && result.length) break;
    }
    if (separator === '||') values = groups.find(group => group.length) || [];
    else if (separator === '&&') values = groups.flat();
    else { values = []; for (let i = 0; i < Math.max(0, ...groups.map(g => g.length)); i++) for (const group of groups) if (i < group.length) values.push(group[i]); }
    break;
  }
  if (!values) values = expression ? simple(input, expression) : [input];
  return regexAt < 0 ? values : replaceValues(values, trimmed);
}

export function strings(input, rule) {
  return evaluateRule(input, rule).map(value => isNode(value) ? plainText(value) : typeof value === 'object' ? JSON.stringify(value) : String(value)).filter(value => value.trim());
}

export function validateRule(rule) {
  if (typeof rule !== 'string') throw new UnsupportedRuleError('规则必须是字符串');
  assertNoScript(rule);
  const at = rule.indexOf('##'), expression = (at < 0 ? rule : rule.slice(0, at)).trim();
  if (at >= 0) replaceValues([''], rule);
  for (const separator of ['||', '&&', '%%']) {
    const parts = splitTop(expression, separator);
    if (parts.length > 1) { parts.forEach(validateRule); return; }
  }
  if (!expression) return;
  if (expression.startsWith('$') || expression.startsWith('@json:')) jsonTokens(expression.replace(/^@json:/, '').trim());
  else simple(parseDocument('<html><body><div></div></body></html>'), expression);
}
