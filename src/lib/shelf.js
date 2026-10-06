// 本地书架。条目和二进制分开存：列书架只读条目（KB 级），书本身（MB 级）打开时才读。
//
// @typedef {object} ShelfItem
// @property {string} id          书架条目 id，例如 "mojimoon:1:illustrated:v01" 或 "local:<hash>"
// @property {string} bookId      所属书的 id（插件给的 Book.id），本地导入的书等于 id
// @property {string} source      插件 id
// @property {string} title       书名（含卷名，例如 "文学少女 · 第一卷"）
// @property {string} author
// @property {string} [cover]     封面 data URL（从 EPUB 里取，或插件给的远程 URL）
// @property {string} ext         'epub' | 'txt'
// @property {number} size        字节
// @property {number} addedAt
// @property {number} [lastReadAt]
// @property {{cfi?: string, percent?: number, chapter?: string}} [progress]
import { idbAll, idbDel, idbGet, idbSet } from './idb.js';

const listeners = new Set();
export function onShelfChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = () => listeners.forEach(fn => fn());

export async function listShelf() {
  const all = await idbAll('shelf');
  return all.sort((a, b) => (b.lastReadAt || b.addedAt) - (a.lastReadAt || a.addedAt));
}
export const getShelfItem = (id) => idbGet('shelf', id);
export const getShelfBlob = (id) => idbGet('blob', id);
export async function hasShelfItem(id) { return !!(await idbGet('shelf', id)); }

export async function addToShelf(item, blob) {
  await idbSet('blob', item.id, blob);
  // 从别的设备导入账户时没带书的条目（orphan:）：重新下载同一卷时把进度、上次阅读时间接回来
  const orphan = await idbGet('kv', `orphan:${item.id}`).catch(() => null);
  const restored = orphan ? { addedAt: orphan.addedAt, progress: orphan.progress, lastReadAt: orphan.lastReadAt } : {};
  await idbSet('shelf', item.id, { addedAt: Date.now(), ...item, ...Object.fromEntries(Object.entries(restored).filter(([, v]) => v != null)) });
  if (orphan) await idbDel('kv', `orphan:${item.id}`).catch(() => {});
  emit();
}
export async function removeFromShelf(id) {
  await idbDel('shelf', id);
  await idbDel('blob', id);
  await idbDel('bookmarks', id);
  await idbDel('kv', `notes:${id}`);
  emit();
}
export async function patchShelfItem(id, patch) {
  const item = await idbGet('shelf', id);
  if (!item) return;
  await idbSet('shelf', id, { ...item, ...patch });
  emit();
}
/** 阅读器翻页时调用（调用方自己做防抖，建议 500ms） */
export function updateProgress(id, progress) {
  return patchShelfItem(id, { progress, lastReadAt: Date.now() });
}

// ---------- 书签 ----------
export async function listBookmarks(id) { return (await idbGet('bookmarks', id)) || []; }
export async function addBookmark(id, { ref, label }) {
  const all = await listBookmarks(id);
  if (all.some(b => b.ref === ref)) return all;
  const next = [{ ref, label, createdAt: Date.now() }, ...all];
  await idbSet('bookmarks', id, next);
  return next;
}
export async function removeBookmark(id, ref) {
  const next = (await listBookmarks(id)).filter(b => b.ref !== ref);
  await idbSet('bookmarks', id, next);
  return next;
}

// ---------- 划线与笔记 ----------
// @typedef {object} Note
// @property {string} cfi       划线范围（epubcfi(...)）
// @property {string} text      划到的原文
// @property {string} color     'gold' | 'rose' | 'jade' | 'lilac'
// @property {string} [note]    读者写的笔记
// @property {string} [chapter]
// @property {number} createdAt
const notesKey = (id) => `notes:${id}`;
export async function listNotes(id) { return (await idbGet('kv', notesKey(id))) || []; }
export async function saveNote(id, note) {
  const all = await listNotes(id);
  const i = all.findIndex(n => n.cfi === note.cfi);
  const next = i >= 0 ? all.map((n, k) => (k === i ? { ...n, ...note } : n)) : [{ createdAt: Date.now(), ...note }, ...all];
  await idbSet('kv', notesKey(id), next);
  return next;
}
export async function removeNote(id, cfi) {
  const next = (await listNotes(id)).filter(n => n.cfi !== cfi);
  await idbSet('kv', notesKey(id), next);
  return next;
}
