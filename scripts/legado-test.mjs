import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFile } from 'node:fs/promises';
import { DOMParser } from 'linkedom';
import { evaluateRule, strings, parseDocument, plainText } from '../src/plugins/legado/rules.js';
import { parseSources, checkSource, search, bookInfo, toc, content } from '../src/plugins/legado/index.js';
import { buildRequest, renderTemplate } from '../src/plugins/legado/request.js';
import { encodeGbk } from '../src/plugins/legado/encoding.js';
import { classifySource, checkDirectory, formatReport } from './legado-check-dir.mjs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

globalThis.DOMParser = DOMParser;

const tests = [];
export const test = (name, run) => tests.push({ name, run });
const gbk = Uint8Array.from([0xc1, 0xb9, 0xb9, 0xac]);
const utf8 = text => new TextEncoder().encode(text);
const response = (bytes, { status = 200, url = 'https://fixture.test/final', type = 'text/html' } = {}) => ({ status, url, headers: new Headers({ 'Content-Type': type }), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });

// 仅 Node 测试层重定向插件模块，产品代码没有为测试暴露桥接入口。
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@tauri-apps/plugin-http') return { url: 'data:text/javascript,export const fetch=(...args)=>globalThis.__legadoNativeMock(...args)', shortCircuit: true };
  if (specifier === '@capacitor/core') return { url: 'data:text/javascript,export const CapacitorHttp={request:(...args)=>globalThis.__legadoNativeMock(...args)}', shortCircuit: true };
  return next(specifier, context);
} });
const originalFetch = globalThis.fetch;
const natives = {};
for (const platform of ['web', 'tauri', 'capacitor']) {
  globalThis.window = platform === 'tauri' ? { __TAURI_INTERNALS__: {} } : platform === 'capacitor' ? { Capacitor: { isNativePlatform: () => true } } : {};
  natives[platform] = (await import(`../src/lib/native.js?test=${platform}`)).nativeRequest;
}
delete globalThis.window;

for (const platform of ['web', 'tauri', 'capacitor']) {
  const nativeRequest = natives[platform];
  const mock = callback => { globalThis.__legadoNativeMock = callback; if (platform === 'web') globalThis.fetch = callback; };
  const reply = (bytes, opts = {}) => platform === 'capacitor'
    ? { status: opts.status || 200, url: opts.url || 'https://fixture.test/final', headers: { 'cOnTeNt-TyPe': opts.type || 'text/html' }, data: Buffer.from(bytes).toString('base64') }
    : response(bytes, opts);
  test(`${platform}: POST、请求头、请求体、最终地址、GBK 和 404 正文`, async () => {
    const headers = { Referer: 'https://fixture.test/', Cookie: 'sample=1', 'User-Agent': 'Fixture Reader' };
    let call;
    mock(async (...args) => { call = args; return reply(gbk, { status: 404, type: 'text/html; charset=gbk' }); });
    const result = await nativeRequest({ url: 'https://fixture.test/post', method: 'POST', headers, body: 'key=sample' });
    assert.deepEqual(result, { status: 404, url: 'https://fixture.test/final', text: '凉宫' });
    const options = platform === 'capacitor' ? call[0] : call[1];
    assert.equal(options.method, 'POST'); assert.deepEqual(options.headers, headers);
    assert.equal(platform === 'capacitor' ? options.data : options.body, 'key=sample');
    if (platform === 'capacitor') assert.equal(options.responseType, 'arraybuffer');
  });
  test(`${platform}: GET 默认值和 UTF-8`, async () => {
    mock(async (...args) => { assert.equal((platform === 'capacitor' ? args[0] : args[1]).method, 'GET'); return reply(utf8('夜读')); });
    assert.equal((await nativeRequest({ url: 'https://fixture.test/' })).text, '夜读');
  });
  test(`${platform}: 参数编码优先于响应头`, async () => {
    mock(async () => reply(gbk, { type: 'text/html; charset=utf-8' }));
    assert.equal((await nativeRequest({ url: 'https://fixture.test/', charset: 'gbk' })).text, '凉宫');
  });
  test(`${platform}: meta 编码及响应头优先级`, async () => {
    const bytes = new Uint8Array([...utf8('<meta charset="gbk">'), ...gbk]);
    mock(async () => reply(bytes));
    assert.ok((await nativeRequest({ url: 'https://fixture.test/' })).text.endsWith('凉宫'));
    mock(async () => reply(utf8('<meta charset="gbk">夜读'), { type: 'text/html; charset=utf-8' }));
    assert.ok((await nativeRequest({ url: 'https://fixture.test/' })).text.endsWith('夜读'));
  });
  test(`${platform}: 超时会拒绝`, async () => {
    mock(() => new Promise(() => {}));
    await assert.rejects(nativeRequest({ url: 'https://fixture.test/', timeout: 8 }), { name: 'TimeoutError' });
  });
  test(`${platform}: 运行中中止及预中止`, async () => {
    mock(() => new Promise(() => {}));
    const controller = new AbortController();
    const pending = nativeRequest({ url: 'https://fixture.test/', signal: controller.signal });
    controller.abort(); await assert.rejects(pending, { name: 'AbortError' });
    mock(() => { throw Error('不应发出预中止请求'); });
    await assert.rejects(nativeRequest({ url: 'https://fixture.test/', signal: controller.signal }), { name: 'AbortError' });
  });
  test(`${platform}: 网络失败原样传递`, async () => {
    mock(async () => { throw new TypeError('网络离线'); });
    await assert.rejects(nativeRequest({ url: 'https://fixture.test/' }), /网络离线/);
  });
}
test('Capacitor: JSON 自动解析的桥接响应', async () => {
  globalThis.__legadoNativeMock = async () => ({ status: 200, headers: { 'Content-Type': 'application/json' }, data: { title: '夜读' } });
  assert.equal((await natives.capacitor({ url: 'https://fixture.test/' })).text, '{"title":"夜读"}');
});
test('Web: 未知编码退回 UTF-8、超时覆盖读取正文', async () => {
  globalThis.fetch = async () => response(utf8('正文'));
  assert.equal((await natives.web({ url: 'https://fixture.test/', charset: 'invalid-encoding' })).text, '正文');
  globalThis.fetch = async () => ({ ...response(utf8('')), arrayBuffer: () => new Promise(() => {}) });
  await assert.rejects(natives.web({ url: 'https://fixture.test/', timeout: 8 }), { name: 'TimeoutError' });
});

const html = parseDocument(await readFile(new URL('./fixtures/legado/rules.html', import.meta.url), 'utf8'));
const json = await readFile(new URL('./fixtures/legado/rules.json', import.meta.url), 'utf8');
const ruleCases = [
  ['JSoup class + 下标 + tag + 负下标 + href', 'class.book.0@tag.a.-1@href', ['/book/2']],
  ['JSoup id + children', 'id.catalog@children@data-code', ['A', 'B', 'C']],
  ['JSoup text', 'text.丙@href', ['/book/3']],
  ['JSoup 排除 !0', 'class.book!0@data-code', ['B', 'C']],
  ['独立排除步骤', 'class.book@!0@data-code', ['B', 'C']],
  ['CSS 选择器', '@css:#catalog .book:nth-child(2) a@text', ['丙']],
  ['text 提取', 'class.book.0@tag.b@text', ['夜灯']],
  ['ownText 提取', 'class.book.0@ownText', ['开头 结尾']],
  ['textNodes 提取', 'class.book.0@textNodes', ['开头', '结尾']],
  ['src 提取', 'tag.img@src', ['covers/3.jpg']],
  ['content 属性', 'tag.meta@content', ['一间夜读书房']],
  ['任意属性', 'class.book.1@data-code', ['B']],
  ['正则全局替换', 'class.numbers@text##(\\d+)##[$1]##', ['前缀 [12] 后缀 [34]']],
  ['正则 ### 首个匹配', 'class.numbers@text##(\\d+)##[$1]###', ['[12]']],
  ['|| 取首个非空', 'class.missing@text||class.a@text', ['甲一', '甲二']],
  ['&& 顺序合并', 'class.a@text&&class.b@text', ['甲一', '甲二', '乙一']],
  ['%% 交叉合并', 'class.a@text%%class.b@text', ['甲一', '乙一', '甲二']],
];
for (const [name, rule, expected] of ruleCases) test(`规则: ${name}`, () => assert.deepEqual(strings(html, rule), expected));
test('规则: @html 与正文段落', () => {
  assert.match(strings(html, 'class.book.0@html')[0], /<b>夜灯<\/b>/);
  assert.equal(plainText(evaluateRule(html, 'class.prose')[0]), '第一段\n第二段\n第三段 & 尾声');
});
for (const [rule, expected] of [ ['$.a.b', ['夜读']], ['$..x', ['甲', '乙', '丙']], ['@json:$.items[*].x', ['甲', '乙']], ['$.items[0].n', ['0']], ["$['a']['b']", ['夜读']] ]) {
  test(`JSONPath: ${rule}`, () => assert.deepEqual(strings(json, rule), expected));
}
test('规则: 拒绝脚本、XPath、JSONPath 过滤和坏正则', () => {
  for (const rule of ['<js>anything</js>', '@js:anything', 'java.getString()', '//div', '$.items[?(@.n)]', 'class.book@text##[##x']) assert.throws(() => evaluateRule(html, rule));
});
test('模板: key/page/算式，无 eval', () => {
  assert.equal(renderTemplate('/?q={{key}}&p={{page-1}}&n={{(page+1)*2}}', { key: '夜 读', page: 3 }), '/?q=%E5%A4%9C%20%E8%AF%BB&p=2&n=8');
  for (const expression of ['process.exit()', 'page.constructor', 'page/0', 'unknown']) assert.throws(() => renderTemplate(`{{${expression}}}`));
});
test('请求: POST 选项段、相对地址、头覆盖', () => {
  const request = buildRequest({ bookSourceUrl: 'https://fixture.test/base/', header: '{"User-Agent":"Reader","Cookie":"a=1"}' }, '/search,{"method":"POST","body":"q={{key}}&p={{page}}","charset":"gbk","headers":{"cookie":"b=2"}}', { key: 'abc', page: 2 });
  assert.deepEqual(request, { url: 'https://fixture.test/search', method: 'POST', headers: { 'User-Agent': 'Reader', cookie: 'b=2' }, body: 'q=abc&p=2', charset: 'gbk', signal: undefined });
});
test('请求: 拒绝危险协议、脚本、未知选项', () => {
  const source = { bookSourceUrl: 'https://fixture.test/' };
  for (const template of ['javascript:alert(1)', '/,{"webView":true}', '/?q={{java.anything()}}', '/,{bad}']) assert.throws(() => buildRequest(source, template));
});
test('书源: 单对象、数组、BOM、坏条目隔离', () => {
  const source = { bookSourceName: '夹具', bookSourceUrl: 'https://fixture.test/', enabled: false };
  assert.equal(parseSources('\uFEFF' + JSON.stringify(source)).sources[0].enabled, false);
  const result = parseSources(JSON.stringify([source, null, { ...source, ruleSearch: 'bad' }, { ...source, bookSourceUrl: 'file:///x' }]));
  assert.equal(result.sources.length, 1); assert.equal(result.errors.length, 3);
  assert.equal(parseSources('{bad').errors.length, 1);
});

const fixture = async name => readFile(new URL(`./fixtures/legado/${name}`, import.meta.url), 'utf8');
const htmlSource = JSON.parse(await fixture('html-source.json'));
const jsonSource = JSON.parse(await fixture('json-source.json'));
const jsonPages = JSON.parse(await fixture('json-pages.json'));
const htmlFiles = {
  '/search': 'html-search.html', '/books/1.html': 'html-book.html', '/library/toc/1.html': 'html-toc-1.html',
  '/library/toc/2.html': 'html-toc-2.html', '/library/chapter/1.html': 'html-content-1.html', '/library/chapter/1_2.html': 'html-content-2.html',
};
const htmlCalls = [];
const htmlHttp = async request => {
  htmlCalls.push(request);
  const path = new URL(request.url).pathname, file = htmlFiles[path];
  assert.ok(file, `未预期的请求（可能串章）：${request.url}`);
  return { status: 200, url: path === '/search' ? 'https://html.fixture.invalid/results/search' : request.url, text: await fixture(file) };
};
test('HTML 全流程: POST 搜索→详情 base 标签→两页目录去重→两页正文不串章', async () => {
  const results = await search(htmlSource, '夜读', { page: 2, http: htmlHttp });
  assert.equal(results.length, 1); assert.equal(results[0].bookUrl, 'https://html.fixture.invalid/books/1.html');
  assert.equal(results[0].coverUrl, 'https://html.fixture.invalid/covers/1.jpg');
  assert.equal(htmlCalls[0].body, 'q=%E5%A4%9C%E8%AF%BB&page=2');
  const info = await bookInfo(htmlSource, results[0].bookUrl, { http: htmlHttp });
  assert.equal(info.name, '夜读'); assert.equal(info.tocUrl, 'https://html.fixture.invalid/library/toc/1.html');
  const progress = [];
  const chapters = await toc(htmlSource, info.tocUrl, { http: htmlHttp, onPage: n => progress.push(n) });
  assert.equal(chapters.length, 3); assert.deepEqual(progress, [1, 2]);
  assert.equal(await content(htmlSource, chapters[0].url, { http: htmlHttp }), '第一段。\n第二段。\n第三段。\n第四段。');
});
test('HTML 正文: 未加载目录也按“下一章”链接文字停止', async () => {
  assert.equal(await content({ ...htmlSource }, 'https://html.fixture.invalid/library/chapter/1.html', { http: htmlHttp }), '第一段。\n第二段。\n第三段。\n第四段。');
});
const jsonCalls = [];
const jsonHttp = async request => {
  jsonCalls.push(request);
  const url = new URL(request.url);
  const key = url.pathname.endsWith('/search') ? 'search' : url.pathname.endsWith('/books/1') ? 'book' : url.pathname.endsWith('/toc/1') ? `toc${url.searchParams.get('page')}` : url.pathname.endsWith('/chapter/1') ? `content${url.searchParams.get('part')}` : '';
  assert.ok(jsonPages[key], `未预期的 JSON 请求（可能串章）：${request.url}`);
  return { status: 200, url: request.url, text: JSON.stringify(jsonPages[key]) };
};
test('JSON 全流程: 相对与协议相对地址、两页目录/正文、目录边界阻止串章', async () => {
  const results = await search(jsonSource, '夜读', { http: jsonHttp });
  assert.equal(results[0].bookUrl, 'https://json.fixture.invalid/api/books/1');
  assert.equal(results[0].coverUrl, 'https://images.fixture.invalid/1.jpg');
  const info = await bookInfo(jsonSource, results[0].bookUrl, { http: jsonHttp });
  assert.equal(info.tocUrl, 'https://json.fixture.invalid/api/toc/1?page=1');
  const progress = [];
  const chapters = await toc(jsonSource, info.tocUrl, { http: jsonHttp, onPage: n => progress.push(n) });
  assert.equal(chapters.length, 2); assert.deepEqual(progress, [1, 2]);
  assert.equal(await content(jsonSource, chapters[0].url, { http: jsonHttp }), '一。\n二。\n三。\n四。');
});
test('详情: 空目录规则回退传入 bookUrl', async () => {
  const source = { ...jsonSource, ruleBookInfo: { name: '$.title' } };
  assert.equal((await bookInfo(source, 'https://json.fixture.invalid/api/books/1', { http: jsonHttp })).tocUrl, 'https://json.fixture.invalid/api/books/1');
});
test('目录: 无尽分页最多 200 页', async () => {
  let requests = 0;
  const http = async request => { requests++; return { url: request.url, status: 200, text: JSON.stringify({ chapters: [{ title: `${requests}`, url: `/chapter/${requests}` }], next: `?page=${requests + 1}` }) }; };
  const chapters = await toc(jsonSource, 'https://json.fixture.invalid/toc?page=1', { http });
  assert.equal(requests, 200); assert.equal(chapters.length, 200);
});
test('目录: 重定向回已访问页面时停止', async () => {
  let requests = 0;
  const chapters = await toc(jsonSource, 'https://json.fixture.invalid/toc', { http: async request => {
    requests++; return { status: 200, url: 'https://json.fixture.invalid/toc', text: JSON.stringify({ chapters: [{ title: '一', url: '/one' }], next: '/redirect' }) };
  } });
  assert.equal(requests, 2); assert.equal(chapters.length, 1);
});
test('流程: 中止后不继续翻页', async () => {
  const controller = new AbortController(); let requests = 0;
  await assert.rejects(toc(jsonSource, 'https://json.fixture.invalid/toc', { signal: controller.signal, http: async request => {
    requests++; controller.abort(); return { status: 200, url: request.url, text: '{}' };
  } }), { name: 'AbortError' });
  assert.equal(requests, 1);
});
test('正文: 循环分页与重复链接不会重复追加', async () => {
  let requests = 0;
  const result = await content(jsonSource, 'https://json.fixture.invalid/chapter/self', { http: async request => {
    requests++; return { status: 200, url: request.url, text: JSON.stringify({ paragraphs: ['正文'], next: '#top' }) };
  } });
  assert.equal(result, '正文'); assert.equal(requests, 1);
});

test('GBK: 凉宫、西游记、ASCII、空格和保留符号', () => {
  assert.equal(encodeGbk('凉宫'), '%C1%B9%B9%AC');
  assert.equal(encodeGbk('西游记'), '%CE%F7%D3%CE%BC%C7');
  assert.equal(encodeGbk('A b+&中'), 'A%20b%2B%26%D6%D0');
  assert.throws(() => encodeGbk('📖'), /GBK 无法编码/);
});
test('GBK: GET 搜索请求地址是真正 GBK 字节编码', async () => {
  const source = { ...jsonSource, searchUrl: '/search?q={{key}},{"charset":"gbk"}' };
  for (const [key, expected] of [['凉宫', '%C1%B9%B9%AC'], ['西游记', '%CE%F7%D3%CE%BC%C7']]) {
    await search(source, key, { http: async request => {
      assert.equal(request.url, `https://json.fixture.invalid/search?q=${expected}`);
      assert.equal(request.charset, 'gbk');
      return { status: 200, url: request.url, text: '{"results":[]}' };
    } });
  }
});
test('GBK: POST 请求体、gb2312 别名及 UTF-8 默认', () => {
  assert.equal(buildRequest(jsonSource, '/,{"method":"POST","body":"q={{key}}","charset":"gb2312"}', { key: '凉宫' }).body, 'q=%C1%B9%B9%AC');
  assert.ok(buildRequest(jsonSource, '/?q={{key}}', { key: '凉宫' }).url.endsWith(encodeURIComponent('凉宫')));
});
test('checkSource: HTML/JSON 四步夹具可用', () => {
  assert.deepEqual(checkSource(htmlSource), { ok: true, unsupported: [] });
  assert.deepEqual(checkSource(jsonSource), { ok: true, unsupported: [] });
});
test('checkSource: 脚本字段逐项报告且 ok=false', async () => {
  const source = JSON.parse(await fixture('unsupported-source.json'));
  const report = checkSource(source);
  assert.equal(report.ok, false);
  assert.ok(report.unsupported.includes('搜索地址用了 <js>'));
  assert.ok(report.unsupported.some(item => item.includes('正文规则.content用了 @js:')));
  assert.ok(report.unsupported.some(item => item.includes('java.*')));
  let called = false;
  await assert.rejects(search(source, '书', { http: async () => { called = true; } }), /不执行脚本/);
  assert.equal(called, false);
});
test('checkSource: 缺少任一步和坏规则不会标可用', () => {
  for (const field of ['ruleSearch', 'ruleBookInfo', 'ruleToc', 'ruleContent']) {
    const source = { ...htmlSource }; delete source[field]; assert.equal(checkSource(source).ok, false);
  }
  assert.equal(checkSource({ ...htmlSource, ruleSearch: { ...htmlSource.ruleSearch, name: '//h1' } }).ok, false);
  assert.equal(checkSource({ ...jsonSource, ruleContent: { content: '$.items[?(@.title)]' } }).ok, false);
  assert.equal(checkSource({ ...htmlSource, ruleContent: { content: 'id.content@html', replaceRegex: '[##' } }).ok, false);
});
test('checkSource: 额外引擎能力和未知编码明确报告', () => {
  const source = { ...htmlSource, searchUrl: '/,{"charset":"big5"}', loginUrl: '/login', ruleContent: { ...htmlSource.ruleContent, webJs: 'x' } };
  const report = checkSource(source);
  assert.equal(report.ok, false);
  assert.ok(report.unsupported.some(value => value.includes('big5')));
  assert.ok(report.unsupported.some(value => value.includes('loginUrl')));
  assert.ok(report.unsupported.some(value => value.includes('webJs')));
});
test('checkSource: 无效输入不抛错', () => {
  for (const value of [null, [], {}, 'x', { ...htmlSource, bookSourceUrl: '', header: '{bad' }]) assert.equal(checkSource(value).ok, false);
});
test('安全: 所有入口都不执行嵌入脚本', () => {
  globalThis.__legadoScriptRan = false;
  const source = { ...htmlSource, ruleContent: { content: '<js>globalThis.__legadoScriptRan=true</js>' } };
  assert.equal(checkSource(source).ok, false);
  assert.throws(() => evaluateRule(html, source.ruleContent.content), /不执行脚本/);
  assert.equal(globalThis.__legadoScriptRan, false); delete globalThis.__legadoScriptRan;
});
test('Capacitor: JSON 基础值不能当 base64 再解码', async () => {
  for (const value of ['夜读', false, 123, null]) {
    globalThis.__legadoNativeMock = async () => ({ status: 503, headers: { 'Content-Type': 'application/json' }, data: value });
    const result = await natives.capacitor({ url: 'https://fixture.test/', charset: 'gbk' });
    assert.equal(result.text, JSON.stringify(value)); assert.equal(result.status, 503);
  }
});

test('JSON: 列表字段直接返回数组也能走四步', async () => {
  const source = { ...jsonSource, ruleSearch: { ...jsonSource.ruleSearch, bookList: '$.results' }, ruleToc: { ...jsonSource.ruleToc, chapterList: '$.chapters' }, ruleContent: { ...jsonSource.ruleContent, content: '$.paragraphs' } };
  const results = await search(source, '夜读', { http: jsonHttp });
  const info = await bookInfo(source, results[0].bookUrl, { http: jsonHttp });
  const chapters = await toc(source, info.tocUrl, { http: jsonHttp });
  assert.equal(await content(source, chapters[0].url, { http: jsonHttp }), '一。\n二。\n三。\n四。');
});
test('流程: 预中止在发出请求前结束', async () => {
  const controller = new AbortController(); controller.abort();
  const options = { signal: controller.signal, http: () => { throw Error('不应请求'); } };
  for (const run of [() => search(jsonSource, '书', options), () => bookInfo(jsonSource, 'https://fixture.test/', options), () => toc(jsonSource, 'https://fixture.test/', options), () => content(jsonSource, 'https://fixture.test/', options)]) await assert.rejects(run(), { name: 'AbortError' });
});
test('Tauri: 超时和中止传播到插件的 signal', async () => {
  let forwarded;
  globalThis.__legadoNativeMock = async (url, options) => { forwarded = options.signal; return new Promise(() => {}); };
  await assert.rejects(natives.tauri({ url: 'https://fixture.test/', timeout: 8 }), { name: 'TimeoutError' });
  assert.equal(forwarded.aborted, true);
  const controller = new AbortController();
  const pending = natives.tauri({ url: 'https://fixture.test/', signal: controller.signal });
  await new Promise(resolve => setTimeout(resolve, 1)); controller.abort();
  await assert.rejects(pending, { name: 'AbortError' }); assert.equal(forwarded.aborted, true);
});
test('规则: CSS 属性值里的 @/|| 不拆成运算', () => {
  const doc = parseDocument('<a data-key="a@b||c" href="/ok">甲</a>');
  assert.deepEqual(strings(doc, '@css:a[data-key="a@b||c"]@href'), ['/ok']);
});
test('编码: http-equiv meta 与首 2KB 边界', async () => {
  const prefix = utf8('<meta http-equiv="Content-Type" content="text/html; charset=gbk">');
  globalThis.fetch = async () => response(new Uint8Array([...prefix, ...gbk]));
  assert.ok((await natives.web({ url: 'https://fixture.test/' })).text.endsWith('凉宫'));
  globalThis.fetch = async () => response(utf8(`${' '.repeat(2048)}<meta charset="gbk">夜读`));
  assert.ok((await natives.web({ url: 'https://fixture.test/' })).text.endsWith('夜读'));
});

// ---- 2026-10-07：真实书源里常见、之前不认的写法 ----
const table = parseDocument('<table><tbody><tr><th>书名</th></tr><tr><td><a href="/b/1">甲</a></td></tr><tr><td><a href="/b/2">乙</a></td></tr></tbody></table><div class="list"><a href="/c/0">页首</a></div><div class="list"><a href="/c/1">第一章</a><a href="/c/2">第二章</a></div><meta property="og:novel:author" content="某作者">');
test('列表规则: 最后一段也是选择器（tbody@tr!0、.list.1@a）', () => {
  assert.deepEqual(evaluateRule(table, 'tbody@tr!0', 0, true).map(n => strings(n, 'tag.a@text')[0]), ['甲', '乙']);
  assert.deepEqual(evaluateRule(table, '.list.1@a', 0, true).map(n => n.getAttribute('href')), ['/c/1', '/c/2']);
  // 字符串规则里同样的写法仍按阅读 App 的意思：最后一段是要取的属性
  assert.deepEqual(strings(table, 'class.list.1@tag.a@href'), ['/c/1', '/c/2']);
});
test('JSON: 不带 $ 的路径（data[*]、book.name）', () => {
  const doc = { data: [{ name: '甲', id: 7 }, { name: '乙', id: 8 }] };
  assert.deepEqual(evaluateRule(doc, 'data[*]', 0, true).map(x => x.name), ['甲', '乙']);
  assert.deepEqual(strings(doc.data[0], 'name'), ['甲']);
});
test('模板: {{$.id}}、{$.id}、{{@@选择器}}、模板外的 ##', () => {
  const book = { bookId: 42, data: { novelId: 9 } };
  assert.deepEqual(strings(book, 'https://x.test/b?id={{$.bookId}}&v=2'), ['https://x.test/b?id=42&v=2']);
  assert.deepEqual(strings(book, 'https://x.test/n/{$.data.novelId}/dirs'), ['https://x.test/n/9/dirs']);
  assert.deepEqual(strings(table, 'https://x.test{{@@class.list.1@tag.a.0@href}}'), ['https://x.test/c/1']);
  assert.deepEqual(strings(table, '{{@@class.list.1@tag.a.0@href##/c/##}}.html##\.html##.htm'), ['1.htm']);
  assert.throws(() => evaluateRule(book, '{{baseUrl}}'), /脚本表达式/);
});
test('checkSource: lastChapter 认得；校验词等只影响显示的字段不提示；可选字段写法不认识不算用不了', async () => {
  const { fatalOf } = await import('../src/lib/legado.js');
  const base = { bookSourceName: 'x', bookSourceUrl: 'https://x.test/', searchUrl: '/s?q={{key}}',
    ruleSearch: { bookList: 'class.book', name: 'tag.a@text', bookUrl: 'tag.a@href', lastChapter: 'class.last@text', checkKeyWord: '我的' },
    ruleBookInfo: { name: 'tag.h1@text', lastChapter: 'class.last@text' },
    ruleToc: { chapterList: 'class.list.1@a', chapterName: '@text', chapterUrl: '@href', isVip: 'class.vip@text', updateTime: 'span@text' },
    ruleContent: { content: 'id.content@html', imageStyle: 'FULL', title: 'h1@text' } };
  assert.deepEqual(checkSource(base).unsupported, []);
  const optionalBroken = { ...base, ruleSearch: { ...base.ruleSearch, kind: 'td.5:4@text', intro: '{{baseUrl}}' } };
  const check = checkSource(optionalBroken);
  assert.equal(check.unsupported.length, 1);
  assert.deepEqual(fatalOf(check), []);
  const requiredBroken = { ...base, ruleToc: { ...base.ruleToc, chapterUrl: '{{baseUrl}}' } };
  assert.equal(fatalOf(checkSource(requiredBroken)).length, 1);
  const scriptHeader = { ...base, header: '<js>({"User-Agent":"x"})</js>' };
  assert.equal(fatalOf(checkSource(scriptHeader)).length, 1);
});
test('详情: lastChapter 取到最新章节', async () => {
  const source = { bookSourceName: 'x', bookSourceUrl: 'https://x.test/', ruleBookInfo: { name: 'tag.h1@text', lastChapter: 'class.last@text' } };
  const info = await bookInfo(source, 'https://x.test/b/1', { http: async () => ({ status: 200, url: 'https://x.test/b/1', text: '<h1>夜读</h1><p class="last">第九章</p>' }) });
  assert.equal(info.latestChapter, '第九章');
});

test('R5-1: 单引号、裸键、尾逗号与嵌套请求头', () => {
  const req = buildRequest({ ...jsonSource, header: "{'User-Agent':'x',}" }, "/s,{'method':'POST',body:'q={{key}}',headers:{X:'y',},}", { key: '夜 读' });
  assert.equal(req.method, 'POST'); assert.equal(req.body, 'q=' + encodeURIComponent('夜 读'));
  assert.deepEqual(req.headers, { 'User-Agent': 'x', X: 'y' });
  const ua = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36';
  assert.equal(buildRequest({ ...jsonSource, header: ua }, '/').headers['User-Agent'], ua);
});
test('R5-1: 转义保持原值；坏 JSON、表达式与非字符串头拒绝', () => {
  assert.equal(buildRequest(jsonSource, String.raw`/s,{method:'POST',body:'it\'s \\ ok \u4e66',}`).body, "it's \\ ok 书");
  for (const bad of ["{body:'x'", "{body:alert(1)}", "{body:'x',,}", "{body:'x'}junk", "{body:'x' method:'GET'}", "{body:'\\q'}"]) assert.throws(() => buildRequest(jsonSource, '/s,' + bad));
  for (const header of ['[]', "{a:1}", '{bad', 'not a UA']) assert.throws(() => buildRequest({ ...jsonSource, header }, '/'));
  assert.equal({}.polluted, undefined);
});

test('R5-2: 白名单只替换常量，分号和换行版本一致', () => {
  for (const expr of ['cookie.removeCookie(source.getKey())', 'cookie.removeCookie(source.key)']) {
    assert.equal(buildRequest(jsonSource, '{{' + expr + '}}/s').url, new URL('/s', jsonSource.bookSourceUrl).href);
    assert.deepEqual(evaluateRule(null, '{{' + expr + '}}'), ['']);
  }
  for (const expr of ['url=source.getKey();cookie.removeCookie(url);url', 'url=source.getKey()\ncookie.removeCookie(url)\nurl', ' url = source.getKey();\n cookie.removeCookie(url);\n url; ']) {
    assert.equal(renderTemplate('{{' + expr + '}}/s', { sourceUrl: 'https://fixture.test' }), 'https://fixture.test/s');
    assert.deepEqual(evaluateRule(null, '{{' + expr + '}}', 0, false, { sourceUrl: 'https://fixture.test' }), ['https://fixture.test']);
  }
});
test('R5-2: 白名单不能夹带语句、换参数或调用实际对象', () => {
  globalThis.cookie = { removeCookie() { throw Error('不应调用'); } };
  try {
    assert.equal(renderTemplate('{{cookie.removeCookie(source.key)}}'), '');
    for (const expr of ['cookie.removeCookie(x);alert(1)', 'cookie.removeCookie(source.key);alert(1)', 'url=source.getKey();cookie.removeCookie(url);url+1', 'url=source.getKey() cookie.removeCookie(url) url']) {
      assert.throws(() => renderTemplate('{{' + expr + '}}'));
      assert.throws(() => evaluateRule(html, '{{' + expr + '}}'), /脚本表达式/);
    }
  } finally { delete globalThis.cookie; }
});

test('R5-3: put 后缀、组合、引号和 get 模板，未定义值为空', () => {
  const context = { variables: Object.create(null) };
  assert.deepEqual(strings({ title: '甲', id: '7' }, 'title@put:{bid:id}', 0, context), ['甲']);
  assert.deepEqual(strings({ id: '8', name: '乙' }, '@put:{"bid":"$.id"}&&$.name', 0, context), ['乙']);
  assert.deepEqual(strings({}, '/b/@get:{bid}/{{@get:{bid}}}/@get:{missing}', 0, context), ['/b/8/8/']);
  assert.deepEqual(strings({}, '@get:{bid}##8##9', 0, context), ['9']);
  assert.equal(buildRequest(jsonSource, '/@get:{bid},{method:"POST",body:"id=@get:{bid}"}', { variables: context.variables }).body, 'id=8');
  assert.throws(() => evaluateRule({}, '@put:{x:<js>oops</js>}'), /不执行脚本/);
  assert.throws(() => evaluateRule({}, '@put:{x:{{alert(1)}}}'), /脚本表达式/);
  assert.throws(() => evaluateRule({}, '@put:{x:$.id'), /未闭合/);
});
test('R5-3: 四步夹具并发两书、两源，章节变量不串值', async () => {
  const original = JSON.parse(await fixture('variables-source.json'));
  assert.deepEqual(checkSource(original), { ok: true, unsupported: [] });
  async function run(label) {
    const source = { ...original, bookSourceName: label };
    const http = async request => {
      const path = new URL(request.url).pathname;
      let data;
      if (path === '/search') data = { books: [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }] };
      else if (path.startsWith('/book/')) data = { name: '书', detail: label + path.slice(-1) };
      else if (path.startsWith('/toc/')) {
        assert.equal(new URL(request.url).searchParams.get('detail'), label + path.slice(-1));
        data = { chapters: [{ id: '1', title: '一' }, { id: '2', title: '二' }] };
      } else data = { body: '正文' };
      return { status: 200, url: request.url, text: JSON.stringify(data) };
    };
    const books = await search(source, '书', { http });
    await Promise.all(books.map(async (book, i) => {
      const id = i ? 'b' : 'a';
      assert.ok(book.bookUrl.endsWith(`/book/${id}?saved=${id}`));
      const info = await bookInfo(source, book.bookUrl, { http });
      const chapters = await toc(source, info.tocUrl, { http });
      const texts = await Promise.all(chapters.map(ch => content(source, ch.url, { http })));
      assert.deepEqual(texts, [`正文 / ${id} / ${label}${id} / 1`, `正文 / ${id} / ${label}${id} / 2`]);
    }));
  }
  await Promise.all([run('源甲'), run('源乙')]);
});
test('R5-3: 变量值只是文本，不能触发二次模板执行或原型污染', () => {
  const context = { variables: Object.create(null) };
  assert.deepEqual(strings({ id: '{{alert(1)}}' }, '$.id@put:{__proto__:$.id}', 0, context), ['{{alert(1)}}']);
  assert.deepEqual(strings({}, '@get:{__proto__}', 0, context), ['{{alert(1)}}']);
  assert.equal(Object.getPrototypeOf(context.variables), null);
  assert.deepEqual(strings({}, '@get:{toString}', 0, context), []);
});

test('R5-4: 方括号闭区间、省略末项、负数、步长与越界', () => {
  assert.deepEqual(strings(html, 'dd[8:]@text'), ['8', '9']);
  assert.deepEqual(strings(html, '.book_other[1:2]@text'), ['1', '2']);
  assert.deepEqual(strings(html, 'dd[1:7:2]@text'), ['1', '3', '5', '7']);
  assert.deepEqual(strings(html, 'dd[-3:-1]@text'), ['7', '8', '9']);
  assert.deepEqual(strings(html, 'dd[7:3:-2]@text'), ['7', '5', '3']);
  assert.deepEqual(strings(html, 'dd[100:200]@text'), []);
  assert.throws(() => strings(html, 'dd[1:3:0]@text'), /步长/);
});
test('R5-4: 点号冒号是下标列表，保留顺序及负下标；支持排除', () => {
  assert.deepEqual(strings(html, '.range span.3:7:-1@text'), ['3', '7', '9']);
  assert.deepEqual(strings(html, '.range td.5:4@text'), ['5', '4']);
  assert.deepEqual(strings(html, '.range span.1:3:0@text'), ['1', '3', '0']);
  assert.deepEqual(strings(html, '.book_other!0:2@text'), ['1']);
});
test('R5-4: @css :eq 正负下标与后代链', () => {
  assert.deepEqual(strings(html, '@css:.range span:eq(3)@text'), ['3']);
  assert.deepEqual(strings(html, '@css:.range span:eq(-1)@text'), ['9']);
  assert.deepEqual(strings(html, '@css:.range:eq(0) span:eq(2)@text'), ['2']);
  assert.deepEqual(strings(html, '@css:.range span:eq(99)@text'), []);
});

test('R5-5: 静态三类互斥，非必经字段不误挡，禁止网络和脚本', () => {
  const saved = globalThis.fetch;
  globalThis.fetch = () => { throw Error('静态检查不应联网'); };
  globalThis.__staticScriptRan = false;
  try {
    assert.equal(classifySource(htmlSource).category, 'pass');
    assert.equal(classifySource({ ...htmlSource, ruleSearch: { ...htmlSource.ruleSearch, intro: '{{alert(1)}}' } }).category, 'pass');
    assert.equal(classifySource({ ...htmlSource, searchUrl: '/,{webView:true}' }).category, 'unknown');
    assert.equal(classifySource({ ...htmlSource, searchUrl: '/{{globalThis.__staticScriptRan=true}}' }).category, 'script');
    assert.equal(globalThis.__staticScriptRan, false);
  } finally { globalThis.fetch = saved; delete globalThis.__staticScriptRan; }
});
test('R5-5: 递归目录，隔离坏 JSON / 坏条目并跳过订阅源', async () => {
  const result = await checkDirectory(fileURLToPath(new URL('./fixtures/legado/check-dir', import.meta.url)));
  assert.equal(result.files, 2); assert.equal(result.sources, 1);
  assert.equal(result.pass, 1); assert.equal(result.script + result.unknown, 0);
  assert.equal(result.skippedSubscriptions, 1); assert.equal(result.errors.length, 2);
  assert.match(formatReport(result), /能过 1 \/ 要脚本 0 \/ 规则不认识 0/);
});
test('R5-5: CLI 用法、缺失目录报错与 --json 输出', () => {
  const command = fileURLToPath(new URL('./legado-check-dir.mjs', import.meta.url));
  const directory = fileURLToPath(new URL('./fixtures/legado/check-dir', import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [command, ...args], { encoding: 'utf8', timeout: 10000 });
  assert.equal(run().status, 1);
  assert.equal(run(directory + '/missing').status, 1);
  const good = run(directory, '--json');
  assert.equal(good.status, 0); assert.equal(JSON.parse(good.stdout).pass, 1);
});

test('R5 回归: eq 属性字面量不拆分；get 空格模板与坏格式', () => {
  const doc = parseDocument('<a data-x=":eq(1)">保留</a>');
  assert.deepEqual(strings(doc, '@css:a[data-x=":eq(1)"]@text'), ['保留']);
  assert.deepEqual(strings({}, '{{ @get:{id} }}', 0, { variables: { id: 3 } }), ['3']);
  for (const bad of ['@get:id', '@get:{id', '@get:{}', '@get:{a.b}']) {
    assert.throws(() => strings({}, bad));
    assert.throws(() => renderTemplate(bad));
  }
});

// 各阶段的测试在 runner 前注册，单条失败不妨碍看到其余用例结果。
let passed = 0;
for (const { name, run } of tests) {
  try { await run(); passed++; console.log(`✓ ${name}`); }
  catch (error) { process.exitCode = 1; console.error(`✗ ${name}\n`, error); }
}
globalThis.fetch = originalFetch;
delete globalThis.__legadoNativeMock;
console.log(`\n${passed}/${tests.length} passed`);
