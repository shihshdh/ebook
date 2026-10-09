// 规则认不出来、人工看过的站点（2026-10-09 审桌面「书源」合集：4 个文件，852 个书源 + 2589 个订阅源）。
// 只看名字、网址和规则，没有打开这些网站。子域名一并算。
export const ADULT_HOSTS = [
  'acepro.store', 'ikanhm.top', 'mxshm.top', 'huihuihm.com', 'manxiangge.xyz', 'my7cbr0rec5oxddnd63ihceb.xyz', 'llss.at',
  'xn--wcsr8yy8y.xyz', 'zhangzisi.com', 'nutaku.net', 'iwara.tv', 'mzitu.com', 'alicesw.com', 'asiantolick.com', 'asiansister.com',
  'meiyuns.com', 'jinglingdu.com', 'kindgirls.com', 'chaojiflsous4.xyz', 'yxy003.com', 'yxy005.com', 'xiu.no', 'hywm4.top',
  'ikmjx.com', 'ruanmeizishe.com', 'qssqapptg5.com', 'yazhouseba.co', 'sewen.info', 'sewenwang.com', 'mb4.cms10demo.com',
  '4kep.com', '4khd.com', 'bjjiaoche6.buzz', '51papaya.com', 'gaohbook.net', '3pxs.sbs', 'dkman.icu', '95mm.tv', 'mh3618.com',
  'nicesss.com', 'sxchinesegirlz.one', 'mc18.cc', 'jk.rs', 'hlg425.cc', 'bqngveqi.cc', 'blog.reimu.net', 'bymt6.buzz',
  'soav.buzz', 'paipancon.com', 'maa1814.com', 'h-webtoon.com', 'sspwk.me', 'manwa.fun', 'meimodao.com', 'meimoai1.com',
  'meimoai8.com', 'sexyai.top', 'galgamezs.com', 'ceq9.com', 'longtenghuaxia.com', 'uaa004.com', 'tuao8.xyz', 'tuaox.cc',
  'xiaocaozipai1.xyz', 'eyushuwu.vip', '18jjsw.com', '9yydstxt178.com', 'po18uu.com', 'po18sf.com', 'rouwenwu19.com',
  'ltxs520.net', 'esjzone.one', 'esjzone.cc', 'esjzone.me',
  // 改了名、名字里看不出来的成人站
  'haitangshuwu.info', 'haitangwx.com', 'yuzhaiwen.com', 'popofree.com',
];
// 书源：不是书站
export const NOT_BOOK_HOSTS = ['52pojie.cn', 'gexingshuo.com', 'iqiyi.com'];
// 订阅：影音、图片、软件下载、网盘、导航工具、阅读 App 的配套、生活杂项
export const NOT_READING_HOSTS = [
  // 影音
  'huajiaozy.com', 'u.boosj.com', 'music.163.com', '64ma.com', 'bilibili.com', 'pptv.com', 'kan.sogou.com', '360kan.com',
  '1905.com', 'ting55.com', 'missevan.com', 'ciyuans.com', 'itingwa.com', 'ting456.com', 'tingsm.com', 'ximalaya.com',
  'tvbts.com', 'kanjubar.com', 'janz.plus', 'ifish.fun', 'fm.music.xiaomi.com', 'kaiyanapp.com', 'yxgapp.com', 'v.qq.com',
  '61ertong.com',
  // 图片
  'huaban.com', 'gank.io', 'dimtown.com', 'ciyuandao.com', 'bcy.net', 'qingniantuzhai.com', 'bohaishibei.com', 'bh.sb',
  'ltfc.net', 'zuimeia.com', 'draft.art', 'imgbb.com', 'biacgn.com', 'wallpaper.pandora.xiaomi.com', 'qiman6.com',
  // 软件、网盘、导航、工具
  '423down.com', 'coolapk.com', 'lanzoux.com', 'lanzoui.com', 'jianguoyun.com', 'yxssp.com', 'lieyou888.com', 'acy.moe',
  'zku.net', 'huluxia.com', 'adzhp.cn', 'ahhhhfs.com', 'link3.cc', 'youquhome.com', 'xiangjianan.gitee.io', 'lks.helloxjn.com',
  'liumingye.github.io', 'dajidaoban.com', 'bookmarkearth.com', 'crdh.cc', 'jigdh.com', '192link.com', 'shadiao.pro',
  'dalao.ru', 'wangdaxing.com', 'inisqw.gitee.io', 'dalaoha.github.io', 'files.catbox.moe', 'cadzxw.com', 'tinywow.com',
  'tool.lu', 'qinggongju.com', 'lkssite.vip', 'qqxiuzi.cn', 'doubao.com', 'metaso.cn', 'xibuluo.com', 'muyv.saop.cc',
  'linux.do', 'aiplay5.streamlit.app', 'app.cn', 'hj.app', 'ccav.mobi', 'kd.clkd.xyz', 'yaozuopan.top', 'am.22.cn',
  'haorenka.org', 'haokawx.lot-ml.com', 'spmoves.com', 'h.17yy.com', 'xbgame.net', 'gamersky.com', 'bbs.oh27.com',
  'bbs.zhanzhangwo.com', 'bbs.leyuz.net', 'lishushuai.gitee.io', 'yuque.com', 'flowus.cn', 'cmd.im',
  // 阅读 App 的论坛、书源站
  'legado.cn', 'legado.cc', 'legado.git.llc', 'cysbbs.xyz', 'miaogongzi.site', 'miaogongzi.cc', 'readbbs.com',
  'jietiandi.net', 'loyc.xyz', 'fqphp.gxom.cn', 'skybook.pages.dev', '5yd.cc', 'iszoc.com',
  // 生活杂项
  'dog126.com', 'cnniao.com', 'chongwumao.com.cn', 'meishij.net', 'haodou.com', 'izhangchu.com', 'xiangha.com', 'cf555.com',
  'xiachufang.com', 'xinshipu.com', 'baotang5.com', 'meishichina.com', 'meishi13.com', 'yanyu5.com', 'sxlxgssp.com',
  'haicent.com', 'jiuhuar.com', 'xmqmnet.com', 'kcjq.com', '1tiaolu.com', 'yyjingyan.com', 'youboy.com', '1688.com',
  'fs.aipingxiang.com', '91baby.com',
];
// 没有网址可认的，按名字
export const NOT_READING_NAMES = [
  'Container', 'Misakassr', '模特分类', '推图网', '鲸落呀', '更多的高级搜索', '林允儿吧', '孙允珠吧', 'QQ阅读背景', '风吹订阅',
  '一程浮力', '晋江醉心', '醉心源', '聚合2.0', '书架~让你看出', '洛娅橙', 'Engels', 'zuiaila', '我的不常用源链接', '浮园',
  '夸克搜索', 'GitHub Action', '其他网站', '阅读酷', '源文件转源', '摸鱼日历', '失效', '私', 'RSS',
];
// 来路不明：站名和域名对不上（借来的域名）、网址是裸 IP、或者备注说网站换了主人
export const SUSPECT_HOSTS = [
  'elkoparts.net', 'dlbeauty.cn', 'ec-soccer.com', 'x9wang.com', 'yuanjinwu.xyz', 'buai.ga', 'c-zzy.com', '233335.xyz',
  'yitxt.com', 'hjgzf.com', 'daiqq.cc', 'furrynovel.com', 'furrynovel.ink', 'furrynovel.xyz', '45.13.93.91',
];
