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
