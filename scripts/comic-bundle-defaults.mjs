// 生成随包附带的默认漫画源：src/comic/default-sources.js（同 legado-bundle-defaults.mjs 之于默认书源）。
//   node scripts/comic-bundle-defaults.mjs            按下面固定的提交拉 venera-configs
//   node scripts/comic-bundle-defaults.mjs <commit>   换一个提交（更新默认源时用，记得改 COMMIT、跑 comic-test --live --bundled）
//
// 只收白名单里的源（src/comic/policy.js），脚本只去掉空白和注释（类名、代码不动，源靠类名装载）。
// 哪些默认打开：ENABLED 里的，是在 Windows 客户端「测一遍」通过的；其余默认关着、标 autoOff——
// 在用户自己的网络下「测一遍」通过了会自动打开（同书源）。自建服务器的三个要先填地址，默认关着、不自动开。
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { comicSkipReason, isSelfHosted } from '../src/comic/policy.js';

const REPO = { owner: 'venera-app', repo: 'venera-configs' };
const COMMIT = process.argv[2] || 'e28e134074308c0006408272639a53b9af9ce9da';   // 2026-10-05
// 2026-10-15 Windows 客户端「测一遍」通过的（热辣漫画和拷贝漫画是同一个后台，搜出来重复，默认不开）
const ENABLED = ['copy_manga', 'Komiic', 'baozi', 'manga_dex', 'ykmh', 'ManHuaGui', 'ccc', 'goda', 'manhuaren', 'mycomic'];
// 默认设置：包子漫画的默认主域名 bzmgcn.com 已经跳到 403，换成测过能用的
const SETTINGS = { baozi: { domains: 'webmota.com' } };

async function get(path) {
  const urls = [`https://fastly.jsdelivr.net/gh/${REPO.owner}/${REPO.repo}@${COMMIT}/${path}`, `https://raw.githubusercontent.com/${REPO.owner}/${REPO.repo}/${COMMIT}/${path}`];
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
  .filter((e, _, all) => !all.some(o => o !== e && o.key === e.key && o.fileName === `${o.key}.js` && e.fileName !== `${e.key}.js`));
const runtime = await get('_venera_.js');
const sources = [];
for (const e of picked) {
  const code = await strip(await get(e.fileName));
  const className = classNameOf(code);
  if (!className) throw new Error(`${e.fileName} 里找不到 ComicSource 类`);
  const enabled = ENABLED.includes(e.key);
  sources.push({ key: e.key, name: e.name, version: String(e.version || ''), fileName: e.fileName, className, code, enabled,
    autoOff: !enabled && !isSelfHosted(e.key) && e.key !== 'hot_manga', ...(SETTINGS[e.key] ? { settings: SETTINGS[e.key] } : {}) });
  console.log(`${enabled ? '开' : '关'} ${e.name} v${e.version}  ${(code.length / 1024).toFixed(0)}KB`);
}
const out = {
  version: 1, repo: 'venera', commit: COMMIT, runtime,
  sources: sources.sort((a, b) => Number(b.enabled) - Number(a.enabled) || ENABLED.indexOf(a.key) - ENABLED.indexOf(b.key)),
};
const file = fileURLToPath(new URL('../src/comic/default-sources.js', import.meta.url));
await writeFile(file, `// 由 scripts/comic-bundle-defaults.mjs 生成：${REPO.owner}/${REPO.repo}@${COMMIT.slice(0, 8)}，白名单里的 ${sources.length} 个源。不要手改。\nexport default ${JSON.stringify(out, null, 1)};\n`);
console.log(`\n写好了 ${file}：${sources.length} 个源（默认打开 ${sources.filter(s => s.enabled).length} 个），${(JSON.stringify(out).length / 1024).toFixed(0)}KB`);
