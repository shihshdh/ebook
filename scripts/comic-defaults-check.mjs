// Read-only maintenance report. Does not install/update sources or change policy.
// node scripts/comic-defaults-check.mjs > report.md
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import bundle from '../src/comic/default-sources.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const identity = s => `${s.key}\0${s.fileName}`; // multiple scripts can share a key
const cell = s => String(s ?? '—').replace(/\r?\n/g, ' ').replace(/\|/g, '&#124;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function versionStatus(current, next) {
  if (current === next) return next;
  if (!/^\d+(\.\d+)*$/.test(current) || !/^\d+(\.\d+)*$/.test(next)) return `${next}（版本变化，需复核）`;
  const a = current.split('.').map(Number), b = next.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return `${next}（${(b[i] || 0) > (a[i] || 0) ? '有新版' : '上游版本回退'}）`;
  }
  return `${next}（版本号等值）`;
}
function run(command, args, timeout) {
  return new Promise(resolve => {
    const child = spawn(command, args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', error = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    child.stdout.on('data', b => { stdout += b; });
    child.stderr.on('data', b => { stderr += b; });
    child.on('error', e => { error = e.message; });
    child.on('close', code => { clearTimeout(timer); resolve({ stdout, stderr, code, error: timedOut ? 'process timeout' : error }); });
  });
}
async function indexAt(ref) {
  // curl honors the workstation's HTTPS_PROXY; no third-party source scripts run here.
  const url = `https://raw.githubusercontent.com/venera-app/venera-configs/${ref}/index.json`;
  const r = await run(process.platform === 'win32' ? 'curl.exe' : 'curl', ['--fail', '--silent', '--show-error', '--location', '--max-time', '60', url], 65000);
  if (r.code !== 0 || r.error) throw new Error(r.error || r.stderr.trim() || `curl exit ${r.code}`);
  const index = JSON.parse(r.stdout);
  if (!Array.isArray(index) || index.some(s => !s.key || !s.fileName || !s.name || typeof s.version !== 'string')) throw new Error('Invalid upstream index');
  return index;
}
export function compare(sources, latest, baseline) {
  const current = new Map(latest.map(s => [identity(s), s]));
  const old = new Set(baseline.map(identity));
  return {
    rows: sources.map(s => ({ source: s, latest: current.get(identity(s)) })),
    added: latest.filter(s => !old.has(identity(s))),
    removed: baseline.filter(s => !current.has(identity(s))),
  };
}
export function parseLive(stdout, sources) {
  const results = new Map();
  // A source error can contain literal newlines (e.g. HTML instead of JSON).
  for (const match of stdout.matchAll(/^ {2}([✓✗]) ([\s\S]*?) {2}\(([\d.]+)s\)\r?$/gm)) {
    const source = [...sources].sort((a, b) => b.name.length - a.name.length)
      .find(s => match[2].startsWith(s.name) && /\s/.test(match[2][s.name.length] || ''));
    if (source) results.set(identity(source), { ok: match[1] === '✓', detail: match[2].slice(source.name.length).trim().replace(/\r?\n/g, ' '), seconds: match[3] });
  }
  return results;
}
async function main() {
  let latest, baseline, indexError = '';
  try { latest = await indexAt('main'); baseline = await indexAt(bundle.commit); }
  catch (e) { indexError = e.message; }
  console.error('Running bundled live checks (one search/detail/chapter/first image path per source; no full crawl)…');
  const live = await run(process.execPath, ['scripts/comic-test.mjs', '--live', '--bundled', '--all'], 15 * 60 * 1000);
  const results = parseLive(live.stdout, bundle.sources);
  const comparison = latest && baseline ? compare(bundle.sources, latest, baseline) : null;
  const rows = comparison?.rows || bundle.sources.map(source => ({ source }));
  const selfHosted = new Set(['komga', 'kavita', 'lanraragi']);
  const report = [
    '# 默认漫画源体检', '',
    `时间：${new Date().toISOString()}；内置提交：\`${bundle.commit}\`。`, '',
    '上游：[venera-configs main index](https://github.com/venera-app/venera-configs/blob/main/index.json)。版本比较仅基于索引版本号；不表示代码内容相同。', '',
    `索引：${indexError ? `读取失败，不能判定新增 / 删除：${cell(indexError)}` : 'main 与固定提交索引均读取成功。'}`, '',
    '| 源 | 内置版本 | 最新版本 | 实测结果 | 失败原因 |',
    '|---|---|---|---|---|',
  ];
  let missing = 0, failed = 0;
  for (const { source: s, latest: next } of rows) {
    const r = results.get(identity(s));
    const skip = selfHosted.has(s.key);
    if (!r && !skip) missing++;
    if (r && !r.ok) failed++;
    const version = !comparison ? '未知' : !next ? '已从索引删除' : versionStatus(s.version, next.version);
    report.push(`| ${cell(s.name)} | ${cell(s.version)} | ${cell(version)} | ${cell(r ? r.ok ? `通过：${r.detail} (${r.seconds}s)` : `失败 (${r.seconds}s)` : skip ? '跳过：自建服务器' : '未取得结果')} | ${cell(r && !r.ok ? r.detail : !r && !skip ? live.error || '测试未输出此源结果，查看原始输出' : '—')} |`);
  }
  report.push('', `相对固定提交新增（仅列名字，是否收录仍由 policy.js 白名单人工审核）：${comparison ? comparison.added.map(s => cell(s.name)).join('、') || '无' : '未知'}。`,
    '', `相对固定提交删除：${comparison ? comparison.removed.map(s => cell(s.name)).join('、') || '无' : '未知'}。`,
    '', `实测：${results.size - failed} 通过、${failed} 失败、${missing} 缺失；自建服务器按原测试器规则跳过。`,
    '', `测试子进程退出码：${live.code}；${cell(live.error || '正常结束')}。注意原测试器即使线上源失败也可能返回 0，本脚本按逐源结果判断。`,
    '', '## 实测原始输出', '', ...live.stdout.trimEnd().split(/\r?\n/).map(l => l.trimEnd() ? `    ${l.trimEnd()}` : ''));
  if (live.stderr || live.error) report.push('', '## 测试诊断', '', ...`${live.stderr}\n${live.error}`.trim().split(/\r?\n/).map(l => l.trimEnd() ? `    ${l.trimEnd()}` : ''));
  console.log(report.join('\n'));
  process.exitCode = indexError || live.code !== 0 || live.error || missing ? 2 : failed ? 1 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
