# 交接：手机端流畅度（分支 `perf/mobile-smoothness`）

接手的人先读完这页。用户要求：**极致丝滑、不偷工减料、不许把动画调快**（「我要的是丝滑，不是动效加快」）；视觉不能变。
用户笔记本容易过热：测完关掉 vite preview、浏览器、Gradle。

## 已经做完（都在这个分支的提交里，尚未发版）

数字都是手机路径：390×844、DPR 3、CPU 降速 4 倍、**开触屏模拟**（不开的话会跑电脑特效路径，比如搜索页玻璃，真手机上本来是关的）。
「卡顿」= 主线程长任务超过 50ms 部分之和。对照是 0.3.13 原版。

| 场景 | 原版 最长帧 / 卡顿 | 现在 |
|---|---|---|
| 首页滚动 | 53 / 0 | 63–73 / 0–2 |
| 切页 | 197 / 282 | 53–70 / 0–18（第一轮）；第二轮又改，本机未复测 |
| 探索页换世界 | 160 / 175 | 77–90 / 21–33 |
| 探索页滚动 | 113 / 27 | 80–110 / 46–74（第一轮）；第二轮已改，**本机未复测**（云端 A/B 见下） |
| 打开书详情 | 110 / 94 | 单独测 73–97 / 39–86；全套连跑偶尔 160+ |
| 搜索打字 | 277 / 339 | 107–130 / 55–91（第一轮）；第二轮又改，本机未复测 |
| 首页静置（开 App 后不碰） | 最长 137–413 | 87–107，基本没有长任务 |
| 电脑端首页静置（不降速） | 最长 108 | 46–50，没有长任务 |

改了什么（每处代码里都有中文注释说明原因）：
1. `src/plugins/legado/encoding.js`：GBK 编码表一次解码建表（94ms → 7ms，两万多字逐字核对一致）。
2. `src/styles/app.css` `.result-list li`：搜索结果行 content-visibility: auto。
3. `src/pages/Explore.jsx` + `src/effects/WorldSwitch.jsx`（onSettle）：换世界时书单等镜头停稳再换。
4. 生成封面改后台线程画：`src/lib/jacket-art.js`（画法，SVG/Canvas 两种逐像素一致）、`jacket.js`（队列）、`jacket.worker.js`（OffscreenCanvas → JPEG 0.95）；`Cover.jsx` 按显示尺寸（ResizeObserver）分 300/600/900 三档；`covers.js` 的 useCover 改用它。没有 Worker/OffscreenCanvas 时退回 SVG。
5. `WorldSwitch.jsx`：拼贴 14 张封面全 eager（被 clip-path 裁着，IO 永远等不到）。
6. `src/effects/PrismGlass.jsx`：初始化分段让出主线程；PMREM 着色器先 compileAsync 预热（借 three 的 `_setSize/_allocateTargets`，找不到就跳过）；尺寸从 ResizeObserver 拿，不读 clientWidth；第一帧画出来才设 data-ready；卸载等初始化停下再释放。
7. `src/App.jsx` 空闲预渲染 + **分块预排版**（`src/lib/warm.js`）：后台页 data-warming 时一块块解锁排版（每段 ≤6ms，拆到第 4 层），最后把前 2.5 屏的 content-visibility: auto 项（瀑布流卡片、搜索结果行）也排掉；首页 `.home-lazy` 区块同样分块排；一步做完隔 120ms 接下一步，有操作就停、停手 1.2s 续上。`Pages` 组件 memo（切页不再重渲染所有后台页）。
8. `src/pages/Home.jsx` + `app.css` `.home-lazy`：近年佳作往下几块 content-visibility: auto + overflow-clip-margin: 120px（逐块量过最多伸出 99px）。唱片那块不加。
9. `src/components/BookSheet.jsx`：面板分两步挂（第一帧只有顶部）；手机上只有内容估计会顶满 92dvh 才分步，第一帧先撑到 92dvh（`.sheet.is-partial`），避免滑入途中变高。
10. ~~`idleLayout`~~：第二轮对照测下来没帮助（空闲回调常一次跑 10–28ms，超出空闲时间），已删。

### 第二轮（云端做的，提交 `6884244`、之后那个）

探索页滚动的真凶是**衬线字体分片**，不是排版本身。`tokens.css` 引的 Noto Serif SC（fonts.loli.net）每个字重切成 101 片、一片中位 64KB，
哪片里的字第一次上屏才下哪片。实测（4 倍降速）：
- 分片没到时排字要逐字走系统后备字体：12 个生僻字 16–44ms；分片到了同样的字 0.3–1ms。
- 每个分片下到时，浏览器把屏幕附近**所有**用这套字的文字重排一遍（170 个对象，17–28ms），不管下到的字有没有用上。
- 书目 4357 本、书名 2551 个字：前 18 本书名就要 19 片，前 90 本也只要 24 片——往后每页只多 0–5 片，多预取几页几乎不多下流量。
- Chrome 的 content-visibility: auto「附近」是视口上下各 **1.5 屏**（实测约 1266px）。原来哨兵提前 900px，新挂的卡片一挂上就在附近，当帧全排。

改了什么：
11. `src/lib/fonts.js`（新）：`loadSerif(text, weight)` 用 `document.fonts.load` 只下这段字要的分片；`atMost(promise, ms)`。
12. `src/effects/MasonryWall.jsx`：书名 + 摘句的分片一次预取 4 页（`FONT_PAGES`），快用完时再下一批（到达挤在一起，同一帧到的只重排一次）；
    哨兵到了等分片下好再挂（最多 `FONT_WAIT` 500ms，离线 / 字体被拦照样挂，测过）；哨兵提前量 900px → `200%`（比 1.5 屏远，新卡片先占位不排）；
    追加一页放进 `startTransition`；换书单直接从第一页算起（以前先按旧张数渲染一遍再砍）。
    文字卡也 content-visibility: auto，占位高度用 `estimate()` 内联（估差主要来自长书名的出处行折行，只影响屏幕外占位；**列分配没动**，瀑布流排列和原来一样）。
    `warm.js` 的 LAZY 也包含文字卡。
13. `src/App.jsx`：每页外面套一层固定的路由地址上下文（`UNSAFE_LocationContext`）。`<Routes location>` 自己订着当前地址，
    地址一变（切页、搜索框同步到地址栏）就给整页换新上下文，后台页里用 useNavigate / Link 的组件全部重渲染——`Pages` 的 memo 挡不住。
14. `src/pages/Search.jsx`：结果列表抽成 memo 的 `ResultList`（以前每敲一个字，结果还没变也把 30 行重新生成比对）；`open` 用 useCallback + ref；
    `pooled` 只依赖 `by` 参数而不是整个 params。`src/lib/library.js` 的 `prepareSearch`：空闲时先把每本书的折叠写法算好（第一次搜索要现算四千多本）。
    `src/lib/pool.js`：书名归一化结果缓存（上限两万条）。

云端 A/B（同一台机器、同一套参数，各 4 次，「卡顿」= 长任务超 50ms 部分之和，ms）：

| 场景 | 改动前（`1b87427`） | 第二轮 |
|---|---|---|
| 探索页滚动 | 206 / 256 / 294 / 338（均 274） | 24 / 82 / 40 / 51（均 49） |
| 切页 | 407 / 469 / 334 / 554（均 441） | 201 / 231 / 190 / 257（均 220） |
| 搜索打字 | 189 / 284 / 471 / 205（均 287） | 114 / 165 / 117 / 226（均 156） |

云端 CPU 慢、没显卡，绝对值比本机大很多，只能看相对变化。探索页滚动的追踪里，滚动途中已经**没有任何字体加载 / 字体失效事件**，挂卡片那一帧的 24ms 排版也没了；
剩下的长任务是每帧固定开销（提交、分层、绘制）。

一处可见差别（我认为是改善，请人工看一眼）：追加的那页现在挂在两屏外，快速划的时候不会再看到新卡片正在做入场动画（mw-in 淡入上移）——以前挂在 900px 外，划得快能看到半截。

## 下一步（按优先级）

0. **先在本机复测第二轮**（探索页滚动、切页、搜索打字），把上面大表补上本机数字。本机能连 fonts.loli.net，不用 `FONTS=google`。
1. **打开书详情**（全套连跑偶尔 160ms+）：很可能也是冷字体分片。面板书名 `.sheet-title` 是 700（匹配到 900 那套分片）、简介 `.sheet-desc` 是 400、
   `.dl-head h3` 也是粗体衬线；随便点一本书，这几套分片大多没下过。先 `TRACE=sheet-open` + `node fontev.mjs` 确认有没有「ShapeText 里的 BeginRemoteFontLoad」。
   思路：点开就 `loadSerif(简介, 400)` / `loadSerif(书名, 700)`；后半截（`restFor`）可以等字下好再挂（要有上限，别让简介迟迟不出来——这会改变出现时机，先和用户确认）；
   或者在瀑布流 / 结果行 pointerdown 时就开始下。注意分片到达会把附近衬线字全重排，别让它落在滑入动画中间。
2. **搜索打字剩下的**：结果第一次出来那帧样式 + 排版（云端 34 + 40ms）。结果行是 content-visibility: auto，但 1.5 屏范围内的十来行照样当帧全排。
   可以考虑先挂一屏的行、其余下一帧再挂（注意 `reveal` 动画按 `--i` 错开 30ms，晚挂的行要补偿延迟，否则错开节奏会变）。
   书源现搜第一次构造 GBK 请求要建表（云端带采样 60ms，本机约 7ms），一次性，没动。
3. **换世界**：新书单第一页的字是冷的。可以在点世界时（镜头动画开始前）就算出新书单、`loadSerif` 第一页——但分片到达会重排当前屏幕上的衬线字，看会不会顿到镜头动画。
4. 全部做完：电脑端（不降速）+ 手机路径各跑一遍全套，和 0.3.13 对照；人工看一遍首页各区块边缘（shadow / 文件夹展开）没被裁；看一眼探索页往下划。

## 怎么测

```bash
npx vite build                                   # 正式构建 → dist
npx vite preview --port 5181 --strictPort &      # 被测版本
# 对照：git worktree add ../base 674e6c3，在那里 npx vite build --outDir <某处>，再 preview 到 5185
# 调试构建（不压缩，看函数名）：npx vite build --minify false --outDir <某处>，preview 到 5182
cd scripts/perf
BLOCK=1 IDLE=12000 node measure.mjs <临时目录> http://127.0.0.1:5181/ <临时目录>/out.json mobile [场景,场景]
#   场景：home-scroll disc-flip page-switch world-switch explore-scroll sheet-open search-type
#   DETAIL=1 打印长帧组成；TRACE=场景 存追踪到 <临时目录>/perf/<场景>.trace.json，再用 tasks.mjs / tree.mjs 看
#     （第二轮加的：taskdump.mjs <trace> <@时间> 看某个长任务的完整事件树；fontev.mjs <trace> 看字体加载 / 失效）
#   PROFILE=场景 存 cpuprofile，cpuruns.mjs 按「连续忙的片段」汇总业务函数
#   BLOCK=1 挡掉网络封面（结果稳定）；IDLE= 进场景前空闲多久（预排版要 ~6s 做完）
IDLEMS=15000 RUNS=2 node idleab.mjs <临时目录> http://127.0.0.1:5185/ http://127.0.0.1:5181/   # 首页静置
```
- 浏览器默认本机 Edge；Linux / 云端用 `BROWSER=/usr/bin/google-chrome`。云端没有真显卡、CPU 也不同，**数字只能和同一台机器上的对照比**，不能和上表直接比。
- 云端（claude.ai/code）怎么跑：`package-lock.json` 指向 registry.npmmirror.com，云端被拦，用
  `npm ci --replace-registry-host=always --registry=https://registry.npmjs.org/`；浏览器
  `BROWSER=/opt/pw-browsers/chromium BROWSER_ARGS="--no-sandbox --proxy-server=$HTTPS_PROXY"`，没有显示器要套 `xvfb-run -a`；
  fonts.loli.net 云端连不上，加 `FONTS=google`（measure.mjs 把它换成 fonts.googleapis.com，同一份字体）。
- 每个场景至少 A/B 各跑 3–4 次、交替跑：单次波动很大（同一版本卡顿合计能差 3 倍）。
- 两个测量不要同时跑（抢 CPU，数字作废）。

## 注意

- 同一工作区里 ASTRA（Codex）在做 `docs/ASTRA_TASKS_R6.md`（下载链路体检），它的文件：`src/plugins/mojimoon/*`、`src/plugins/public/*`、`scripts/**`（除 `scripts/perf/`）、`docs/ASTRA_*`。别碰。
- 0.3.14（插图版改从 mojimoon/wenku8-epub 下载）在 main 的提交 `fa523b4`，尚未推送 / 发版，由用户决定。
- Windows 安装包、APK 只能在用户本机打（`docs/BUILD.md`）。
