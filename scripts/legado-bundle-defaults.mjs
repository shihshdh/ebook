// 只读本地书源并静态筛选，绝不请求站点或执行源脚本。
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DOMParser } from 'linkedom';
import { parseSources, checkSource } from '../src/plugins/legado/index.js';
import { fatalOf } from '../src/lib/legado.js';
import { DEFAULTS_VERSION } from '../src/plugins/legado/defaults.js';
import { buildRequest } from '../src/plugins/legado/request.js';
import { bookSkipReason } from '../src/plugins/legado/source-policy.js';

// 不携带登录信息、发现页脚本、调试注释或用户的运行状态，仅保留应用读书用的规则。
const FIELDS = ['bookSourceName', 'bookSourceUrl', 'bookSourceGroup', 'searchUrl', 'header', 'ruleSearch', 'ruleBookInfo', 'ruleToc', 'ruleContent'];
// 内置包比导入再严一点：地址是裸 IP、域名写坏了（把备注写进了网址，或者 .com-8 这种）的不带
const badHost = (host) => /^\d+(?:\.\d+){3}$/.test(host) || !/\.[a-z]{2,}$/i.test(host);
export function selectDefaults(sources) {
  globalThis.DOMParser ||= DOMParser;
  let passed = 0, excludedCredentials = 0, excludedAdult = 0;
  const excluded = {}, unique = new Map();
  const skip = (why) => { excluded[why] = (excluded[why] || 0) + 1; };
  for (const original of sources) {
    const check = checkSource(original);
    if (fatalOf(check).length) continue;
    passed++;
    // 按原始规则判（发现页的分类名只在原始规则里，内置包不带）
    const why = bookSkipReason(original);
    if (why) { skip(why); if (why === '成人内容') excludedAdult++; continue; }
    if (badHost(new URL(original.bookSourceUrl).hostname)) { skip('网址是 IP 或写坏了'); continue; }
    const request = buildRequest(original, original.searchUrl, { key: 'test' });
    const url = new URL(request.url);
    const credentials = Object.entries(request.headers).some(([name, value]) => /^(?:cookie|authorization|proxy-authorization|x-api-key|api-key)$/i.test(name) && value.trim())
      || url.username || url.password || [...url.searchParams.keys()].some(key => /^(?:access_token|refresh_token|api_key|apikey|authorization)$/i.test(key));
    if (credentials) { excludedCredentials++; continue; }
    const source = Object.fromEntries(FIELDS.filter(key => original[key] != null).map(key => [key, structuredClone(original[key])]));
    // 同一个站（同一个域名）只留一份：优先保留不支持项更少的规则；相同分数保留按文件名顺序遇到的第一份。
    const key = new URL(source.bookSourceUrl).hostname;
    const old = unique.get(key);
    if (!old || check.unsupported.length < old.originalIssues) unique.set(key, { source, check: checkSource(source), originalIssues: check.unsupported.length });
  }
  return { passed, excludedCredentials, excludedAdult, excluded, sources: [...unique.values()].map(({ source, check }) => ({ source, check })) };
}

export async function bundleDirectory(directory) {
  const sources = [];
  let files = 0;
  async function walk(dir) {
    const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && /\.json$/i.test(entry.name)) {
        files++;
        sources.push(...parseSources(await readFile(path, 'utf8')).sources);
      }
    }
  }
  await walk(resolve(directory));
  const selected = selectDefaults(sources);
  return { version: DEFAULTS_VERSION, validation: 'static', files, candidates: sources.length, passed: selected.passed, excludedCredentials: selected.excludedCredentials, excludedAdult: selected.excludedAdult, excluded: selected.excluded, sources: selected.sources };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (!process.argv[2]) throw new Error('用法：node scripts/legado-bundle-defaults.mjs <书源目录>');
    const bundle = await bundleDirectory(process.argv[2]);
    if (!bundle.sources.length) throw new Error('没有静态检查通过的书源，不覆盖默认包');
    const target = fileURLToPath(new URL('../src/plugins/legado/default-sources.js', import.meta.url));
    await writeFile(target, '// 由 scripts/legado-bundle-defaults.mjs 生成；仅静态检查通过，未标记为实测成功。\nexport default ' + JSON.stringify(bundle, null, 2) + ';\n', 'utf8');
    const why = Object.entries(bundle.excluded).map(([k, n]) => `${k} ${n}`).join('、');
    console.log(`静态通过 ${bundle.passed} 条；不收：${why || '无'}、含凭据 ${bundle.excludedCredentials} 条；按域名去重后内置 ${bundle.sources.length} 条；${Buffer.byteLength(JSON.stringify(bundle))} 字节（紧凑 JSON）`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
