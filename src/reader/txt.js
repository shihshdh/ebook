import JSZip from 'jszip';

import { CHAPTER } from './chapter.js';
export { CHAPTER };

const escape = value => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

// 先转成内存 EPUB，保证 TXT 和 EPUB 的位置、目录、书签使用同一套稳定语义。
// opts.isHeading(line)：自定义哪些行算章节标题（公版书源会把「狂人日記」「學而第一」这类独占一段的短标题也算上）
export async function txtToEpub(blob, title, { isHeading = (line) => CHAPTER.test(line) } = {}) {
  const bytes = await blob.arrayBuffer();
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { text = new TextDecoder('gb18030').decode(bytes); }
  const chapters = [];
  let current = { title: '正文', lines: [] };
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (isHeading(line)) {
      if (current.lines.length) chapters.push(current);
      current = { title: line.trim(), lines: [] };
    } else current.lines.push(line);
  }
  chapters.push(current);
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  chapters.forEach((chapter, i) => zip.file(`c${i}.xhtml`, `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escape(chapter.title)}</title></head><body><h1>${escape(chapter.title)}</h1>${chapter.lines.filter(l => l.trim()).map(l => `<p>${escape(l)}</p>`).join('')}</body></html>`));
  zip.file('nav.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>目录</title></head><body><nav epub:type="toc"><ol>${chapters.map((c, i) => `<li><a href="c${i}.xhtml">${escape(c.title)}</a></li>`).join('')}</ol></nav></body></html>`);
  zip.file('book.opf', `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">librarium-txt</dc:identifier><dc:title>${escape(title)}</dc:title><dc:language>zh</dc:language><meta property="dcterms:modified">2026-01-01T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${chapters.map((_, i) => `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine>${chapters.map((_, i) => `<itemref idref="c${i}"/>`).join('')}</spine></package>`);
  return zip.generateAsync({ type: 'arraybuffer' });
}
