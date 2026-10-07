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

## 其它

- 公版书源书目：`src/plugins/public/make-catalog.mjs`（用法写在文件开头），重新生成 `catalog.json`。
- Legado 规则引擎单测：`node scripts/legado-test.mjs`（需要 Node 22.15+）。
