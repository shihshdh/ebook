# ASTRA 第十一轮任务书：漫画阅读器的流畅度和出图速度（2026-10-17）

用户原话：「全面优化体验，不能有卡顿和掉帧，你跑通测试再给我上线」「iOS 一定要单独调优」「目前漫画加载存在高延迟和卡顿」。
Claude 已经修了详情慢、书墙翻页、后台活挤主线程（提交 `3b6b03f` 及之前），**剩下最卡的是漫画阅读器**：
手机路径（390×844、DPR 3、CPU 降速 4 倍、触屏）下阅读器滑动 p95 60–90ms、超过 33ms 的帧约 80 帧 / 12 秒，卡顿 200ms 左右。

## 工作区（必须遵守）

- 只在 `C:\Users\ys221\Desktop\我的网页\文库\librarium-reader` 里干活，分支 `feat/comic-reader-perf`（从 `3b6b03f` 分出）。
- **不要碰** `librarium-ios`、`librarium-sources`、`librarium-icon`、`librarium`。
- 只改阅读器相关：`src/pages/ComicReader.jsx`、`src/reader/chrome.jsx`（小说阅读器也用它，改了要两个阅读器都测）、
  `src/styles/` 里阅读器的样式、`src/comic/images.js`（取图），需要的话 `src/comic/library.js` 里的 `pageURL` / `chapterImages`
  （改动写清楚，Claude 那边也在动 library.js 别的部分，合并时会对）。测量脚本可以加在 `scripts/perf/`。
- 提交到 `feat/comic-reader-perf`，**不要推送、不要合并 main、不要发版**。
- **不要开桌面客户端**（Tauri 只能开一个实例，Claude 正在用）。测漫画阅读器用**安卓模拟器**：
  AVD `EBOOK_API34`（`%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe -avd EBOOK_API34 -no-snapshot -gpu swiftshader_indirect`），
  打调试 APK（`JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`，`npm run android:build`，装 `android/app/build/outputs/apk/debug/app-debug.apk`），
  `adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>` 后用 CDP 驱动（参考 `scripts/perf/measure-app.mjs` 的录帧方法，端口换成 9333）。
  测完关模拟器、`gradlew --stop`（用户笔记本容易过热）。

## 要做的

1. **量基线**：阅读器两种模式（上下条漫、左右翻页）各录：打开第一话到第一张图出来的时间；连续滑 / 翻 30 张的帧（p95、p99、最长、超过 33ms 的帧、长任务卡顿）；
   切到下一话的等待；内存（`performance.memory` 或 CDP `Memory.getDOMCounters` / JS heap）随翻页的增长。CPU 采样看主线程时间花在哪
   （参考 measure-app.mjs 的 PROFILE）。
2. **优化**（每改一处量一次，没用的撤回）。方向参考，以数据为准：
   - 图片解码不占滑动的帧：`decoding="async"`、上屏前 `img.decode()`、给图片定好宽高比占位（不让图片到了把下面的内容顶下去重排）；
   - 预取：当前张往后几张、快到本话末尾时预取下一话的图片列表和前几张；正在看的那张排在最前（`pageURL` 的 `front`）；
   - 离当前很远的图片释放（`URL.revokeObjectURL`、卸掉 img）：iOS 的 WKWebView 内存上限低，超了会整页白屏重载；
   - 滚动容器上的监听都是 passive，滚动中不读排版（getBoundingClientRect / offsetTop 之类），进度用 IntersectionObserver；
   - 大图（超过屏幕两三倍宽的）缩到合适尺寸再上屏（可以用 `createImageBitmap` 的 resize，注意兼容 iOS 15+ 的 WKWebView）。
3. **iOS 单独看一遍**：WKWebView 的差异（`content-visibility`、`decode()`、内存）在代码里分支处理并注释；改不了真机验证的写清楚。
4. **回归**：小说阅读器（共用 chrome.jsx）手势、面板照常；`npm run build`、`node scripts/comic-test.mjs`（13 项）通过。
5. **报告**：`docs/ASTRA_REPORT.md` 加「第十四轮」，改前 / 改后的数字表（同一套测法、各跑 3 轮取中位数）、改了什么、为什么；`docs/PROGRESS.md` 加一行。
   做完在报告最后写「完成」。
