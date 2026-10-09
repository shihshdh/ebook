import { assertNoScript, splitTop, UnsupportedRuleError } from './safety.js';
import { inertTemplate } from './templates.js';
import { takePuts, getVariable, validateGets } from './variables.js';

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
function indices(nodes, spec, exclude = false, range = false) {
  const relative = value => Number(value) < 0 ? nodes.length + Number(value) : Number(value);
  let positions;
  if (range && spec.includes(':')) {
    const [from, to, stride] = spec.split(':');
    const step = stride === undefined || stride === '' ? 1 : Number(stride);
    if (!Number.isSafeInteger(step) || step === 0) throw new UnsupportedRuleError('下标步长必须是非零整数');
    const start = from === '' ? (step > 0 ? 0 : nodes.length - 1) : relative(from);
    const end = to === '' ? (step > 0 ? nodes.length - 1 : 0) : relative(to);
    positions = [];
    // 阅读的方括号区间包含末项；越界跳过，遍历量受元素数限制。
    for (let i = 0; i < nodes.length; i++) {
      if ((step > 0 ? i >= start && i <= end : i <= start && i >= end) && (i - start) % step === 0) positions.push(i);
    }
    if (step < 0) positions.reverse();
  } else positions = spec.split(range ? ',' : ':').map(relative).filter(i => i >= 0 && i < nodes.length);
  if (exclude) { const drop = new Set(positions); return nodes.filter((_, i) => !drop.has(i)); }
  return positions.map(i => nodes[i]);
}
function select(node, segment, css) {
  if (!isNode(node)) return [];
  if (/^!?-?\d+$/.test(segment)) return indexed([node], segment.replace('!', ''), segment.startsWith('!'));
  let selector = segment, index, exclude = false, range = false;
  const eqParts = css ? splitTop(segment, ':eq') : [];
  if (eqParts.length > 1) {
    const eq = /^:eq\(\s*(-?\d+)\s*\)/.exec(segment.slice(eqParts[0].length));
    if (!eq) throw new UnsupportedRuleError('无效的 :eq 下标');
    const before = eqParts[0], after = segment.slice(before.length + eq[0].length);
    const selected = indexed(select(node, before || '*', true), eq[1], false);
    if (!after) return selected;
    if (/^\s/.test(after)) return selected.flatMap(el => select(el, after.trim(), true));
    throw new UnsupportedRuleError(':eq 后仅支持空格连接的后代选择器');
  }
  const bracket = /\[(!?)(-?\d*(?::-?\d*){1,2}|-?\d+(?:,-?\d+)*)\]$/.exec(selector);
  if (bracket) {
    index = bracket[2]; exclude = !!bracket[1]; range = true; selector = selector.slice(0, bracket.index);
  } else if (!css) {
    // 点号后的冒号列出指定下标（.3:7:-1），不是区间或步长。
    const suffix = /(?:\.|(!))(-?\d+(?::-?\d+)*)$/.exec(selector);
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
  return index == null ? nodes : indices(nodes, index, exclude, range);
}

const EXTRACTIONS = /^(?:text|textNodes|ownText|html|all)$/;
function extract(value, kind) {
  if (!isNode(value)) return [value];
  if (kind === 'text') return [plainText(value)];
  if (kind === 'ownText') return [ownText(value)];
  if (kind === 'textNodes') return [...value.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).filter(Boolean);
  if (kind === 'html') return [value.innerHTML || ''];
  if (kind === 'all') return [value.outerHTML || ''];
  return [value.getAttribute?.(kind) || ''];
}

// XPath 用 WebView 自带的 document.evaluate（XPath 1.0）。和阅读 App（JsoupXpath）对齐的两处：
//   在元素上求值时 // 和 / 开头是「在这个元素里找」（原生 XPath 会从整个文档找）；
//   末尾的 /html() /allText() /ownText() /textNodes() 是 JsoupXpath 的扩展函数，换成我们自己的提取方式
function xpath(input, rule) {
  const root = typeof input === 'string' ? parseDocument(input) : input;
  if (!isNode(root)) return [];
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  if (typeof doc?.evaluate !== 'function') throw new UnsupportedRuleError('当前环境不支持 XPath');
  let expression = rule.replace(/^@XPath:/i, '').trim(), kind = '';
  const fn = /\/(html|allText|ownText|textNodes)\(\)\s*$/.exec(expression);
  if (fn) { kind = fn[1] === 'allText' ? 'text' : fn[1]; expression = expression.slice(0, fn.index); }
  if (root.nodeType !== 9 && expression.startsWith('/')) expression = '.' + expression;
  let result;
  try { result = doc.evaluate(expression, root, null, 0, null); }
  catch { throw new UnsupportedRuleError(`不支持的 XPath：${expression}`); }
  if (result.resultType === 1) return [String(result.numberValue)];
  if (result.resultType === 2) return [result.stringValue];
  if (result.resultType === 3) return [String(result.booleanValue)];
  const out = [];
  for (let node; (node = result.iterateNext());) out.push(node.nodeType === 2 ? node.value : node.nodeType === 3 || node.nodeType === 4 ? node.textContent : node);
  return kind ? out.flatMap(value => extract(value, kind)) : out;
}
const isXPath = rule => /^(?:@XPath:|\/)/i.test(rule);

/** list=true：规则要的是一组元素（书单、章节列表），最后一段也当选择器，不当提取方式（和阅读 App 的 getElements 一样） */
function simple(input, rule, list = false) {
  if (rule.startsWith('@json:')) return jsonSelect(input, rule.slice(6).trim());
  if (rule.startsWith('$')) return jsonSelect(input, rule);
  if (isXPath(rule)) return xpath(input, rule);
  if (/^(?:@put:|@get:|:)/i.test(rule)) throw new UnsupportedRuleError('不支持的变量格式或纯正则提取规则');
  // 内容是 JSON 时，不带前缀的规则就是 JSONPath（data[*]、book.name），阅读 App 也这么认
  if (input && typeof input === 'object' && !isNode(input) && !rule.startsWith('@')) return jsonSelect(input, `$.${rule}`);
  const css = rule.startsWith('@css:');
  const segments = splitTop(css ? rule.slice(5) : rule, '@');
  let extraction;
  const last = segments.at(-1).trim();
  if (!list && segments.length > 1 && !/^(?:children|!?-?\d+|(?:class|id|tag|text)\..*)$/.test(last)) extraction = segments.pop().trim();
  // 只有一段（章节名 "text"、章节地址 "href"）：阅读 App 把它当取值方式，用在元素自己身上。
  // text / ownText / html 这些直接取；别的单词先当选择器找（"h1" 照旧取标题），找不到再当属性名（href、src、title）
  else if (!list && !css && segments.length === 1 && isNode(input) && /^[\w:-]+$/.test(last)) {
    let found = [];
    if (!EXTRACTIONS.test(last)) { try { found = select(input, last, false); } catch { /* 不是合法选择器，就是属性名 */ } }
    if (!found.length) extraction = segments.pop().trim();
  }
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

// 模板规则：{{…}} 里是一条规则，求值后拼进外面的文字（常见于拼书籍 / 章节地址：…?id={{$.bookId}}）。
// 和阅读 App 一样认 {{@@选择器}}、{{$.JSON}}、{{//XPath}}，以及 JSON 书源的单括号 {$.id}；其余 {{…}} 是脚本表达式，不执行
const TEMPLATE = /\{\{(\s*@get:\{[^{}]*\}\s*|[\s\S]*?)\}\}|\{(\$[.[][^{}]*)\}|@get:\{([^{}]*)\}/g;
const hasTemplate = rule => /\{\{[\s\S]*?\}\}|\{\$[.[][^{}]*\}/.test(rule);
function innerRule(inner) {
  const rule = inner.trim();
  if (rule.startsWith('@@')) return rule.slice(2);
  if (/^(?:\$[.[]|@json:|@css:|@XPath:|\/)/i.test(rule)) return rule;
  throw new UnsupportedRuleError(`模板里是脚本表达式：{{${rule.slice(0, 30)}}}`);
}
/** {{…}} 外面的第一个 ## */
function regexOutsideTemplates(rule) {
  for (let i = 0, depth = 0; i < rule.length - 1; i++) {
    if (rule.startsWith('{{', i)) { depth++; i++; }
    else if (depth && rule.startsWith('}}', i)) { depth--; i++; }
    else if (!depth && rule.startsWith('##', i)) return i;
  }
  return -1;
}
function template(input, rule, depth, check, context = {}) {
  const at = regexOutsideTemplates(rule);
  const body = at < 0 ? rule : rule.slice(0, at);
  validateGets(body);
  const text = body.replace(TEMPLATE, (_, double, single, get) => {
    if (get !== undefined) return getVariable(context, get);
    const variable = /^@get:\{([^{}]*)\}$/.exec((double ?? single).trim());
    if (variable) return getVariable(context, variable[1]);
    const inert = inertTemplate(double ?? single, context.sourceUrl);
    if (inert !== undefined) return inert;
    const inner = innerRule(double ?? single);
    if (check) { validateRule(inner, false, depth + 1); return ''; }
    return strings(input, inner, depth + 1, context)[0] || '';
  });
  return at < 0 ? [text] : replaceValues([text], rule.slice(at));
}

export function evaluateRule(input, rule, depth = 0, list = false, context = {}) {
  if (!rule) return [];
  if (typeof rule !== 'string') throw new UnsupportedRuleError('规则必须是字符串');
  if (depth > 32 || rule.length > 65536) throw new UnsupportedRuleError('规则过长或嵌套过深');
  assertNoScript(rule);
  const taken = takePuts(rule);
  if (taken.puts.length) {
    context.variables ||= Object.create(null);
    for (const [key, expression] of taken.puts) Object.defineProperty(context.variables, key, { value: strings(input, expression, depth + 1, context).join('\n'), enumerable: true, configurable: true, writable: true });
  }
  const trimmed = taken.rule;
  if (!trimmed && taken.puts.length) return [input];
  if (!list && (hasTemplate(trimmed) || /@get:/.test(trimmed))) return template(input, trimmed, depth, false, context);
  // 正则段里的 || 不属于合并运算；组合每个分支单独求值后才抽取文字。
  const regexAt = trimmed.indexOf('##');
  const expression = regexAt < 0 ? trimmed : trimmed.slice(0, regexAt);
  let values;
  for (const separator of ['||', '&&', '%%']) {
    const parts = splitTop(expression, separator);
    if (parts.length < 2) continue;
    const groups = [];
    for (const part of parts) {
      if (!part.trim()) continue;
      const result = evaluateRule(input, part, depth + 1, list, context).filter(v => v != null && (typeof v !== 'string' || v.trim()));
      groups.push(result);
      if (separator === '||' && result.length) break;
    }
    if (separator === '||') values = groups.find(group => group.length) || [];
    else if (separator === '&&') values = groups.flat();
    else { values = []; for (let i = 0; i < Math.max(0, ...groups.map(g => g.length)); i++) for (const group of groups) if (i < group.length) values.push(group[i]); }
    break;
  }
  if (!values) values = expression ? simple(input, expression, list) : [input];
  return regexAt < 0 ? values : replaceValues(values, trimmed);
}

export function strings(input, rule, depth = 0, context = {}) {
  return evaluateRule(input, rule, depth, false, context).map(value => isNode(value) ? plainText(value) : typeof value === 'object' ? JSON.stringify(value) : String(value)).filter(value => value.trim());
}

/** 只检查规则写法，不联网。list 同 evaluateRule */
export function validateRule(rule, list = false, depth = 0) {
  if (typeof rule !== 'string') throw new UnsupportedRuleError('规则必须是字符串');
  if (depth > 32 || rule.length > 65536) throw new UnsupportedRuleError('规则过长或嵌套过深');
  assertNoScript(rule);
  const taken = takePuts(rule);
  taken.puts.forEach(([, expression]) => validateRule(expression, false, depth + 1));
  rule = taken.rule;
  if (!list && (hasTemplate(rule.trim()) || /@get:/.test(rule))) { template(null, rule.trim(), depth, true); return; }
  const at = rule.indexOf('##'), expression = (at < 0 ? rule : rule.slice(0, at)).trim();
  if (at >= 0) replaceValues([''], rule);
  for (const separator of ['||', '&&', '%%']) {
    const parts = splitTop(expression, separator);
    if (parts.length > 1) { parts.forEach(part => validateRule(part, list, depth + 1)); return; }
  }
  if (!expression) return;
  if (expression.startsWith('$') || expression.startsWith('@json:')) { jsonTokens(expression.replace(/^@json:/, '').trim()); return; }
  if (isXPath(expression)) {
    const doc = parseDocument('<html><body></body></html>');
    if (typeof doc.createExpression !== 'function') throw new UnsupportedRuleError('当前环境不支持 XPath');
    try { doc.createExpression(expression.replace(/^@XPath:/i, '').replace(/\/(html|allText|ownText|textNodes)\(\)\s*$/, '')); }
    catch { throw new UnsupportedRuleError(`不支持的 XPath：${expression}`); }
    return;
  }
  try { simple(parseDocument('<html><body><div></div></body></html>'), expression, list); }
  catch (error) {
    // 不带 $ 的 JSONPath（data[*]）：内容是 JSON 时能用，这里不知道内容类型，写法对就放行
    if (expression.startsWith('@')) throw error;
    try { jsonTokens(`$.${expression}`); } catch { throw error; }
  }
}
