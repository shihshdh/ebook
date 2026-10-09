// 收什么源：EBOOK 只看书。
//   书源只收文字书：听书、漫画、影视、音乐不收（EBOOK 只会把文字章节做成书，那些本来也用不了）
//   订阅只收拿来读的文字：小说书单、新闻资讯、知识文章。影音、图片、软件下载、网盘、导航工具、
//   阅读 App 的配套（书源仓库、净化规则、朗读引擎、主题）都不收
//   成人内容一律不收
// 看名字、分组、网址和分类名（书源的发现页、订阅源的分类），不看说明：说明里常有免责声明，会误伤。
// 普通言情、百合、耽美不会只因题材被删。
// 导入时拦，启动时也按这里清一遍旧数据（lib/legado.js、lib/rss.js）。
import { ADULT_HOSTS, NOT_BOOK_HOSTS, NOT_READING_HOSTS, NOT_READING_NAMES, SUSPECT_HOSTS } from './blocked-sites.js';

// ---------- 成人 ----------
// 名字 / 分组里出现就算
const ADULT = /R-?1[58]|18\s*[Xx+禁🈲]|X18|🔞|成人|色情|情色|涩|里番|裏番|本子|绅士|hentai|porn|nsfw|xxx|无码|無碼|有码|有碼|福利|偷拍|约炮|淫|(?<![a-z])av(?![a-z])|麻豆|黄漫|黄网|黄色|小黄|黄仓库|禁漫|H漫|撸|xvideos|missav|jav(?!a)|写真|美女|尤物|宅男|小姐姐|媚韵|妹子|妹纸|模特|丝袜|性感|嫩模|萝莉|巨乳|草榴|(?<!\d)1024(?!\d)|番号|自拍|吃瓜|黑料|sex|adult|ghs|老司机|🍆|肉文|辣文|高H|H文|po18|色文|色哟哟|色堂|四色|66色|禁忌书屋|爱丽丝书屋|御书屋|第一版主|(?<![a-z])uaa(?![a-z])/i;
// 本地合集把部分成人站标为「废文」，另一些只保留站名
const ADULT_SITE = /废文|廢文|海棠(?:书屋|書屋|文学|文學)|御宅(?:文|书|書)屋|PO\s*文/i;
// 整组都是成人站的分组名（名字本身看不出来）
const ADULT_GROUP = /SP-SSR|妙性朗然|呦呦鹿鸣|ifwlzs|㈱人间/i;
const ADULT_HOST = /porn|hentai|hanime|jav(?!a)|xvideos|xnxx|missav|jable|18comic|nhentai|wnacg|sehuatang|t66y|caoliu|po18|sexy?|netflav|avple|thisav|playav|qinav|7mmtv|tktube|85tube|cableav|(?:^|\.)uaa\d*\./i;
// 分类名：一个就算（成人站的分类几乎都是这些）。有歧义的词（起点有「家庭伦理」、番茄有「成人教育」）只认整个分类名
const ADULT_SORT = /无码|無碼|有码|有碼|偷拍|乱伦|亂倫|人妻|女优|女優|番号|情色|色情|里番|裏番|福利姬|写真|丝袜|絲襪|巨乳|美腿|性爱|性愛|三级片|三級|调教|調教|强奸|強暴|中文字幕|无圣光|套图|R-?18|18禁|H漫|H动漫|本子|同人志|肉文|辣文|高H|国产传媒|嫩模|秀人|NSFW|伦理片|网友自拍|国产自拍|自拍偷拍|都市激情|亚洲激情|欧美激情|激情男女|成人(?!教育|高考|自考|礼)|(?<![A-Za-z])AV(?![A-Za-z])/i;
const ADULT_SORT_EXACT = /^(?:自拍|伦理|激情|露出|素人|三级)$/;

// ---------- 不是书 / 不是拿来读的 ----------
const BOOK_TYPES = { 1: '听书', 2: '漫画', 3: '文件下载', 4: '视频' };
const NOT_BOOK_GROUP = /漫画|漫畫|听书|聽書|有声|影视|影視|视频|視頻|音乐|音樂|游戏|遊戲|短剧|电影|電影/;
const NOT_BOOK_NAME = /漫画|漫畫|听书|聽書|有声|影视|影視|视频|視頻|音乐|音樂|短剧|电影|電影|哔哩|B站|直播/;

const MEDIA = /影视|影視|视频|視頻|电影|電影|影院|影城|剧场|劇場|电视|電視|追剧|美剧|韩剧|日剧|泰剧|港剧|短剧|剧集|连续剧|综艺|番剧|动画|動畫|动漫|動漫|直播|看片|片库|播放|m3u8|(?<![a-z])vod|(?<![a-z])tv(?![a-z])|bilibili|哔哩|B站|A站|抖音|快手|youtube|油管|优酷|爱奇艺|腾讯视频|芒果|解析|音乐|音樂|听书|聽書|有声|音频|音頻|电台|(?<![a-z])fm(?![a-z])|(?<![a-z])dj(?![a-z])|歌曲|歌单|儿歌|K歌|网易云|酷狗|播客|广场舞|字幕组|🎬|📺|📽|🎞|🎥|🎦|🎶|📻|ＴＶ/i;
const PICTURE = /图片|圖片|美图|壁纸|图库|图集|图摘|无聊图|插画|画师|画廊|pixiv|P站|摄影|头像|表情包|cos|漫画|漫畫|🖼|📷|image|img/i;
// 阅读 App 的配套：书源仓库、导入链接、净化 / 替换规则、朗读引擎、主题、论坛和教程
const APP_META = /书源|書源|源仓库|订阅源|订阅合集|订阅复刻|一键导入|legado|开源阅读|阅读\s*(?:3\.0|ʏᴰ|Σ|官方|论坛|主题|附加|教程|浏览器|理解|难受)|难受|tts|朗读|发音人|净化|替换规则|写源|发现规则|源大佬|源合集|源链接|蓝奏|兰奏|lanzou|整合|万源/i;
const APP_META_GROUP = /书源|書源|源仓库|源大佬|legado|-md-|订阅合集|订阅复刻/i;
const SOFTWARE = /下载|下載|软件|軟件|破解|网盘|網盤|云盘|坚果云|磁力|磁搜|种子|torrent|tracker|(?<![a-z])bt(?![a-z])|vpn|翻墙|免翻|梯子|机场|节点|游戏|遊戲|激活|svip|(?<![a-z])vip(?![a-z])|(?<![a-z])app|apk|资源|ai工具|(?<![a-z])ai(?![a-z])|chat|gpt|画图|导航|浏览|聚合|工具|搜索引擎|直链|天气|字体|模板|源码|站长|酷安|养生|菜谱|美食|食谱|下厨|煲汤|宠物|汪星人|喵星人|鸟星人|网名|饮品|开车|木鱼|日历|域名|办理/i;
// 名字、分组里带这些的算阅读（只抵消「软件工具」这一类，成人、影音照样不收）
const READING = /小说|小說|文学|文學|精校|书单|推书|搜书|找书|书荒|读书|書屋|书屋|书库|书城|书阁|书吧|书院|书网|书坊|看书|藏书|杂志|期刊|新闻|资讯|日报|早报|报纸|要闻|头条|热榜|榜单|知乎|公众号|故事|美文|散文|诗|国学|古籍|典藏|百科|科普/;

const labelOf = (s) => `${s.bookSourceName || s.sourceName || ''} ${s.bookSourceGroup || s.sourceGroup || ''}`;
const hostOf = (s) => {
  try { return new URL(String(s.bookSourceUrl || s.sourceUrl || '').trim().split(/[\s,#]/)[0]).hostname.toLowerCase(); } catch { return ''; }
};
const inList = (host, list) => !!host && list.some(h => host === h || host.endsWith('.' + h));

/** 分类名：书源的 exploreUrl、订阅源的 sortUrl。「名字::网址」一行一个（或 && 隔开），也有 JSON 数组 */
export function sortNamesOf(s) {
  const raw = s.exploreUrl ?? s.sortUrl;
  if (!raw) return [];
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const json = [...text.matchAll(/"title"\s*:\s*"([^"]{1,30})"/g)].map(m => m[1]);
  if (json.length) return json.map(t => t.trim()).filter(Boolean);
  return text.split(/\n|&&/).map(line => line.indexOf('::') > 0 ? line.slice(0, line.indexOf('::')).trim() : '').filter(n => n && n.length <= 30);
}
// 影音 / 图片站的分类大多是这些；只有一两个（「动漫」「有声小说」）不算
const MEDIA_SORT = /电影|電影|电视剧|電視劇|连续剧|連續劇|剧集|美剧|韩剧|日剧|泰剧|港剧|综艺|綜藝|动漫|動漫|番剧|动画|動畫|纪录片|短剧|视频|視頻|直播|(?<![A-Za-z])MV|音乐|音樂|歌曲|歌单|电台|有声|听书|(?<![A-Za-z])DJ|舞曲|影院|影视|影視/i;
const PICTURE_SORT = /图片|圖片|图集|套图|美图|壁纸|插画|插圖|头像|表情|cos|写真|漫画|漫畫|韩漫|国漫|日漫|gif|动图/i;
const mostly = (names, re) => { const n = names.filter(x => re.test(x)).length; return n >= 2 && n * 3 >= names.length; };

const suspect = (host) => inList(host, SUSPECT_HOSTS);
// 名单里的名字：三个字以上的含有就算，短的（「私」「失效」）要整名一样
const nameIs = (s, n) => { const name = String(s.sourceName || '').trim(); return name === n || (n.length >= 3 && name.includes(n)); };

export function isAdultSource(source = {}) {
  const label = labelOf(source), host = hostOf(source);
  if (ADULT.test(label) || ADULT_SITE.test(label)) return true;
  if (ADULT_GROUP.test(source.bookSourceGroup || source.sourceGroup || '')) return true;
  if (host && (ADULT_HOST.test(host) || inList(host, ADULT_HOSTS))) return true;
  return sortNamesOf(source).some(n => ADULT_SORT.test(n) || ADULT_SORT_EXACT.test(n));
}

/** 书源：返回 '' 表示收下，否则是不收的原因 */
export function bookSkipReason(s = {}) {
  if (isAdultSource(s)) return '成人内容';
  const type = Number(s.bookSourceType || 0);
  if (type !== 0) return BOOK_TYPES[type] || '不是文字书';
  if (NOT_BOOK_GROUP.test(s.bookSourceGroup || '') || NOT_BOOK_NAME.test(s.bookSourceName || '')) return '不是文字书';
  if (inList(hostOf(s), NOT_BOOK_HOSTS)) return '不是书站';
  if (suspect(hostOf(s))) return '来路不明的站';
  return '';
}

/** 订阅源：返回 '' 表示收下，否则是不收的原因 */
export function rssSkipReason(s = {}) {
  if (isAdultSource(s)) return '成人内容';
  const label = labelOf(s), host = hostOf(s), sorts = sortNamesOf(s), url = String(s.sourceUrl || '').trim();
  if (MEDIA.test(label) || mostly(sorts, MEDIA_SORT)) return '视频 / 音频';
  if (PICTURE.test(label) || mostly(sorts, PICTURE_SORT)) return '图片 / 漫画';
  if (APP_META.test(s.sourceName || '') || APP_META_GROUP.test(s.sourceGroup || '') || /^(?:legado|yuedu):/i.test(url)) return '阅读 App 的配套';
  if (inList(host, NOT_READING_HOSTS) || NOT_READING_NAMES.some(n => nameIs(s, n))) return '不是阅读内容';
  if (suspect(host)) return '来路不明的站';
  if (SOFTWARE.test(label) && !READING.test(label)) return '软件 / 工具';
  return '';
}
