// 外文漫画翻成中文：书名、简介、标签、章节名（图里的对白不翻）。
//
//   哪些要翻：有假名（日文）、有谚文（韩文），或者一个汉字都没有、有成词的拉丁字母（英文等）。全是汉字的不动
//            （中文源本来就是中文；只有汉字的日文书名中文读者也看得懂）
//   用什么翻：微软 Edge 浏览器自带翻译用的接口（免 key、国内直连、允许跨域，自动识别语言）。是非公开接口，
//            哪天不能用了就原样显示外文，不影响看漫画
//   罗马字日文（「Kaguya-sama wa Kokurasetai」）会被认成印尼语之类翻成乱码：认出来的语言不在常见的那几种里就不用译文
//   章节号本地改：「Chapter 12: The Return」「Vol.2 Ch.5」「第3話 はじまり」→「第12话 …」，只把后面的副标题送去翻
//   译过的记在本机（最多 4000 条），同一句不翻第二遍；同一刻要翻的攒成一批（一次最多 100 条）
const ENDPOINT = 'https://edge.microsoft.com/translate/translatetext?to=zh-Hans&isEnterpriseClient=false';
const KEY = 'comic:tr', SWITCH = 'comic:translate', MAX = 4000, BATCH = 100;
const LANGS = new Set(['en', 'ja', 'ko', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'uk', 'pl', 'nl', 'vi', 'th', 'tr']);

// 只翻外文源（policy.js 白名单里这几个是英文、日文的；自己搭的漫画服务器里什么语言都有）。
// 中文源里用英文名的韩漫（拷贝漫画的「LOST MAN」）是源自己就这么叫，不翻
const FOREIGN_SOURCES = new Set(['manga_dex', 'comick', 'shonen_jump_plus', 'comic_walker', 'komga', 'kavita', 'lanraragi']);
/** 源的 key 或 id（「venera:manga_dex」）都行 */
export const isForeignSource = (source) => FOREIGN_SOURCES.has(String(source || '').split(':').pop().toLowerCase());

// MangaDex 的标签、状态是固定的一套，机翻常出错（Official Colored →「官方有色人种」，Gore →「戈尔」），直接对照
const TERMS = new Map(Object.entries({
  oneshot: '短篇', thriller: '惊悚', 'award winning': '获奖作品', reincarnation: '转生', 'sci-fi': '科幻', 'time travel': '穿越时空',
  genderswap: '性转', loli: '萝莉', 'traditional games': '传统游戏', 'official colored': '官方上色', historical: '历史', monsters: '怪物',
  action: '动作', demons: '恶魔', psychological: '心理', ghosts: '鬼怪', animals: '动物', 'long strip': '条漫', romance: '恋爱', ninja: '忍者',
  comedy: '喜剧', mecha: '机甲', anthology: '合集', "boys' love": '耽美', incest: '禁断', crime: '犯罪', survival: '生存', zombies: '丧尸',
  'reverse harem': '逆后宫', sports: '运动', superhero: '超级英雄', 'martial arts': '武术', 'fan colored': '同好上色', samurai: '武士',
  'magical girls': '魔法少女', mafia: '黑帮', adventure: '冒险', 'self-published': '自出版', 'virtual reality': '虚拟现实',
  'office workers': '职场', 'video games': '电子游戏', 'post-apocalyptic': '末世', 'sexual violence': '性暴力', crossdressing: '异装',
  magic: '魔法', "girls' love": '百合', harem: '后宫', military: '军事', wuxia: '武侠', isekai: '异世界', '4-koma': '四格', doujinshi: '同人',
  philosophical: '哲学', gore: '血腥', drama: '剧情', medical: '医疗', 'school life': '校园', horror: '恐怖', fantasy: '奇幻',
  villainess: '恶役千金', vampires: '吸血鬼', delinquents: '不良', 'monster girls': '魔物娘', shota: '正太', police: '警察',
  'web comic': '网络漫画', 'slice of life': '日常', aliens: '外星人', cooking: '美食', supernatural: '超自然', mystery: '悬疑',
  adaptation: '改编', music: '音乐', 'full color': '全彩', tragedy: '悲剧', gyaru: '辣妹',
  ongoing: '连载中', completed: '已完结', hiatus: '休刊中', cancelled: '已停更', shounen: '少年', shoujo: '少女', seinen: '青年', josei: '女性',
  tags: '标签', tag: '标签', status: '状态', authors: '作者', author: '作者', artists: '画师', artist: '画师', genres: '类型', genre: '类型',
  themes: '题材', formats: '形式', demographic: '受众', language: '语言', 'content rating': '分级',
}));

export const translateOn = () => { try { return localStorage.getItem(SWITCH) !== '0'; } catch { return true; } };
export function setTranslateOn(on) { try { localStorage.setItem(SWITCH, on ? '1' : '0'); } catch { /* 存不下就只管这次 */ } }

const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u, HANGUL = /\p{Script=Hangul}/u, HAN = /\p{Script=Han}/u, WORD = /[A-Za-z]{2,}/;
/** 这句要不要翻 */
export const isForeign = (s) => {
  s = String(s || '').trim();
  if (!s) return false;
  if (KANA.test(s) || HANGUL.test(s)) return true;
  return !HAN.test(s) && WORD.test(s);
};

// ---------- 缓存 ----------
let cache;
const cacheOf = () => {
  if (!cache) { try { cache = new Map(Object.entries(JSON.parse(localStorage.getItem(KEY)) || {})); } catch { cache = new Map(); } }
  return cache;
};
let saveTimer;
const save = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const c = cacheOf();
    while (c.size > MAX) c.delete(c.keys().next().value);   // 最早翻的先扔
    try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(c))); } catch { /* 存不下就下次再翻 */ }
  }, 800);
};

// ---------- 攒批、请求 ----------
let pending = new Map(), flushTimer;   // 原文 → [resolve...]
async function request(texts) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 12000);   // iOS 15 还没有 AbortSignal.timeout
  const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(texts), signal: ctl.signal }).finally(() => clearTimeout(timer));
  if (!res.ok) throw new Error(`翻译接口 ${res.status}`);
  const out = await res.json();
  return texts.map((t, i) => {
    const r = out[i], zh = r?.translations?.[0]?.text?.trim(), lang = r?.detectedLanguage?.language;
    return zh && LANGS.has(lang) ? zh : t;   // 认不准语言（多半是罗马字）就保留原文
  });
}
function flush() {
  const batch = pending;
  pending = new Map();
  const texts = [...batch.keys()];
  for (let i = 0; i < texts.length; i += BATCH) {
    const part = texts.slice(i, i + BATCH);
    request(part).then(
      zh => part.forEach((t, k) => { cacheOf().set(t, zh[k]); batch.get(t).forEach(fn => fn(zh[k])); save(); }),
      () => part.forEach(t => batch.get(t).forEach(fn => fn(t))),   // 没翻成：这次原样显示，不记
    );
  }
}
/** 翻一句：要翻的才翻，翻不了原样返回（不会 reject） */
export function tr(text) {
  const s = String(text || '').trim();
  if (!s || !translateOn() || !isForeign(s)) return Promise.resolve(text);
  const term = TERMS.get(s.toLowerCase());
  if (term) return Promise.resolve(term);
  const hit = cacheOf().get(s);
  if (hit !== undefined) return Promise.resolve(hit);
  return new Promise(resolve => {
    if (!pending.has(s)) pending.set(s, []);
    pending.get(s).push(resolve);
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 30);
  });
}
/** 最多等 ms，超时先给原文（列表不能因为翻译卡住） */
const within = (p, fallback, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(fallback), ms))]);

// ---------- 章节名 ----------
const num = (s) => String(s).replace(/^0+(?=\d)/, '');
/** 「Chapter 12: The Return」→「第12话」+ 要翻的副标题 */
export function splitChapter(title) {
  const t = String(title || '').trim();
  let m;
  if ((m = /^(?:vol(?:ume)?\.?\s*(\d+)\s*[,.\-–:]?\s*)?(?:ch(?:apter|\.)?|ep(?:isode|\.)?|#)\s*(\d+(?:\.\d+)?)\s*(?:[:：\-–.]\s*)?(.*)$/i.exec(t)))
    return { head: `${m[1] ? `第${num(m[1])}卷 ` : ''}第${num(m[2])}话`, rest: m[3].trim() };
  if ((m = /^vol(?:ume)?\.?\s*(\d+)\s*(?:[:：\-–.]\s*)?(.*)$/i.exec(t))) return { head: `第${num(m[1])}卷`, rest: m[2].trim() };
  if ((m = /^第\s*(\d+(?:\.\d+)?)\s*[話话回]\s*[:：\-–]?\s*(.*)$/.exec(t))) return { head: `第${num(m[1])}话`, rest: m[2].trim() };
  if ((m = /^(\d+(?:\.\d+)?)\s*[:：\-–]\s*(.+)$/.exec(t))) return { head: `第${num(m[1])}话`, rest: m[2].trim() };
  if (/^(?:oneshot|one-shot|読切|読み切り)$/i.test(t)) return { head: '短篇', rest: '' };
  return { head: '', rest: t };
}
// 只在外文源里用（localizeDetails 先看了源），话号改成「第N话」，副标题是外文的才送去翻。
// 不能先看整句是不是外文：MangaDex 的章节名先被 bestLanguage 改成「第2话 Pochita」，带了汉字
async function chapterTitle(title) {
  const { head, rest } = splitChapter(title);
  if (!head) return tr(title);
  if (!rest) return head;
  return `${head} ${await tr(rest)}`;
}

// ---------- MangaDex：每一话挑最好的语言 ----------
// MangaDex 的章节按「Volume 1 - EN」「No Volume - CN」分组，同一话常有好几个国家的译者各传一份。
// 每一话只留一份：中文汉化（CN > HK > TW）> 英文 > 日文 > 其他；再按卷、话号排好，组名改成「第1卷」「未分卷」。
// 中文汉化只到第 50 话、英文到 150 话的，就是前 50 话看中文、后面看英文（副标题照样翻成中文）
const MD_GROUP = /^(?:Volume\s+(.+?)|No Volume) - ([A-Z]{2,3}(?:-[A-Z]{2})?)$/;
const LANG_RANK = ['CN', 'HK', 'TW', 'EN', 'JP'];
const rankOf = (lang) => { const i = LANG_RANK.indexOf(lang); return i < 0 ? LANG_RANK.length : i; };
const numOr = (v, dflt) => { const n = parseFloat(v); return Number.isFinite(n) ? n : dflt; };
export function bestLanguage(d) {
  const ch = d?.chapters || [];
  if (ch.length < 2 || !ch.every(c => MD_GROUP.test(c.group || ''))) return d;
  const best = new Map();   // 卷|话号 → 那一话的最好版本
  ch.forEach((c, i) => {
    const [, vol, lang] = MD_GROUP.exec(c.group);
    const no = String(c.title).split(':')[0].trim();
    // 有话号的按话号认（同一话有的译者分了卷、有的没分），「Oneshot」这种按卷 + 名字认
    const key = Number.isFinite(parseFloat(no)) ? String(parseFloat(no)) : (vol || '') + '|' + no, was = best.get(key);
    if (!was || rankOf(lang) < was.rank) best.set(key, { c, i, vol, no, rank: rankOf(lang) });
  });
  const kept = [...best.values()].sort((a, b) => {
    const x = parseFloat(a.no), y = parseFloat(b.no);
    if (Number.isFinite(x) && Number.isFinite(y)) return x - y || a.i - b.i;
    return numOr(a.vol, Infinity) - numOr(b.vol, Infinity) || a.i - b.i;
  });
  // 章节名统一成「第1话 狗与电锯」（MangaDex 给的是「1: 狗与电锯」），外文副标题后面再翻
  const named = (c) => { const { head, rest } = splitChapter(c.title); return head ? (rest ? head + ' ' + rest : head) : c.title; };
  return { ...d, chapters: kept.map(({ c, vol }) => ({ ...c, title: named(c), group: vol ? '第' + num(vol) + '卷' : '未分卷' })) };
}

// ---------- 套到漫画数据上 ----------
/** 搜索结果、探索书单：外文源的书名、简介、标签翻好（最多等 4 秒），原名放 titleOrig（详情里显示「又名」）。source：源的 key 或 id */
export async function localizeComics(comics, source) {
  if (!translateOn() || !isForeignSource(source) || !comics?.some(c => isForeign(c.title) || isForeign(c.description))) return comics;
  const job = Promise.all(comics.map(async c => {
    if (!isForeign(c.title) && !isForeign(c.description) && !(c.tags || []).some(isForeign)) return c;
    const [title, description, tags] = await Promise.all([tr(c.title), tr(c.description), Promise.all((c.tags || []).map(tr))]);
    return { ...c, title, titleOrig: title !== c.title ? c.title : c.titleOrig, description, tags };
  }));
  return within(job, comics, 4000);
}

/** 详情：外文源的书名、简介、标签、全部章节名（最多等 6 秒；几百话的一批批翻，一般一两秒）。MangaDex 先挑语言 */
export async function localizeDetails(d, source) {
  if (!translateOn() || !d || !isForeignSource(source)) return d;
  const base = bestLanguage(d);
  const job = (async () => {
    const [title, description, tags, chapters] = await Promise.all([
      tr(base.title), tr(base.description),
      Promise.all((base.tags || []).map(async ([k, v]) => [await tr(k), await Promise.all((v || []).map(tr))])),
      Promise.all((base.chapters || []).map(async c => ({ ...c, title: await chapterTitle(c.title), group: await tr(c.group) }))),
    ]);
    return { ...base, title, titleOrig: title !== base.title ? base.title : base.titleOrig, description, tags, chapters };
  })();
  return within(job, base, 6000);
}
