// 本地导入插件：把用户手里的 EPUB / TXT 放进书架。
// 不联网、不内置任何来源——书从哪来是用户自己的事，我们只负责读。
import { addToShelf } from '../../lib/shelf.js';
import { hash } from '../../lib/motion.js';

export const id = 'local';
export const kind = 'import';
export const name = '本地导入';
export const short = '本地';
export const description = '把电脑或手机里的 EPUB、TXT 拖进来。TXT 会按"第X章"自动分章，GBK、Big5 编码也能识别。';
export const version = '1.0.0';
// 手机的文件选择器按 MIME 过滤，EPUB 常被标成 octet-stream / zip：一起放进来，ZIP 导入时解开
export const accept = '.epub,.txt,.zip,application/epub+zip,text/plain,application/zip,application/octet-stream';

/** TXT：UTF-8 / GBK / Big5 / UTF-16 按内容识别（见 lib/charset.js） */
export async function decodeText(blob) {
  const { decodeBytes } = await import('../../lib/charset.js');
  return decodeBytes(new Uint8Array(await blob.arrayBuffer()));
}

async function epubMeta(blob) {
  try {
    const { default: ePub } = await import('epubjs');
    const book = ePub(await blob.arrayBuffer());
    const meta = await book.loaded.metadata;
    let cover = '';
    try {
      const url = await book.coverUrl();
      if (url) {
        const b = await (await fetch(url)).blob();
        cover = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
      }
    } catch {}
    book.destroy();
    return { title: meta.title, author: meta.creator, cover };
  } catch { return {}; }
}

/** @returns {Promise<{ok: string[], failed: {name: string, reason: string}[]}>} */
export async function importFiles(files) {
  const ok = [], failed = [];
  for (const f of files) {
    const ext = (f.name.match(/\.(epub|txt)$/i) || [])[1]?.toLowerCase();
    if (!ext) { failed.push({ name: f.name, reason: '只支持 EPUB 和 TXT' }); continue; }
    const base = f.name.replace(/\.(epub|txt)$/i, '');
    const itemId = `local:${hash(f.name + f.size + f.lastModified).toString(36)}`;
    try {
      let title = base, author = '', cover = '', blob = f;
      if (ext === 'epub') {
        // GBK / Big5 编码的 EPUB 先转成 UTF-8，不然阅读器里是乱码
        blob = await (await import('../../reader/epubfix.js')).utf8Epub(f);
        ({ title = base, author = '', cover = '' } = await epubMeta(blob));
      } else {
        // 统一转成 UTF-8 存，阅读器不用再猜编码
        blob = new Blob([await decodeText(f)], { type: 'text/plain;charset=utf-8' });
        const m = base.match(/^(.+?)\s*[-—_]\s*(.+?)$/); // 「书名 - 作者」
        if (m) { title = m[1]; author = m[2]; }
      }
      await addToShelf({ id: itemId, bookId: itemId, source: id, title, author, cover, ext, size: blob.size }, blob);
      ok.push(itemId);
    } catch (err) {
      failed.push({ name: f.name, reason: err?.message || '读取失败' });
    }
  }
  return { ok, failed };
}
