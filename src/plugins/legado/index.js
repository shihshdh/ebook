import { absoluteUrl, scriptMarkers, UnsupportedRuleError } from './safety.js';
import { nativeRequest } from '../../lib/native.js';
import { buildRequest } from './request.js';
import { evaluateRule, strings, parseDocument, plainText, validateRule } from './rules.js';

export function parseSources(text) {
  const sources = [], errors = [];
  let input;
  try { input = JSON.parse(String(text).replace(/^\uFEFF/, '')); }
  catch { return { sources, errors: ['书源 JSON 格式错误'] }; }
  const entries = Array.isArray(input) ? input : [input];
  entries.forEach((entry, index) => {
    try {
      if (!entry || Array.isArray(entry) || typeof entry !== 'object') throw new Error('必须是书源对象');
      if (typeof entry.bookSourceName !== 'string' || !entry.bookSourceName.trim()) throw new Error('缺少 bookSourceName');
      if (typeof entry.bookSourceUrl !== 'string' || !entry.bookSourceUrl.trim()) throw new Error('缺少 bookSourceUrl');
      absoluteUrl(entry.bookSourceUrl);
      for (const key of ['ruleSearch', 'ruleBookInfo', 'ruleToc', 'ruleContent']) {
        if (entry[key] != null && (typeof entry[key] !== 'object' || Array.isArray(entry[key]))) throw new Error(`${key} 必须是对象`);
      }
      sources.push({ ...entry, bookSourceName: entry.bookSourceName.trim(), bookSourceUrl: entry.bookSourceUrl.trim(), enabled: entry.enabled !== false });
    } catch (error) { errors.push(`第 ${index + 1} 项：${error.message}`); }
  });
  return { sources, errors };
}

export function checkSource(source) {
  const unsupported = [];
  const add = message => { if (!unsupported.includes(message)) unsupported.push(message); };
  if (!source || typeof source !== 'object' || Array.isArray(source)) return { ok: false, unsupported: ['不是有效的书源对象'] };
  const labels = { searchUrl: '搜索地址', header: '请求头', ruleSearch: '搜索规则', ruleBookInfo: '详情规则', ruleToc: '目录规则', ruleContent: '正文规则' };
  const inspect = (value, label) => {
    if (typeof value === 'string') scriptMarkers(value).forEach(marker => add(`${label}用了 ${marker}`));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, child]) => inspect(child, `${label}.${key}`));
  };
  for (const [key, label] of Object.entries(labels)) inspect(source[key], label);
  try { if (!absoluteUrl(source.bookSourceUrl)) throw new Error(); } catch { add('书源地址必须是 http/https URL'); }
  if (!source.searchUrl) add('缺少搜索地址');
  else {
    try { buildRequest(source, source.searchUrl, { key: 'test', page: 1 }); }
    catch (error) { if (!scriptMarkers(JSON.stringify([source.searchUrl, source.header])).length) add(`搜索请求：${error.message}`); }
  }
  const required = { ruleSearch: ['bookList', 'name', 'bookUrl'], ruleBookInfo: ['name'], ruleToc: ['chapterList', 'chapterName', 'chapterUrl'], ruleContent: ['content'] };
  const supportedFields = {
    ruleSearch: ['bookList', 'name', 'author', 'bookUrl', 'kind', 'intro', 'coverUrl', 'latestChapter', 'wordCount'],
    ruleBookInfo: ['init', 'name', 'author', 'intro', 'coverUrl', 'kind', 'latestChapter', 'wordCount', 'tocUrl'],
    ruleToc: ['chapterList', 'chapterName', 'chapterUrl', 'nextTocUrl'],
    ruleContent: ['content', 'nextContentUrl', 'replaceRegex'],
  };
  for (const [group, fields] of Object.entries(required)) {
    const block = source[group];
    if (!block || typeof block !== 'object' || Array.isArray(block)) { add(`缺少或无效的${labels[group]}`); continue; }
    for (const field of fields) if (typeof block[field] !== 'string' || !block[field].trim()) add(`${labels[group]}缺少 ${field}`);
    for (const [field, rule] of Object.entries(block)) {
      if (rule == null || rule === '') continue;
      if (!supportedFields[group].includes(field)) { add(`${labels[group]}暂不支持 ${field}`); continue; }
      if (scriptMarkers(rule).length) continue;
      try {
        if (field === 'replaceRegex') {
          if (typeof rule !== 'string') throw new UnsupportedRuleError('规则必须是字符串');
          for (const line of rule.split(/\r?\n/).filter(Boolean)) validateRule(line.startsWith('##') ? line : `##${line}`);
        } else validateRule(rule);
      } catch (error) { add(`${labels[group]}.${field}：${error.message}`); }
    }
  }
  for (const field of ['loginUrl', 'loginUi', 'loginCheckJs', 'bookSourceJavaScript', 'jsLib', 'ruleExplore']) if (source[field]) add(`暂不支持 ${field}（登录、脚本或发现规则）`);
  // 保守标记，避免把依赖未实现字段的书源宣传成完整可用。
  return { ok: unsupported.length === 0, unsupported };
}

// 目录建立章节边界，正文续页遇到目录里的另一章时必须停下。
const chapterSets = new WeakMap();
const checkAbort = signal => { if (signal?.aborted) throw new DOMException('已取消', 'AbortError'); };
const first = (input, rule) => {
  if (!rule) return '';
  try { return strings(input, rule)[0]?.trim() || ''; }
  catch (error) { if (error instanceof UnsupportedRuleError) return ''; throw error; }
};
const urlOrEmpty = (value, base) => {
  try { return absoluteUrl(value, base); } catch { return ''; }
};
const pageKey = url => { const key = new URL(url); key.hash = ''; return key.href; };
const collection = (input, rule) => evaluateRule(input, rule).flatMap(value => Array.isArray(value) ? value : [value]);

async function load(source, address, { page = 1, key = '', signal, http = nativeRequest, base } = {}) {
  checkAbort(signal);
  const request = buildRequest(source, address, { page, key, signal, base: base || source.bookSourceUrl });
  const response = await http(request);
  checkAbort(signal);
  const finalUrl = urlOrEmpty(response.url, request.url) || request.url;
  let document;
  try { document = JSON.parse(response.text); }
  catch { document = parseDocument(response.text); }
  // HTML 的合法 base 标签参与资源解析，最终请求地址仍单独用于分页去重。
  const baseHref = document.querySelector?.('base[href]')?.getAttribute('href');
  return { document, url: finalUrl, base: urlOrEmpty(baseHref, finalUrl) || finalUrl, requestUrl: request.url };
}

function fields(input, rules, base) {
  const result = {};
  for (const field of ['name', 'author', 'intro', 'kind', 'latestChapter', 'wordCount']) result[field] = first(input, rules[field]);
  result.coverUrl = urlOrEmpty(first(input, rules.coverUrl), base);
  return result;
}

export async function search(source, keyword, { page = 1, signal, http } = {}) {
  const rules = source.ruleSearch || {};
  if (!rules.bookList || !rules.name || !rules.bookUrl) throw new UnsupportedRuleError('搜索规则缺少列表、书名或书籍地址');
  const loaded = await load(source, source.searchUrl, { page, key: keyword, signal, http });
  const entries = collection(loaded.document, rules.bookList), result = [], seen = new Set();
  for (const entry of entries) {
    const data = fields(entry, rules, loaded.base);
    const bookUrl = urlOrEmpty(first(entry, rules.bookUrl), loaded.base);
    if (!data.name || !bookUrl || seen.has(bookUrl)) continue;
    seen.add(bookUrl); result.push({ ...data, bookUrl });
  }
  return result;
}

export async function bookInfo(source, bookUrl, { signal, http } = {}) {
  const rules = source.ruleBookInfo || {};
  const loaded = await load(source, bookUrl, { signal, http });
  const input = rules.init ? evaluateRule(loaded.document, rules.init)[0] || loaded.document : loaded.document;
  return { ...fields(input, rules, loaded.base), tocUrl: urlOrEmpty(first(input, rules.tocUrl), loaded.base) || bookUrl };
}

export async function toc(source, tocUrl, { signal, http, onPage } = {}) {
  const rules = source.ruleToc || {};
  if (!rules.chapterList || !rules.chapterName || !rules.chapterUrl) throw new UnsupportedRuleError('目录规则缺少列表、章节名或地址');
  const result = [], pages = new Set(), chapters = new Set();
  let address = tocUrl, base = source.bookSourceUrl;
  for (let page = 1; address && page <= 200; page++) {
    const requested = buildRequest(source, address, { page, base }).url;
    if (pages.has(pageKey(requested))) break;
    const loaded = await load(source, address, { signal, http, page, base });
    if (pages.has(pageKey(loaded.url))) break;
    pages.add(pageKey(requested)); pages.add(pageKey(loaded.url));
    for (const entry of collection(loaded.document, rules.chapterList)) {
      const title = first(entry, rules.chapterName), url = urlOrEmpty(first(entry, rules.chapterUrl), loaded.base);
      if (title && url && !chapters.has(url)) { chapters.add(url); result.push({ title, url }); }
    }
    onPage?.(page); checkAbort(signal);
    address = first(loaded.document, rules.nextTocUrl); base = loaded.base;
  }
  chapterSets.set(source, new Set([...(chapterSets.get(source) || []), ...chapters]));
  return result;
}

function isNextChapter(source, loaded, next, firstUrl) {
  if (chapterSets.get(source)?.has(next) && next !== firstUrl) return true;
  const anchors = loaded.document.querySelectorAll?.('a[href]') || [];
  for (const anchor of anchors) {
    if (urlOrEmpty(anchor.getAttribute('href'), loaded.base) === next && /下[一个]?[章回节卷]|next\s*chapter/i.test(`${anchor.textContent} ${anchor.getAttribute('title') || ''}`)) return true;
  }
  return false;
}

function replaceContent(text, rule) {
  if (!rule) return text;
  // replaceRegex 是独立的替换表达式，不把正文作为可执行的选择器。
  for (const line of rule.split(/\r?\n/).filter(Boolean)) {
    const expression = line.startsWith('##') ? line : `##${line}`;
    text = strings(text, expression).join('\n');
  }
  return text;
}

export async function content(source, chapterUrl, { signal, http } = {}) {
  const rules = source.ruleContent || {};
  if (!rules.content) throw new UnsupportedRuleError('缺少正文规则');
  const pages = new Set(), pieces = [];
  let address = chapterUrl, base = source.bookSourceUrl;
  for (let page = 1; address && page <= 200; page++) {
    const requested = buildRequest(source, address, { page, base }).url;
    if (pages.has(pageKey(requested))) break;
    const loaded = await load(source, address, { signal, http, page, base });
    if (pages.has(pageKey(loaded.url))) break;
    pages.add(pageKey(requested)); pages.add(pageKey(loaded.url));
    const values = collection(loaded.document, rules.content);
    for (const value of values) {
      // HTML/JSON 都允许正文含段落标记，只解析文本，不挂进活动文档。
      const text = typeof value === 'string' ? (/<\/?[a-z][^>]*>/i.test(value) ? plainText(value) : value) : plainText(value);
      if (text.trim()) pieces.push(text.trim());
    }
    const next = urlOrEmpty(first(loaded.document, rules.nextContentUrl), loaded.base);
    if (!next || isNextChapter(source, loaded, next, chapterUrl)) break;
    address = next; base = loaded.base;
  }
  return replaceContent(pieces.join('\n'), rules.replaceRegex).trim();
}
