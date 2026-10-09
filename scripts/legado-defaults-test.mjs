import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFile } from 'node:fs/promises';
import { DOMParser } from 'linkedom';
import bundle from '../src/plugins/legado/default-sources.js';
import { defaultKeyOf, mergeDefaults, DEFAULTS_VERSION } from '../src/plugins/legado/defaults.js';
import { isAdultSource, bookSkipReason, rssSkipReason } from '../src/plugins/legado/source-policy.js';

globalThis.DOMParser = DOMParser;
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('夹具测试不允许联网'); };

// 只在 Node 测试中替换数据库模块；生产初始化、合并、开关和删除走真实代码。
const hook = registerHooks({ resolve(specifier, context, next) {
  if (specifier === './idb.js' && /\/src\/lib\/(legado|rss)\.js/.test(context.parentURL || '')) {
    return { shortCircuit: true, url: 'data:text/javascript,export const idbGet=(...a)=>globalThis.__defaultsDB.get(...a);export const idbSet=(...a)=>globalThis.__defaultsDB.set(...a);' };
  }
  return next(specifier, context);
} });
const { selectDefaults } = await import('./legado-bundle-defaults.mjs');
const { checkSource } = await import('../src/plugins/legado/index.js');
const { fatalOf, sourceIdOf } = await import('../src/lib/legado.js');
const { buildRequest } = await import('../src/plugins/legado/request.js');
const fixture = JSON.parse(await readFile(new URL('./fixtures/legado/html-source.json', import.meta.url), 'utf8'));
const tests = [];
const test = (name, run) => tests.push({ name, run });
let serial = 0;
const freshModule = () => import(`../src/lib/legado.js?defaults-test=${++serial}`);
function database(entries = []) {
  const data = new Map(entries), writes = [];
  globalThis.__defaultsDB = {
    async get(store, key) { return structuredClone(data.get(key)); },
    async set(store, key, value) { writes.push(key); data.set(key, structuredClone(value)); },
  };
  return { data, writes };
}

test('生成：只保留静态通过源，同站点不同名优先选规则更完整的版本', () => {
  const partial = { ...fixture, bookSourceName: '部分', ruleSearch: { ...fixture.ruleSearch, intro: '{{unknown()}}' } };
  const failed = { ...fixture, bookSourceUrl: 'https://bad.fixture.invalid', searchUrl: '<js>alert(1)</js>' };
  const selected = selectDefaults([partial, fixture, { ...fixture, bookSourceName: '重复' }, failed]);
  assert.equal(selected.passed, 3); assert.equal(selected.sources.length, 1);
  assert.equal(selected.sources[0].source.bookSourceName, fixture.bookSourceName);
});
test('生成：默认包排除 Cookie、授权头与 URL 凭据，不修改原始源', () => {
  const variants = [
    { ...fixture, header: '{"Cookie":"fixture-session"}' },
    { ...fixture, searchUrl: '/,{headers:{Authorization:"Bearer fixture-token"}}' },
    { ...fixture, searchUrl: '/?access_token=fixture-token' },
    { ...fixture, searchUrl: 'https://fixture:secret@auth.fixture.invalid/search' },
  ];
  const selected = selectDefaults(variants);
  assert.equal(selected.sources.length, 0); assert.equal(selected.excludedCredentials, 4);
  assert.match(variants[0].header, /fixture-session/);
});
test('默认包：全部通过静态检查，站点唯一、没有实测标记或认证请求头', () => {
  assert.equal(bundle.validation, 'static'); assert.ok(bundle.sources.length > 0);
  const sites = new Set();
  for (const entry of bundle.sources) {
    assert.equal(bookSkipReason(entry.source), '');
    assert.ok(!/^\d+(\.\d+){3}$/.test(new URL(entry.source.bookSourceUrl).hostname));
    assert.deepEqual(fatalOf(checkSource(entry.source)), []);
    assert.equal(entry.test, undefined); assert.equal(entry.source.test, undefined);
    const key = defaultKeyOf(entry.source); assert.ok(!sites.has(key)); sites.add(key);
    for (const [name, value] of Object.entries(buildRequest(entry.source, entry.source.searchUrl, { key: 'test' }).headers)) {
      assert.ok(!/^(cookie|authorization|proxy-authorization|x-api-key|api-key)$/i.test(name) || !value.trim());
    }
  }
});
test('合并：同站点自定义名称、停用、实测失败记录保留，输入不被修改', () => {
  const source = { ...bundle.sources[0].source, bookSourceName: '我自己的名字' };
  const existing = [{ id: sourceIdOf(source), source, enabled: false, test: { ok: false }, addedAt: 1 }];
  const before = structuredClone(existing);
  const merged = mergeDefaults(existing, bundle, sourceIdOf, 5);
  assert.equal(merged.length, bundle.sources.length); assert.deepEqual(merged[0], before[0]);
  assert.deepEqual(existing, before);
  assert.equal(merged[1].builtin, DEFAULTS_VERSION); assert.equal(merged[1].test, undefined);
});
test('首次启动：并发读取只安装一次，全部启用并写入账户安装标记', async () => {
  const db = database(), api = await freshModule();
  const lists = await Promise.all(Array.from({ length: 8 }, () => api.listSources()));
  assert.equal(lists[0].length, bundle.sources.length);
  assert.ok(lists.every(list => list === lists[0]));
  assert.ok(lists[0].every(e => e.enabled && e.builtin === DEFAULTS_VERSION && e.test === undefined));
  assert.deepEqual(db.writes, ['legado:sources', 'legado:defaults:1']);
});
test('重启：停用和单条删除不会被默认包覆盖或补回', async () => {
  const db = database(), api = await freshModule();
  const list = await api.listSources();
  await api.setSourceEnabled(list[0].id, false);
  await api.removeSource(list[1].id);
  const again = await (await freshModule()).listSources();
  assert.equal(again.length, bundle.sources.length - 1);
  assert.equal(again.find(e => e.id === list[0].id).enabled, false);
  assert.ok(!again.some(e => e.id === list[1].id));
  assert.equal(db.data.get('legado:defaults:1'), DEFAULTS_VERSION);
});
test('全部删除后重启保持空列表；另一个新账户仍自动获得默认源', async () => {
  database(); const api = await freshModule();
  const list = await api.listSources(); await api.removeSources(list.map(e => e.id));
  assert.deepEqual(await (await freshModule()).listSources(), []);
  database();
  assert.equal((await (await freshModule()).listSources()).length, bundle.sources.length);
});
test('升级已有账户：保留原源与关闭状态，只补缺少的默认源', async () => {
  const source = { ...bundle.sources[0].source, bookSourceName: '自定义' };
  const old = { id: sourceIdOf(source), source, enabled: false, addedAt: 123, test: { ok: false, why: '旧记录' } };
  database([['legado:sources', [old]]]);
  const list = await (await freshModule()).listSources();
  assert.equal(list.length, bundle.sources.length); assert.deepEqual(list[0], old);
});
test('读库失败：不覆盖数据、不写安装标记，恢复后允许重试', async () => {
  const db = database(); const get = globalThis.__defaultsDB.get;
  globalThis.__defaultsDB.get = async () => { throw Error('夹具读失败'); };
  const api = await freshModule();
  await assert.rejects(api.listSources(), /夹具读失败/); assert.equal(db.writes.length, 0);
  globalThis.__defaultsDB.get = get;
  assert.equal((await api.listSources()).length, bundle.sources.length);
});
test('初始化中断：列表已写、标记未写，重试去重且不丢用户状态', async () => {
  const db = database(); const set = globalThis.__defaultsDB.set;
  globalThis.__defaultsDB.set = async (...args) => { if (args[1] === 'legado:defaults:1') throw Error('夹具写失败'); return set(...args); };
  const api = await freshModule(); await assert.rejects(api.listSources(), /夹具写失败/);
  assert.equal(db.data.get('legado:sources').length, bundle.sources.length);
  db.data.get('legado:sources')[0].enabled = false;
  globalThis.__defaultsDB.set = set;
  const list = await api.listSources();
  assert.equal(list.length, bundle.sources.length); assert.equal(list[0].enabled, false);
});
test('保存失败：内存列表不虚假显示已删除，重试可成功', async () => {
  database(); const api = await freshModule(); const list = await api.listSources();
  const set = globalThis.__defaultsDB.set;
  globalThis.__defaultsDB.set = async () => { throw Error('保存失败'); };
  await assert.rejects(api.removeSource(list[0].id), /保存失败/);
  assert.equal((await api.listSources()).length, bundle.sources.length);
  globalThis.__defaultsDB.set = set;
  await api.removeSource(list[0].id);
  assert.equal((await api.listSources()).length, bundle.sources.length - 1);
});

test('成人过滤：名称、分组及改名站点；普通言情、百合、耽美不误删', () => {
  for (const bookSourceName of ['R18小说', '🔞笔趣阁', '海棠书屋', '御宅文屋', 'PO文屋']) assert.ok(isAdultSource({ bookSourceName }));
  assert.ok(isAdultSource({ bookSourceName: '普通名字', bookSourceGroup: '🎈废文' }));
  assert.ok(isAdultSource({ bookSourceName: '已改名', bookSourceUrl: 'https://m.haitangwx.com/' }));
  for (const bookSourceName of ['百合爱会', '耽美小说网', '言情小说网', '古诗词网']) assert.equal(isAdultSource({ bookSourceName }), false);
  const selected = selectDefaults([{ ...fixture, bookSourceName: 'R18' }, fixture]);
  assert.equal(selected.excludedAdult, 1); assert.equal(selected.sources.length, 1);
});
test('成人过滤：升级清除已安装列表，重新导入也不能添加', async () => {
  const adult = { ...fixture, bookSourceName: '海棠书屋' };
  const entry = { id: sourceIdOf(adult), source: adult, enabled: true };
  const db = database([['legado:sources', [entry]], ['legado:defaults:1', true]]);
  const api = await freshModule();
  assert.deepEqual(await api.listSources(), []);
  assert.deepEqual(db.data.get('legado:sources'), []);
  const imported = await api.importSources(JSON.stringify(adult));
  assert.equal(imported.added, 0); assert.equal(imported.skipped, 1); assert.deepEqual(imported.errors, []);
  assert.deepEqual(await api.listSources(), []);
});

test('订阅源：已导入 R18 / 18X 清理入库，分类同步消失，重导拦截', async () => {
  const sources = [
    { sourceName: '旧成人站', sourceUrl: 'https://adult.fixture.invalid/', sourceGroup: 'R18,🎬 欧美' },
    { sourceName: '旧成人站二', sourceUrl: 'https://adult2.fixture.invalid/', sourceGroup: '18X' },
    { sourceName: '普通订阅', sourceUrl: 'https://news.fixture.invalid/', sourceGroup: '资讯', singleUrl: true },
  ];
  const entries = sources.map((source, i) => ({ id: String(i), source, enabled: true, mode: 'web' }));
  const db = database([['legado:rss', entries], ['legado:rss-seeded', 1]]);
  const api = await import('../src/lib/rss.js?adult-cleanup-test=1');
  const list = await api.listRss();
  assert.equal(list.length, 1); assert.equal(list[0].source.sourceName, '普通订阅');
  assert.deepEqual(list.flatMap(e => api.groupsOf(e.source)), ['资讯']);
  assert.equal(db.data.get('legado:rss').length, 1);
  const result = await api.importRss(sources.slice(0, 2));
  assert.equal(result.added, 0); assert.equal(result.skipped, 2);
  assert.equal((await api.listRss()).length, 1);
});
test('默认订阅不含成人源，按订阅字段也能识别改名的成人站', async () => {
  const defaults = JSON.parse(await readFile(new URL('../src/lib/rss-defaults.json', import.meta.url), 'utf8'));
  assert.ok(defaults.every(source => !isAdultSource(source)));
  assert.ok(isAdultSource({ sourceName: '改名', sourceUrl: 'https://m.haitangwx.com/' }));
});

test('书源：漫画、听书、影视（类型或分组）不收；起点「家庭伦理」、番茄「成人教育」、Java 不算成人', () => {
  assert.equal(bookSkipReason({ bookSourceName: '某漫画', bookSourceType: 2 }), '漫画');
  assert.equal(bookSkipReason({ bookSourceName: '某站', bookSourceGroup: '听书 书源' }), '不是文字书');
  assert.equal(bookSkipReason({ bookSourceName: '哔哩哔哩', bookSourceGroup: '' }), '不是文字书');
  assert.equal(bookSkipReason({ bookSourceName: '吾爱破解', bookSourceUrl: 'https://www.52pojie.cn' }), '不是书站');
  assert.equal(bookSkipReason({ bookSourceName: '起点', exploreUrl: '都市::https://a/1\n家庭伦理::https://a/2' }), '');
  assert.equal(bookSkipReason({ bookSourceName: '番茄', exploreUrl: '[{"title":"成人教育","url":"/x"}]' }), '');
  assert.equal(bookSkipReason({ bookSourceName: 'Java编程小说' }), '');
  assert.equal(bookSkipReason({ bookSourceName: '某站', exploreUrl: '玄幻::/1&&R18::/2' }), '成人内容');
  assert.equal(bookSkipReason({ bookSourceName: '某站', exploreUrl: '辣文合集::/1' }), '成人内容');
});
test('订阅：只收拿来读的文字；影音、图片、软件工具、阅读 App 配套不收', () => {
  const r = (sourceName, more = {}) => rssSkipReason({ sourceName, sourceUrl: 'https://fixture.invalid/', ...more });
  assert.equal(r('某某影院'), '视频 / 音频');
  assert.equal(r('某站', { sortUrl: '电影::/1\n电视剧::/2\n综艺::/3\n搜索::/4' }), '视频 / 音频');
  assert.equal(r('壁纸大全'), '图片 / 漫画');
  assert.equal(r('在线tts合集'), '阅读 App 的配套');
  assert.equal(r('423 Down', { sourceUrl: 'https://www.423down.com/' }), '不是阅读内容');
  assert.equal(r('夸克导航'), '软件 / 工具');
  assert.equal(r('某站', { sortUrl: '最新::/1\n国产自拍::/2' }), '成人内容');
  // 正常的留下：分组叫「订阅源集合」不算配套；分类里夹一个「动漫」「有声小说」不算影音；带「推书」的工具分组留下
  assert.equal(r('知乎热榜', { sourceGroup: '订阅源集合' }), '');
  assert.equal(r('晋江论坛', { sortUrl: '读书心得::/1\n网友留言::/2\n动漫::/3' }), '');
  assert.equal(r('搜书吧', { sortUrl: '精品电子书::/1\n常规小说::/2\n有声小说::/3' }), '');
  assert.equal(r('星云推书', { sourceGroup: '工具 订阅' }), '');
  assert.equal(r('Runoob-服务端', { sortUrl: 'Python::/1\nJava::/2' }), '');
  for (const name of ['私', 'RSS', '失效']) assert.equal(r(name), '不是阅读内容');
  assert.equal(r('私人藏书阁'), '');
});
test('升级到新内置包：旧版带进来、新版审掉的内置源删掉；自己导入的、停用状态都保留', async () => {
  const keptBuiltin = { id: sourceIdOf(bundle.sources[0].source), source: bundle.sources[0].source, enabled: false, builtin: 1 };
  const dropped = { ...fixture, bookSourceName: '旧内置', bookSourceUrl: 'https://dropped.fixture.invalid' };
  const droppedEntry = { id: sourceIdOf(dropped), source: dropped, enabled: true, builtin: 1 };
  const mine = { ...fixture, bookSourceName: '我导入的', bookSourceUrl: 'https://mine.fixture.invalid' };
  const mineEntry = { id: sourceIdOf(mine), source: mine, enabled: true };
  const db = database([['legado:sources', [keptBuiltin, droppedEntry, mineEntry]], ['legado:defaults:1', true]]);
  const list = await (await freshModule()).listSources();
  assert.deepEqual(list.map(e => e.source.bookSourceName), [keptBuiltin.source.bookSourceName, '我导入的']);
  assert.equal(list[0].enabled, false);
  assert.equal(db.data.get('legado:defaults:1'), DEFAULTS_VERSION);
  // 删过的默认源不会因为升级补回来
  assert.equal(list.length, 2);
});

test('搜索池：书目和书源不分开，同一本书（书名一样、作者对得上）合成一条', async () => {
  const { pool } = await import('../src/lib/pool.js');
  const lib = [{ id: 'mojimoon:1', source: 'mojimoon', title: '败北女角太多了！', alt: '败犬女主太多了', author: '雨森焚火', tags: [], downloads: [{ kind: 'txt' }] }];
  const e = (n) => ({ id: 'e' + n, source: { bookSourceName: '源' + n } });
  const it = (name, author, bookUrl) => ({ name, author, bookUrl });
  const out = pool(lib, [
    { entry: e(1), item: it('败犬女主太多了', '雨森焚火', '/a') },
    { entry: e(2), item: it('诡秘之主', '爱潜水的乌贼', '/b') },
    { entry: e(3), item: it('诡秘之主（精校版）', '爱潜水的乌贼著', '/c') },
    { entry: e(4), item: it('诡秘之主', '别人', '/d') },
    { entry: e(5), item: it('《诡秘之主》', '', '/e') },
    { entry: e(5), item: it('《诡秘之主》', '', '/e') },
  ], '诡秘之主', () => '轻小说文库');
  assert.deepEqual(out.map(b => [b.title, b.poolSources.join()]), [['诡秘之主', '源2,源3,源5'], ['诡秘之主', '源4'], ['败北女角太多了！', '轻小说文库,源1']]);
  const merged = out[2];
  assert.equal(merged.downloads.length, 2); assert.equal(merged.downloads[1].source, 'legado');
  // 书架键沿用原来单个书源的写法，以前下过的照样显示「阅读」
  assert.match(merged.downloads[1].shelfKey, /^legado:e1:[a-z0-9]+:txt$/);
  assert.equal(lib[0].downloads.length, 1);
  // 同名的书：先返回的同人只有一个来源，排在多个来源的原作后面；带了作者就把那位作者的排第一
  const same = [{ entry: e(7), item: it('诡秘之主', '同人作者', '/x') }, { entry: e(8), item: it('诡秘之主', '爱潜水的乌贼', '/y') }, { entry: e(9), item: it('诡秘之主', '爱潜水的乌贼', '/z') }];
  assert.equal(pool([], same, '诡秘之主')[0].author, '爱潜水的乌贼');
  assert.equal(pool([], same.slice(0, 2), '诡秘之主', undefined, '爱潜水的乌贼')[0].author, '爱潜水的乌贼');
  // 书源给的分类带括号引号也认
  assert.deepEqual(pool([], [{ entry: e(1), item: { ...it('某书', '', '/k'), kind: '["男频","奇幻"]' } }], '某书')[0].tags, ['男频', '奇幻']);
});

let passed = 0;
try {
  for (const { name, run } of tests) {
    try { await run(); passed++; console.log(`✓ ${name}`); }
    catch (error) { process.exitCode = 1; console.error(`✗ ${name}`, error); }
  }
} finally { globalThis.fetch = originalFetch; delete globalThis.__defaultsDB; hook.deregister(); }
console.log(`\n${passed}/${tests.length} passed`);
