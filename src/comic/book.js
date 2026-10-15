// 漫画 → 详情面板、搜索池、封面用的 Book（字段见 plugins/registry.js）。
// 这个文件要轻：搜索页、探索页、封面都在首屏的包里，漫画源的沙箱和图片加载另外按需加载。
//
//   source: 'comic'，没有下载入口（downloads 为空）；详情面板看到 comic 字段就换成章节列表（components/ComicSheetBody.jsx）
//   comics: 同一部漫画在哪几个源里有（搜索池按书名把不同源的合成一条），第一个是封面和默认打开的那个
export const isComic = (b) => b?.source === 'comic';

/** @param {{ sourceId: string, sourceName: string, comic: { id, title, titleOrig?, subtitle, cover, tags, description } }} hit  titleOrig：外文源翻译前的原名 */
export function comicBook({ sourceId, sourceName, comic }) {
  return {
    id: `comic:${sourceId}:${comic.id}`, source: 'comic',
    title: comic.title, alt: comic.titleOrig || '', author: comic.subtitle || '', publisher: sourceName, status: '', animated: false,
    tags: (comic.tags || []).slice(0, 4), description: comic.description || '', length: '', updated: '', illustrated: false,
    coverSrc: comic.cover || '', downloads: [],
    comics: [{ sourceId, sourceName, comicId: comic.id, cover: comic.cover || '', title: comic.title }],
    poolSources: [sourceName],
  };
}

export const comicShelfId = (sourceId, comicId) => `comic:${sourceId}:${comicId}`;

// 书架、首页「接着读」上漫画的进度按话说：一部漫画几百话，按百分比常年显示 0%
/** 「第1话 第 7 张」；还没看过是 '' */
export const comicWhere = (it) => (it?.progress?.chapter ? `${it.progress.chapter}${it.progress.page ? ` 第 ${it.progress.page + 1} 张` : ''}` : '');
/** 作者那一行：作者 · 漫画源（漫画没有文件大小） */
export const comicByline = (it) => [it?.author, it?.comic?.sourceName].filter(Boolean).join(' · ') || '漫画';
export const readPath = (sourceId, comicId, index = 0) => `/read/comic/${encodeURIComponent(sourceId)}/${encodeURIComponent(comicId)}/${index}`;
export function comicShelfLocation(item, ref) {
  const [chapter, page] = typeof ref === 'string' && /^\d+:\d+$/.test(ref) ? ref.split(':').map(Number) : [item.progress?.index || 0, item.progress?.page || 0];
  return { pathname: readPath(item.comic.sourceId, item.comic.comicId, chapter), state: { page, at: ref ? Date.now() : item.lastReadAt || 0, title: item.title } };
}
