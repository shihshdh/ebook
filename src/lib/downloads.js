// 「下载」文件夹收书：蓝奏云的 EPUB（台版带官方彩插）只能在浏览器里手动下载。
// 用户在详情里点「复制并打开」后，这里"上弦"30 分钟：每次回到 EBOOK 窗口（以及每隔几秒）看一眼下载文件夹，
// 新出现的 EPUB / TXT 直接放进书架；ZIP 解开，里面的 EPUB / TXT 一并放进去。
// 只在 Windows 客户端工作；只收上弦之后新出现的文件，不会把下载文件夹里原有的东西搬进来。
import { downloadsFolder, lanzou, onOpenedFile } from './native.js';

const KEY = 'librarium.dlwatch';
const WINDOW = 30 * 60e3;
let seen = new Set();
let timer = 0;
let busy = false;
let onImported = null;

const armed = () => {
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && Date.now() - v.at < WINDOW ? v : null; } catch { return null; }
};

/** 详情里点了蓝奏云链接：开始盯下载文件夹 */
export function armDownloadWatch(title) {
  if (!downloadsFolder.available) return false;
  const prev = armed();
  // 留 1 分钟余量：浏览器有时把文件时间记成开始下载的那一刻
  try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), since: prev?.since ?? Date.now() - 60e3, title })); } catch {}
  schedule();
  return true;
}

/** 一个文件 → 可导入的 File[]：ZIP 解开取里面的 EPUB / TXT，其它原样 */
export async function expandFile(name, bytes, time = Date.now()) {
  if (!/\.zip$/i.test(name)) return [new File([bytes], name, { lastModified: time })];
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(bytes);
  const out = [];
  for (const entry of Object.values(zip.files)) {
    const base = entry.name.split('/').pop();
    if (entry.dir || !/\.(epub|txt)$/i.test(base) || base.startsWith('._')) continue;
    out.push(new File([await entry.async('uint8array')], base, { lastModified: time }));
  }
  return out;
}

async function scan() {
  const w = armed();
  if (!w || busy) return;
  busy = true;
  try {
    const files = (await downloadsFolder.recent(w.since)).filter(f => !seen.has(f.name + f.size));
    if (!files.length) return;
    const { importFiles } = await import('../plugins/local/index.js');
    const toImport = [];
    for (const f of files) {
      seen.add(f.name + f.size);
      const bytes = await downloadsFolder.read(f.name);
      // 自己导出的账户备份也会落在下载文件夹：不能当成一包书再导回来
      if (/\.zip$/i.test(f.name) && await (await import('./accountIO.js')).isAccountArchive(bytes)) continue;
      toImport.push(...await expandFile(f.name, bytes, f.time));
    }
    if (!toImport.length) return;
    const res = await importFiles(toImport);
    onImported?.(res, toImport.map(f => f.name));
  } catch (e) {
    console.warn('[downloads]', e);
  } finally {
    busy = false;
  }
}

function schedule() {
  clearInterval(timer);
  if (!armed()) return;
  // 下载期间用户可能一直开着浏览器：每 4 秒轻扫一次（只列目录，很便宜）；过了 30 分钟自动停
  timer = setInterval(() => { if (!armed()) clearInterval(timer); else scan(); }, 4000);
}

/** App 启动时挂上：Windows 窗口重新获得焦点就扫一次下载文件夹；安卓接「用 EBOOK 打开」。返回卸载函数 */
export function startDownloadWatch(cb) {
  // 安卓「用 EBOOK 打开」和 Windows 蓝奏云小窗下好的文件，走同一条入架路
  const take = async ({ name, bytes }) => {
    try {
      // EBOOK 的账户备份（用「用 EBOOK 打开」或从下载文件夹进来）：导入成一个新账户，不当书拆
      if (/\.zip$/i.test(name)) {
        const { importAccount, isAccountArchive } = await import('./accountIO.js');
        if (await isAccountArchive(bytes)) {
          const res = await importAccount(bytes);
          window.dispatchEvent(new CustomEvent('librarium:account-imported', { detail: res }));
          return;
        }
      }
      const files = await expandFile(name, bytes);
      if (!files.length) return;
      const { importFiles } = await import('../plugins/local/index.js');
      cb(await importFiles(files), files.map(f => f.name));
    } catch (e) { console.warn('[import]', e); }
  };
  const offLanzou = lanzou.onFile(take);
  const offOpen0 = onOpenedFile(take);
  const offOpen = () => { offOpen0(); offLanzou(); };
  if (!downloadsFolder.available) return offOpen;
  onImported = cb;
  const onFocus = () => scan();
  window.addEventListener('focus', onFocus);
  schedule();
  return () => { window.removeEventListener('focus', onFocus); clearInterval(timer); onImported = null; offOpen(); };
}
