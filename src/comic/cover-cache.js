// 漫画封面存在本机：封面要经漫画源的沙箱一张张下（排队，一张半秒左右），每次打开漫画页都重下的话，
// 头几秒满屏是生成的书衣。下过的存进 IndexedDB（单独一个库，不动主库的表结构），下次直接出。
//   键：源 id | 封面地址；值：{ blob, at }（at 是最近一次用到的时间）
//   最多留 400 张（一张 20–60KB，十来 MB），每写 40 张清一次：留最近用过的
const DB = 'librarium-comic-covers', STORE = 'c', MAX = 400, SWEEP_EVERY = 40;
let dbp;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('blocked'));
    });
    dbp.catch(() => { dbp = null; });
  }
  return dbp;
}
const tx = (mode, fn) => db().then(d => new Promise((resolve, reject) => {
  const t = d.transaction(STORE, mode), s = t.objectStore(STORE);
  const out = fn(s);
  t.oncomplete = () => resolve(out?.result);
  t.onerror = () => reject(t.error);
  t.onabort = () => reject(t.error);
}));

/** 存着的封面（Blob），没有是 null；顺手记一下用过的时间 */
export async function loadCover(key) {
  try {
    const v = await tx('readonly', s => s.get(key));
    if (!v?.blob) return null;
    if (Date.now() - v.at > 864e5) tx('readwrite', s => s.put({ blob: v.blob, at: Date.now() }, key)).catch(() => {});   // 一天以上没用过才更新时间，少写几次
    return v.blob;
  } catch { return null; }
}

let writes = 0;
export function saveCover(key, blob) {
  if (!blob?.size || blob.size > 600 * 1024) return;   // 太大的（源给的原图）不存
  tx('readwrite', s => s.put({ blob, at: Date.now() }, key)).then(() => { if (++writes % SWEEP_EVERY === 0) sweep(); }).catch(() => {});
}

// 超过 MAX 张：按最近用过的时间留下 MAX 张
async function sweep() {
  try {
    const all = [];
    await tx('readonly', s => { const req = s.openCursor(); req.onsuccess = () => { const c = req.result; if (c) { all.push([c.key, c.value.at]); c.continue(); } }; return null; });
    if (all.length <= MAX) return;
    all.sort((a, b) => b[1] - a[1]);
    const drop = all.slice(MAX).map(([k]) => k);
    await tx('readwrite', s => { for (const k of drop) s.delete(k); return null; });
  } catch { /* 清不了下次再清 */ }
}
