// 有些 EPUB（多见于早年用工具打包的中文书）正文是 GBK / Big5 编码，epub.js 读压缩包里的文本一律按 UTF-8 解，
// 打开就满屏乱码（别的阅读器会看 <?xml encoding> 声明，所以在那边正常）。
// 导入时查一遍：正文、目录、OPF、CSS 里有不是合法 UTF-8 的，按声明的编码（没声明就在 GB18030 / Big5 里挑乱码少的）
// 转成 UTF-8、改掉声明，重新打包。全是 UTF-8 的书原样返回，不重新打包。
import { decodeBytes, declaredCharset, isUtf8 } from '../lib/charset.js';

const TEXT = /\.(x?html?|xml|opf|ncx|css)$/i;

const toUtf8Decl = text => text
  .replace(/^﻿/, '')
  .replace(/(<\?xml[^>]*encoding\s*=\s*["'])[\w-]+(["'])/i, '$1utf-8$2')
  .replace(/(<meta[^>]*charset\s*=\s*["']?)[\w-]+/gi, '$1utf-8');

/** @param {Blob} blob EPUB @returns {Promise<Blob>} 需要时转好码的 EPUB，否则就是原来那个 */
export async function utf8Epub(blob) {
  const { default: JSZip } = await import('jszip');
  let zip;
  try { zip = await JSZip.loadAsync(await blob.arrayBuffer()); } catch { return blob; }
  const fixed = new Map();
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !TEXT.test(entry.name)) continue;
    const bytes = await entry.async('uint8array');
    if (!isUtf8(bytes)) fixed.set(entry.name, toUtf8Decl(decodeBytes(bytes, [declaredCharset(bytes)])));
  }
  if (!fixed.size) return blob;
  // 重新打包：mimetype 必须排第一个、不压缩
  const out = new JSZip();
  out.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || entry.name === 'mimetype') continue;
    out.file(entry.name, fixed.has(entry.name) ? fixed.get(entry.name) : await entry.async('uint8array'));
  }
  return out.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
}
