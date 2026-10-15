# 漫画源

分支 `feat/comic-sources`。这份文档写清楚：漫画源从哪来、怎么在 EBOOK 里安全地跑、界面接在哪、现在做到哪、还有什么要在真机上验。
进度看板见 `docs/PROGRESS.md` 第 91–99 行；ASTRA 这一轮的任务书是 `docs/ASTRA_TASKS_R7.md`。

## 一句话

**直接用 Venera 的漫画源（JS 脚本），在 App 里放一个沙箱跑；漫画和轻小说用同一套界面。**

- 源脚本原样用、不改一行：EBOOK 实现 Venera 宿主那一侧的 `sendMessage`（HTML 解析、加解密、存档、网络），在 `src/comic/runtime/sandbox.js`。
- 白名单里的 21 个源随包附带，首次使用自动装上，默认开 10 个（Windows 客户端「测一遍」通过的）。
- 探索页多一个「漫画」小标签：和轻小说同样的五个世界和书墙，所有源混在一起，界面上不写源的名字。
- 搜索页：漫画和轻小说在同一个搜索池里，一起搜、一起列。
- 漫画详情用同一个详情面板，章节列表代替下载；阅读器支持条漫 / 翻页 / 从右往左。
- 和文字书源的关系：Legado 引擎「只认规则，不执行脚本」的原则不变；漫画源是另一套，脚本只在隔离的沙箱里执行。

### 为什么不用别的路

| 路线 | 不选的原因 |
|---|---|
| Legado 漫画规则（bookSourceType 2） | 大多数靠 `@js:` 解密图片地址，现有引擎不执行脚本；能纯规则跑的很少 |
| Mangayomi / Kotatsu / Mihon 扩展 | Mangayomi 扩展库、Kotatsu parsers 都已归档；Mihon（keiyoushi）是 Kotlin APK，只能当逆向参考 |
| 自己写几个内置源 | 漫画站域名、加密改得勤，跟不上；Venera 社区一直在维护 |
| QuickJS（WASM）跑源 | 隔离更彻底，但 DOM 解析、画布都要自己实现，iOS 15 也没有 OffscreenCanvas |

## 源

| 仓库 | 状态（2026-10-15） | 用法 |
|---|---|---|
| [venera-app/venera-configs](https://github.com/venera-app/venera-configs) | 活跃（10-05 还在更新），33 个源 | 默认源从这里打包（固定提交 `e28e1340`）；「检查更新」「更多源」也从这里拉 |
| [WEP-56/EZvenera-config](https://github.com/WEP-56/EZvenera-config) | 活跃（10-13），同一套接口 | 插件页「更多源」可以切过去挑 |
| venera-app/venera（主程序） | 2026-04 已归档 | 宿主行为照它 1.6 版的 `lib/foundation/js_engine.dart` 抄 |

**许可证**：两个仓库都没有写许可证。按用户的决定，白名单里的源随包附带（`src/comic/default-sources.js`），同默认书源的做法；知道这有被要求下架的风险（同类的书源合集仓库 shidahuilang/shuyuan 已被 GitHub 以违反服务条款封禁）。

**白名单**（`src/comic/policy.js`）：只收一般向。Venera 的索引里约三分之一是成人站，现有的成人判断（`source-policy.js`）按名字只挡得住其中 4 个，所以用白名单：名单外的（包括索引以后新加的）一律不显示、不打包。

**默认开哪些**：拷贝漫画、Komiic、包子漫画（预设域名 webmota.com，默认的 bzmgcn.com 已失效）、MangaDex、优酷漫画、漫画柜、CCC 追漫台、GoDa 漫画、漫画人、MYCOMIC。
其余 7 个（爱看漫、少年ジャンプ＋、comick、再漫画、カドコミ、漫画1234、嗨皮漫画）是在这台电脑上测不通的（地区、网络），默认关着、标 `autoOff`——用户在自己的网络下点「测一遍」，通过的会自动打开（同书源）。热辣漫画和拷贝漫画同一个后台，默认关；Komga / Kavita / LANraragi 要填自己的服务器，默认关。

更新默认源：`node scripts/comic-bundle-defaults.mjs <新提交>`，再跑 `node scripts/comic-test.mjs --live --bundled`，看结果改脚本里的 `ENABLED`。

## 架构

```
源脚本 + _venera_.js ─┐
                       ├─ 沙箱 iframe（sandbox="allow-scripts"，和 App 不同源；CSP default-src 'none'）
sandbox.js（兼容层）──┘    html→DOMParser  convert→crypto-js  存档→内存 + 回写  http→交给主页面
            │ postMessage（出来的只有：http 请求、存档、日志、提示）
            ▼
host.js（主页面）── checkUrl（拦本机 / 局域网）── nativeRequest raw（Tauri reqwest / 安卓 OkHttp）
            ▼
sources.js 源管理    library.js 搜 / 详情 / 章节 / 取图 / 进度    catalog.js 探索页书单    book.js 漫画 → Book
            ▼
探索页「漫画」标签（ComicExplore）  搜索池（pool.js）  详情面板（BookSheet → ComicSheetBody）  阅读器（ComicReader）
```

| 文件 | 做什么 |
|---|---|
| `src/comic/runtime/sandbox.js` | 沙箱里的兼容层。构建时连同 crypto-js 打成一段 41KB 的 IIFE（`vite.config.js` 的 `?inline-script` 插件），写进 iframe 的 srcdoc |
| `src/comic/runtime/host.js` | 主页面侧：每个源一个 iframe，按 `event.source` 分发消息，替沙箱发请求，认出 Cloudflare 人机验证 |
| `src/comic/sources.js` | 源管理：首次使用装默认源、从仓库装 / 更新、开关、设置、存档、沙箱生命周期（最多同时 6 个，正在用的不关）、「测一遍」（自动开关） |
| `src/comic/library.js` | 搜漫画（各源并发 4）、详情和章节（这次运行里缓存）、取图（正文图和封面各排各的队）、阅读进度 |
| `src/comic/catalog.js` | 探索页书单：「全部」= 各源探索页第一页交错合并；五个世界 = 各源分类名对得上的那个（奇幻 ← 奇幻/魔幻/玄幻/异世界…）；同名合成一条 |
| `src/comic/book.js` | 漫画 → 详情面板、搜索池、封面用的 Book（`source: 'comic'`，`comics` 列着在哪几个源里有）。轻，首屏包里 |
| `src/comic/policy.js` | 白名单、`checkUrl` |
| `src/comic/images.js` | 按 `onImageLoad` 给的请求头取图，`onResponse` 解密，按文件头认图片 |
| `src/comic/default-sources.js` | 随包附带的源（生成的，不要手改；首次使用时按需加载一次） |
| `src/components/ComicExplore.jsx` | 探索页「漫画」标签：WorldSwitch + MasonryWall + 最近在看 |
| `src/components/ComicSheetBody.jsx` | 详情面板里漫画那一截：换源（当前源没章节自动换下一个）、继续看、章节 |
| `src/pages/ComicReader.jsx` | 阅读器，路由 `/read/comic/:源/:漫画/:第几话` |
| `src/components/ComicSources.jsx` | 插件页「漫画源」：更多源、检查更新、测一遍、开关、源自己的设置 |
| 改动的老文件 | `lib/native.js`（`nativeRequest` 加 `raw`）、`lib/pool.js`（漫画进搜索池）、`lib/covers.js`（漫画封面经沙箱取）、`lib/idb.js` / `lib/accountIO.js`（`comic:*` 跟账户走、备份带上）、`pages/Search.jsx`、`pages/Explore.jsx`、`components/BookSheet.jsx`、`effects/WorldSwitch.jsx`（`unit` 参数）、`App.jsx`（阅读器路由）、`pages/Plugins.jsx` |
| `scripts/comic-test.mjs`、`scripts/comic-bundle-defaults.mjs`、`scripts/fixtures/comic/` | 回归测试、生成默认源 |

### 存储

当前账户 IndexedDB 的 kv：`comic:sources`（装好的源，连脚本）、`comic:defaults`（装过的内置包版本）、`comic:runtime:<仓库>`（`_venera_.js`）、`comic:data:<源>`（源自己存的：设置、设备号、cookie）、`comic:progress`（最近在看，最多 200 本）。都跟账户走，账户备份带上。

### 和 Venera 对齐的细节（踩过的）

- 设置的默认值在装载源时就定下：源在运行时改 `this.settings`（拷贝漫画会这么做）不影响 `loadSetting`。用户改的设置存在 `data.settings`。
- AES-ECB/CBC/CFB/OFB 按块直接处理，**不加不去填充**（源自己去，如 ccc.js）；输入不是整块、RSA 等不支持的转换返回 `null` 并记日志。
- `chapters` 没给 = 整本一卷（`loadEp` 的 epId 传 `null`）；给了个空的 = 没有章节可看。
- 源没写 UA 就加浏览器 UA，**名字首字母大写**：包子漫画的章节接口对小写的 `user-agent:` 回 Cloudflare 人机验证（403）。
- 搜索选项默认值：`default` 字段，没有就取第一项的值（`"value-label"` 取 `-` 前面），多选是 `"[]"`。
- `_venera_.js` 和源脚本要放在**同一次** eval 里，两边的 `class` / `let` 才在一个作用域。
- 探索页四种写法（multiPartPage、singlePageWithMultiPart、multiPageComicList、mixed）、分类的三种写法（字符串 + categoryParams、`{ label, target }`、dynamic 的 `loader()`）都统一成 `[{ title, comics }]` / `{ label, category, param }`。

## 安全

源脚本是网上下来的代码，按不可信处理：

- iframe 只给 `allow-scripts`，没有 `allow-same-origin`：源是 `null`，读不到 App 的 IndexedDB、localStorage、cookie。
- srcdoc 的 CSP `default-src 'none'`：脚本自己发不出请求，网络只能走 postMessage 交给主页面。
- 主页面替它发请求前过 `checkUrl`：只许 http(s)，本机和局域网一律拒绝（防止脚本扫路由器、NAS）；Komga / Kavita / LANraragi 例外。
- 源要求「打开网页」（`UI.launchUrl`）不执行，只弹提示。
- **原生桥**：WebView 会把原生桥注入到子 frame。沙箱启动时先看清楚：
  - **Windows（已实测，2026-10-15）**：沙箱里有 `__TAURI_INTERNALS__`、`ipc`、`chrome.webview`。从沙箱调 `toggle_maximize` 不生效，同一条从主页面调生效（对照）；沙箱里 XHR 访问公网、`ipc://localhost`、局域网全被 CSP 拦。`chrome.webview`（真正的传输通道）删掉；`__TAURI_INTERNALS__`、`ipc` 被 Tauri 定义成只读，删不掉，也调不通。
  - **iPhone**：WKWebView 的 `messageHandlers` 在所有 frame 都能用，Capacitor 6 收消息不看是不是主 frame（安卓查了）。所以 EBOOK 自己在原生侧把 `bridge` 消息处理换成只认主 frame 的包装（`ios/App/App/EbookNative.swift`，R7-2），并且只往主 frame 注入 `window.__EBOOK_BRIDGE_GUARD__ = 'main-frame'`。前端看到这个标记才在 iPhone 上开放漫画（`comicSupported`），并把它传给沙箱；沙箱只在有标记时放行 `webkit.messageHandlers`（标记由主页面在源脚本求值前传入，源脚本改不了）。没装这层防护的旧版本照旧不开放。**待 CI 构建后在模拟器验收**（R8-3 ④）。
  - **安卓**：Capacitor 6 用 WebMessageListener，只认主 frame、只注入到 App 自己的源；系统 WebView 太旧时退回 `addJavascriptInterface`（所有 frame 都有 `androidBridge`）→ 沙箱里看到 `androidBridge` 就拒绝运行。真机验收是 ASTRA R7-1。
- 网页版用不了（漫画站不给 CORS 头），只有客户端能用。

## 实测（Windows 客户端，2026-10-15，这台电脑走 Clash）

插件页「测一遍」（搜索 → 打开第一本 → 第一话 → 第一张图）：

| 源 | 结果 |
|---|---|
| 拷贝漫画 | 「海贼王」400 话，第一话 209 张 |
| Komiic | 「ONE PIECE航海王」228 话，第一话 210 张 |
| 包子漫画（webmota.com） | 「航海王」1187 话，第一话 20 张 |
| MangaDex | 「葬送的芙莉蓮」34 话，第一话 36 张 |
| 漫画柜 | 「ONE PIECE航海王」649 话，第一话 23 张 |
| CCC 追漫台 | 「NG男女」52 话，第一话 19 张 |
| GoDa 漫画、漫画人、优酷漫画、MYCOMIC | 通过 |
| 爱看漫 | 搜索页 403（curl 也是） |
| 少年ジャンプ＋ | 拿令牌的接口回 HTML，大概只对日本开放 |
| 再漫画 | 详情「漫画不存在」，像是按出口 IP 地区屏蔽 |
| カドコミ、漫画1234、嗨皮漫画 | 连不上（TLS 被断开） |
| comick | 详情超时（站点慢） |

Node 里（`comic-test --live`）包子漫画的章节接口、MYCOMIC 会被 Cloudflare 拦，客户端里能过：TLS 指纹不同，以客户端为准。

界面（同一台客户端）：探索页「漫画」标签 5 秒内铺出 36 张卡片；搜「葬送的芙莉莲」4 秒内漫画并进结果，三个源的同一部合成一条；详情默认源没章节时自动换到下一个；阅读器条漫 / 翻页、刷新后接着上次那张、Esc 退出、「最近在看」更新。

## 还没做 / 已知问题

- **书架**：漫画能进书架（详情「加入书架」，开始看自动加入），进度、继续阅读、书签、账户备份都有（R8-2）。还没有：追更提醒、按话离线下载（CBZ）、导入本地 CBZ。
- **图片重排**（`modifyImage`）、RSA、登录、Cloudflare 人机验证（Tauri 已有 `open_web` 小窗可借）：白名单里的源都用不到，没做。
- **MangaDex 的内容分级**：源的搜索选项默认「Any」会带上 erotica 级（不含 pornographic），要不要默认改成 safe + suggestive，待定。
- **主包**：漫画源列表（`sources.js`、白名单）进了首屏包（搜索页、探索页要知道有哪些源），约 +25KB；沙箱、书单、阅读器、默认源包都按需加载。
- **Cookie**：Tauri 的 http 插件自带持久 cookie 库；安卓的 CapacitorHttp 走系统 cookie，没验证过。
- 开发服务器偶尔漏掉文件改动（两次编辑隔得太近，给出中间版本）：调试时结果对不上，先 `touch` 一下文件再刷新。

## 测试

```bash
node scripts/comic-test.mjs                    # 兼容层逐项过一遍（11 项，离线；第一次要下载 _venera_.js）
node scripts/comic-test.mjs --live --bundled   # 随包附带的默认源，真实网站走一遍
node scripts/comic-test.mjs --live --all       # venera-configs 最新版里白名单的源
node scripts/comic-test.mjs --live --only=baozi --set=baozi.domains=webmota.com --verbose   # 单测一个源、改设置、失败时打印请求和日志
node scripts/legado-test.mjs                   # 书源（这一轮顺手修了它模拟 Capacitor 缺 getPlatform 的问题，main 上原本跑不起来）
```
