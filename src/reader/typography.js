// EPUB styles often specify a family on paragraphs/spans, overriding body.
// Keep a single inherited variable and override text elements once per document.
const documents = new WeakSet();
export const READER_FONT_STACKS = {
  serif: '"EBOOK Song", "Songti SC", serif',
  sans: '-apple-system, "PingFang SC", "Microsoft YaHei UI", sans-serif',
  kai: '"EBOOK Kai", "Kaiti SC", serif',
};
export function applyReaderFont(contents, key) {
  const doc = contents.document;
  if (!doc?.body) return Promise.resolve();
  if (!documents.has(doc)) {
    const style = doc.createElement('style');
    style.dataset.ebookFonts = '';
    const url = name => new URL(`/fonts/reader/${name}.woff2`, window.location.href).href;
    style.textContent = `@font-face{font-family:"EBOOK Song";src:url("${url('song')}") format("woff2");font-display:swap;}
      @font-face{font-family:"EBOOK Kai";src:url("${url('kai')}") format("woff2");font-display:swap;}`;
    doc.head.append(style);
    for (const el of doc.body.querySelectorAll('p,span,div,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,a,em,strong,b,i,ruby,rt,section,article')) {
      if (!el.closest('svg,math,pre,code')) el.style.setProperty('font-family', 'var(--ebook-reader-family)', 'important');
    }
    documents.add(doc);
  }
  const family = READER_FONT_STACKS[key] || READER_FONT_STACKS.serif;
  doc.body.style.setProperty('--ebook-reader-family', family);
  doc.body.style.setProperty('font-family', family, 'important');
  if (key === 'sans' || !doc.fonts) return Promise.resolve();
  let timer;
  return Promise.race([
    doc.fonts.load(`16px "${key === 'kai' ? 'EBOOK Kai' : 'EBOOK Song'}"`, '阅读漢字'),
    new Promise(resolve => { timer = setTimeout(resolve, 5000); }),
  ]).catch(e => console.warn('[reader-font]', e)).then(() => {
    if (contents.document === doc) contents.resizeCheck?.();
  }).finally(() => clearTimeout(timer));
}
