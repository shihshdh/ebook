// 收哪些漫画源：只收一般向，用白名单。
//   Venera 的源索引里约三分之一是成人站（禁漫、紳士漫畫、nhentai、ehentai、hitomi、哔咔、18漫画、H-Comic、漫小肆、漫蛙吧…），
//   现有的成人判断（plugins/legado/source-policy.js）按名字只挡得住其中 4 个，所以这里不靠猜：名单上的才显示，
//   索引以后新加的源，审过再加进来。耽美、百合、后宫这类题材标签不算成人（同文字书源的规矩）。
import { isAdultSource } from '../plugins/legado/source-policy.js';

/** 一般向的源：key（源脚本里的 key 字段）→ 列表里名字下面那行补充说明（没什么可说的留空） */
export const ALLOWED = {
  copy_manga: '国漫、日漫汉化最全',
  baozi: '主域名打不开时，在设置里换一个',
  manga_dex: '官方开放接口，多语言汉化',
  ManHuaGui: '老牌日漫站',
  zaimanhua: '原动漫之家',
  Komiic: '繁体',
  goda: '',
  manhuaren: '',
  ykmh: '',
  ikmmh: '',
  mycomic: '繁体',
  hot_manga: '拷贝漫画的另一个入口',
  happy: '',
  mh1234: '',
  ccc: '台湾正版平台',
  comic_walker: '角川官方，日文',
  shonen_jump_plus: '集英社官方，日文',
  comick: '英文聚合站',
  // 自己搭的漫画服务器：要在设置里填自己的服务器地址
  komga: '连自己的漫画服务器',
  kavita: '连自己的漫画服务器',
  lanraragi: '连自己的漫画服务器',
};
const SELF_HOSTED = new Set(['komga', 'kavita', 'lanraragi']);
export const isSelfHosted = (key) => SELF_HOSTED.has(key);

/** 返回 '' 表示收下，否则是不收的原因（索引条目或已安装的源都能传：{ key, name, url? }） */
export function comicSkipReason({ key, name, url } = {}) {
  if (isAdultSource({ bookSourceName: name || '', bookSourceUrl: url || '' })) return '成人内容';
  if (!Object.hasOwn(ALLOWED, key)) return '不在白名单';
  return '';
}

// 漫画源只上公网：本机、局域网一律不许（防止网上来的脚本扫路由器、NAS）。自己搭的漫画服务器（Komga 这类）例外
// URL 解析已经把 2130706433、0x7f.1 这类写法规范成 127.0.0.1，这里只认规范形式
export function isPrivateHost(hostname) {
  const h = String(hostname).replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  const v4 = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(h);
  if (v4) {
    const a = +v4[1], b = +v4[2];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  return h.includes(':') && (h === '::' || h === '::1' || /^f[cd]|^fe[89ab]|^::ffff:/.test(h));
}
export function checkUrl(url, { allowPrivate = false } = {}) {
  let u;
  try { u = new URL(url); } catch { throw new Error(`不是网址：${String(url).slice(0, 80)}`); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('只能访问 http / https 网址');
  if (!allowPrivate && isPrivateHost(u.hostname)) throw new Error('漫画源不能访问本机和局域网');
  return u.href;   // 顺便把中文关键词这类非 ASCII 字符转成百分号编码
}
