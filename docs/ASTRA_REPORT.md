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

## 第十轮 · 2026-10-15

### R7-1 · 安卓漫画源验收（构建通过，设备验收受阻）

- 在 `librarium-ios` / `feat/comic-sources` 执行；未触碰另一工作区或 5181 / 9223 服务。
- `npm run android:build` 首次因 SDK 路径未配置失败；仅设置当前进程 `JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`、`ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk` 后重跑，Vite 和 Gradle 成功（134 tasks）。APK：`android/app/build/outputs/apk/debug/app-debug.apk`，SHA256 `1312E91BF3E42DB1DF5A2497A4CDE18984BE517C2CD8A6AE64892A7330416E14`。
- `adb devices` 无设备，`emulator -list-avds` 无 AVD；SDK 无 command-line tools / system-images，WHPX 可用。尝试从 Google 官方下载命令行工具：代理下载 240 秒仅数 MB，直连 20 秒只收到 647396 字节后超时，未取得可解压工具，未能创建 API 34 Google APIs x86_64 AVD。
- **未验收**：未安装 / 启动 APK，未执行沙箱内探测、插件「测一遍」、探索 / 搜索 / 条漫 / 翻页。因此没有探测输出、实测结果表或截图；不能用 Node 或桌面结果替代安卓结果。
- 新增 `scripts/comic-mobile-probe.mjs`，`node --check` 通过。设备就绪后：安装上述 APK，打开插件页任意漫画源设置；取得 App PID，执行 `adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>`，再运行 `node scripts/comic-mobile-probe.mjs`。脚本只选择 localhost App 中 about:srcdoc 的默认执行上下文，输出 frame/context 与 androidBridge、Capacitor、webkit、fetch、XHR、IndexedDB 原文；未找到子 frame 会失败，不会回退到主 frame。
- 静态风险（不是动态结论）：Capacitor 6 `MessageHandler.java` 在现代 WEB_MESSAGE_LISTENER 路径检查 isMainFrame，但旧 WebView / legacy 模式 / listener 注册异常时会回退 addJavascriptInterface，可能把 androidBridge 暴露给子 frame。API 34 通过也不能覆盖旧 WebView；需要后续 fail-closed 策略与旧设备复验，本轮未擅改依赖。
- 安卓同步生成文件仅出现换行差异，无语义改动。没有改 src、版本、依赖声明，没有 commit / push / 发版。

### R7-2 · iPhone 原生桥（代码完成；待 macOS 编译 / 真机验收）

- 修改 `ios/App/App/EbookNative.swift`：新增 MainFrameBridgeHandler，所有消息先检查 `message.frameInfo.isMainFrame`；子 frame 直接丢弃，主 frame 原样转发原有 WebViewDelegationHandler。弱引用 delegate，避免 WKUserContentController → wrapper → delegate → contentController 循环。
- 复用已有 CAPBridgeViewController 子类 EbookViewController。Main.storyboard 本来已指定这个类及 App 模块，EbookNative.swift 本来已加入 Xcode Sources，因此无需改 storyboard / pbxproj。保留原有 EbookNative 注册、滚动配置和沉浸模式。
- 核对本地 Capacitor 6 源码：CAPBridgeProtocol 没有 webViewDelegationHandler，故使用 `bridge as? CapacitorBridge`；具体类公开该属性，delegate 的 userContentController(_:didReceive:) 为 open。loadView 创建桥后调用 capacitorDidLoad，viewDidLoad 才开始加载页面，在网页执行前替换 handler。若无法取得桥 / WebView，fatalError 阻止不安全页面加载。
- `node scripts/ios-platform-test.mjs`：7/7；新增 `node --test scripts/ios-comic-bridge-test.mjs`：3/3（storyboard / target 集成、Capacitor API 与初始化顺序、主 frame guard / 弱引用）。这些是静态检查，不是 Swift 编译或 WKWebView 动态安全证明；本机没有 Swift / Xcode。
- 后续 CI：获得用户推送许可后再执行；现有 `.github/workflows/ios.yml` push 仅匹配 codex/ios-personal，不自动匹配 feat/comic-sources，需在已推送且包含 workflow 的 ref 上 workflow_dispatch。现有流程运行平台检查、构建 unsigned IPA、启动 iPhone 模拟器；不会自动做以下沙箱探测。本轮未推送或触发 CI，也未改 workflow。
- iPhone 验收步骤：先跑新增静态检查；模拟器启动 App，验证正常主页面原生网络、触感、文件导入和沉浸模式；插件页展开漫画源设置，在 Safari Web Inspector 选择该 about:srcdoc 子 frame（不是顶层）。记录 typeof androidBridge / Capacitor / webkit；运行 fetch('https://example.com')、XHR GET 同址、indexedDB.open('x')，应被 CSP / opaque origin 拦截。iOS 的 webkit.messageHandlers.bridge **可能仍可见**，关键是 native 丢弃调用，不能以 typeof 判定安全。
- 在子 frame 直接调用 `webkit.messageHandlers.bridge.postMessage({type:'message',callbackId:'r7-child',pluginId:'CapacitorHttp',methodName:'request',options:{url:'https://example.com',method:'GET'}})`；用 Xcode breakpoint 确认包装器收到 isMainFrame=false 后返回，原 delegate / HTTP 插件未进入、无原生请求、无 callback。再在主 frame 调用 `Capacitor.Plugins.CapacitorHttp.request({url:'https://example.com',method:'GET'})`，确认原 delegate 及正常回调仍工作。对 same-origin iframe、sandbox iframe、页面刷新后各重复；保留原始日志和 390 宽截图。CI smoke 成功本身不能代替这一步。

### R7-3 · 默认漫画源体检（完成）

- 新增 `scripts/comic-defaults-check.mjs`：只读内置包、main 索引和固定提交索引；以 key + fileName 匹配，避免同 key 多账号变体误判；数字版本区分新版 / 回退，非数字版本标记人工复核；新增源只列名字，不下载 / 安装 / 改白名单。
- 必须读取固定提交的完整索引，才能区分“上游新加”与“早已存在但未内置 / 未通过白名单”的源；索引读取失败时标记未知，不误报删除。
- 实际调用 `node scripts/comic-test.mjs --live --bundled --all` 一次，保留原始 stdout。沿用原测试器 4 个源 worker、每源顺序搜索→详情→第一话→第一张图，不全量抓图。命令行工具 curl 读取索引（尊重本机 HTTPS_PROXY），子进程有 15 分钟上限；线上失败返回 1，索引 / 子进程 / 缺失结果错误返回 2，全部通过返回 0。原测试器线上失败也会返回 0，因此不能只看其退出码。
- 实测发现 JSON 解析错误会带换行，已修复报告解析器并用保存的原始输出离线重放，18/18 正确解析；没有为修复报告再次请求网站。新增 `scripts/comic-defaults-check-test.mjs`，4/4 通过（重复 key、非内置旧源、失败解析、数字版本、多行错误）。
- 结果：固定提交 e28e134074308c0006408272639a53b9af9ce9da；main 无新增、删除或版本变化。21 内置源，18 公网源实测 10 通过 / 8 失败；3 自建源跳过。夹具测试 10/10。完整报告保存为 `docs/ASTRA_COMIC_DEFAULTS_R7.md`，下面贴同份报告。

### 协作发现与本轮文件清单

- **交给 Claude 的 iOS 接入点**：本轮末尾只读核对 `src/comic/runtime/sandbox.js`，发现当前 `unsafeBridge` 对任何 `webkit.messageHandlers` 都拒绝运行。R7-2 包装器拦截调用但不隐藏对象，因此 iOS 漫画源仍可能被前端拒绝启动。需要 Claude 在保持旧版本 fail-closed 的前提下设计原生防护能力识别，且不能信任不可信源自己设置的全局标记；未改 src。
- 同一工作区有 Claude 的并行修改（包括新增的沙箱原生桥拒绝逻辑和 legado-test 变更），均保留。此轮构建 APK 对应构建时快照，后续 src 变化未重新打入，不将后续 Node 结果冒充 APK 验收。
- 本轮手工修改：`ios/App/App/EbookNative.swift`、`docs/ASTRA_REPORT.md`。
- 本轮新增：`scripts/comic-mobile-probe.mjs`、`scripts/ios-comic-bridge-test.mjs`、`scripts/comic-defaults-check.mjs`、`scripts/comic-defaults-check-test.mjs`、`docs/ASTRA_COMIC_DEFAULTS_R7.md`。
- 构建生成：dist 与 android 内忽略的网页资产 / debug APK；安卓两个 Capacitor Gradle 文件仅换行状态、无内容 diff。Google 工具下载最终 240 秒超时（10414514 / 154957218 bytes），本轮下载的临时文件已清理，没有安装不完整 SDK 工具。
- `git diff --check` 通过。结束时 5181 / 9223 仍在监听。未改禁止文件、版本号、另一工作区；未提交、推送、发布或触发 CI。

### R7-3 报告原文

# 默认漫画源体检

时间：2026-10-15T07:25:55.901Z；内置提交：`e28e134074308c0006408272639a53b9af9ce9da`。

上游：[venera-configs main index](https://github.com/venera-app/venera-configs/blob/main/index.json)。版本比较仅基于索引版本号；不表示代码内容相同。

索引：main 与固定提交索引均读取成功。

| 源 | 内置版本 | 最新版本 | 实测结果 | 失败原因 |
|---|---|---|---|---|
| 拷贝漫画 | 1.4.2 | 1.4.2 | 通过：搜到 21，400 话，第一话 209 张，图 332KB (9.7s) | — |
| Komiic | 1.0.3 | 1.0.3 | 通过：搜到 3，228 话，第一话 210 张，图 182KB (6.4s) | — |
| 包子漫画 | 1.1.6 | 1.1.6 | 失败 (4.7s) | 章节：Invalid status code: 403 |
| MangaDex | 1.2.0 | 1.2.0 | 通过：搜到 10，34 话，第一话 36 张，图 1009KB (19.6s) | — |
| 优酷漫画 | 1.0.0 | 1.0.0 | 通过：搜到 4，2 话，第一话 139 张，图 208KB (8.9s) | — |
| 漫画柜 | 1.2.1 | 1.2.1 | 通过：搜到 10，649 话，第一话 23 张，图 191KB (9.9s) | — |
| CCC追漫台 | 1.0.1 | 1.0.1 | 通过：搜到 20，52 话，第一话 19 张，图 154KB (9.3s) | — |
| GoDa漫画 | 1.2.1 | 1.2.1 | 通过：搜到 18，4 话，第一话 45 张，图 180KB (8.6s) | — |
| 漫画人 | 1.0.0 | 1.0.0 | 通过：搜到 22，4 话，第一话 180 张，图 333KB (1.0s) | — |
| MYCOMIC | 1.1.0 | 1.1.0 | 失败 (0.9s) | 搜索：Cloudflare 验证拦截：请在漫画源设置中点击「登录」，通过内置浏览器完成一次 Cloudflare 验证后即可正常使用。 |
| 爱看漫 | 1.0.6 | 1.0.6 | 失败 (5.6s) | 搜索：搜不到 |
| 少年ジャンプ＋ | 1.1.1 | 1.1.1 | 失败 (4.2s) | 搜索：Unexpected token '&lt;', "&lt;html&gt; &lt;h"... is not valid JSON |
| comick | 1.2.0 | 1.2.0 | 通过：搜到 50，2548 话，第一话 51 张，图 37KB (65.1s) | — |
| 再漫画 | 1.0.2 | 1.0.2 | 失败 (0.3s) | 详情：漫画不存在或已被删除 |
| Lanraragi | 1.1.0 | 1.1.0 | 跳过：自建服务器 | — |
| Komga | 1.0.0 | 1.0.0 | 跳过：自建服务器 | — |
| カドコミ | 1.0.1 | 1.0.1 | 失败 (0.3s) | 装载：Client network socket disconnected before secure TLS connection was es |
| 漫画1234 | 1.0.0 | 1.0.0 | 失败 (5.4s) | 搜索：Cannot read properties of null (reading 'attributes') |
| 热辣漫画 | 1.0.0 | 1.0.0 | 通过：搜到 20，400 话，第一话 209 张，图 332KB (11.5s) | — |
| Kavita | 1.0.0 | 1.0.0 | 跳过：自建服务器 | — |
| 嗨皮漫画 | 1.0.0 | 1.0.0 | 失败 (0.3s) | 搜索：Client network socket disconnected before secure TLS connection was es |

相对固定提交新增（仅列名字，是否收录仍由 policy.js 白名单人工审核）：无。

相对固定提交删除：无。

实测：10 通过、8 失败、0 缺失；自建服务器按原测试器规则跳过。

测试子进程退出码：0；正常结束。注意原测试器即使线上源失败也可能返回 0，本脚本按逐源结果判断。

## 实测原始输出

    ✓ 装载：元信息、搜索选项默认值、设置快照
    ✓ 搜索：HTML 解析（GBK 网页）、cookie、浏览器 UA（首字母大写）
    ✓ 详情：表单请求体、分组章节、标签
    ✓ 章节：hmac 签名、AES-CBC 不去填充、源自己的 UA、设置改了立即生效
    ✓ 图片：onImageLoad 的请求头、onResponse 解密
    ✓ 设置：换域名、回调按钮
    ✓ Convert 和 Node 的 crypto 对得上
    ✓ 原生桥：Tauri 的删掉，iOS / 旧安卓的拒绝运行
    ✓ 网址检查：本机和局域网不许
    ✓ 白名单：成人站、没审过的不收

    10/10 通过

    真实源（随包附带 @e28e1340，18 个）：
      ✗ 包子漫画         章节：Invalid status code: 403  (4.7s)
      ✓ CCC追漫台       搜到 20，52 话，第一话 19 张，图 154KB  (9.3s)
      ✗ カドコミ         装载：Client network socket disconnected before secure TLS connection was es  (0.3s)
      ✓ comick       搜到 50，2548 话，第一话 51 张，图 37KB  (65.1s)
      ✓ 拷贝漫画         搜到 21，400 话，第一话 209 张，图 332KB  (9.7s)
      ✓ GoDa漫画       搜到 18，4 话，第一话 45 张，图 180KB  (8.6s)
      ✗ 嗨皮漫画         搜索：Client network socket disconnected before secure TLS connection was es  (0.3s)
      ✓ 热辣漫画         搜到 20，400 话，第一话 209 张，图 332KB  (11.5s)
      ✗ 爱看漫          搜索：搜不到  (5.6s)
      ✓ Komiic       搜到 3，228 话，第一话 210 张，图 182KB  (6.4s)
      ✓ MangaDex     搜到 10，34 话，第一话 36 张，图 1009KB  (19.6s)
      ✓ 漫画柜          搜到 10，649 话，第一话 23 张，图 191KB  (9.9s)
      ✓ 漫画人          搜到 22，4 话，第一话 180 张，图 333KB  (1.0s)
      ✗ 漫画1234       搜索：Cannot read properties of null (reading 'attributes')  (5.4s)
      ✗ MYCOMIC      搜索：Cloudflare 验证拦截：请在漫画源设置中点击「登录」，通过内置浏览器完成一次 Cloudflare 验证后即可正常使用。  (0.9s)
      ✗ 少年ジャンプ＋      搜索：Unexpected token '<', "<html>
    <h"... is not valid JSON  (4.2s)
      ✓ 优酷漫画         搜到 4，2 话，第一话 139 张，图 208KB  (8.9s)
      ✗ 再漫画          详情：漫画不存在或已被删除  (0.3s)
      能用 10 / 18

## 第十一轮 · 2026-10-15（ASTRA 做到一半额度用完，Claude 接手收尾）

ASTRA 在 Codex 额度用完前完成了 R8-1、R8-2 的代码和 R8-3 ①②，没来得及写报告、跑真实源的书架往返和 iPhone 尺寸的其余页面。以下由 Claude 核对、补测、补完。

### R8-3 ①② · iPhone 放行（完成，待 CI）
- `ios/App/App/EbookNative.swift`：在 R7-2 的主 frame 包装之外，`capacitorDidLoad` 再加一个 `WKUserScript`（`.atDocumentStart`、`forMainFrameOnly: true`）：`window.__EBOOK_BRIDGE_GUARD__ = 'main-frame'`。
- `src/comic/sources.js`：`comicSupported = isNative && (!isIOS || window.__EBOOK_BRIDGE_GUARD__ === 'main-frame')`；`src/comic/runtime/host.js` 把这个值作为 `env.bridgeGuard` 传给沙箱；`sandbox.js` 的检查移到 boot 里、源脚本求值之前：有 `androidBridge` 一律拒绝，`webkit.messageHandlers` 只在没有 guard 时拒绝。
- `scripts/comic-test.mjs` 新增一条（有 guard 放行、安卓仍拒绝），现在 12/12。

### R8-1 · 漫画阅读器和小说同一套（完成）
- `LiquidTabs`、`Clock`、`swipeDir` 抽到 `src/reader/chrome.jsx`，`Reader.jsx` 只改 import；`ComicReader.jsx` 照 Reader.jsx 的 DOM / 类名重写（`reader2`、`rd-top`、`rd-deskbar` / `rd-dock`、`rd-panel`、`rd-ribbon`、`rd-ambient`…），五个面板：目录、进度、书签、阅读方式、纸张。
- 对照截图（同一位置，漫画 / 小说，电脑 / 390 宽）：`docs/screenshots/comic/r8-{comic,novel}-{toolbar,toc,marks,mode,theme}-{desktop,mobile}.png`。
- Claude 在真实源（GoDa 漫画《葬送的芙莉莲》）上复测：底部常驻「本话 第 7 / 39 张 · 还剩 32 张」+ 时钟；方向键翻页；Esc 退出。

### R8-2 · 漫画加入书架（完成）
- `src/lib/shelf.js` 新增 `addShelfMetadata`（漫画条目不带 blob）；`src/comic/shelf.js`：`ensureComicShelf`（加入时封面经源取到、缩成 360 宽 JPEG data URL 存下）、`comicShelfProgress`、`persistComicProgress`；详情里「加入书架 / 已在书架」，开始看自动加入；`OpenTransition` 漫画跳 `readPath`；书架「漫画」角标、「漫画书签」区；账户导出 / 导入漫画条目直接写回书架。
- Claude 补：书架卡片、书架「继续阅读」、首页「接着读」、书架顶上的文件夹标签，漫画的进度按话说（「看到 第1话 第 7 张」），作者那行写「作者 · 漫画源」——之前是「佚名 · 1 KB」「读到 0%」（98 话的漫画看了 7 张，百分比是 0.18%）。`src/comic/book.js` 的 `comicWhere` / `comicByline`。
- 真实源往返（Windows 客户端，默认账户）：搜索 → 详情「加入书架」→ 已在书架，封面已存 → 读到第 7 张 → 书架显示「GoDa漫画 / 看到 第1话 第 7 张」→ 从书架点开接着第 7 张。

### R8-3 ③ · iPhone 界面（完成，模拟）
- Windows 客户端里用 CDP 模拟 iPhone（390×844、iPhone UA、只给主 frame 注入 guard、安全区 47 / 34）：`ui-mobile platform-ios` 生效，探索页漫画标签（世界 + 书墙 + 最近在看 + 液态玻璃标签栏）、详情（iOS 底部抽屉，章节按钮最小 44px）、搜索（漫画和小说混排）、插件页漫画源，都没有横向溢出，没有脚本异常。截图 `docs/screenshots/comic/r8-ios-{explore-top,explore-wall,sheet,sheet-chapters,search,plugins}.png`。
- 这是模拟，不是真机：WKWebView 的真实行为（原生桥包装、触感、安全区）要靠 CI 产出的 IPA 在模拟器 / 真机上验。

### R8-3 ④ · iOS CI（停点，等用户同意）
- `.github/workflows/ios.yml` 有 `workflow_dispatch`：提交 → `git push -u origin feat/comic-sources` → `gh workflow run ios.yml --ref feat/comic-sources`。流程：`npm ci`、`ios-platform-test`、`npm run ios:build`（无签名 IPA）、`scripts/smoke-ios.sh`（模拟器冒烟），产物 `EBOOK-iOS-unsigned` / `EBOOK-iOS-smoke`。
- 拿到 IPA 后按 R7-2 报告的步骤在模拟器验子 frame 调不动原生桥。

### R8-4 · 安卓验收（阻塞）
- 命令行工具、系统镜像从 Google 下载超时（R7-1），本轮没再试。需要用户在 Android Studio 的 SDK Manager 里装一个 API 34 x86_64 镜像，或者换一台有模拟器 / 真机的环境。

### 收尾检查
- `npm run build` 通过；`node scripts/comic-test.mjs` 12/12；`node scripts/legado-test.mjs` 96/96；`node --test scripts/ios-comic-bridge-test.mjs` 4/4。
- 未提交、未推送。

## 第十三轮 · 2026-10-17 · R10 应用图标重新设计

- 三个原创两色几何方案：松绿翻页、陶红书签、紫色漫画分格；选定松绿翻页，去除夜读、金色描边和字母。
- 三套 1024 原图、iOS/Android 蒙版与 Windows 32/16px 对比见 [ICON_R10.md](ICON_R10.md)。
- 正式 SVG、favicon、Android 五密度/自适应安全区、Tauri PNG/ICO/ICNS/Appx、iOS 图标均已生成，底色常量同步。
- 69 项图标输出检查通过，npm run build 通过；仅在 librarium-icon 的 feat/new-icon 本地提交，不推送、不合并、不发版。


## 第十四轮 · 2026-10-17（漫画阅读器流畅度和出图速度）

工作区仅 librarium-reader，分支 feat/comic-reader-perf；原版提交为 776eb27（R11 任务书提交，阅读器未改）。未启动桌面客户端，未推送、未合并、未发版。

### 测法与可复现条件

在 EBOOK_API34 / Android 14 的实际 debug APK / WebView Chrome 113 上，通过 adb 9333 CDP 驱动；390×844、DPR 3、触屏、CPU 降速 4 倍、SwiftShader。固定自托管测试源使用既有 Komga 私网许可，经过真实源沙箱、原生 HTTP、防盗链配置/正文取图路径。两话各 40 张固定 2400×3400 JPEG（960066 字节），图片服务每请求等待 80ms，章节列表等待 160ms，禁用 HTTP 缓存。源只写在模拟器测试数据里，不修改/安装生产源代码。

每个版本 scroll / page 各跑三轮，所有数字逐项取中位数。条漫以真实触屏滑动加固定下一页边界定位，翻页以方向键连续过 30 张；这不是自由滚动的固定 12 秒场景，不能与任务书中旧桌面模拟数字直接相减。首图从进入第一话到 DOM img 有 naturalWidth，轮询 40ms；这是图片就绪代理指标，并非屏幕光学首绘。换话从下一话操作到新话图片就绪。rAF 记录帧间隔；>33.4ms 阈值沿用 measure-app.mjs；longtask 阻塞合计为 sum(max(duration−50,0))。每轮单独录 CPU 自身采样，记录 JS heap、DOM counters 和 URL 驻留数。性能运行时没有并发构建或跑其他测试。

先量 baseline，再逐项改/测；首图波动较大，因此最后额外恢复原版跑 baseline-confirm，再恢复最终源码跑 final。两次原版结果都保留，不删除初始较好的首图数字。原版和最终源码 SHA-256 在 scripts/perf/results/source-hashes.json。纯全分辨率噪声图的最初试跑体积 4.3MB、严重放大桥接传输，已废弃；不混入以下比较。

### 改前 / 改后（三轮中位数）

| 版本 | 模式 | 首图 ms | 换话 ms | p95 ms | p99 ms | 最长帧 ms | >33.4ms 帧 | 最长长任务 ms | 阻塞合计 ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | scroll | 1339 | 1384 | 50 | 166.7 | 350 | 49 | 376 | 2523 |
| baseline | page | 1316 | 1493 | 66.7 | 100 | 100 | 40 | 116 | 1247 |
| baseline-confirm | scroll | 2599 | 2223 | 33.3 | 300 | 783.3 | 47 | 750 | 7785 |
| baseline-confirm | page | 2423 | 3367 | 283.3 | 316.7 | 316.7 | 60 | 323 | 6945 |
| final | scroll | 2013 | 1182 | 33.3 | 66.7 | 166.7 | 38 | 87 | 123 |
| final | page | 1934 | 1542 | 16.7 | 33.3 | 66.7 | 6 | 58 | 11 |


相对最初 baseline，最终版条漫 p95 50→33.3ms、p99 166.7→66.7ms、阻塞 2523→123ms；翻页 p95 66.7→16.7ms、p99 100→33.3ms、阻塞 1247→11ms。条漫仍有 >33.4ms 帧，不能据此宣称完全无掉帧。

首图总时间不能报成稳定提升：最初 baseline 是 1339/1316ms，最终是 2013/1934ms，反而更慢；随后的原版复核是 2599/2423ms。最后相邻原版/最终版对照中，首图降至 2013/1934ms，换话 2223→1182ms、3367→1542ms，但源启动/调度存在明显轮间波动。能稳定定位到的收益是请求发出后的取图转换段（含固定网络等待）：

| 复核版本 | 模式 | 请求发出→图片就绪 ms |
|---|---|---:|
| baseline-confirm | scroll | 1337 |
| baseline-confirm | page | 1241 |
| final | scroll | 345 |
| final | page | 328 |


### 每项修改的测量与撤回

| 实验（均为两模式各三轮） | 调整与取舍 |
|---|---|
| step1-android-bytes | 安卓正文图片用预分配 Uint8Array + 有界循环替代每字节回调；预取转换分块让出主线程。翻页 p95 66.7→16.7ms、阻塞 1247→0ms，保留；条漫首图退化继续处理。 |
| step2-decode | 屏外图先 load / decode，再提交宽高和占位，DOM img 使用 async decoding。条漫 p95 50→33.3ms；翻页额外 decode 等待使首图 1201→2308ms，此部分随后撤回。 |
| step3-window-priority | 图片生命周期改成有界窗口，当前图先取、近页观察器不抢冷启动，远页迟到结果丢弃；翻页撤掉额外 decode 等待。第31张 URL 25→8；保留。 |
| step4-visible-first | 当前图直接提交 async img，仅屏外图准备解码；避免可见图等屏外准备路径。条漫长任务阻塞 211→124ms，首图仍有波动。 |
| step5-current-bytes | pageURL 的 front 传到正文转换层；当前图快速连续转换，预取继续让出主线程。该阶段换话中位数 scroll 1119ms、page 736ms；最后在原版/最终版对照中确认转换段收益。 |
| step6-open-parallel（撤回） | 试过详情/进度并行读、书架写入不阻塞图片。首图无稳定收益（scroll 1742→2033ms），不保留；书架/进度原有先后关系恢复。 |


完整逐项数字含 p95/p99/最长帧/长任务/内存，在 [summary.md](../scripts/perf/results/summary.md)；原始三轮、CPU 函数采样、每十页 DOM/heap 检查点分别在 scripts/perf/results/ 的同名 JSON。共九组有效版本数据、每组六轮，未将半途试跑计入。

CPU 采样：最初原版逐字节转换回调自身耗时中位数 scroll 2822ms、page 2056ms（index-DebORF4z.js:68，对应 nativeRequest 的 Uint8Array.from(atob(...), callback)）；原版复核约 6740/6336ms。最终正文转换 helper 约 655/544ms。主要优化依据是每字节 JS 回调与临时对象造成的主线程/GC 开销；浏览器内部 (program) 仍占相当比例，不把它误归因于某个未采样到的 React 函数。

### 内存与 iOS 单独处理

| 版本 | 模式 | JS heap 前→后 MiB | 第 11 / 21 / 31 张 Blob URL 数 |
|---|---|---|---|
| baseline | scroll | 37.6→58.7 | 15 / 24 / 24 |
| baseline | page | 38.2→75.8 | 15 / 25 / 25 |
| baseline-confirm | scroll | 36→75.7 | 15 / 25 / 25 |
| baseline-confirm | page | 37.1→75.6 | 15 / 25 / 25 |
| final | scroll | 27.5→63.8 | 7 / 8 / 8 |
| final | page | 28.4→63 | 8 / 8 / 8 |


URL 驻留量明显下降，JS heap 仍受 GC 时机影响；JS heap 不等于图片解码内存或整个 WebView RSS，因此不声称这些数字证明 iOS 不会白屏。安卓 window 为当前页前后最多 4 张（顺读通常当前+前4+后3=8张），iOS 前后最多2张、向后预取1张；observer 同样受窗口约束，远页完成时再检查距离并 revoke，离章/退出时中止并释放。卸掉图片后保留已知宽高比占位。

WKWebView 分支：不走新的 Android Capacitor base64 适配器，保留 sandbox.http；屏外图 decode() 拒绝时使用已 load 的图片，避免永久占位；当前图直接 async 上屏；取消检查使用基础 aborted 属性。没有依赖 content-visibility 来实现图片回收，支持目标包含 iOS 15；WebKit 是 [Safari 18 才新增 content-visibility](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/)。没有引入额外 bitmap/canvas 大图副本；本轮仍显示原始分辨率图片，未新增下一话图片预取。

iOS 验证范围仅为单元测试的 iOS 传输分支，以及安卓 WebView 中 iPhone UA + 人为 decode 拒绝的策略分支回归（能出图、连续翻页后最多5个驻留 URL）。本机未运行真正的 WKWebView / iOS 真机，真实内存压力、WebKit 解码和白屏恢复仍待 iOS 真机验证；安卓数字不能当 iOS 性能结论。

### 回归、范围与复跑

- npm run build：通过；npm run android:build：最终 debug APK 构建通过。
- node scripts/comic-test.mjs：13/13 通过。
- node scripts/perf/reader-image-test.mjs android / ios：通过。覆盖原始字节、front、源解密回调、Referer、压缩头、状态/非图片、私网策略和取消。
- node scripts/perf/reader-regression.mjs：17项通过。漫画/小说实际触屏翻页、两套五类面板、漫画书签、React 委托 wheel/touchstart/touchmove 为 passive、退出前漫画 URL 全部释放，以及 iOS 模拟分支。小说夹具走真实 TXT→EPUB 引擎；未改共享 chrome.jsx。
- 产品文件仅 src/pages/ComicReader.jsx、src/comic/images.js、src/comic/library.js。library.js 只在 pageURL 内传递 front 一个参数，其他缓存、源和翻译逻辑未动，便于与 Claude 的其他 library.js 修改合并。其余为 scripts/perf 测量/回归和本报告、PROGRESS。
- 回归工具初版的 CDP 文档注入/会话触屏设置和夹具转义问题已修正后重跑；最终通过记录是 scripts/perf/results/regression.json，没有把脚本错误计成产品通过。
- 复跑：设置 JAVA_HOME 和 ANDROID_HOME，启动 EBOOK_API34，npm run android:build，然后 node scripts/perf/comic-reader-android.mjs <label> 3；对照工具 node scripts/perf/recheck-reader.mjs 776eb27 会备份/恢复当前三个源码文件、分别构建原版/当前版，仅用于干净且已保存的 reader 工作区。
- 测完已移除 9333/9461 转发、adb emu kill 关闭模拟器、gradlew.bat --stop 停止1个 daemon；未打开桌面客户端。仅本地提交 feat/comic-reader-perf，不推送、不合并、不发版。

完成

## 第十五轮 · 2026-10-17 · R12 陶红书签开屏

- 两个方向：书签轻提 / 书页展开，正式选择轻提；均为 1400ms，降低动态为 500ms，可点按/任意键跳过，会话只播一次。逐帧和切换方法见 [SPLASH_R12.md](SPLASH_R12.md)。
- Android / iOS / 网页首帧统一 #B64E38 纯色交接，网页书签淡入，移除旧夜读视觉和 worker，不再等待字体。原生仅静态检查。
- 浏览器 5190、390×844 验证浅/深/跟随系统、跳过及会话行为通过；npm run build 通过。
- 4× CPU 整页 rAF 检查未通过 33ms 门槛（最大 830–1093ms，DOM 清理 1.77–1.87s）；CSS 视觉时间线 1.4s，合成帧/真机仍待验。不越界修改首页加载。
- 仅 feat/new-splash 本地提交；不推送、不合并、不发版，未开桌面客户端。
## 第九轮接续 · 2026-10-18 · 漫画源扩充

- 接续 Claude 未提交改动：21 → 38 个源，默认开启 10 → 24；历史直连样本探索第一页去重 415 → 834（非完整书库）。新增 17 个站点，社区修复版本替换 3 个原有源。
- 2026-10-18 离线兼容 13/13，生产构建通过；网站结果复用 2026-10-17 保存的 JSON，未冒称今天全量重测。
- 报告 docs/ASTRA_COMIC_SOURCES_R9.md 汇总直连/代理、封面、探索和收录情况。包子仍有封面 403 例外。
- 接入缺口：sources.js 不处理包版本升级、since/replaces 和社区更新路径，旧账户不会自动新增；依任务书不改该文件。主分支接入后才可发版。
- 仅源分支整理，未合并、未推送、未发布。

## 0.4.1 三端接续 · 2026-10-18

- 用户授权完成 Windows / Android / iPhone 并发布 Release。漫画源包已接入主工作区；旧账户自动补入新源，迁移7项通过。
- 详情页提前取即将阅读的一张正文图（支持继续阅读页码），最多2张、每张4MB、保留60秒；阅读器消费Blob并各自创建/释放URL。失败可重试、取消及时返回；3项缓存回归通过。
- 书目JSON/CSV整理移到模块Worker；主线程与Worker共用纯URL构造器，保持平台候选区别；与旧实现逐字段一致和实际Worker共4项回归通过。不可用时退回同步路径。
- 手机底栏用ResizeObserver初始化，避免React首次提交时强制全页布局；读取尺寸在写样式之前完成。
- 图标69项复验，修复Tauri生成Android副本的透明边和前景不一致，生成流程自动同步。
- 开屏保持陶红书签、1400ms、跳过和减少动态设置。启动优化尚不能宣称整页4倍降速无超过33ms的帧；严格区分主线程rAF与合成线程视觉。
- 三端候选构建/实际交互、实网漫画加载和Release附件验收继续执行，发布清单只在三端附件齐备后更新。

### 0.4.1 解码与验收补充

- 安卓 API34 / WebView113 实测发现主线程 atob 和逐字节循环仍占用明显，新增图片解码 Worker，ArrayBuffer 直接转移，旧 WebView 保留分块回退；2项真实 Worker 字节一致性回归通过。
- 同机4倍降速、2400×3400约960KB固定图、80ms图请求，首轮条漫p95 83.3→33.3ms（原首轮混有模拟器冷启动，不能当纯解码收益）；翻页p95 33.3→16.7ms，主线程循环/atob从采样热点消失。当前版条漫最长100ms、翻页50ms，仍不能宣称全程无长帧。
- 双阅读器17项回归通过。首次iOS CI的build/冒烟通过；巡检深色报告实际返回浅色，原脚本把“脚本执行成功”当“页面通过”，已改成检查真实出图、章节、阅读器和主题结果并使失败退出。
