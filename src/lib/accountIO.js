// 账户导出 / 导入：换设备、备份都靠它（没有服务器，数据只在本机）。
//
// 导出文件是一个 zip：
//   ebook-account.json   账户名与头像、偏好、书架条目（含阅读进度）、书签、划线笔记
//   books/<n>.<ext>      书本身（可选；不带书时文件只有几十 KB）
// 不导出 PIN：拿到文件的人本来就能读 JSON，PIN 留着没有意义，导入后可以重新设。
//
// 导入总是新建一个账户（同名自动加序号），不会覆盖现有账户。
// 不带书导出的条目先记成 orphan:<条目id>：以后重新下载同一卷（插件给的条目 id 是确定的），
// 进度自动接上；书签、笔记本来就按条目 id 存，也会自动对上（见 shelf.js addToShelf）。
import { ACCOUNT_KEYS, acctDB, acctKey, createAccount, getAccount } from './accounts.js';
import { idbEntries, idbPut, isNotesKey } from './idb.js';

export const MANIFEST = 'ebook-account.json';
const pad = (n) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; };

/** 账户的书一共多大（导出前给用户看） */
export async function accountBooksSize(id) {
  const shelf = await idbEntries(acctDB(id), 'shelf');
  return shelf.reduce((n, [, v]) => n + (v.size || 0), 0);
}

/**
 * @returns {Promise<{name: string, bytes: Uint8Array, books: number}>}
 */
export async function exportAccount(id, { books = true, onProgress } = {}) {
  const acc = getAccount(id);
  if (!acc) throw new Error('账户不存在');
  const db = acctDB(id);
  const [shelf, bookmarks, notes, orphans, legado] = await Promise.all([
    idbEntries(db, 'shelf'), idbEntries(db, 'bookmarks'), idbEntries(db, 'kv', isNotesKey),
    // 上次导入时没带书、还没重新下载的条目也带上，进度不丢
    idbEntries(db, 'kv', k => typeof k === 'string' && k.startsWith('orphan:')),
    idbEntries(db, 'kv', k => typeof k === 'string' && k.startsWith('legado:')),   // 导入的书源
  ]);
  const local = {};
  for (const k of ACCOUNT_KEYS) {
    try { const v = localStorage.getItem(acctKey(k, id)); if (v != null) local[k] = v; } catch {}
  }
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const manifest = {
    format: 'ebook-account', version: 1, exportedAt: Date.now(),
    account: { name: acc.name, color: acc.color, avatar: acc.avatar || '' },
    local, shelf: [...shelf.map(([, v]) => v), ...orphans.map(([, v]) => v)],
    bookmarks: Object.fromEntries(bookmarks),
    notes: Object.fromEntries(notes.map(([k, v]) => [k.slice('notes:'.length), v])),
    legado: Object.fromEntries(legado),
    books: [],
  };
  if (books) {
    const blobs = new Map(await idbEntries(db, 'blob'));
    manifest.shelf.forEach((item, i) => {
      const blob = blobs.get(item.id);
      if (!blob) return;
      const path = `books/${i}.${item.ext || 'epub'}`;
      zip.file(path, blob);
      manifest.books.push({ id: item.id, path });
    });
  }
  zip.file(MANIFEST, JSON.stringify(manifest));
  // EPUB 本身已经压缩过，再压只是白费 CPU
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' }, m => onProgress?.(m.percent / 100));
  const safe = acc.name.replace(/[\\/:*?"<>|]/g, '_');
  return { name: `EBOOK账户_${safe}_${today()}${books ? '' : '_无书'}.zip`, bytes, books: manifest.books.length };
}

/** 这个 zip 是不是 EBOOK 的账户文件 */
export async function isAccountArchive(bytes) {
  try {
    const { default: JSZip } = await import('jszip');
    return !!(await JSZip.loadAsync(bytes)).file(MANIFEST);
  } catch { return false; }
}

/** @returns {Promise<{account: object, books: number, orphans: number}>} */
export async function importAccount(bytes, { onProgress } = {}) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(bytes);
  const file = zip.file(MANIFEST);
  if (!file) throw new Error('这不是 EBOOK 的账户文件');
  const m = JSON.parse(await file.async('string'));
  if (m.format !== 'ebook-account') throw new Error('这不是 EBOOK 的账户文件');
  if (m.version > 1) throw new Error('这个账户文件来自更新的 EBOOK，请先升级');

  const acc = createAccount({ name: m.account?.name, color: m.account?.color, avatar: m.account?.avatar || '' });
  const db = acctDB(acc.id);
  for (const [k, v] of Object.entries(m.local || {})) {
    if (ACCOUNT_KEYS.includes(k)) { try { localStorage.setItem(acctKey(k, acc.id), v); } catch {} }
  }
  const paths = new Map((m.books || []).map(b => [b.id, b.path]));
  let books = 0, orphans = 0, done = 0;
  for (const item of m.shelf || []) {
    const f = paths.has(item.id) && zip.file(paths.get(item.id));
    if (f) {
      const type = item.ext === 'txt' ? 'text/plain;charset=utf-8' : 'application/epub+zip';
      await idbPut(db, 'blob', item.id, new Blob([await f.async('uint8array')], { type }));
      await idbPut(db, 'shelf', item.id, item);
      books++;
    } else {
      await idbPut(db, 'kv', `orphan:${item.id}`, item);
      orphans++;
    }
    onProgress?.(++done / Math.max(1, m.shelf.length));
  }
  for (const [id, list] of Object.entries(m.bookmarks || {})) await idbPut(db, 'bookmarks', id, list);
  for (const [id, list] of Object.entries(m.notes || {})) await idbPut(db, 'kv', `notes:${id}`, list);
  for (const [k, v] of Object.entries(m.legado || {})) if (k.startsWith('legado:')) await idbPut(db, 'kv', k, v);
  return { account: acc, books, orphans };
}
