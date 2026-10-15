import { addShelfMetadata, getShelfItem, patchShelfItem, updateProgress } from '../lib/shelf.js';
import { comicShelfId } from './book.js';
import { coverURL } from './library.js';

const pending = new Map();
let writes = Promise.resolve();
const serialize = job => { const next = writes.then(job); writes = next.catch(() => {}); return next; };
export const persistComicProgress = (id, progress) => serialize(() => updateProgress(id, progress));
async function thumbnail(sourceId, cover) {
  const url = await coverURL(sourceId, cover);
  const img = new Image(); img.src = url; await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 360; canvas.height = Math.max(1, Math.min(1440, Math.round(360 * img.naturalHeight / img.naturalWidth)));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', .84);
}
/** Insert immediately; a slow cover must not delay opening a chapter. */
export function ensureComicShelf({ sourceId, sourceName, comicId, title, cover, author = '' }) {
  const id = comicShelfId(sourceId, comicId);
  if (pending.has(id)) return pending.get(id);
  const work = (async () => {
    const existing = await getShelfItem(id);
    const item = existing || await addShelfMetadata({ id, bookId: id, source: 'comic', ext: 'comic', size: 0, title, author,
      comic: { sourceId, sourceName, comicId }, cover: '', progress: { percent: 0, index: 0, page: 0, chapter: '' } });
    if (!item.cover && cover) thumbnail(sourceId, cover).then(data => serialize(() => patchShelfItem(id, { cover: data })), () => {}).catch(() => {});
    return item;
  })();
  pending.set(id, work);
  work.finally(() => pending.delete(id)).catch(() => {});
  return work;
}

export const comicShelfProgress = ({ index, page, pages, chapters, chapter }) => ({
  index, page, chapter, percent: Math.max(0, Math.min(1, (index + (page + 1) / Math.max(1, pages)) / Math.max(1, chapters))),
});
