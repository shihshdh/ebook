// 静态检查：只读本地 JSON，不调用搜索、请求或书源脚本。
import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DOMParser } from 'linkedom';
import { parseSources, checkSource, SUBSCRIPTION } from '../src/plugins/legado/index.js';
import { fatalOf } from '../src/lib/legado.js';

export function classifySource(source) {
  globalThis.DOMParser ||= DOMParser;
  const reasons = fatalOf(checkSource(source));
  const script = reasons.some(r => /<js>|@js:|java\.\*|脚本表达式|模板算式/.test(r));
  return { category: !reasons.length ? 'pass' : script ? 'script' : 'unknown', reasons };
}

export async function checkDirectory(directory) {
  globalThis.DOMParser ||= DOMParser;
  const result = { files: 0, sources: 0, pass: 0, script: 0, unknown: 0, skippedSubscriptions: 0, errors: [], reasons: {}, groups: { script: {}, unknown: {} },
    notes: ['按应用 fatalOf 的必经规则判断；每条源只归一类，原因可重叠。', '仅静态检查，不代表站点可访问或实际搜读成功。', 'Node/linkedom 缺少 XPath 校验能力，相关规则保守计入规则不认识。'] };
  async function walk(dir) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && /\.json$/i.test(entry.name)) {
        result.files++;
        let parsed;
        try { parsed = parseSources(await readFile(path, 'utf8')); }
        catch (error) { result.errors.push(`${path}: ${error.message}`); continue; }
        for (const error of parsed.errors) {
          if (error.includes(SUBSCRIPTION)) result.skippedSubscriptions++;
          else result.errors.push(`${path}: ${error}`);
        }
        for (const source of parsed.sources) {
          const { category, reasons } = classifySource(source);
          result.sources++; result[category]++;
          for (const reason of new Set(reasons)) {
            result.reasons[reason] = (result.reasons[reason] || 0) + 1;
            result.groups[category][reason] = (result.groups[category][reason] || 0) + 1;
          }
        }
      }
    }
  }
  await walk(resolve(directory));
  return result;
}

export function formatReport(result) {
  const lines = [`JSON 文件 ${result.files}；有效书源 ${result.sources}`, `能过 ${result.pass} / 要脚本 ${result.script} / 规则不认识 ${result.unknown}`,
    `跳过订阅源 ${result.skippedSubscriptions}；导入错误 ${result.errors.length}`, ...result.notes];
  for (const [category, label] of [['script', '要脚本'], ['unknown', '规则不认识']]) {
    lines.push(`\n${label}（按原因计数）`);
    for (const [reason, count] of Object.entries(result.groups[category]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) lines.push(`  ${count} × ${reason}`);
  }
  if (result.errors.length) {
    lines.push('\n导入错误（最多显示前 10 条，--json 可查看全部）', ...result.errors.slice(0, 10));
  }
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (!process.argv[2] || process.argv[2].startsWith('--')) throw new Error('用法：node scripts/legado-check-dir.mjs <目录> [--json]');
    const result = await checkDirectory(process.argv[2]);
    console.log(process.argv.includes('--json') ? JSON.stringify(result, null, 2) : formatReport(result));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
