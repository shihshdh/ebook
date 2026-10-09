// 交替跑 A/B：每次只跑一个场景、一个版本（各开一次浏览器），每轮把版本顺序倒过来，结果一行一个追加到 <scratch>/ab.jsonl。
// 用法：node ab.mjs <scratch> <轮数> <场景,场景> <名字=地址> <名字=地址> ...
//   WARM=1 先每个版本跑一次首页滚动（不计）：建好各自的书库、把字体缓存热起来；IDLE= 同 measure.mjs（默认 12000）；LOG= 换结果文件
//   跑完：node ab.mjs <scratch> sum   按场景、版本列出每次的 最长帧 / 卡顿 和平均
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const [S, rounds, scen, ...vers] = process.argv.slice(2);
const log = process.env.LOG || `${S}/ab.jsonl`;

if (rounds === 'sum') {
  const L = readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(x => x.max != null && !x.warm);
  for (const sc of [...new Set(L.map(x => x.sc))]) for (const v of [...new Set(L.map(x => x.v))]) {
    const r = L.filter(x => x.sc === sc && x.v === v);
    if (!r.length) continue;
    const avg = (k) => Math.round(r.reduce((a, x) => a + x[k], 0) / r.length);
    console.log(sc.padEnd(15), v.padEnd(6), '最长帧', r.map(x => Math.round(x.max)).join('/'), '｜卡顿', r.map(x => x.blocking).join('/'), `（均 ${avg('blocking')}）`, '｜>33ms 帧', r.map(x => x.over33).join('/'));
  }
  process.exit(0);
}

const V = vers.map(v => v.split('='));
const run = (name, url, sc, warm = false) => {
  const out = `${S}/ab-run.json`;
  const r = spawnSync('node', ['measure.mjs', S, url, out, 'mobile', sc], { cwd: here, env: { ...process.env, BLOCK: '1', IDLE: process.env.IDLE || '12000' }, encoding: 'utf8', timeout: 240000 });
  let res = null; try { res = JSON.parse(readFileSync(out, 'utf8'))[sc]; } catch {}
  const line = { t: new Date().toISOString(), v: name, sc, ...(warm && { warm }), ...res };
  if (r.status !== 0) line.err = (r.stderr || '').slice(-300);
  appendFileSync(log, JSON.stringify(line) + '\n');
  console.log(name.padEnd(6), sc.padEnd(15), res ? `最长帧 ${res.max} LoAF ${res.loafMax} 卡顿 ${res.blocking} >33ms ${res.over33}` : 'FAIL ' + line.err);
};
if (process.env.WARM) for (const [n, u] of V) run(n, u, 'home-scroll', true);
for (let k = 0; k < +rounds; k++) for (const sc of scen.split(',')) {
  for (const [n, u] of (k % 2 ? [...V].reverse() : V)) run(n, u, sc);
}
