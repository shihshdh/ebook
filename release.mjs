// 发版第二步（第一步是 发版.bat 打两个包）：把 release/ 里的两个包传上 GitHub Release，再改 latest.json 和 README 的下载链接、推到 main。
//
// 顺序有讲究：先建 Release、传好附件，再推 latest.json。客户端启动 8 秒后读 main 上的 latest.json，
// 版本更新就提示下载 releases/download/v<版本>/<文件名>——清单先上去、附件还没传完的话，这期间点更新会 404。
//
// 用法：node release.mjs --check      只查代码状态（发版.bat 打包前先跑这个，免得白打）
//       node release.mjs              建 Release（要装 GitHub CLI 并登录：gh auth login），再推清单
//       node release.mjs --manifest   Release 已经在网页上手动建好、两个文件也传了：只改清单和 README、推 main
// 更新说明：docs/RELEASE_<版本>.md。第一行「# 标题」是 Release 的标题，下一行「> 一句话」写进 latest.json，其余是正文；
// 正文后面自动补两个文件的 SHA-256。
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const REPO = 'shihshdh/ebook';
const manifestOnly = process.argv.includes('--manifest');
const fail = (msg) => { console.error('\n✗ ' + msg); process.exit(1); };
const run = (cmd, args, opts = {}) => String(execFileSync(cmd, args, { encoding: 'utf8', stdio: opts.quiet ? 'pipe' : ['ignore', 'pipe', 'inherit'], ...opts }) ?? '').trim();

const VER = JSON.parse(readFileSync('package.json', 'utf8')).version;
const EXE = `EBOOK_${VER}_x64-setup.exe`, APK = `EBOOK_${VER}.apk`;
const TAG = `v${VER}`;
console.log(`EBOOK ${VER}`);

// 1. 代码状态：在 main 上、工作区干净、和 GitHub 上的 main 一致（打出来的包就是 GitHub 上这份代码）
const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main') fail(`当前在分支 ${branch}，要在 main 上发版`);
const dirty = run('git', ['status', '--porcelain', '--untracked-files=no']);
if (dirty) fail(`工作区有没提交的改动（这些改动会被打进包里）：\n${dirty}\n先提交或 git stash，再重新打包`);
run('git', ['fetch', 'origin', 'main'], { quiet: true });
if (run('git', ['rev-parse', 'HEAD']) !== run('git', ['rev-parse', 'origin/main'])) fail('本地 main 和 GitHub 上的 main 不一致：先 git pull / git push，再重新打包');
for (const [f, v] of [['src-tauri/tauri.conf.json', JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).version],
  ['src-tauri/Cargo.toml', /^version = "(.+)"/m.exec(readFileSync('src-tauri/Cargo.toml', 'utf8'))?.[1]],
  ['android/app/build.gradle', /versionName "(.+)"/.exec(readFileSync('android/app/build.gradle', 'utf8'))?.[1]]]) {
  if (v !== VER) fail(`${f} 里的版本是 ${v}，package.json 是 ${VER}：四处版本号要一起改`);
}

if (!existsSync('android/keystore.properties')) fail('没有 android/keystore.properties：APK 不是正式签名，装不上去覆盖旧版，不能发');
if (!existsSync(`docs/RELEASE_${VER}.md`)) fail(`没有更新说明 docs/RELEASE_${VER}.md`);
if (process.argv.includes('--check')) { console.log('✓ 可以打包'); process.exit(0); }

// 2. 两个包：在 release/ 里、是这一版
const headTime = +run('git', ['log', '-1', '--format=%ct']) * 1000;
for (const f of [EXE, APK]) {
  if (!existsSync(`release/${f}`)) fail(`release/${f} 不存在：先跑 发版.bat 打包`);
  if (statSync(`release/${f}`).mtimeMs < headTime) fail(`release/${f} 比当前代码旧（是之前打的）：重新跑 发版.bat`);
}
const sha = (f) => new Promise((res, rej) => { const h = createHash('sha256'); createReadStream(f).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });
const sums = { [EXE]: await sha(`release/${EXE}`), [APK]: await sha(`release/${APK}`) };
for (const [f, s] of Object.entries(sums)) console.log(`  ${s}  ${f}`);

// 3. 更新说明
const notesFile = `docs/RELEASE_${VER}.md`;
const lines = readFileSync(notesFile, 'utf8').replace(/\r/g, '').split('\n');
const title = lines.find(l => l.startsWith('# '))?.slice(2).trim();
const oneLine = lines.find(l => l.startsWith('> '))?.slice(2).trim();
if (!title || !oneLine) fail(`${notesFile} 要有「# 标题」和「> 一句话说明」两行`);
const body = lines.filter(l => !l.startsWith('# ') && !l.startsWith('> ')).join('\n').trim()
  + `\n\n## SHA-256\n\n\`\`\`text\n${sums[EXE]}  ${EXE}\n${sums[APK]}  ${APK}\n\`\`\`\n`;

// 4. GitHub Release（先建、传好附件）
writeFileSync('release/RELEASE_BODY.md', body);
const hasGh = (() => { try { run('gh', ['--version'], { quiet: true }); return true; } catch { return false; } })();
if (!manifestOnly) {
  if (!hasGh) fail(`没装 GitHub CLI（gh）。可以装上再来（winget install GitHub.cli，然后 gh auth login），
  或者在网页上手动建：https://github.com/${REPO}/releases/new
    Tag：${TAG}（目标 main）  标题：${title}
    正文：release/RELEASE_BODY.md（已经写好）  附件：release/${EXE}、release/${APK}
  建好以后跑 node release.mjs --manifest 推清单`);
  let exists = false;
  try { run('gh', ['release', 'view', TAG, '--repo', REPO], { quiet: true }); exists = true; } catch {}
  if (exists) fail(`GitHub 上已经有 ${TAG} 了。要重传附件：gh release upload ${TAG} release/${EXE} release/${APK} --clobber --repo ${REPO}，再跑 node release.mjs --manifest`);
  console.log(`\n建 Release ${TAG}，上传两个文件（几十 MB，要一会儿）…`);
  run('gh', ['release', 'create', TAG, `release/${EXE}`, `release/${APK}`, '--repo', REPO, '--target', 'main', '--title', title, '--notes-file', 'release/RELEASE_BODY.md'], { stdio: 'inherit' });
}

// 5. 核对 Release 上的附件确实在，再推清单
if (hasGh) {
  let assets = [];
  try { assets = JSON.parse(run('gh', ['release', 'view', TAG, '--repo', REPO, '--json', 'assets'], { quiet: true })).assets.map(a => a.name); }
  catch { fail(`GitHub 上找不到 Release ${TAG}：先建好、传好两个文件，再跑 node release.mjs --manifest`); }
  for (const f of [EXE, APK]) if (!assets.includes(f)) fail(`Release ${TAG} 上没有 ${f}：先传上去，再跑 node release.mjs --manifest`);
} else console.log('（没装 gh，没法核对 Release 上的附件，按已经传好了处理）');
const manifest = { version: VER, notes: oneLine, windows: { file: EXE, sha256: sums[EXE] }, android: { file: APK, sha256: sums[APK] } };
writeFileSync('latest.json', JSON.stringify(manifest, null, 2) + '\n');
const readme = readFileSync('README.md', 'utf8');
const nextReadme = readme
  .replace(/\[EBOOK_[\d.]+_x64-setup\.exe\]\(https:\/\/github\.com\/[^)]+\)/, `[${EXE}](https://github.com/${REPO}/releases/download/${TAG}/${EXE})`)
  .replace(/\[EBOOK_[\d.]+\.apk\]\(https:\/\/github\.com\/[^)]+\)/, `[${APK}](https://github.com/${REPO}/releases/download/${TAG}/${APK})`);
if (nextReadme === readme) console.log('（README 里没找到下载链接，没改）');
writeFileSync('README.md', nextReadme);
run('git', ['add', 'latest.json', 'README.md']);
run('git', ['commit', '-q', '-m', `发布 EBOOK ${VER}：更新下载链接与安装包校验`]);
run('git', ['push', 'origin', 'main'], { stdio: 'inherit' });
console.log(`\n✓ 发好了：https://github.com/${REPO}/releases/tag/${TAG}\n  客户端下次启动 8 秒后会提示更新到 ${VER}`);
