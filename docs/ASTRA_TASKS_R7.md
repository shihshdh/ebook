# ASTRA 第十轮：漫画源的手机端（安卓验收、iPhone 原生桥）+ 默认源体检

背景：EBOOK 在加漫画源（分支 `feat/comic-sources`，工作区 `C:\Users\ys221\Desktop\我的网页\文库\librarium-ios`）。方案、架构、安全模型都在 `docs/COMIC_PLAN.md`，先读它。一句话：
Venera 的漫画源脚本跑在一个 sandbox iframe 里（`src/comic/runtime/sandbox.js`，只给 allow-scripts，和 App 不同源，CSP 不许联网），网络请求经 postMessage 交给主页面用原生 HTTP 发。
**风险在原生桥**：WebView 会把原生桥注入到子 frame，网上来的源脚本要是能调原生插件，就能绕过一切限制。Windows 已经实测安全（见 COMIC_PLAN「安全」）；手机端还没验。

## 规矩

- **文件归属**：只改 `android/**`、`ios/**`、`scripts/**` 里**新建**的文件、`docs/ASTRA_*`。
  Claude 正在改 `src/**`、`vite.config.js`、`package.json`、`docs/COMIC_PLAN.md`、`scripts/comic-test.mjs`、`scripts/comic-bundle-defaults.mjs`，**一个字都别碰**。确实需要改 `src/` 才能修的问题，写进 REPORT，Claude 来改。
- **不提交、不推送、不发版、不改版本号**。改完留在工作区，REPORT 里列清楚改了哪些文件。
- Claude 在这台电脑上开着 Tauri 开发版（`npm run desktop:dev`，端口 5181 和 9223），**别关它、别占这两个端口**。要构建网页包用 `npm run build`（输出 `dist/`，不影响开发版）。
- 访问漫画网站要克制：一个源一次只发一个请求，不要全量扫。
- 每项做完在 `docs/ASTRA_REPORT.md` 末尾加一节「第十轮」：做了什么、怎么验的、结果（截图放 `docs/screenshots/comic/`）、没做成的和原因。

## 任务

| # | 内容 | 验证 |
|---|---|---|
| R7-1 | **安卓验收漫画源**。`npm run android:build` 出 debug APK，装到模拟器（SDK 在 `%LOCALAPPDATA%\Android\Sdk`；没有 AVD 就建一个 API 34 x86_64，Google APIs 镜像），打开 App。<br>① 安全：用 `chrome://inspect`（或 `adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>` + CDP，可以参照 `scripts/perf/cdp.mjs`）连上 WebView，到「插件」页展开任意漫画源的设置（会开出一个沙箱 iframe），在**沙箱 iframe 自己的执行上下文**里看：`typeof androidBridge`、`typeof Capacitor`、`typeof webkit`、`fetch('https://example.com')` 和 `XMLHttpRequest` 能不能出去、`indexedDB.open('x')` 能不能开。期望：androidBridge / Capacitor 都是 undefined，原生网络和存储都被拦。Claude 在 Windows 上用的探测脚本思路见 COMIC_PLAN「安全」一节<br>② 功能：插件页「漫画源」点「测一遍」，记下每个源的结果；探索页「漫画」标签、搜索页搜「海贼王」（漫画会和小说混在一起出来）、打开一部漫画读一话（条漫和翻页两种），各截一张 390 宽的图 | REPORT 贴 ① 的探测输出原文、② 的测一遍结果表和截图路径 |
| R7-2 | **iPhone：原生桥只认主 frame**。问题：WKWebView 的 `window.webkit.messageHandlers.bridge` 在所有 frame 都能用，而 Capacitor 6 的 `WebViewDelegationHandler.userContentController(_:didReceive:)` 不检查 `message.frameInfo.isMainFrame`（安卓的 `MessageHandler.java` 查了）。在 `ios/App/App/` 里修：自定义一个 `CAPBridgeViewController` 子类（storyboard 改指向它），在 `capacitorDidLoad()` 里把名为 `bridge` 的 script message handler 换成一个包装：`frameInfo.isMainFrame` 为假直接丢掉，为真转给原来的 `bridge.webViewDelegationHandler`。不改 node_modules。<br>这台电脑编译不了 iOS：写好代码、保证 Swift 语法和 Capacitor 6 的 API 对得上（读 `node_modules/@capacitor/ios/Capacitor/Capacitor/*.swift` 核对签名），`node scripts/ios-platform-test.mjs` 等现有静态检查要过。真机 / 模拟器验证等用户同意推送后走 GitHub Actions（`.github/workflows/ios.yml`），**你不推送** | REPORT 写清楚改了哪几个文件、为什么这样包、怎么在 CI 上验证（给出要在 iPhone 模拟器里跑的探测步骤，同 R7-1 ①） |
| R7-3 | **默认漫画源体检脚本** `scripts/comic-defaults-check.mjs`（新文件）：<br>① 读 `src/comic/default-sources.js`（随包附带的源和固定提交号），对比 venera-configs `main` 上的 `index.json`：哪些源出了新版、哪些被删了、索引里新加了哪些（新加的只列名字，收不收由人看 `src/comic/policy.js` 的白名单决定）<br>② 调 `node scripts/comic-test.mjs --live --bundled --all` 拿实测结果<br>③ 输出一份 markdown 报告到 stdout（源 / 内置版本 / 最新版本 / 实测结果 / 失败原因） | 跑一遍，REPORT 贴报告 |

不做：改漫画的界面和逻辑（Claude 在做）；书架追更、离线下载（下一轮）；发版。
