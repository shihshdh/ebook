# ASTRA 实施汇报

## R3-1 · nativeRequest —— 完成（2026-10-06）
- 文件：`src/lib/native.js`、`scripts/legado-test.mjs`。
- 做法：先审已有实现，保留独立 AbortController、整段请求超时和三端原始字节解码；补 base64 空白处理、Capacitor 自动解析 JSON 的兼容、无效编码逐级回退。
- 验证：`node scripts/legado-test.mjs`，23/23 通过；假 plugin-http / CapacitorHttp / fetch 覆盖 POST/请求头/请求体、GET、重定向最终地址、404 正文、参数→响应头→meta→UTF-8、网络失败、预中止/中途中止/读取正文超时。
- 已知限制：Capacitor 原生请求无法真正取消，Promise 及时拒绝且丢弃迟到结果；桥接已经解析的 JSON 无法恢复原始字节与排版。客户端实网验证按分工由 Claude 在 C6 做。本轮没有启动服务、打包或模拟器。

## R3-2 · Legado 规则层 —— 完成
- 文件：`src/plugins/legado/{index,rules,request,safety}.js`、`scripts/legado-test.mjs`、`scripts/fixtures/legado/rules.{html,json}`、package.json/package-lock.json（新增 linkedom 开发依赖）。
- 做法：逐条解析书源 JSON；请求选项和模板算式使用专用解析器；HTML 依赖 WebView DOMParser，Node 使用 linkedom；规则不联网、不执行任何书源脚本。
- 验证：`node scripts/legado-test.mjs`，累计 51/51 通过，覆盖任务书每种规则语法。`###` 语义为只取首个正则匹配，再应用替换。
- 支持：class/id/tag/text/children、正负下标和 ! 排除、CSS、text/ownText/textNodes/html/任意属性、正则替换和捕获组、JSONPath 子属性/递归属性/通配/下标、|| 首个有结果 / && 拼接 / %% 交叉合并、key/page 和数值四则模板、GET/POST JSON 选项段。
- 暂不支持：脚本、XPath、JSONPath 过滤/切片、变量存取、WebView/验证码/登录流程；最终完整兼容清单由 R3-4 补充。全局 npm 缓存报错，安装开发依赖时使用 `scripts/.npm-cache`，无运行服务或构建。

## R3-3 · 四步流程与分页 —— 完成
- 文件：`src/plugins/legado/index.js`、`scripts/legado-test.mjs`、`scripts/fixtures/legado/html-*`、`json-*`。
- 做法：固定签名的 search/bookInfo/toc/content；默认 nativeRequest，可注入假 http。相对地址以最终响应地址及合法 HTML base 解析；目录为空回退 bookUrl；目录/正文分页循环检测、目录章节去重、200 页硬上限、onPage 和 AbortSignal。
- 验证：`node scripts/legado-test.mjs` 累计 59/59；两个本地夹具站各跑完搜索→详情→两页目录→两页正文，另外测循环、重定向循环、中止和 200 页上限。
- 章节边界：使用同一 Source 对象调用 toc 后，content 遇到目录中的另一章即停；HTML 即使未先读目录，也识别“下一章 / next chapter”链接文字。无目录、无语义标记的 JSON 续页地址无法凭地址可靠判断章节归属，因此调用方应先取目录。无任何内置线上书源、无实网请求。

## R3-4 · GBK 关键词与 checkSource —— 完成
- 文件：`src/plugins/legado/encoding.js`、`request.js`、`rules.js`、`index.js`、`src/lib/native.js`、`scripts/legado-test.mjs`、`scripts/fixtures/legado/unsupported-source.json`。
- 做法：首次遇到非 ASCII 的 GBK 关键词才用 TextDecoder 扫描双字节区建反查表；GET 地址/POST body 都按请求 charset 编码；不支持字符明确报错，不偷偷换成 UTF-8。checkSource 对请求和四组规则逐字段检查，不执行任何脚本，对未实现能力保守返回 ok=false。
- 验证：`node scripts/legado-test.mjs`，最终 **74/74** 通过（本机约 0.4 秒）；包括凉宫 `%C1%B9%B9%AC`、西游记 `%CE%F7%D3%CE%BC%C7`、gb2312 别名、POST body、脚本拦截、错误语法、JSON 数组集合、Tauri signal 传播、meta 的 2KB 边界。没有启动开发服务、桌面进程、Gradle 或模拟器；R3-5 本次未执行。

### C6 接入约定及兼容清单（最终）

入口为 `src/plugins/legado/index.js`，导出任务书规定的 `parseSources / checkSource / search / bookInfo / toc / content`，签名未变。先 parseSources 保留逐条错误，再 checkSource 给出 unsupported；通过后使用同一 Source 对象完成四步。默认 HTTP 使用 nativeRequest，单测全部注入本地夹具；HTTP 的 4xx/5xx 保留正文。

**支持**：
- 书源：单对象/对象数组、UTF-8 BOM、坏条目隔离；Legado 3.x 的四组规则对象。
- 请求：HTTP(S)、GET/POST、自定义头与头覆盖、字符串 body、charset 选项；`{{key}}`、`{{page}}`、page/数字的 `+ - * / %` 及括号；只有专用数值解析器，不使用 eval/Function。
- 关键词：UTF-8、GBK（兼容 gb2312/cp936/ms936 名称）；中文反查表只初始化一次，不能编码的字符报错。响应解码可使用 TextDecoder 支持的编码。
- HTML：`class.x.0@tag.a.-1@href`、id/tag/text/children、单个正/负下标、`!0` 排除；`@css:` 标准 CSS 选择器；`@text / @ownText / @textNodes / @html / @href / @src / @content / @任意属性`。text 选择器匹配元素自身的直接文本；正文保留段落换行并排除 script/style。
- 正则：`##正则##替换##`、捕获组 `$1` 等；末尾 `###` 取第一个匹配并替换；replaceRegex 可逐行列多条替换。使用 JavaScript RegExp 语法。
- JSON：`@json:` 或 `$` 开头的属性路径、`$..属性`、`[*]`、`[0]`、引号键名；搜索/目录/正文的集合规则也接受直接返回数组。
- 合并：`||` 首个非空、`&&` 按顺序拼接、`%%` 交叉拼接；可对合并后的结果统一加正则替换。引号或选择器括号中的合并符不会误拆。
- 四步：相对/协议相对地址、最终响应 URL、HTML base；目录章节去重与 onPage；目录和正文 200 页上限、循环/重定向循环停止、signal 中止；正文应用 replaceRegex。

**不支持 / 接入时需要提示**：
- `<js>`、`@js:`、`java.*` 一律不执行；XPath、@put/@get 变量、纯正则提取模式、Java 专有正则、JSONPath 过滤/切片、跨规则变量、复杂 JS 模板算式。
- WebView 执行、登录/验证码、发现规则、动态 JS 页面、解密字体、书源自带 JS 库和未实现的四组规则字段；checkSource 会列出这些字段。组合表达式里的各分支分别带正则替换暂不属于支持子集，应先合并再统一替换。
- checkSource 只能验证语法和必要字段，不能保证目标网页仍匹配；实网、Cookie/Referer 权限和 C6 UI 接入由 Claude 验证。
- 目录章界缓存在同一 Source 对象上：先 toc 再 content；没有目录也没有“下一章”语义标记的 JSON 接口无法可靠判断未知地址是否跨章。
- Capacitor 无真正取消 API，只及时拒绝 Promise 并丢弃迟到结果；自动解析的 JSON 无法复原原始字节/格式。正文 200 页截断后返回已取得部分，当前接口没有额外截断状态。
- Node 单测需要 Node 22.15+（registerHooks）和 devDependency linkedom；linkedom 未被应用模块导入，不进入客户端包。

## 任务 1 · 阅读器 —— 完成
- 文件：`src/pages/Reader.jsx`、`src/styles/reader.css`、`src/reader/txt.js`。
- 做法要点：EPUB/TXT 共用 epub.js；TXT 按章卷回节切章，UTF-8 失败后用 GB18030 解码，生成内存 EPUB。沉浸工具栏、目录、书签、四主题、字体/字号/行距、滚动/翻页、iframe 内触控与键盘、位置恢复、500ms 防抖保存；主题修改不重建 rendition，模式切换保留 CFI。
- 验证：esbuild 独立打包通过；内存 TXT EPUB 的目录切章、XML 转义、ZIP 结构检查通过。全应用与浏览器联调待 Claude 完成路由后补做。
- 已知问题 / 需要 Claude 配合的：使用 default export 挂载 `/read/:id`；百分比约定为 0–1。暂无新增依赖。尚未在真机测试触控。

## 任务 2 · ⑥ 书页之河 —— 部分完成（代码完成，等待页面接入验收）
- 文件：`src/effects/PageRiver.jsx`、`src/effects/PageRiver.css`。
- 做法要点：动态加载 Three.js，5000/3500/1800 个 InstancedMesh 薄纸页；暖灯、雾、纸色分层、斥力翻滚、弹簧回位；父元素输入监听避免遮挡英雄区链接；触控松开回灯；离屏/后台停帧、尺寸变化防抖、完整资源释放，低画质和减少动态使用静态 CSS。
- 验证：接入首页后，在 5180 的 1440 宽视口移动指针查看暖灯和空洞；390 宽触屏默认低档应显示静态纸页，可切均衡档测试拖动台灯。
- 已知问题 / 需要 Claude 配合的：父元素需 position:relative 和实际高度；截至本次汇报 App.jsx 尚未存在，因此尚未完成完整页面的双宽度验收。

## 任务 3 · ④ Prism 玻璃折射 —— 完成（组件验收）
- 文件：`src/effects/PrismGlass.jsx`、`src/effects/PrismGlass.css`；共用验收入口 `src/reader/verify.html`、`verify.jsx`、`verify-browser.cjs`。
- 做法要点：直接移植 GlassInvite 的八片内缩倒角多边形、transmission/IOR/dispersion 材质、PMREM 环境和倾斜/抬升逻辑；仅深色调色板，字体用 --serif，字体加载后重画；HTML children 固定不倾斜；触屏/低档/减少动态使用静态版；离屏、后台、收敛停帧。
- 验证：独立入口 `/src/reader/verify.html` 在 1440 和 390 宽度均通过 Playwright；搜索框能输入，390 触屏为静态版。截图在 `src/reader/.verify/prism-1440.png` 和 `prism-390.png`。
- 补充任务 1 验证：同轮完成 TXT 目录、键盘翻页、书签、纸白主题/楷体/字号、模式切换、刷新进度恢复；修复分栏 iframe 点击坐标。双宽度截图 `reader-1440.png` / `reader-390.png`。
- 已知问题 / 需要 Claude 配合的：完整应用 5180 的接入验收继续补充；任务 4 发现终端 java 不在 PATH，已找到 Android Studio JBR 21，正在定位 SDK。

## R5 · 2026-10-07（本地静态检查 / 夹具单测）
- 统一口径：4 个 JSON 文件，parseSources 接受 852 条；按应用 fatalOf 判断必经规则，三类互斥（能过 / 要脚本 / 规则不认识），原因计数可重叠；linkedom 不支持 XPath，相关规则保守归入未知，静态通过不等于网站可访问。基线 266 / 491 / 95，与任务书 851 条的旧口径不同。只读用户目录，不联网、不执行脚本、不构建、不提交。
- R5-1 完成：独立数据解析器支持单引号、裸键、尾逗号、裸 Mozilla/5.0 UA；拒绝表达式和坏 JSON；81/81 单测通过。静态 266 / 491 / 95 → 279 / 495 / 78（选项解析通过后暴露出脚本依赖的条目会转入要脚本）。
- R5-2 完成：整段正则白名单将移除 cookie 片段替换为空，将取源地址片段替换为书源 URL；其余表达式仍拒绝，流程透传源地址；83/83 单测通过。静态 279 / 495 / 78 → 298 / 475 / 79。
- R5-3 完成：put 纯数据规则映射、后缀 / &&、get 字面插值；搜索条目→书籍地址→目录→各章继承独立变量快照，按书源对象和书籍流程隔离，章节并发也不串值；新增 JSON 四步夹具，两源两书并发验证，86/86 单测通过。静态 298 / 475 / 79 → 299 / 475 / 78；不少含变量的源仍依赖明确拒绝的脚本。变量为当前会话内存态，刷新后需要重新搜索 / 从详情初始化。
- R5-4 完成：方括号闭区间（含末项）、省略边界、负下标 / 步长、点号后冒号下标列表、排除列表及 @css :eq(n)；注意 span.3:7:-1 取第 3、7、末项，td.5:4 取第 5、4 项，不把点号写法误当切片。rules.html 增加可复验元素；89/89 单测通过。静态 299 / 475 / 78 → 301 / 475 / 76。
- R5-5 完成：scripts/legado-check-dir.mjs 递归只读 JSON，按应用 fatalOf 输出能过 / 要脚本 / 规则不认识与各类原因，支持 --json，跳过订阅源、隔离坏文件 / 条目。收尾补了 :eq 属性字面量、get 格式和模板空格回归；93/93 单测通过（本轮新增 14 条）。本项静态 301 / 475 / 76 → 301 / 475 / 76；全轮 266 / 491 / 95 → 301 / 475 / 76（净增 35 条能过）。4 文件接受 852 条书源，另跳过 2589 条订阅源、27 条导入错误；逐阶段数字存于 scripts/legado-r5-summary.json。复验：在项目根目录执行 node scripts/legado-test.mjs，再执行 node scripts/legado-check-dir.mjs "C:\Users\ys221\Desktop\书源"（可加 --json）。未修改 src/lib/legado.js 的 FATAL 或 Claude 的文件；未联网、未执行书源脚本、未构建、未 commit / push。遗留：脚本 / webView / 无搜索地址仍不支持；Node XPath 校验受限；变量只在当前源对象的内存流程中保留，未持久化。

## 默认书源 · 2026-10-07
- 按用户确认的口径：使用桌面目录中静态检查通过的源；301 条候选排除 11 条带 Cookie / 授权头 / URL 凭据的规则，按规范化站点 URL 去重后内置 247 个。生成器 scripts/legado-bundle-defaults.mjs 可重复生成 src/plugins/legado/default-sources.js；生成过程只读本地文件，不联网、不执行规则脚本。包中不伪造 test.ok 或实测时间。
- src/lib/legado.js 首次读取时懒加载内置包，按账户写入 legado:sources 与安装标记；旧列表优先，同站点不重复插入，用户停用、实测记录、删除均保留。删除后重启不补回，新账户各自初始化。并发首次读取复用一个 Promise；数据库读取失败不覆盖旧数据，初始化中断可重试；保存成功才更新内存。FATAL 判断未改。
- src/components/LegadoSources.jsx 与 src/plugins/booksource/index.js 仅同步默认源说明及内置标识；页面布局、RSS、性能文件未动。默认包通过动态 import 随前端产物携带，首次列源时加载，原有搜索 / 下载流程自动使用。
- 验证：node scripts/legado-defaults-test.mjs 为 11/11，node scripts/legado-test.mjs 为 93/93，共 104 条全绿；git diff --check 通过。默认源是静态兼容，未联网验证站点；遵照之前的低负载要求未启动服务、未构建 APK / 桌面安装包，未 commit / push。复验应用：新账户进入书源页应自动出现 247 个启用源，停用或删除后重开仍保持用户设置。

## 成人源过滤与 Windows 安装 · 2026-10-07
- 0.3.9 先剔除了 11 条成人书源规则，内置源由 247 减为 236，补了旧书源清理和重新导入拦截，Windows 包已构建并安装到 D:\EBOOK，桌面快捷方式保留。用户截图指出订阅页仍有 R18 / 18X：此前遗漏独立的 legado:rss 数据，不能把书源过滤当成整个应用已过滤。
- 0.3.10 修复订阅存储入口：启动时过滤并持久化旧 RSS 列表，导入时同样拦截；source-policy 兼容订阅字段和已知改名域名；订阅页重置已经失效的分组选择。普通影视、资讯、言情、百合、耽美不会仅因题材被删除。只读桌面合集审计：2589 条订阅源中匹配过滤 288 条（其中 R18 分组 135、18X 分组 41；这是文件内计数，不是用户数据库计数）。
- 单测：默认源 / 成人过滤 / RSS 迁移与导入拦截 15/15，规则引擎 93/93，共 108 条通过。0.3.10 Windows 前端构建通过；正在生成并安装 NSIS 修复包。
- 0.3.10 安装完成：D:\EBOOK\EBOOK.exe 的 ProductVersion=0.3.10；已按 Tauri NSIS 包类型标记核验完整程序 SHA256，桌面 EBOOK.lnk 指向该程序。桌面安装包 EBOOK_0.3.10_x64-setup.exe，SHA256=087CA87A62401A722CC519E9E6D06C9E4BC3F92ADB9EE133D134404A4839DC98。启动应用读取账户书源 / 订阅列表时执行旧数据清理；未直接访问用户站点或执行源脚本，未 commit / push。
