# 交接：手机端流畅度（分支 `perf/mobile-smoothness`）

接手的人先读完这页。用户要求：**极致丝滑、不偷工减料、不许把动画调快**（「我要的是丝滑，不是动效加快」）；视觉不能变。
用户笔记本容易过热：测完关掉 vite preview、浏览器、Gradle。

## 已经做完（都在这个分支的提交里，尚未发版）

数字都是手机路径：390×844、DPR 3、CPU 降速 4 倍、**开触屏模拟**（不开的话会跑电脑特效路径，比如搜索页玻璃，真手机上本来是关的）。
「卡顿」= 主线程长任务超过 50ms 部分之和。对照是 0.3.13 原版。

| 场景 | 原版 最长帧 / 卡顿 | 现在 |
|---|---|---|
| 首页滚动 | 53 / 0 | 63–73 / 0–2 |
| 切页 | 197 / 282 | 第二轮本机 83–97 / **0**（4 次全 0）；第一轮 53–70 / 0–18 |
| 探索页换世界 | 160 / 175 | 77–90 / 21–33 |
| 探索页滚动 | 113 / 27 | 第二轮本机 50–73 / **0**（4 次全 0）；第一轮 80–110 / 46–74 |
| 打开书详情 | 110 / 94 | 单独测 73–97 / 39–86；全套连跑偶尔 160+ |
| 搜索打字 | 277 / 339 | 第二轮本机 110–130 / 56–81；第一轮 107–130 / 55–91 |

（切页、探索页滚动、搜索打字三行的第二轮数字，和同一时间重测的原版、第一轮对照见下面「本机复测」。）
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

### 本机复测（第二轮，2026-10-09 夜）

本机 Edge、300Hz 屏、手机路径（同上）、`BLOCK=1 IDLE=12000`，直连 fonts.loli.net。三个版本各在干净的 worktree 里构建（工作区里 ASTRA 没提交的改动不混进来）：
原版 `674e6c3`、第一轮 `1b87427`、第二轮 `c70557b`。用 `scripts/perf/ab.mjs` 跑：每次新开浏览器、只跑一个场景一个版本，
每轮把版本顺序倒过来，共 4 轮；正式跑之前每个版本先跑一次首页滚动（不计），书库、字体缓存都是热的。
每格是 4 次的 最长帧 / 卡顿（ms），括号里是卡顿平均：

| 场景 | 原版 `674e6c3` | 第一轮 `1b87427` | 第二轮 `c70557b` |
|---|---|---|---|
| 探索页滚动 | 263 / 158，260 / 147，210 / 145，233 / 151（均 150） | 107 / 111，140 / 76，103 / 103，97 / 72（均 91） | 57 / 0，73 / 0，70 / 0，50 / 0（**均 0**） |
| 切页 | 400 / 448，340 / 321，347 / 319，357 / 356（均 361） | 123 / 46，93 / 4，90 / 6，93 / 7（均 16） | 97 / 0，83 / 0，83 / 0，83 / 0（**均 0**） |
| 搜索打字 | 223 / 250，270 / 292，267 / 280，314 / 388（均 303） | 123 / 112，110 / 61，137 / 97，133 / 96（均 92） | 110 / 56，127 / 81，130 / 72，127 / 73（均 71） |

- 探索页滚动、切页：第二轮 8 次没有一个长任务超过 50ms（LoAF 最长 0–61ms），和云端结论一致。
- 搜索打字：卡顿均值 92 → 71，比云端（287 → 156）降得少；**最长帧没变**（110–130ms）。`DETAIL=1` 抓了一次：最长那帧 126ms 里
  样式 + 排版 111ms，脚本只有 6ms（React 调度）——和云端说的「结果第一次出来那帧的样式 + 排版」是同一类，但是不是那一帧还没用追踪确认，留给下一步第 2 项。
- 这次重测的原版比大表第一列重（比如探索页滚动卡顿 150 对 27）。大表第一列是之前的会话测的，跑法不完全一样；
  这次每个场景单独开浏览器、进场景前停 12 秒。**比较请以同一张表里的对照为准。**

### 第三轮（本机）：打开书详情

**先查清原因**（`TRACE=sheet-open` + `fontev.mjs`、页面里看 `document.fonts`）——和上面猜的不一样，**不是分片没下**：
- fonts.loli.net 的 CSS 里 400 / 600 / 900 三个字重指向**同一批文件**（可变字体，按字切 101 片）：下一片三个字重一起就绪。
  瀑布流预取 600 字重的书名、摘句，书详情 700 的书名、400 的简介用到的分片也就下好了。sheet-open 整个场景里一个字体请求都没有。
- 点开那一帧的两块：① 脚本 19–30ms：后台页（插件页一长串书源 Link、首页、书架……）跟着重渲染；② 样式布局 ~44ms，其中排字 ~30ms。
- 排字慢的原因：**字形第一次以某个「字重 × 字号」出现时要现算字形数据**，和分片下没下无关。实测（4 倍降速，分片都已下好，60 个字）：
  第一次 14–39ms，同样的字打乱顺序再排 0.6–1.6ms；换个字号（15px → 15.5px）又是 36ms。约每个新字形 0.5–1ms。
  书详情的书名（700、24px）、简介（400、15px）是别处没用过的组合，所以每本书的字都是冷的。同一本书关了再开（字形全热），最长帧 37–53 → 13–20ms。

改了什么：
15. `src/lib/ui.jsx`：上下文拆成「动作」（openBook / closeBook / toast / openReader / endOpening，永远同一组函数）和「状态」（sheet、toasts、opening）。
    只要动作的组件改用 `useUIActions()`（App、首页、探索、搜索、书架、插件页、订阅页、账户面板、书源列表、订阅源列表、更新卡片）；
    要看状态的（BookSheet、Toasts、OpenTransition）照旧 `useUI()`。点书、关书、弹提示不再牵连后台页。
    A/B（4 次交替，sheet-open）：卡顿 64 / 59 / 58 / 43（均 56）→ 40 / 20 / 18 / 8（**均 22**）；长帧里的脚本从 19–30ms 降到 5–6ms。

16. **字形预热（已合，`98104c6`）**：`src/lib/glyph-warm.js`：手指按下一本书（pointerdown）时，
    在屏幕外一个 `contain: strict`、`visibility: hidden` 的盒子里，用和书详情一样的类名（字重字号全靠类名）把这本书还没排过的字排一遍；
    瀑布流、搜索结果、首页各卡片、书架推荐、光盘、文件夹扇都接了 `{...pressBook(book)}`。
    - 第一版（`perf/glyph-warm-wip` 的 f27215f）点书卡顿 37 → 0，但探索页滚动 >33ms 的帧 4 → 13–15（A/B 4 次，卡顿都是 0）。查清是两处：
      1. **按下就下新分片**：`TRACE=explore-scroll` + `fontev.mjs` 看到滚动中有 4 次 `EventDispatch > FunctionCall` 发起的 BeginRemoteFontLoad，
         到达后各一次整片字体失效——就是按下时 `loadSerif(简介…)`。改成只排分片已下好的字。
         **坑**：不能用 `document.fonts.check`：本机装了同名字体（Noto Serif SC）时 Chrome 一律说「好了」，页面里照样用网络分片、排的时候照样去下（实测）。
         现在按 unicode-range 查这个字归哪个 FontFace、看它的 `status`（各字重同一片状态一起变，只看 400）；码位表一口气建要 19ms（4 倍降速），改成空闲时一片片填。
      2. **`scheduler.postTask` 一段接一段地排，按下后五六十到一百毫秒一帧都没画**（`gaps.mjs` 看到的：rAF 间隔 50–104ms，里面全是 3–12ms 的预热任务）。
         Chrome 把触摸移动、pointercancel 对齐到帧才派发，帧画不出来，停下的信号也送不到，预热排到完才停。改成 rAF 里每帧排一段（≤5ms、每次 4 个字），
         手指移动超过 8px、抬手、pointercancel 都停。**以后凡是「分段让出主线程」的活，在有触摸的场景里别用 postTask / setTimeout 连着排。**
    - A/B（4 次交替，对照 `0dfca95`）：

      | 场景 | 对照 | 预热 |
      |---|---|---|
      | sheet-tap 卡顿 | 35 / 34 / 28 / 17（均 29） | 5 / 0 / 0 / 0（**均 1**） |
      | sheet-tap 最长帧 | 73 / 73 / 77 / 67 | 60 / 43 / 50 / 43 |
      | explore-scroll >33ms 帧 | 6 / 2 / 5 / 3 | 4 / 6 / 3 / 5 |
      | explore-scroll 最长帧 | 127 / 43 / 127 / 40 | 50 / 43 / 70 / 43 |
      | search-type 卡顿 | 49 / 62 / 52 / 59（均 56） | 45 / 46 / 45 / 58（均 49） |
      | search-type >33ms 帧 | 6 / 7 / 9 / 7 | 7 / 8 / 6 / 7 |

## 下一步（按优先级）

0. ~~先在本机复测第二轮~~：做完了，见上面「本机复测」。
1. ~~**打开书详情**~~：做完了，15、16 都已合（见「第三轮」）。`perf/glyph-warm-wip` 分支留着当记录，可以删。
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
#   场景：home-scroll disc-flip page-switch world-switch explore-scroll sheet-open sheet-tap search-type
#     （sheet-tap 和 sheet-open 点同样三本书，但用真触摸按下 80ms 再抬起，有 pointerdown；测按下时做的事要用它）
#   DETAIL=1 打印长帧组成；TRACE=场景 存追踪到 <临时目录>/perf/<场景>.trace.json，再用 tasks.mjs / tree.mjs 看
#     （第二轮加的：taskdump.mjs <trace> <时间> 看某个长任务的完整事件树；fontev.mjs <trace> 看字体加载 / 失效）
#     （第三轮加的：gaps.mjs <trace> [33] 列出 rAF 间隔超过 N ms 的地方、间隔里每个任务在干什么——「卡顿 0 但 >33ms 帧变多」用它查，
#       一串几毫秒的小任务连着跑、中间不画帧，tasks.mjs 是看不出来的）
#   PROFILE=场景 存 cpuprofile，cpuruns.mjs 按「连续忙的片段」汇总业务函数
#   BLOCK=1 挡掉网络封面（结果稳定）；IDLE= 进场景前空闲多久（预排版要 ~6s 做完）
IDLEMS=15000 RUNS=2 node idleab.mjs <临时目录> http://127.0.0.1:5185/ http://127.0.0.1:5181/   # 首页静置
# 交替 A/B（每次新开浏览器、只跑一个场景一个版本，每轮倒换顺序）：
WARM=1 node ab.mjs <临时目录> 4 explore-scroll,page-switch,search-type 原版=http://127.0.0.1:5185/ 新=http://127.0.0.1:5181/
node ab.mjs <临时目录> sum                         # 按场景、版本汇总
```
- 对照版本建议各开一个 worktree 构建（`git worktree add --detach <目录> <提交>`，node_modules 用目录联接指过去），
  工作区里 ASTRA 没提交的改动就不会混进被测版本。
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
