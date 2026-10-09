# 交接：手机端流畅度（分支 `perf/mobile-smoothness`）

接手的人先读完这页。用户要求：**极致丝滑、不偷工减料、不许把动画调快**（「我要的是丝滑，不是动效加快」）；视觉不能变。
用户笔记本容易过热：测完关掉 vite preview、浏览器、Gradle。

## 已经做完（都在这个分支的提交里，尚未发版）

数字都是手机路径：390×844、DPR 3、CPU 降速 4 倍、**开触屏模拟**（不开的话会跑电脑特效路径，比如搜索页玻璃，真手机上本来是关的）。
「卡顿」= 主线程长任务超过 50ms 部分之和。对照是 0.3.13 原版。

| 场景 | 原版 最长帧 / 卡顿 | 现在 |
|---|---|---|
| 首页滚动 | 53 / 0 | 63–73 / 0–2 |
| 切页 | 197 / 282 | 53–70 / 0–18 |
| 探索页换世界 | 160 / 175 | 77–90 / 21–33 |
| 探索页滚动 | 113 / 27 | 80–110 / 46–74（**没解决**，见下） |
| 打开书详情 | 110 / 94 | 单独测 73–97 / 39–86；全套连跑偶尔 160+ |
| 搜索打字 | 277 / 339 | 107–130 / 55–91 |
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
10. `src/effects/MasonryWall.jsx` + `warm.js` 的 `idleLayout`：空闲时提前排快滚到的瀑布流卡片。（**测下来对探索页滚动没起作用**，见下）

## 下一步（按优先级）

1. **探索页滚动**：长帧是「瀑布流追加一批卡片」那一帧的排版 55–70ms。追踪里每帧只有 4 次排字却花 26–34ms，同时有 `BeginRemoteFontLoad`——很可能是穿插的**文字卡（.mw-quote，衬线大字）**：它没加 content-visibility，追加时当场排字，还在等网络字体。下一步：确认是哪段文字、哪个字体；考虑文字卡也 content-visibility: auto（`contain-intrinsic-size` 用 MasonryWall 里 `estimate()` 的高度内联写上），并把 `.mw-quote` 加进 `idleLayout` 和 `warm.js` 的 LAZY 选择器。`idleLayout` 若最终没用就删掉，别留死代码。
2. **搜索打字**：结果变化那帧排版 94–108ms（`scripts/perf/measure.mjs` 场景 search-type，DETAIL=1 看长帧）。
3. **打开书详情**：全套连跑偶尔 160ms+，看是哪本书（内容长但没触发分两步？），必要时调 `deferRest` 的估算。
4. 全部做完：电脑端（不降速）+ 手机路径各跑一遍全套，和 0.3.13 对照；人工看一遍首页各区块边缘（shadow / 文件夹展开）没被裁。

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
#   BLOCK=1 挡掉网络封面（结果稳定）；IDLE= 进场景前空闲多久（预排版要 ~6s 做完）
IDLEMS=15000 RUNS=2 node idleab.mjs <临时目录> http://127.0.0.1:5185/ http://127.0.0.1:5181/   # 首页静置
```
- 浏览器默认本机 Edge；Linux / 云端用 `BROWSER=/usr/bin/google-chrome`。云端没有真显卡、CPU 也不同，**数字只能和同一台机器上的对照比**，不能和上表直接比。
- 两个测量不要同时跑（抢 CPU，数字作废）。

## 注意

- 同一工作区里 ASTRA（Codex）在做 `docs/ASTRA_TASKS_R6.md`（下载链路体检），它的文件：`src/plugins/mojimoon/*`、`src/plugins/public/*`、`scripts/**`（除 `scripts/perf/`）、`docs/ASTRA_*`。别碰。
- 0.3.14（插图版改从 mojimoon/wenku8-epub 下载）在 main 的提交 `fa523b4`，尚未推送 / 发版，由用户决定。
- Windows 安装包、APK 只能在用户本机打（`docs/BUILD.md`）。
