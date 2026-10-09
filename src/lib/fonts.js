// 衬线字（Noto Serif SC）提前下好。
//
// 这套字是按字切成一百多个分片的网络字体（tokens.css 引的那份 CSS，每个字重一百来片、一片几十 KB），
// 哪个分片里的字第一次上屏，才去下哪个分片。分片没到的时候排字很慢：这些字要逐字走系统后备字体查找
// （4 倍降速下十来个字十几到四十几毫秒；分片到了以后同样的字不到 1 毫秒），分片到了再把字重排一遍。
// 瀑布流往下翻、新书单一挂上，就是「一帧里几段字现查后备字体」——探索页滚动顿的那一下。
// 所以快要上屏的字先把分片下好（document.fonts.load 只下这段字用得到的分片，下过的直接就绪），下好了再挂。
// 另外：每个分片下到时，浏览器都会把屏幕附近所有用这套字的文字重排一遍（不管下到的字用没用上），
// 所以预取要成批、要早，别在滚动当中一片一片地到（见 MasonryWall.jsx 的 FONT_PAGES）。

const FAMILY = '"Noto Serif SC"';

/**
 * 把这段字要用的衬线分片下好
 * @param text   要上屏的字（重复的字只算一次）
 * @param weight 字重：书名、摘句都是 600
 * @returns 下好（或下不了）时完成的 Promise，不会失败
 */
export function loadSerif(text, weight = 600) {
  const chars = [...new Set(text)].join('');
  if (!chars || !document.fonts?.load) return Promise.resolve();
  return document.fonts.load(`${weight} 16px ${FAMILY}`, chars).then(() => {}, () => {});
}

/** 等 promise，但最多等 ms 毫秒（网络慢、离线时不能让内容一直不出来） */
export const atMost = (promise, ms) => Promise.race([promise, new Promise(r => setTimeout(r, ms))]);
