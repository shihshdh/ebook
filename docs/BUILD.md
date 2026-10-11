# 运行与打包

三端同一套前端（`src/`）。网页版走浏览器 fetch + 带 CORS 的镜像，只做开发预览；验收以 Windows 客户端（Tauri）和安卓 APK 为准，它们走原生 HTTP（`src/lib/native.js`），不受 CORS 限制。

版本号四处一起改：`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`android/app/build.gradle`（versionName，versionCode +1）。界面上的「版本」从 package.json 来。

## 网页（开发）

```bash
npm install
npm run dev        # http://localhost:5180
```

开发服务器用完就关（`vite.config.js` 已经不监视 `src-tauri/target` 等构建产物，但开着照样占资源）。

## Windows 桌面版

双击 `打包桌面版.bat`，或 `npm run desktop:build`。

- 产物：`src-tauri/target/release/bundle/nsis/EBOOK_<版本>_x64-setup.exe`，复制一份到项目根的 `release/`。
- `src-tauri/target` 是指向 `D:\DevCache\librarium-target` 的链接（Rust 编译产物几个 G，不放桌面）。
- 安装包按当前用户安装，不需要管理员权限；内部包标识是 `app.librarium.reader`。本机装在 `D:\EBOOK`（`安装包.exe /S /D=D:\EBOOK` 静默安装/升级，会建桌面和开始菜单快捷方式）。升级前先关掉正在运行的 EBOOK。
- 需要：Rust（MSVC 工具链）、Visual Studio C++ Build Tools。WebView2 系统没有时安装器会自动下载。

## Android

双击 `打包安卓版.bat`：构建前端 → `cap sync` → `gradlew assembleRelease` → 复制成 `release/EBOOK_<版本>.apk`（已签名、已瘦身）。

- 需要 JDK 17+：没装单独的 JDK 时用 Android Studio 自带的，`set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`。
- Android SDK 默认 `%LOCALAPPDATA%\Android\Sdk`，脚本会自动设置 `ANDROID_HOME`。
- **正式签名**：`android/keystore/` + `android/keystore.properties`，两者都不进打包产物，务必备份——丢了以后新版本装不上去，只能先卸载旧版。
- 打完包 `cd android && gradlew --stop`，Gradle 守护进程会一直占着 1–2GB 内存。

两份 bat 使用 UTF-8 内容和 Windows CRLF 换行；编辑时保留 CRLF，避免 CMD 在切换 UTF-8 代码页后误读命令。首次构建需要联网下载 Rust / Gradle 依赖。

## 发版（客户端「检查更新」靠它）

1. 两端打好包，`release/` 里有 `EBOOK_<版本>_x64-setup.exe` 和 `EBOOK_<版本>.apk`。
2. 改仓库根的 `latest.json`：版本号、一句更新说明、两个文件名和 SHA-256（`Get-FileHash 文件 -Algorithm SHA256`）。
3. 提交推到 main，再建 GitHub Release，tag 是 `v<版本>`，两个文件作为附件传上去。

客户端启动 8 秒后读 main 上的 `latest.json`，版本更新就提示；下载走 `releases/download/v<版本>/<文件名>`（经国内加速代理），下完核对 SHA-256。所以 tag 名、文件名必须和 `latest.json` 对得上。

## iOS 自用安装（Windows + 云端 Mac + SideStore）

iOS 工程位于 `ios/App`，最低 iOS 15。与 Windows、Android 共用前端；`EbookNative.swift` 实现 iOS 文件打开、导出到系统「文件」、独立网页下载窗口和状态栏控制。iOS 停用 APK/EXE 自动更新，更新时通过 SideStore 覆盖安装新版 IPA，保持同一 Apple 账号及应用标识。

### 构建

- GitHub Actions：`iOS personal build`，在 `codex/ios-personal` 分支推送相关改动时运行，也支持手动触发（工作流合入默认分支后）。仅使用标准 macOS runner，不需要 Apple 账号、证书或仓库密钥。
- 有 Mac 时：`npm ci`，然后 `npm run ios:build`。需要 Xcode、命令行工具和 CocoaPods。
- `ios:sync` 会编译前端、同步 `package.json` 的版本及图标、运行 Capacitor sync。云端 Xcode 构建真机 arm64 Release，并检查应用、前端入口及 Capacitor framework 均存在。
- 产物：`release/EBOOK_<版本>_ios-unsigned.ipa` 和对应 `.sha256`，也会上传为 Actions 附件 `EBOOK-iOS-unsigned`（保留 30 天）。这是**未签名包**，不能直接点击安装，也不是 App Store/TestFlight 包。
- 本工作流不修改 Windows/Android 发布渠道的 `latest.json`，不创建或覆盖正式 Release。

### 安装及续签（在用户设备上完成）

1. 按 [SideStore 官方前置条件](https://docs.sidestore.io/docs/installation/prerequisites)准备 Windows、数据线、iPhone 和普通 Apple 账号；按当前官方指引安装所需驱动、LocalDevVPN 等组件。
2. 按 [官方安装步骤](https://docs.sidestore.io/docs/installation/install)安装 SideStore，在手机上完成信任/开发者模式等设置。Apple 账号只在自己的安装工具中登录，不提交到 GitHub 或聊天中。
3. 下载 Actions 的附件并解压，把其中 IPA 放到 iPhone「文件」中，在 SideStore 的 My Apps 页点「+」选择 IPA，完成签名安装。
4. 普通账号的签名有效期为 7 天；SideStore 可以尝试后台刷新，但不是永久签名。按 [官方 FAQ](https://docs.sidestore.io/docs/faq)配置并检查刷新条件，首次手动刷新成功后再依赖后台刷新。仅安装 EBOOK 不会自动配置 SideStore。
5. 后续更新用相同账号在 SideStore 导入新 IPA 覆盖安装；先用 EBOOK 账户导出备份，避免卸载造成数据丢失。

### 真机验收

云端编译通过不代表真机验收完成。首次安装后检查：冷启动及刘海/底部安全区；EPUB/TXT 文件导入与阅读；原生书源搜索及下载；内置网页/蓝奏云完成验证后的下载入架；账户 ZIP 导出、取消及恢复；深浅主题及阅读沉浸模式；后台恢复；设置中显示 iOS 且没有 APK 更新提示。原生打开/网页下载入架单文件上限为 120 MB。

## 其它工具

- 公版书源书目：`src/plugins/public/make-catalog.mjs`（用法写在文件开头），重新生成 `catalog.json`。
- Legado 规则引擎单测：`node scripts/legado-test.mjs`（需要 Node 22.15+）。
