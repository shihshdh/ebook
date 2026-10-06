// IndexedDB 统一入口。一次定义所有 store，避免多次 createStore 冲突。
//   shelf      书架条目 { id → ShelfItem }（不含二进制，列书架只读这里）
//   blob       书的二进制 { id → Blob }
//   bookmarks  书签 { id → Bookmark[] }
//   kv         杂项：插件书目缓存、封面查询结果（设备共用）；notes:<id> 划线笔记、orphan:<id> 待接回的进度、legado:sources 导入的书源（跟账户走）
//
// 本地账户（见 accounts.js）：shelf / blob / bookmarks 和 kv 里的 notes:* 存在当前账户自己的库里，
// 其余 kv（书目、封面缓存）放在设备共用的 'librarium' 库——换账户不用重新下 3MB 书目。
// 默认账户的库就是 'librarium' 本身，所以老数据不用迁移。
import { acctDB } from './accounts.js';

const SHARED = 'librarium';
const DB_VERSION = 1;
const STORES = ['shelf', 'blob', 'bookmarks', 'kv'];
const ACCOUNT_STORES = new Set(['shelf', 'blob', 'bookmarks']);

const dbs = new Map();
export function openDB(name = SHARED) {
  if (dbs.has(name)) return dbs.get(name);
  const p = new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbs.delete(name); reject(req.error); };
    req.onblocked = () => { dbs.delete(name); reject(new Error('数据库被另一个窗口占用，请关掉其它窗口')); };
  });
  dbs.set(name, p);
  return p;
}

// kv 里跟着账户走的：notes:*（划线笔记）、orphan:*（导入时没带书的书架条目，等重新下载时接上进度）、legado:*（自己导入的书源）
const isAccountKey = (store, key) => ACCOUNT_STORES.has(store) || (store === 'kv' && typeof key === 'string' && /^(notes|orphan|legado):/.test(key));
const dbFor = (store, key) => (isAccountKey(store, key) ? acctDB() : SHARED);

function run(dbName, store, mode, fn) {
  return openDB(dbName).then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    let result;
    if (req) req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('aborted'));
  }));
}

export const idbGet = (store, key) => run(dbFor(store, key), store, 'readonly', s => s.get(key));
export const idbSet = (store, key, value) => run(dbFor(store, key), store, 'readwrite', s => s.put(value, key));
export const idbDel = (store, key) => run(dbFor(store, key), store, 'readwrite', s => s.delete(key));
export const idbAll = (store) => run(dbFor(store), store, 'readonly', s => s.getAll());
export const idbKeys = (store) => run(dbFor(store), store, 'readonly', s => s.getAllKeys());

// ---------- 导出 / 导入账户用：直接指定库 ----------
/** 某个库某个 store 的全部 [key, value]，filter(key) 可选 */
export function idbEntries(dbName, store, filter) {
  return openDB(dbName).then(db => new Promise((resolve, reject) => {
    const out = [];
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return;
      if (!filter || filter(c.key)) out.push([c.key, c.value]);
      c.continue();
    };
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
  }));
}
export const idbPut = (dbName, store, key, value) => run(dbName, store, 'readwrite', s => s.put(value, key));
/** 账户自己的那部分 kv（划线笔记）用这个判断 */
export const isNotesKey = (key) => typeof key === 'string' && key.startsWith('notes:');
