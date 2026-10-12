// Verified thumbnails for the fixed home recommendations. Source URLs and
// attribution are recorded in public/covers/sources.json. Other books retain
// the network cover pipeline; imported EPUB artwork always takes precedence.
const featured = new Set(["1779", "3027", "2353", "2607", "3111", "2032", "2177", "3110", "2922", "4099", "2214", "2102", "4218", "3646", "2906", "3414", "2255", "3394", "2015", "3384", "2907", "3203", "3740", "2554"]);
const picks = new Map([
  [
    "诡秘之主|爱潜水的乌贼",
    "/covers/picks/1010868264.webp"
  ],
  [
    "宿命之环|爱潜水的乌贼",
    "/covers/picks/1036370336.webp"
  ],
  [
    "深海余烬|远瞳",
    "/covers/picks/1034360760.webp"
  ],
  [
    "道诡异仙|狐尾的笔",
    "/covers/picks/1031794030.webp"
  ],
  [
    "玄鉴仙族|季越人",
    "/covers/picks/1035420986.webp"
  ],
  [
    "赤心巡天|情何以甚",
    "/covers/picks/1016530091.webp"
  ],
  [
    "光阴之外|耳根",
    "/covers/picks/1031777108.webp"
  ],
  [
    "夜的命名术|会说话的肘子",
    "/covers/picks/1021617576.webp"
  ],
  [
    "大奉打更人|卖报小郎君",
    "/covers/picks/1019664125.webp"
  ],
  [
    "将进酒|唐酒卿",
    "/covers/picks/3373718.webp"
  ],
  [
    "有匪|priest",
    "/covers/picks/2595385.webp"
  ],
  [
    "默读|priest",
    "/covers/picks/2771073.webp"
  ],
  [
    "一级律师|木苏里",
    "/covers/picks/2674286.webp"
  ],
  [
    "小蘑菇|一十四洲",
    "/covers/picks/4105840.webp"
  ],
  [
    "十日终焉|杀虫队队员",
    "/covers/picks/7143038691944959011.webp"
  ],
  [
    "我在精神病院学斩神|三九音域",
    "/covers/picks/6982529841564224526.webp"
  ]
]);
export function curatedCover(book) {
  if (!book) return '';
  if (book.source === 'pick') return picks.get(`${book.title}|${book.author}`) || '';
  const aid = book.source === 'mojimoon' ? String(book.aid) : /^mojimoon:(\d+)$/.exec(book.bookId || '')?.[1];
  return featured.has(aid) ? `/covers/featured/${aid}.webp` : '';
}
