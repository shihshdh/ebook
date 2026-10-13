# 运行与打包

四端用同一套前端（`src/`）。网页版走浏览器 fetch 加带 CORS 的镜像，只用来开发预览；验收以 Windows 客户端（Tauri）、安卓 APK 和 iPhone IPA 为准，客户端走原生 HTTP（`src/lib/native.js`），不受 CORS 限制。

- **手机界面**：iPhone 和安卓共用一套 iOS 设计语言，样式在 `src/styles/mobile.css`，只在 `<html class="ui-mobile">` 下生效（`native.js` 的 `mobileUI`）。标签栏是 `src/components/GlassTabBar.jsx`。电脑版不受影响。
- **版本号**四处一起改：`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`（连同 `Cargo.lock`）、`android/app/build.gradle`（versionName，versionCode +1）。iPhone 的版本号构建时从 package.json 取，build 号用 GitHub Actions 的运行序号。界面上的「版本」也从 package.json 来。

## 网页（开发）

```bash
npm install
npm run dev        # http://localhost:5180
```

开发服务器用完就关（`vite.config.js` 已经不监视 `src-tauri/target` 等构建产物，但开着照样占资源）。

## Windows 桌面版

双击 `打包桌面版.bat`，或者运行 `npm run desktop:build`。

- 产物：`src-tauri/target/release/bundle/nsis/EBOOK_<版本>_x64-setup.exe`，复制一份到项目根的 `release/`。
- `src-tauri/target` 是指向 `D:\DevCache\librarium-target` 的链接（Rust 编译产物有几个 G，不放桌面）。
- 安装包按当前用户安装，不需要管理员权限；内部包标识是 `app.librarium.reader`。升级前先关掉正在运行的 EBOOK。
- 需要：Rust（MSVC 工具链）、Visual Studio C++ Build Tools。系统没有 WebView2 时，安装器会自动下载。

## Android

双击 `打包安卓版.bat`：构建前端 → `cap sync` → `gradlew assembleRelease` → 复制成 `release/EBOOK_<版本>.apk`（已签名、已瘦身）。

- 需要 JDK 17 以上。没单独装 JDK 时，可以用 Android Studio 自带的：`set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`。
- Android SDK 默认在 `%LOCALAPPDATA%\Android\Sdk`，脚本会自动设置 `ANDROID_HOME`；直接跑 `gradlew` 时要自己设。
- **正式签名**：`android/keystore/` 和 `android/keystore.properties`，两者都不进仓库，务必备份——丢了以后新版本装不上去，只能先卸载旧版。在别的工作区打包时，可以临时写一份 `keystore.properties` 指向原来的 jks。注意 Java 按 ISO-8859-1 读这个文件，路径里的中文要写成 `\uXXXX`。
- 打完包 `cd android && gradlew --stop`：Gradle 守护进程会一直占着 1–2 GB 内存。
- 原生插件 `EbookNative.java`：文件打开、导出、蓝奏云 / 网页小窗、系统栏、APK 安装、语义触感（`View.performHapticFeedback`）。

两份 bat 使用 UTF-8 内容和 Windows CRLF 换行；编辑时保留 CRLF，避免 CMD 切换到 UTF-8 代码页后读错命令。第一次构建需要联网下载 Rust / Gradle 依赖。

## iPhone

iOS 工程在 `ios/App`，最低 iOS 15。原生插件 `EbookNative.swift` 负责：文件打开和导出到系统「文件」、独立网页下载窗口、状态栏和沉浸模式、预热的触感发生器（`haptic` / `prepareHaptics`），以及上报系统的「降低透明度」「增强对比度」。iPhone 不走应用内更新，用 SideStore 覆盖安装新版 IPA。

### 构建（不需要 Mac）

- GitHub Actions 的 iOS 构建（`.github/workflows/ios.yml`）：往 `codex/ios-personal` 分支推送 `src/`、`ios/`、`public/` 等改动时自动运行，也可以手动触发。用的是标准 macOS runner，不需要 Apple 账号、证书或仓库密钥。
- 流程：平台测试（`node --test scripts/ios-platform-test.mjs`）→ `npm run ios:build`，云端 Xcode 编译真机 arm64 Release，打成未签名 IPA → 在 iPhone 模拟器上冷启动，检查进程存活并截图。
- 产物：Actions 附件 `EBOOK-iOS-unsigned`（`EBOOK_<版本>_ios-unsigned.ipa` 和 `.sha256`，保留 30 天）；模拟器首屏截图在附件 `EBOOK-iOS-smoke` 里，在 Windows 上想看真 iOS 渲染（毛玻璃、系统字体），就看这张。
- 有 Mac 时也可以本地打：`npm ci`，然后 `npm run ios:build`（需要 Xcode、命令行工具和 CocoaPods）。
- 这是**未签名包**，不能直接点开安装，也不是 App Store / TestFlight 包。安装步骤见 README 的「iPhone 安装」。

### 测试

- `node --test scripts/ios-platform-test.mjs`：四个平台的路由和更新资格，以及 iOS、安卓的原生触感和无障碍状态，能不能经桥接到达原生插件。
- `python scripts/ios-ui-test.py http://127.0.0.1:5178`：先运行 `npm run dev -- --host 127.0.0.1 --port 5178`，并安装 Python Playwright 和 WebKit。覆盖以下内容：
  - 阅读器：EPUB 沙盒、封面跨章、前后滑动、菜单、目录、横屏、滚动模式退出；
  - 页面：五种 iPhone 尺寸（含横屏）下的六个主页面，不横向溢出；
  - 交互：世界切换，玻璃标签栏透镜的浮起、拖动和落位，键盘弹出时可见区和底栏让位。
- Windows 上的 WebKit 不渲染 `backdrop-filter`，截图里玻璃看着发透是正常的。要看毛玻璃效果，用 Chromium 内核的浏览器（Playwright 用 `channel='msedge'`）。Windows 测试机的帧率不能当作 iPhone 的帧率。

### 已知限制

- EPUB 保持 `allowScriptedContent: false`。WebKit 会屏蔽沙箱里的事件，所以 iPhone 的分页手势由外层接收；这个模式下暂时不能长按正文划线、选字，目录、书签、搜索、进度跳转都照常。
- 标签栏透镜的折射是近似实现：WebKit 的 `backdrop-filter` 做不了真折射，透镜里是放大的拷贝加横向色差。
- 内置网页显示加载进度、网络失败和重试；「更多」里可以用 Safari 打开、复制链接和提取码。在 Safari 里下载的书，要从书架导入，或者在「文件」里选「用 EBOOK 打开」。蓝奏云受站点状态、验证码和手机网络影响，要在真机上验证。
- 原生打开和网页下载入架，单个文件上限 120 MB。

## 发版

客户端启动 8 秒后读 main 上的 `latest.json`，发现新版本就提示；下载走 `releases/download/v<版本>/<文件名>`（经国内加速代理），下完核对 SHA-256。所以 tag 名、文件名必须和 `latest.json` 对得上，而且**要先传好 Release 附件，再推清单**——清单先上去的话，这期间点更新会 404。

### 两端一起发（Windows + 安卓）

1. 写好更新说明 `docs/RELEASE_<版本>.md`：第一行「# 标题」是 Release 的标题，下一行「> 一句话」会写进 `latest.json`，其余是正文。
2. 在 main 上、工作区干净、和 GitHub 上的 main 一致时，双击 `发版.bat`。它会：
   - 先检查代码状态；
   - 打 Windows 和安卓两个包；
   - 运行 `node release.mjs`，建 GitHub Release、上传附件；
   - 改写 `latest.json` 和 README 里的下载链接，推到 main。

### 只发一端（比如 0.3.17 只发了安卓）

1. 打好那一端的包，在 GitHub 上建 Release `v<版本>`（目标 main），只传这一端的附件。
2. `latest.json` 里只写这一端：没有自己安装包的客户端读到清单后不会提示更新，会继续用旧版。
3. README 里只改这一端的下载链接，提交推到 main。

### 附上 iPhone 版

iPhone 不读 `latest.json`。在 Actions 里找到这个版本号提交对应的 iOS 构建，下载附件 `EBOOK-iOS-unsigned`，核对 SHA-256，把 IPA 和 `.sha256` 一起传到同一个 Release，再改 README 里的 IPA 链接。

开发中的测试包，发成预发布版 `v<版本>-ios.N`。

## 其它工具

- 公版书源书目：`src/plugins/public/make-catalog.mjs`（用法写在文件开头），用来重新生成 `catalog.json`。
- Legado 规则引擎单测：`node scripts/legado-test.mjs`（需要 Node 22.15 以上）。
