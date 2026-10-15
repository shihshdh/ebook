// 探索页「漫画」先放的名作：大家都听过的那几十部，排在各源探索页随手给的东西前面（全部 + 各自的题材世界）。
// 只有书名，到时候去打开的漫画源里按名字搜（catalog.js）——哪个源有就用哪个，不绑死在某个源上。
//
//   title  搜的词，也是比对用的名字
//   alias  源里可能的别的写法（繁体、旧译名、英文），书名比对不分繁简，这里要写全
//   world  归哪个题材世界（lib/library.js 的 WORLDS：fantasy 奇幻 / campus 校园 / scifi 科幻 / romance 恋爱 / mystery 悬疑）
export const FAMOUS = [
  { title: '咒术回战', alias: ['咒術迴戰', '咒术回战'], world: 'fantasy' },
  { title: '东京喰种', alias: ['東京喰種', '东京食尸鬼', '東京食屍鬼'], world: 'mystery' },
  { title: '海贼王', alias: ['航海王', '海賊王', 'ONE PIECE'], world: 'fantasy' },
  { title: '鬼灭之刃', alias: ['鬼滅之刃'], world: 'fantasy' },
  { title: '进击的巨人', alias: ['進擊的巨人', '进击的巨人'], world: 'mystery' },
  { title: '电锯人', alias: ['鏈鋸人', '链锯人', '電鋸人'], world: 'fantasy' },
  { title: '间谍过家家', alias: ['間諜家家酒', 'SPY×FAMILY', 'SPYxFAMILY', '间谍家家酒'], world: 'romance' },
  { title: '火影忍者', alias: ['NARUTO'], world: 'fantasy' },
  { title: '名侦探柯南', alias: ['名偵探柯南'], world: 'mystery' },
  { title: '葬送的芙莉莲', alias: ['葬送的芙莉蓮', '葬送者芙莉莲'], world: 'fantasy' },
  { title: '我的英雄学院', alias: ['我的英雄學院'], world: 'campus' },
  { title: '一拳超人', alias: ['一拳超人', 'ONE PUNCH-MAN'], world: 'scifi' },
  { title: '死神', alias: ['BLEACH', '境·界'], world: 'fantasy' },
  { title: '排球少年', alias: ['排球少年!!', '排球少年！！'], world: 'campus' },
  { title: '我推的孩子', alias: ['【我推的孩子】'], world: 'mystery' },
  { title: '辉夜大小姐想让我告白', alias: ['輝夜姬想讓人告白', '辉夜大小姐想让我告白～天才们的恋爱头脑战～', '輝夜姬想讓人告白~天才們的戀愛頭腦戰~'], world: 'romance' },
  { title: '死亡笔记', alias: ['死亡筆記', 'DEATH NOTE'], world: 'mystery' },
  { title: '钢之炼金术师', alias: ['鋼之鍊金術師', '钢之炼金术士'], world: 'fantasy' },
  { title: '全职猎人', alias: ['獵人', 'HUNTER×HUNTER', '猎人'], world: 'fantasy' },
  { title: '龙珠', alias: ['七龍珠', '七龙珠', 'DRAGON BALL'], world: 'scifi' },
  { title: '灌篮高手', alias: ['灌籃高手', 'SLAM DUNK'], world: 'campus' },
  { title: '约定的梦幻岛', alias: ['約定的夢幻島'], world: 'mystery' },
  { title: '怪兽8号', alias: ['怪獸8號', '怪兽八号'], world: 'scifi' },
  { title: '迷宫饭', alias: ['迷宮飯'], world: 'fantasy' },
  { title: '蓝色监狱', alias: ['藍色監獄', 'BLUE LOCK'], world: 'campus' },
  { title: '东京复仇者', alias: ['東京卍復仇者', '东京卍复仇者', '東京復仇者'], world: 'scifi' },
  { title: '银魂', alias: ['銀魂'], world: 'scifi' },
  { title: '药屋少女的呢喃', alias: ['藥師少女的獨語', '药师少女的独语'], world: 'mystery' },
  { title: '擅长捉弄的高木同学', alias: ['擅長捉弄的高木同學', '擅长捉弄人的高木同学'], world: 'romance' },
  { title: '堀与宫村', alias: ['堀與宮村', '堀さんと宮村くん'], world: 'romance' },
  { title: '寄生兽', alias: ['寄生獸'], world: 'scifi' },
  { title: '夏日重现', alias: ['夏日重現', '夏日時光'], world: 'mystery' },
  { title: '石纪元', alias: ['Dr.STONE 新石紀', '石纪元', 'Dr.STONE'], world: 'scifi' },
  { title: '地狱乐', alias: ['地獄樂'], world: 'fantasy' },
  { title: 'JOJO的奇妙冒险', alias: ['JoJo的奇妙冒險', 'JOJO奇妙冒险'], world: 'fantasy' },
  { title: '文豪野犬', alias: ['文豪Stray Dogs'], world: 'mystery' },
  { title: '四月是你的谎言', alias: ['四月是你的謊言'], world: 'romance' },
  { title: '齐木楠雄的灾难', alias: ['齊木楠雄的災難'], world: 'campus' },
  { title: '月刊少女野崎君', alias: ['月刊少女野崎同學'], world: 'romance' },
  { title: '关于我转生变成史莱姆这档事', alias: ['關於我轉生變成史萊姆這檔事', '转生史莱姆'], world: 'fantasy' },
  { title: '无职转生', alias: ['無職轉生', '无职转生～到了异世界就拿出真本事～'], world: 'fantasy' },
  { title: '某科学的超电磁炮', alias: ['科學超電磁砲', '某科學的超電磁砲'], world: 'scifi' },
  { title: '好想告诉你', alias: ['好想告訴你', '只想告诉你'], world: 'campus' },
];

// 高分神作：口碑最好的那一批，放在漫画页最显眼的地方（ComicExplore 顶上的光盘架），书墙最前面也先放它们。
//   note  光盘下面那句推荐语（自己写的，不是源里的简介）
//   by    作者（中文名，显示用）；byRe 核对作者用——书名太常见的（「怪物」「乒乓」「冥王」）不核作者会认错书
//         （包子漫画里就有同名的国漫「冥王」「乒乓」「火鸟」）。写了 byRe 的，源里搜出来没写作者的也不收
//   q     搜的词（书名里带标点、太短的另给一个）
export const TOP_RATED = [
  { title: '血之辙', alias: ['血之轍', '血の轍'], by: '押见修造', byRe: /押[见見]/, world: 'mystery', note: '一个过分爱儿子的母亲，押见修造的心理恐怖代表作' },
  { title: '再见绘梨', alias: ['再見繪梨', 'さよなら絵梨', '再见了绘梨', '永别了绘梨', '告别绘梨'], by: '藤本树', world: 'campus', note: '用手机拍下的一部电影，分不清哪里是真、哪里是戏' },
  { title: '蓦然回首', alias: ['驀然回首', 'LOOK BACK', 'ルックバック'], by: '藤本树', world: 'campus', note: '两个一起画漫画的女孩，写给所有创作的人' },
  { title: '浪客行', alias: ['VAGABOND'], by: '井上雄彦', byRe: /井上/, world: 'fantasy', note: '井上雄彦画宫本武藏，水墨一样的画面' },
  { title: '怪物', alias: ['MONSTER', '怪物MONSTER'], q: 'MONSTER', by: '浦泽直树', byRe: /浦[泽沢澤]/, world: 'mystery', note: '天才外科医生救活的少年，长大后成了怪物' },
  { title: '冥王', alias: ['PLUTO', '冥王PLUTO', 'PLUTO冥王'], q: 'PLUTO', by: '浦泽直树', byRe: /浦[泽沢澤]|手[冢塚]/, world: 'scifi', note: '浦泽直树重写手冢治虫的《铁臂阿童木》' },
  { title: '20世纪少年', alias: ['20世紀少年', '二十世纪少年'], by: '浦泽直树', world: 'mystery', note: '儿时写下的「预言书」，一件一件成了真' },
  { title: '虫师', alias: ['蟲師', '虫師'], by: '漆原友纪', world: 'fantasy', note: '银古与「虫」，一个个安静的山野故事' },
  { title: '3月的狮子', alias: ['3月的獅子', '三月的狮子', '三月的獅子'], by: '羽海野千花', world: 'campus', note: '孤独的少年棋士，和川本家三姐妹的温暖' },
  { title: '少女终末旅行', alias: ['少女終末旅行'], by: 'つくみず', world: 'scifi', note: '文明熄灭之后，两个女孩在废墟里慢慢走' },
  { title: '地。关于地球的运动', alias: ['地。～关于地球的运动～', '地。-关于地球的运动-', '地。關於地球的運動', '地。～關於地球的運動～', 'チ。地球の運動について'], q: '地球的运动', by: '鱼丰', world: 'scifi', note: '为了地动说，一代代人把性命交了出去' },
  { title: '来自深渊', alias: ['來自深淵', 'メイドインアビス'], by: '土笔章人', world: 'fantasy', note: '可爱画风下，最残酷的一场深渊冒险' },
  { title: '晚安布布', alias: ['晚安，布布', 'おやすみプンプン'], by: '浅野一二〇', world: 'campus', note: '画成一只小鸟的少年，平凡又沉重的一生' },
  { title: '乒乓', alias: ['ピンポン', 'PING PONG', '乒乓pingpong', '乒乓PINGPONG'], by: '松本大洋', byRe: /松本/, world: 'campus', note: '松本大洋笔下的乒乓、天才和少年' },
  { title: '宝石之国', alias: ['寶石之國'], by: '市川春子', world: 'fantasy', note: '宝石做成的人们，在月人的掠夺里找寻自己' },
  { title: '剑风传奇', alias: ['劍風傳奇', '烙印战士', '烙印戰士', '烙印勇士', 'BERSERK'], q: '烙印战士', by: '三浦建太郎', byRe: /三浦/, world: 'fantasy', note: '黑暗奇幻的高峰，格斯与命运的抗争' },
  { title: '火之鸟', alias: ['火之鳥', '火鸟', '火鳥'], by: '手冢治虫', byRe: /手[冢塚]/, world: 'scifi', note: '手冢治虫的毕生之作，跨越古今的生命史诗' },
  { title: '恶之华', alias: ['惡之華', '恶之花'], by: '押见修造', byRe: /押[见見]/, world: 'campus', note: '偷走体操服的那一天起，青春滑向了深渊' },
  { title: '炎拳', alias: ['FIRE PUNCH'], by: '藤本树', world: 'fantasy', note: '永不熄灭的火焰与复仇，藤本树的第一部长篇' },
  { title: '海街diary', alias: ['海街日记', '海街日記', '海街DIARY'], by: '吉田秋生', world: 'romance', note: '镰仓老屋里，四姐妹的四季日常' },
  { title: '棋魂', alias: ['棋靈王', 'ヒカルの碁'], by: '小畑健', world: 'campus', note: '千年棋魂附身的小学生，走上围棋之路' },
  { title: '镖人', alias: ['鏢人'], by: '许先哲', world: 'fantasy', note: '大漠里的镖师，国漫武侠的高峰' },
];
