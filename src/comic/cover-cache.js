// 漫画的东西存在本机（IndexedDB，各自单独一个库，不动主库的表结构）：
//   封面：要经漫画源的沙箱一张张下（排队，一张半秒左右），每次打开漫画页都重下的话，头几秒满屏是生成的书衣
//   详情：章节列表，有的源要等 3–4 秒（拷贝漫画 3.9 秒、漫画柜 3.2 秒），点开一部漫画就干等
// 值是 { v, at }（at：最近一次用到 / 存进来的时间）。超过上限按 at 留最近的；每写一批清一次
function makeStore(DB, MAX, SWEEP_EVERY = 40) {
  const STORE = 'c';
  let dbp;
  const db = () => {
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
  };
  const tx = (mode, fn) => db().then(d => new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode), out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
  let writes = 0;
  const sweep = async () => {
    try {
      const all = [];
      await tx('readonly', s => { const req = s.openCursor(); req.onsuccess = () => { const c = req.result; if (c) { all.push([c.key, c.value.used ?? c.value.at]); c.continue(); } }; return null; });
      if (all.length <= MAX) return;
      all.sort((a, b) => b[1] - a[1]);
      const drop = all.slice(MAX).map(([k]) => k);
      await tx('readwrite', s => { for (const k of drop) s.delete(k); return null; });
    } catch { /* 清不了下次再清 */ }
  };
  return {
    /** { v, at } 或 null；一天以上没用过的顺手把时间更新（少写几次） */
    async load(key) {
      try {
        const raw = await tx('readonly', s => s.get(key));
        const e = raw && { ...raw, v: raw.v ?? raw.blob, used: raw.used ?? raw.at };   // 0.4.0 存的封面是 { blob, at }
        if (!e || e.v == null) return null;
        if (Date.now() - e.used > 864e5) tx('readwrite', s => s.put({ v: e.v, at: e.at, used: Date.now() }, key)).catch(() => {});
        return e;
      } catch { return null; }
    },
    save(key, v) {
      const now = Date.now();
      tx('readwrite', s => s.put({ v, at: now, used: now }, key)).then(() => { if (++writes % SWEEP_EVERY === 0) sweep(); }).catch(() => {});
    },
  };
}

// 封面：最多 400 张（一张 20–60KB，十来 MB）；太大的（源给的原图）不存
const covers = makeStore('librarium-comic-covers', 400);
export async function loadCover(key) { return (await covers.load(key))?.v || null; }
export function saveCover(key, blob) { if (blob?.size && blob.size <= 600 * 1024) covers.save(key, blob); }

// 详情：最多 300 部（几百话的一部几十 KB）
const details = makeStore('librarium-comic-details', 300, 20);
/** { v: 详情, at: 存的时间 } 或 null */
export const loadDetails = (key) => details.load(key);
export const saveDetails = (key, d) => details.save(key, d);
