# ASTRA 第十二轮任务书：配合新图标重新设计开屏动画（2026-10-17）

用户选了新图标 **B · 书签**（陶红 #B64E38 底 + 浅白 #FFF7ED 书签，见 `docs/ICON_R10.md`、`public/app-icon.svg`），
并要求「开屏动画也让 Astra 重新设计」。之前也说过「不要夜读这个主题了」。

## 工作区（必须遵守）

- 只在 `C:\Users\ys221\Desktop\我的网页\文库\librarium-splash` 里干活，分支 `feat/new-splash`（从 main `3648872` 分出，新图标已经在里面）。
- **不要碰** `librarium-ios`（Claude）、`librarium-reader`（你另一个对话在做阅读器）、`librarium-sources`、`librarium`。
- 只改开屏相关：`src/components/Splash.jsx`、`src/effects/splash-glyph.worker.js`（可以删掉或重写）、`src/styles/app.css` / `light.css` 里 `.splash*` 的样式、
  `index.html` 里首帧用到的开屏底色、`capacitor.config.json` 的启动底色、安卓 `android/app/src/main/res/values/styles.xml` 的系统启动页
  （`windowSplashScreenBackground` / `IconBackgroundColor` 等）、iOS `ios/App/App/Base.lproj/LaunchScreen.storyboard`（底色 / 图标）。
  顶栏字标（开屏最后飞进去的那个）在 `src/components/NavBar.jsx`，只改与开屏衔接需要的部分，不改导航功能。
- 提交到 `feat/new-splash`，**不要推送、不要合并 main、不要发版**。
- 不要开桌面客户端（Tauri 只能开一个实例，Claude 在用）。看效果用 `npm run dev`（Vite，换个端口如 `--port 5190`），在浏览器里看；
  手机宽度用 390×844。系统启动页（安卓 / iOS 原生那一屏）只能静态检查配置，说明清楚。

## 设计要求

- 和新图标一个家族：书签符号是主角，陶红 + 浅白两色，扁平、几何、留白多，Claude / ChatGPT 那种克制。不要夜空、月牙、暖黑、金线、手写体这些「夜读」元素。
- 节奏短：总长 ≤ 1.6 秒（现在的偏长），可点击 / 任意键跳过；每个会话只播一次（沿用 `sessionStorage` 的 `librarium.splash`）；
  `prefers-reduced-motion` 时只做淡入淡出。
- 衔接三段不能有闪：系统启动页（原生）→ 网页首帧（`index.html` 的底色 / 内联样式）→ 开屏动画 → 首页。三段的底色、图标位置要对得上，
  不能出现「白一下」「黑一下」「图标跳一下」。浅色 / 深色主题（外观里有跟随系统）都要考虑开屏背景用什么色。
- 流畅：只动 `transform` / `opacity`（或 OffscreenCanvas），手机路径（CPU 降速 4 倍）下不能有超过 33ms 的帧；开屏期间首页在后面照常加载，不要拖慢首屏。
  可以用 `scripts/perf/` 里的方法录帧（网页版即可，开屏和平台无关）。
- 出 2 个方向的动画（比如：书签从顶部落下插进书页再展开成首页；书签符号描边成形后缩放进顶栏字标），各录一个 GIF / 逐帧截图放进
  `docs/SPLASH_R12.md`，选一个你认为最好的实现为正式版，另一个写清楚怎么切换（留个常量就行），让用户挑。

## 交付

`docs/SPLASH_R12.md`：两个方向的逐帧 / GIF、选择理由、各段衔接的检查（三段底色对照表）、录帧结果；`docs/ASTRA_REPORT.md` 加「第十五轮」摘要；
`npm run build` 通过后提交。做完在 SPLASH_R12.md 最后写「完成」。
