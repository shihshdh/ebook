import { absoluteUrl, assertNoScript, UnsupportedRuleError } from './safety.js';
import { keywordEncoder } from './encoding.js';

function arithmetic(expression, page) {
  const compact = expression.replace(/\s/g, '');
  const tokens = compact.match(/page|\d+(?:\.\d+)?|[()+*/%\-]/g) || [];
  if (tokens.join('') !== compact || tokens.length > 64) throw new UnsupportedRuleError(`不支持的模板算式：${expression}`);
  let index = 0;
  const atom = () => {
    const token = tokens[index++];
    if (token === '+') return atom();
    if (token === '-') return -atom();
    if (token === '(') { const value = sum(); if (tokens[index++] !== ')') throw new UnsupportedRuleError('模板算式括号不匹配'); return value; }
    if (token === 'page') return Number(page);
    if (/^\d+(?:\.\d+)?$/.test(token || '')) return Number(token);
    throw new UnsupportedRuleError('模板算式不完整');
  };
  const product = () => {
    let value = atom();
    while (['*', '/', '%'].includes(tokens[index])) { const op = tokens[index++], right = atom(); value = op === '*' ? value * right : op === '/' ? value / right : value % right; }
    return value;
  };
  const sum = () => {
    let value = product();
    while (['+', '-'].includes(tokens[index])) { const op = tokens[index++], right = product(); value = op === '+' ? value + right : value - right; }
    return value;
  };
  const value = sum();
  if (index !== tokens.length || !Number.isFinite(value)) throw new UnsupportedRuleError('模板算式无有效结果');
  return String(value);
}

export function renderTemplate(text, { key = '', page = 1, encode = encodeURIComponent } = {}) {
  assertNoScript(text);
  return String(text ?? '').replace(/\{\{([\s\S]*?)\}\}/g, (_, expression) => expression.trim() === 'key' ? encode(String(key)) : arithmetic(expression, page));
}

export function parseHeaders(value) {
  if (value == null || value === '') return {};
  assertNoScript(typeof value === 'string' ? value : JSON.stringify(value));
  const headers = typeof value === 'string' ? JSON.parse(value) : value;
  if (!headers || Array.isArray(headers) || typeof headers !== 'object' || Object.values(headers).some(v => typeof v !== 'string')) throw new UnsupportedRuleError('请求头必须是字符串键值对象');
  return { ...headers };
}

export function requestParts(template) {
  assertNoScript(template);
  const text = String(template ?? '').trim();
  const at = /,\s*\{/.exec(text);
  if (!at) return { address: text, options: {} };
  let options;
  try { options = JSON.parse(text.slice(at.index + 1)); } catch { throw new UnsupportedRuleError('请求选项不是有效 JSON'); }
  const allowed = ['method', 'body', 'charset', 'headers'];
  const unknown = Object.keys(options).filter(key => !allowed.includes(key));
  if (unknown.length) throw new UnsupportedRuleError(`不支持的请求选项：${unknown.join('、')}`);
  return { address: text.slice(0, at.index), options };
}

export function buildRequest(source, template, { key = '', page = 1, base = source.bookSourceUrl, signal, encode } = {}) {
  const { address, options } = requestParts(template);
  const vars = { key, page, encode: encode || keywordEncoder(options.charset) };
  const method = String(options.method || 'GET').toUpperCase();
  if (!['GET', 'POST'].includes(method)) throw new UnsupportedRuleError(`不支持的请求方法：${method}`);
  if (options.body != null && typeof options.body !== 'string') throw new UnsupportedRuleError('请求体必须为字符串');
  const headers = parseHeaders(source.header);
  for (const [key, value] of Object.entries(parseHeaders(options.headers))) {
    // Header 名不区分大小写，选项段覆盖书源默认值。
    const existing = Object.keys(headers).find(name => name.toLowerCase() === key.toLowerCase());
    if (existing) delete headers[existing];
    headers[key] = renderTemplate(value, vars);
  }
  return { url: absoluteUrl(renderTemplate(address, vars), base), method, headers,
    ...(options.body != null ? { body: renderTemplate(options.body, vars) } : {}),
    ...(options.charset ? { charset: options.charset } : {}), signal };
}
