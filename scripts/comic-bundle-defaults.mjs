// 生成随包附带的默认漫画源：src/comic/default-sources.js（同 legado-bundle-defaults.mjs 之于默认书源）。
//   node scripts/comic-bundle-defaults.mjs            按下面固定的提交拉 venera-configs
//   node scripts/comic-bundle-defaults.mjs <commit>   换一个提交（更新默认源时用，记得改 COMMIT、跑 comic-test --live --bundled）
//
// 只收白名单里的源（src/comic/policy.js），脚本只去掉空白和注释（类名、代码不动，源靠类名装载）。
// 哪些默认打开：ENABLED 里的，是在 Windows 客户端「测一遍」通过的；其余默认关着、标 autoOff——
// 在用户自己的网络下「测一遍」通过了会自动打开（同书源）。自建服务器的三个要先填地址，默认关着、不自动开。
//
// 官方仓库之外，COMMUNITY 里列的是社区仓库的源（官方没有的站，2026-10-17 第九轮逐个实测过，见 docs/ASTRA_COMIC_SOURCES_R9.md）：
// 各按固定提交拉，_venera_.js 用官方那份（随包只带一份运行时，测试也是拿官方运行时跑的）。
// 文件名前面加上仓库简称（「lx7.bilimanga.js」），装好的 id 是「venera:lx7.bilimanga」，不会和官方仓库以后的同名文件撞上
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { comicSkipReason, isSelfHosted } from '../src/comic/policy.js';

const REPO = { owner: 'venera-app', repo: 'venera-configs' };
const COMMIT = process.argv[2] || 'e28e134074308c0006408272639a53b9af9ce9da';   // 2026-10-05（2026-10-17 看过：还是最新提交）
// 版本：2 = 第九轮加了社区源。新加的源标 since: 2（已经装过第 1 版默认源的用户，sources.js 只补 since 比装过的版本新的）
const VERSION = 2;
// 社区仓库：简称 → 仓库和固定提交
const REPOS = {
  lx7: { owner: 'LX7kM9', repo: 'venera-configs', commit: 'f8775d2a2ec8322366724073b37793152078e7ba' },        // 2026-10-15
  hdh: { owner: 'handahao666-boop', repo: 'venera_comic_source', commit: 'ee1a541f8e8c6378a2bbf463c30406a2cc8ec7e4' }, // 2026-10-15
  yhq: { owner: 'YHQY-Dev', repo: 'venera-sources', commit: 'b84b58ad0935df124b38a12f2d6e369d0715ff32' },          // 2026-07-14
  tk: { owner: 'token1008', repo: 'venera-cn-64bit', commit: 'a47957c657f39731c3a082e7bab82113d6fc693e' },         // 2026-09-23
  zm: { owner: 'zhimouzhou', repo: 'venera-manga-sources', commit: 'b3b22aaf832fb2382004b5be10a314e59c47e328', index: 'all_index.json' }, // 2026-06-04
};
// 社区源：[仓库简称, 源的 key, 仓库里的文件名, { replace }]。同一个站有几个仓库的版本时，取实测最好的那个（docs/ASTRA_COMIC_SOURCES_R9.md）
// replace：官方那份坏了、社区修好的，顶替官方的（文件名沿用官方的，装好的 id 不变）
const COMMUNITY = [
  ['lx7', 'banana', 'banana.js'],                       // 香蕉漫画
  ['lx7', 'tuku_cc', 'tuku_cc.js'],                     // 图库漫画
  ['lx7', 'mkzhan', 'mkzhan.js'],                       // 漫客栈
  ['lx7', 'xmanhua', 'xmanhua.js'],                     // X漫画
  ['lx7', 'wmanhua', 'wmanhua.js'],                     // W漫画
  ['lx7', 's311_com', '311.js'],                        // 311漫画
  ['lx7', 'zerobyw', 'zero.js'],                        // zero搬运网
  ['lx7', 'guazimanhua', 'guazi_manhua.js'],            // 瓜子漫画
  ['lx7', 'mangabz', 'mangabz.js'],                     // Mangabz
  ['lx7', 'mhkan', 'mhkan.js'],                         // 漫画kan
  ['lx7', 'haokan_txt', 'haokan.js'],                   // 好看漫画（和 311 漫画同一个后台，默认关）
  ['zm', 'rumanhua2', 'sources/rumanhua2.js'],          // 如漫画
  ['tk', 'acqq', 'sources-direct/acqq.js'],             // 腾讯漫画（正版，只有免费章节）
  ['tk', 'kanman', 'sources-direct/kanman.js'],         // 看漫画
  ['tk', 'manman', 'sources-direct/manman.js'],         // 漫漫漫画
  ['yhq', 'dm5', 'dm5.js'],                             // 动漫屋（和漫画人同一个后台，默认关）
  ['yhq', 'sisimanhua', 'sisimanhua.js'],               // 思思漫画（封面取不到，默认关）
  ['lx7', 'baozi', 'baozi.js', { replace: true }],      // 官方 1.1.6 章节图 403；1.2.1 能换图床（s1.bzcdn.net）
  ['lx7', 'mh1234', 'mh1234.js', { replace: true }],    // 官方 1.0.0 搜索报错
  ['lx7', 'shonen_jump_plus', 'shonen_jump_plus.js', { replace: true }],   // 官方 1.1.1 搜索拿到网页不是 JSON
];
// 2026-10-15 Windows 客户端「测一遍」通过的（热辣漫画和拷贝漫画是同一个后台，搜出来重复，默认不开）；
// 2026-10-17 第九轮：国内直连下搜索 + 封面 + 探索页都正常的社区源也默认打开（要求国内网络能用，代理的结果只作参考）。
// MYCOMIC 直连、代理都被 Cloudflare 拦，comick 国内直连一次要一两分钟、详情常超时：这两个改成默认关（测一遍通过会自动打开）
// 和别的源同一个后台、搜出来重复的：默认关，也不自动打开
const SAME_BACKEND = ['hot_manga', 'haokan_txt', 'dm5'];
const ENABLED = ['copy_manga', 'Komiic', 'baozi', 'manga_dex', 'ykmh', 'ManHuaGui', 'ccc', 'goda', 'manhuaren',
  'banana', 'rumanhua2', 'tuku_cc', 'mkzhan', 'xmanhua', 'wmanhua', 'acqq', 's311_com', 'kanman', 'zerobyw', 'guazimanhua',
  'mangabz', 'mhkan', 'manman', 'mh1234'];
// 默认设置：包子漫画的默认主域名 bzmgcn.com 已经跳到 403，换成测过能用的
// 章节图床换成 s1.bzcdn.net（默认的 as.baozimh.com 也是 403）。封面写死在 static-tw.baozimh.com（403），见报告
const SETTINGS = { baozi: { domains: 'webmota.com', cdn_domains: 's1.bzcdn.net' } };

async function get(path, { owner, repo, commit } = { ...REPO, commit: COMMIT }) {
  const urls = [`https://fastly.jsdelivr.net/gh/${owner}/${repo}@${commit}/${path}`, `https://raw.githubusercontent.com/${owner}/${repo}/${commit}/${path}`];
  let last;
  for (const url of urls) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(20000) }); if (r.ok) return await r.text(); last = new Error(`HTTP ${r.status} ${url}`); }
    catch (e) { last = e; }
  }
  throw last;
}
const strip = async (code) => (await transform(code, { minifyWhitespace: true, legalComments: 'none', target: 'es2022' })).code;
const classNameOf = (code) => /\bclass\s+([A-Za-z_$][\w$]*)\s+extends\s+ComicSource\b/.exec(code)?.[1] || '';

const index = JSON.parse(await get('index.json'));
const picked = index.filter(e => /^[\w.-]+\.js$/.test(e.fileName || '') && !comicSkipReason({ key: e.key, name: e.name }))
  // 同一个 key 有多个文件（拷贝漫画的「多账号」版）只要和 key 同名的那个
  .filter((e, _, all) => !all.some(o => o !== e && o.key === e.key && o.fileName === `${o.key}.js` && e.fileName !== `${e.key}.js`))
  .map(e => ({ ...e, since: 1 }));
const indexes = {};
for (const [alias, key, file, { replace = false } = {}] of COMMUNITY) {
  const repo = REPOS[alias];
  indexes[alias] ||= JSON.parse(await get(repo.index || 'index.json', repo));
  const e = indexes[alias].find(x => x.key === key && x.fileName === file);
  if (!e) throw new Error(`${repo.owner}/${repo.repo} 的索引里没有 ${key}（${file}）`);
  if (comicSkipReason({ key: e.key, name: e.name })) throw new Error(`${e.name}（${key}）不在白名单`);
  const at = picked.findIndex(o => o.key === key);
  if (at >= 0 && !replace) throw new Error(`${key} 官方仓库已经有了`);
  if (at < 0 && replace) throw new Error(`${key} 官方仓库里没有，不用 replace`);
  const official = at >= 0 ? picked.splice(at, 1)[0] : null;
  picked.push({ ...e, name: official?.name || e.name, since: 2, replaces: !!official, from: { alias, ...repo, file }, fileName: official?.fileName || `${alias}.${file.split('/').pop()}` });
}
const runtime = await get('_venera_.js');
const sources = [];
for (const e of picked) {
  const code = await strip(await get(e.from?.file || e.fileName, e.from));
  const className = classNameOf(code);
  if (!className) throw new Error(`${e.fileName} 里找不到 ComicSource 类`);
  const enabled = ENABLED.includes(e.key);
  sources.push({ key: e.key, name: e.name, version: String(e.version || ''), fileName: e.fileName, className, code, enabled,
    autoOff: !enabled && !isSelfHosted(e.key) && !SAME_BACKEND.includes(e.key), since: e.since, ...(e.replaces ? { replaces: true } : {}),
    ...(e.from ? { from: `${e.from.owner}/${e.from.repo}@${e.from.commit.slice(0, 8)}/${e.from.file}` } : {}),
    ...(SETTINGS[e.key] ? { settings: SETTINGS[e.key] } : {}) });
  console.log(`${enabled ? '开' : '关'} ${e.name} v${e.version}${e.from ? `（${e.from.owner}/${e.from.repo}）` : ''}  ${(code.length / 1024).toFixed(0)}KB`);
}
const out = {
  version: VERSION, repo: 'venera', commit: COMMIT, runtime,
  sources: sources.sort((a, b) => Number(b.enabled) - Number(a.enabled) || ENABLED.indexOf(a.key) - ENABLED.indexOf(b.key)),
};
const file = fileURLToPath(new URL('../src/comic/default-sources.js', import.meta.url));
await writeFile(file, `// 由 scripts/comic-bundle-defaults.mjs 生成：${REPO.owner}/${REPO.repo}@${COMMIT.slice(0, 8)}${COMMUNITY.length ? ` 和 ${COMMUNITY.length} 个社区源` : ''}，白名单里的 ${sources.length} 个源。不要手改。\nexport default ${JSON.stringify(out, null, 1)};\n`);
console.log(`\n写好了 ${file}：${sources.length} 个源（默认打开 ${sources.filter(s => s.enabled).length} 个），${(JSON.stringify(out).length / 1024).toFixed(0)}KB`);
