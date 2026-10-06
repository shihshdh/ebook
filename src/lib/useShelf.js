import { useEffect, useState } from 'react';
import { listShelf, onShelfChange } from './shelf.js';

/** 订阅书架：返回条目数组（按最近阅读/加入排序）和 id 集合 */
export function useShelf() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => listShelf().then(list => { if (alive) setItems(list); }).catch(() => alive && setItems([]));
    load();
    const off = onShelfChange(load);
    return () => { alive = false; off(); };
  }, []);
  return { items: items || [], ready: items !== null, ids: new Set((items || []).map(i => i.id)) };
}
