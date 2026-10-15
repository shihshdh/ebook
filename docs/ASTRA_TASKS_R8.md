# ASTRA 第十一轮：漫画的阅读体验和轻小说一样（含加入书架）+ iPhone 适配

用户的原话：「我要求漫画和轻小说有一样的阅读体验，包括加入书库」「iPhone 尽快给我完成适配」。
**这一轮 Claude 停手，整个工作区（`C:\Users\ys221\Desktop\我的网页\文库\librarium-ios`，分支 `feat/comic-sources`）交给你**，`src/**` 也可以改。
先读 `docs/COMIC_PLAN.md`（漫画源的架构、文件、安全模型、踩过的坑），再读本文件。

## 规矩

- 工作区里有 Claude 还没提交的漫画源代码（`git status` 看得到），**在它上面接着做**，不要回退、不要整文件重排格式。
- **不提交、不推送、不发版、不改版本号**。iPhone 要上 CI 构建必须推送：做到那一步时停下，在 REPORT 里写清楚要推哪个分支、跑哪个 workflow，等用户点头。
- 轻小说的体验不能退化：改 `Reader.jsx`、`Shelf.jsx`、`Home.jsx`、`OpenTransition.jsx`、`shelf.js` 时只加漫画分支、只抽公共件，小说的行为、性能一律不动（项目一直在调流畅度，见 `docs/HANDOFF_PERF.md`）。
- Tauri 开发版可能还开着（`npm run desktop:dev`，端口 5181，WebView2 调试端口 9223）。你可以用它验收：CDP 连 `http://127.0.0.1:9223/json`，参照 `scripts/perf/cdp.mjs`。开发服务器偶尔漏掉文件改动（两次编辑隔得太近会给出中间版本），结果对不上时先 `touch` 那个文件再刷新。
- 每项做完在 `docs/ASTRA_REPORT.md` 末尾「第十一轮」一节写：做了什么、怎么验的、截图路径（`docs/screenshots/comic/`）、没做成的和原因。同时更新 `docs/PROGRESS.md` 第 97–99 行，并在漫画那一节下面续行。
- 收尾必须跑：`npm run build`、`node scripts/comic-test.mjs`（现在 11/11）、`node scripts/legado-test.mjs`（96/96）、`node scripts/ios-platform-test.mjs`、`node --test scripts/ios-comic-bridge-test.mjs`。

## 现状（Claude 交接）

| 已有 | 文件 |
|---|---|
| 漫画阅读器：条漫 / 翻页 / 从右往左，暗底，自己的一套上下栏（`cr-*` 样式）；进度存 `comic:progress`（最近在看） | `src/pages/ComicReader.jsx`、`src/styles/comic.css` |
| 阅读器路由 `/read/comic/:源/:漫画/:第几话`（在 `/read/` 下，自动全屏、藏导航） | `src/App.jsx` |
| 详情：同一个 BookSheet，漫画换成 `ComicSheetBody`（换源、继续看、章节） | `src/components/BookSheet.jsx`、`src/components/ComicSheetBody.jsx` |
| 数据：搜、详情、章节、取图、进度 | `src/comic/library.js`（`comicDetails`、`chaptersOf`、`chapterImages`、`pageURL`、`coverURL`、`getProgress` / `saveProgress` / `useComicProgress`、`readPath`） |
| 漫画 → Book（`source: 'comic'`，`id = comic:<源>:<漫画>`，`comics` 列着各源） | `src/comic/book.js` |
| **还没有**：漫画进不了书架；阅读器的界面、目录、书签、阅读统计都和小说不一样 | |

## 任务

| # | 内容 | 验证 |
|---|---|---|
| R8-1 | **漫画阅读器和小说阅读器同一套界面和手势**。<br>做法：照 `src/pages/Reader.jsx` 的 DOM 和类名重写 `ComicReader.jsx` 的外壳，让 `reader.css` / `mobile.css`（`.ui-mobile .reader2 …`）直接生效——`main.reader2`、`.rd-stage`、`.rd-ambient`（顶上章节名，底下「本话 第 p / n 张 · 还剩几张」+ 时钟）、`.rd-top.glass`（返回 / 书名和话名 / 目录 / 书签）、`.rd-bottom` 里电脑用 `.rd-deskbar`（«  进度条  » + LiquidTabs）、手机用 `.rd-dock`（LiquidTabs 带图标）、`.rd-panel`（电脑目录是可固定的左侧栏，其余是弹出面板）、`.rd-ribbon` 书签丝带、手机 `.rd-menu-trigger`、`.rd-edge` 电脑左右翻页按钮、`.rd-toast`。<br>`LiquidTabs`、`Clock`、`swipeDir`（带速度的横划判定）从 Reader.jsx 抽到 `src/reader/chrome.jsx`，两个阅读器共用（小说那边只改 import）。<br>面板换成漫画的内容：**目录**（章节列表，当前话高亮、读过的变淡，长列表滚到当前）、**进度**（本话的张数滑条，拖动出气泡，上一话 / 下一话）、**书签**（按张存：`ref = "<第几话>:<第几张>"`，用 `lib/shelf.js` 的 `addBookmark` / `listBookmarks`，书架 id 见 R8-2）、**阅读方式**（条漫 / 翻页、从右往左；宽屏翻页可选双页）、**纸张**（用 `READER_THEMES` 的底色，暗底是默认）。<br>交互对齐小说：点左右三分之一翻页、中间呼出；横划用 `swipeDir`；键盘 ← → 空格 PageUp/Down、`[` `]` 换话、`T` 目录、`B` 书签、Esc 一层层关（面板 → 工具栏 → 退出）；安卓返回键同 Esc（`onBackButton`）；`setImmersive`；手机书签轻震（`haptic`）；`useReadingClock()` 记阅读时长（书架的阅读统计）。<br>漫画特有的保留：图按需取、离当前 20 张以外放掉、记宽高比防塌、条漫用 IntersectionObserver 定当前张、刷新后接着上次那张（`state.at` 比进度新才用导航带来的页码） | Windows 客户端：电脑和 390 宽（CDP `Emulation.setDeviceMetricsOverride`）各截图——工具栏、目录、书签、阅读方式、纸张五个状态，和小说阅读器同位置截图并排对比 |
| R8-2 | **漫画加入书架**。<br>① 书架条目：`id = comic:<源>:<漫画>`（和 `comicBook` 一致），`source: 'comic'`、`ext: 'comic'`、`size: 0`、`comic: { sourceId, sourceName, comicId }`、`cover`（加入时经 `coverURL` 取封面，缩成 360 宽 JPEG data URL 存下，离线也能显示，做法同 BookSheet 的 `epubCover`）、`progress: { percent, index, page, chapter }`（percent = (第几话 + 张/总张) / 话数）。`lib/shelf.js` 加一个不带 blob 的入口（现在 `addToShelf` 必须带 blob），`removeFromShelf` 照常。<br>② 什么时候进书架：详情里加「加入书架 / 已在书架」按钮；**开始看就自动加入**（同小说：读的书都在书架上）。阅读器翻页时同步 `updateProgress`（书架进度、`lastReadAt`）。<br>③ 打开：`OpenTransition` 遇到 `ext === 'comic'` 跳 `readPath(源, 漫画, progress.index)`，带上 `{ page, at }`；书架的「按书签打开」（`openAt`）对漫画跳到那一张。<br>④ 书架页：漫画和小说混排，角标「漫画」（同 TXT 角标的写法），筛选 / 排序 / 继续阅读 / 阅读统计 / 删除都照常；首页「继续阅读」因为读的是书架，打开要走 ③。<br>⑤ 账户备份：`accountIO` 导出的书架条目里漫画没有 blob，导入时现在会变成 `orphan:`——漫画条目要直接写回书架 | 详情加入 → 书架出现（有封面、读到 x%）→ 从书架点开接着上次那张 → 删除；首页继续阅读能打开漫画；账户导出再导入成新账户后漫画还在书架 |
| R8-3 | **iPhone 适配**。<br>① 原生标记：`EbookViewController.capacitorDidLoad` 里再加一个 `WKUserScript`（`.atDocumentStart`、**forMainFrameOnly: true**）：`window.__EBOOK_BRIDGE_GUARD__ = 'main-frame'`。只有装了 R7-2 防护的版本主页面才有这个值，子 frame 永远没有。<br>② 前端：`src/comic/sources.js` 的 `comicSupported` 改成 `isNative && (!isIOS \|\| window.__EBOOK_BRIDGE_GUARD__ === 'main-frame')`，`comicUnsupportedWhy` 相应改；`src/comic/runtime/host.js` 启动沙箱时把 `env.bridgeGuard` 设成这个值传进去；`sandbox.js` 里 `unsafeBridge` 对 `webkit.messageHandlers` 只在 `env.bridgeGuard !== 'main-frame'` 时拒绝（判断要放在 boot 里、源脚本求值之前；安卓的 `androidBridge` 检查不变，仍然 fail-closed）。`scripts/comic-test.mjs` 补一条：带 webkit 的环境，有 guard 能跑、没 guard 拒绝。<br>③ 界面：iPhone 用的是 `.ui-mobile` 那套（`styles/mobile.css`）。探索页漫画标签、详情里的章节、阅读器（R8-1 之后应该自动套上小说的手机样式）、插件页漫画源，在 390×844 下逐个过：安全区、液态玻璃标签栏不挡内容、字号（mobile.css 里正文 15–17px）、点击区域 ≥ 44px。<br>④ 构建：写好以后跑静态检查；要推送跑 `.github/workflows/ios.yml`（它的 push 只匹配 `codex/ios-personal`，feat 分支要 workflow_dispatch）——**停下等用户同意**，REPORT 里写清楚命令。CI 产出 IPA 后按 R7 报告里写的步骤在模拟器验：子 frame 调 `webkit.messageHandlers.bridge.postMessage(...)` 不进原生、主 frame 正常；漫画「测一遍」、探索、搜索、阅读、加入书架 | 静态检查全过；390 宽截图；推送前的停点写进 REPORT |
| R8-4 | 安卓验收（R7-1 没做成的）：上一轮命令行工具下载超时。可以试 Android Studio 自带的 SDK Manager（`%LOCALAPPDATA%\Android\Sdk`，Android Studio 在 `C:\Program Files\Android\Android Studio`），或者换镜像；实在下不下来就跳过，写明原因。做成了就照 R7-1 跑一遍，并验 R8-1 / R8-2 在安卓上 | 同 R7-1 |

顺序：R8-3 ①② 最先（小、而且用户最急），然后 R8-1 → R8-2 → R8-3 ③④ → R8-4。

不做：离线下载漫画章节（下一轮）；改轻小说的功能；发版。
