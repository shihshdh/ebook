import { useEffect, useState } from 'react';
import { listBookmarks } from '../lib/shelf.js';

export default function ComicShelfBookmarks({ items, onOpenAt }) {
  const [marks, setMarks] = useState([]);
  useEffect(() => {
    let alive = true;
    Promise.all(items.filter(it => it.ext === 'comic').map(book => listBookmarks(book.id).then(list => list.map(mark => ({ ...mark, book })), () => [])))
      .then(lists => { if (alive) setMarks(lists.flat().sort((a, b) => b.createdAt - a.createdAt)); });
    return () => { alive = false; };
  }, [items]);
  if (!marks.length) return null;
  return <section className="sp-notes glass"><div className="sp-head"><h2 className="serif">漫画书签</h2></div><ol className="sp-note-list">
    {marks.slice(0, 20).map(m => <li key={`${m.book.id}:${m.ref}`}><button onClick={() => onOpenAt(m.book, m.ref)}><span className="sp-quote serif">{m.label}</span><small className="muted">《{m.book.title}》</small></button></li>)}
  </ol></section>;
}
