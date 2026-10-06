// 生成公版书源的书目 catalog.json（开发时跑一次；Gutenberg 的中文书很少变，隔几个月重跑即可）
//
//   1. 下载官方目录：https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv（约 20MB）
//   2. （opencc-js 已是应用依赖：公版书源的简体版也用它）
//   3. node src/plugins/public/make-catalog.mjs <pg_catalog.csv 路径>
//
// 只收语言为 zh 的文本（双语的英译本不要）；同一本书被拆成「1-10回」「11-20回」的分段，若有整本就只留整本。
// 书名存繁体原文 + 简体（检索两种都能搜到，界面显示简体）；作者 Gutenberg 只给拼音，常见的映射成中文名，其余显示拼音。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as OpenCC from 'opencc-js';

const src = process.argv[2];
if (!src) { console.error('用法：node make-catalog.mjs <pg_catalog.csv>'); process.exit(1); }
const t2s = OpenCC.Converter({ from: 'tw', to: 'cn' });

function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  return rows;
}

// 拼音 → 中文名（简体）。只收有把握的；查不到就显示拼音
const NAMES = {
  "Wu, Cheng'en": '吴承恩', 'Cao, Xueqin': '曹雪芹', 'Luo, Guanzhong': '罗贯中', "Shi, Nai'an": '施耐庵', 'Pu, Songling': '蒲松龄',
  'Wu, Jingzi': '吴敬梓', 'Lu, Xixing': '陆西星', 'Xiaoxiaosheng': '兰陵笑笑生', 'Li, Ruzhen': '李汝珍', 'Liu, E': '刘鹗',
  'Li, Boyuan': '李宝嘉', 'Wu, Jianren': '吴趼人', 'Zeng, Pu': '曾朴', 'Lu, Xun': '鲁迅', 'Confucius': '孔子', 'Mencius': '孟子',
  'Laozi': '老子', 'Liezi': '列子', 'Sunzi': '孙子', 'Guiguzi': '鬼谷子', 'Han, Fei': '韩非', 'Mo, Di': '墨子', 'Guan, Zhong': '管仲',
  'Shang, Yang': '商鞅', 'Sima, Qian': '司马迁', 'Ban, Gu': '班固', 'Chen, Shou': '陈寿', 'Zuoqiu, Ming': '左丘明', 'Liu, Xiang': '刘向',
  'Liu, An': '刘安', 'Dong, Zhongshu': '董仲舒', 'Wang, Chong': '王充', 'Jia, Yi': '贾谊', 'Yang, Xiong': '扬雄', 'Ge, Hong': '葛洪',
  'Gan, Bao': '干宝', 'Tao, Qian': '陶渊明', 'Liu, Yiqing': '刘义庆', 'Yan, Zhitui': '颜之推', 'Liu, Xie': '刘勰', 'Zhong, Rong': '钟嵘',
  'Cao, Zhi': '曹植', 'Xiao, Tong': '萧统', 'Guo, Pu': '郭璞', 'Li, Bai': '李白', 'Li, Shangyin': '李商隐', 'Li, He': '李贺',
  'Bai, Juyi': '白居易', 'Bai, Xingjian': '白行简', 'Yuan, Zhen': '元稹', 'Du, Guangting': '杜光庭', 'Su, Shi': '苏轼', 'Su, Xun': '苏洵',
  'Ouyang, Xiu': '欧阳修', 'Shen, Kuo': '沈括', 'Lu, You': '陆游', 'Xin, Qiji': '辛弃疾', 'Li, Qingzhao': '李清照', 'Fan, Chengda': '范成大',
  'Zhu, Xi': '朱熹', 'Meng, Yuanlao': '孟元老', 'Yue, Fei': '岳飞', 'Zhuge, Liang': '诸葛亮', 'Wang, Yangming': '王阳明',
  'Guan, Hanqing': '关汉卿', 'Wang, Shifu': '王实甫', 'Ma, Zhiyuan': '马致远', 'Tang, Xianzu': '汤显祖', 'Hong, Sheng': '洪昇',
  'Kong, Shangren': '孔尚任', 'Feng, Menglong': '冯梦龙', 'Ling, Mengchu': '凌濛初', 'Li, Yu': '李渔', 'Zhang, Dai': '张岱',
  'Zhang, Chao': '张潮', 'Yuan, Mei': '袁枚', 'Ji, Yun': '纪昀', 'Shen, Fu': '沈复', 'Wang, Shizhen': '王士祯', 'Gu, Yanwu': '顾炎武',
  'Huang, Zongxi': '黄宗羲', 'Dai, Zhen': '戴震', 'Zhao, Yi': '赵翼', 'Nalan, Xingde': '纳兰性德', 'Hong, Zicheng': '洪应明',
  'Lü, Kun': '吕坤', 'Wenkang': '文康', 'Shi, Yukun': '石玉昆', 'Yu, Wanchun': '俞万春', 'Chen, Chen': '陈忱', 'Song, Yingxing': '宋应星',
  'Xu, Hongzu': '徐弘祖', 'Wang, Guowei': '王国维', 'Su, Manshu': '苏曼殊', 'Yu, Dafu': '郁达夫', 'Zhu, Ziqing': '朱自清',
  'Han, Bangqing': '韩邦庆', 'Tianhuazangzhuren': '天花藏主人', 'Huineng': '慧能', 'Kumārajīva': '鸠摩罗什', 'Zhang, Zhongjing': '张仲景',
  'Langhuanshanqiao': '嫏嬛山樵', 'Ming Xuanzong, Emperor of China': '唐玄宗', 'Quyuan': '屈原', 'Yin, Xi': '尹喜',
  'Anonymous': '佚名', 'Unknown': '佚名', 'Various': '多人',
};
const authorOf = (field) => {
  const first = (field || '').split('; ')[0].replace(/\s*\[.*$/, '');
  const key = first.replace(/,\s*(active|approximately|jin shi|ju ren|pseud|\d|-|\?).*$/i, '').trim();
  if (NAMES[key]) return NAMES[key];
  const [sur, given] = key.split(', ');
  return given ? `${sur} ${given}` : key || '佚名';
};

// Gutenberg 的「Category」书架 → 我们的标签
const SHELF = {
  'Novels': '小说', 'Historical Novels': '历史演义', 'Mythology, Legends & Folklore': '神话志怪', 'Philosophy & Ethics': '诸子',
  'History - Other': '史书', 'History - Ancient': '史书', 'Essays, Letters & Speeches': '散文', 'Religion/Spirituality': '宗教',
  'Poetry': '诗词', 'Short Stories': '短篇', 'Romance': '言情', 'Politics': '政论', 'Plays/Films/Dramas': '戏曲',
};
const tagsOf = (shelves, subjects) => {
  const tags = new Set(['公版']);
  for (const s of shelves.split('; ')) { const t = SHELF[s.replace(/^Category: /, '')]; if (t) tags.add(t); }
  if (/drama|Opera/i.test(subjects)) tags.add('戏曲');
  if (/Military art/i.test(subjects)) tags.add('兵书');
  return [...tags].slice(0, 4);
};

// 名著一句话简介（其余书只有统一说明）
const BLURB = {
  23962: '唐僧师徒四人西天取经、一路降妖伏魔的神魔小说，四大名著之一。',
  24264: '以贾府兴衰和宝黛爱情为主线的世情长篇，四大名著之一。',
  23950: '从桃园结义到三分归晋，百年群雄逐鹿的历史演义，四大名著之一。',
  23863: '一百单八将聚义梁山泊的英雄传奇，四大名著之一。',
  51828: '借花妖狐鬼写人间世情的文言短篇集。',
  24032: '讽刺科举功名、写尽士林百态的章回小说。',
  23910: '武王伐纣、众仙斗法、姜子牙封神的神魔小说。',
  23818: '唐敖海外游历奇国、百位才女同登科的奇幻长篇。',
  23850: '晚清游医老残的一路见闻，四大谴责小说之一。',
  24138: '晚清官场群像的讽刺长卷，四大谴责小说之一。',
  23839: '孔子及其弟子的言行录，儒家经典。',
  7337: '老子五千言，道家开山之作。',
  24226: '纪传体通史之祖，「史家之绝唱，无韵之离骚」。',
  23864: '现存最早的兵书，十三篇。',
  23873: '中国最早的诗歌总集，三百零五篇。',
  27166: '鲁迅第一部小说集，收《狂人日记》《孔乙己》《阿Q正传》等。',
  25606: '陈寿撰、裴松之注的纪传体三国史。',
  52200: '明代世情长篇，借西门庆一家写市井百态。',
};

const rows = parseCSV(readFileSync(src, 'utf8'));
rows.shift();
let books = rows.filter(r => r[1] === 'Text' && r[4] === 'zh').map(r => {
  const n = +r[0], t = r[3].replace(/\s+/g, ' ').trim();
  return { n, t, s: t2s(t), a: t2s(authorOf(r[5])), tags: tagsOf(r[8] || '', r[6] || ''), issued: r[2], ...(BLURB[n] ? { d: BLURB[n] } : {}) };
});
// 分段（「粉妝樓11-20回」）有整本时去掉
const whole = new Set(books.map(b => b.t));
books = books.filter(b => { const m = b.t.match(/^(.*?)\s*\d+\s*-\s*\d+\s*回$/); return !(m && whole.has(m[1])); });
books.sort((a, b) => a.n - b.n);

// GITenberg（Gutenberg 在 GitHub 上的镜像，收到 2016 年前后）：有的书记下仓库名 gh 和 UTF-8 文本文件名 f。
// 应用里就能走 jsDelivr（带 CORS，国内有好几条线路），和 gutenberg.org 一起竞速。仓库名 = 书名里每个非字母数字换成 -，再接 _编号
async function mirrorOf(b) {
  const slug = `${b.t.replace(/[^A-Za-z0-9]/g, '-')}_${b.n}`;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(`https://data.jsdelivr.com/v1/packages/gh/GITenberg/${encodeURIComponent(slug)}@master?structure=flat`);
      if (res.status === 404) return null;
      const j = await res.json();
      const f = (j.files || []).find(x => x.name === `/${b.n}-0.txt`);
      return f ? { gh: slug, f: f.name.slice(1) } : null;
    } catch { await new Promise(r => setTimeout(r, 1000)); }
  }
  return null;
}
let done = 0;
const queue = [...books];
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let b; (b = queue.shift());) {
    Object.assign(b, await mirrorOf(b));
    if (++done % 50 === 0) console.log(`镜像 ${done}/${books.length}`);
  }
}));
console.log(`有 GITenberg 镜像：${books.filter(b => b.gh).length} 本`);

const out = fileURLToPath(new URL('./catalog.json', import.meta.url));
writeFileSync(out, JSON.stringify({ generatedAt: Date.now(), source: 'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv', books }));
console.log(`${books.length} 本 → ${out}`);
