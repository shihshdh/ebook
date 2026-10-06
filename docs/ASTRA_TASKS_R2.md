# 给 ASTRA 的任务书 · 第二轮（2026-10-06）

项目已改名 **EBOOK**（内部存储键、包名 `app.librarium.reader` 不变）。用户的方向：**我们做的是客户端**——验收以 Windows 客户端（Tauri / WebView2）和安卓 APK 为准，网页版只是开发预览；两端要"狠狠优化"；国内不开代理也要能用。

这一轮你负责**原生层**，Claude 负责前端。两边靠下面的 `native.js` 约定对接，可以同时开工、互不等待。

## 硬规矩（同第一轮，加一条）

1. **只改你名下的文件**：`src/lib/native.js`、`src-tauri/**`、`android/**`、`capacitor.config.json`、`src/plugins/legado/*`、`scripts/**`、`docs/ASTRA_*`、`docs/BUILD.md`、`打包*.bat`、`package.json`（只加依赖和 scripts）。其余只读（`src/App.jsx`、`src/pages/*`、`src/components/*`、`src/styles/*`、其它 `src/lib/*` 是 Claude 的）。
2. 不 `git commit`，不删别人的文件。
3. 中文注释说"为什么"。
4. **新增**：`native.js` 里下面约定的导出，签名定了就不要改；网页端全部是安全的空操作（不报错、返回合理默认值），Claude 的代码会无条件调用它们。
5. 每完成一行，在 `docs/ASTRA_REPORT.md` 追加一段（做了什么 / 文件 / 怎么验证 / 已知问题），并把 `docs/PROGRESS.md` 里对应那一行的状态改掉（只改你那几行的「状态」和「备注」列）。

## native.js 新约定（Claude 按这个写前端，你按这个实现）

```js
// ——— 已有，加一个可选参数 opts ———
export const platform;            // 'web' | 'tauri' | 'capacitor'
export const isNative;
export async function nativeGetText(url, opts?);
export async function nativeGetBinary(url, onProgress?, opts?);
//   opts = { signal?: AbortSignal, timeout?: number /* ms，默认 20000 连接超时 */ }
//   net.js 这轮改成多镜像并行竞速：赢家出来后会 abort 其它请求。
//   tauri：把 signal 传给 plugin-http 的 fetch；signal 已中止就立刻抛 AbortError。
//   capacitor：CapacitorHttp 不能真中止，就在 signal abort 时让 Promise 立刻 reject（结果丢掉即可）。

// ——— 窗口（只在 tauri 有效；其它平台：动作是空操作，查询返回 false） ———
export const win = {
  minimize(): Promise<void>,
  toggleMaximize(): Promise<void>,
  close(): Promise<void>,
  isMaximized(): Promise<boolean>,
  onMaximizedChange(cb: (max: boolean) => void): () => void,   // 返回取消订阅；用 onResized 实现即可
  setFullscreen(on: boolean): Promise<void>,                   // 阅读器 F11 / 沉浸
  isFullscreen(): Promise<boolean>,
  show(): Promise<void>,                                       // 前端首帧画完后调用一次（防白闪，见 R2-1）
};
// 拖动：Claude 的标题栏用 data-tauri-drag-region 属性，你只需保证权限放行。

// ——— 安卓 ———
export function onBackButton(handler: () => boolean): () => void;
//   按返回键时，从最后注册的 handler 往前依次调用，返回 true 表示"我处理了"就停；
//   都没处理 → App.minimizeApp()（安卓惯例：退到后台，不杀进程）。返回值是取消注册。
//   网页 / tauri：空操作，返回空函数。
export function haptic(kind: 'light' | 'medium' | 'select'): void;   // 翻页、加书签时的轻震；非安卓空操作
export function setSystemBars(opts: { dark: boolean }): void;
//   dark=true 表示当前是深色主题 → 状态栏/导航栏图标用浅色；反之用深色图标。背景都透明（沉浸）。
//   Claude 在启动和切主题时调用。
```

**安全区**：安卓 WebView 的 `env(safe-area-inset-*)` 不可靠。请在原生侧监听 WindowInsets（状态栏、导航栏、刘海），把像素值写到 `document.documentElement` 的 CSS 变量 `--native-safe-top / --native-safe-bottom / --native-safe-left / --native-safe-right`（带 `px`），转屏和插入变化时更新。Claude 的 CSS 写成 `max(env(safe-area-inset-top), var(--native-safe-top, 0px))`。

## 主题色（启动底色要和首帧一致，否则会闪）

- 默认浅色「象牙纸」：底色 `#f4efe6`；深色「黑金」：底色 `#080706`。主题存在 `localStorage['librarium.theme']`（`'dark'` 或其它=浅色）。
- 原生侧拿不到 localStorage 的话，启动底色用浅色 `#f4efe6`，配合 R2-1 / R2-2 的"画完再显示"就不会闪。

---

## 任务（按顺序做；一行 = 一个能单独验证的模块）

| # | 模块 | 验证 |
|---|---|---|
| R2-1 | **Windows 无边框窗口**：`decorations: false` + `shadow: true`（Win11 圆角阴影）；窗口先 `visible: false`，前端调 `win.show()` 再显示，另加 Rust 侧 2 秒兜底自动显示；`window-state` 的 StateFlags 去掉 VISIBLE 免得它抢先显示；capabilities 放行 `core:window:allow-start-dragging / allow-minimize / allow-toggle-maximize / allow-close / allow-set-fullscreen / allow-is-fullscreen / allow-is-maximized / allow-show`；实现 `native.js` 的 `win.*` | 临时在网页控制台调 `win.minimize()` 等都生效；打包后启动不再有系统标题栏，也不闪白/闪黑 |
| R2-2 | **网络放行**：Legado 书源会访问任意站点，Tauri http scope 改成 `http://*` 和 `https://*`；安卓允许明文 HTTP（network_security_config，`cleartextTrafficPermitted=true`）；两端请求头带一个正常的移动/桌面 UA（有些镜像拒绝空 UA） | 客户端里请求 `http://` 地址和随便一个 https 站点都不再被拒 |
| R2-3 | **安卓原生**：装 `@capacitor/app`、`@capacitor/status-bar`、`@capacitor/haptics`（都用 ^6）；实现 `onBackButton / haptic / setSystemBars`；沉浸状态栏 + 透明导航栏（edge-to-edge）；安全区 CSS 变量注入（见上）；启动页用 Android 12 SplashScreen API，底色 `#f4efe6`，中间是图标；`windowSoftInputMode=adjustResize` | 装到手机/模拟器：状态栏透明、内容不被刘海和底部手势条挡住；按返回键会调到 handler |
| R2-4 | **安卓 release 签名 + 瘦身**：生成正式签名（keystore 放 `android/keystore/`，密码写 `android/keystore.properties`，两者都别进打包产物；在 REPORT 里提醒用户备份——丢了以后装新版要先卸载）；release 开 `minifyEnabled` + `shrinkResources`；`打包安卓版.bat` 改为产出签名 release APK，文件名带版本号 `EBOOK_<version>.apk` 复制到项目根的 `release/` | `release/EBOOK_x.y.z.apk` < 5MB，`apksigner verify` 通过 |
| R2-5 | **新图标**：Claude 会放 `public/app-icon.svg`（完整图标，1024 方形）和 `public/app-icon-fg.svg`（安卓自适应图标前景，透明底，图形在中间 66% 安全区内）——在那之前先做别的。用 `scripts/` 里的 node 脚本（resvg 或 sharp）出 PNG，再 `tauri icon`；安卓出 adaptive icon（前景 + 底色 `#0d0b09`）和各密度 mipmap | 安装包、开始菜单、安卓桌面都是新 EBOOK 图标 |
| R2-6 | **Legado 书源规则引擎核心** `src/plugins/legado/`：解析 Legado 书源 JSON（单个或数组）；规则支持 CSS 选择器（`@css:` 及默认 JSoup 风格 `class.xxx.0@tag.a@href`）、`@text / @href / @src / @html / @ownText`、`##正则##替换`、`@json:` / `$.` JSONPath、`{{key}}` `{{page}}` 模板、`<js>` 段先**跳过并标记不支持**（不要 eval 远程脚本）；四步 `search(source, keyword) / bookInfo / toc / content`，网络一律走 `net.js` 的 `getText`；带单元测试，用本地 HTML 夹具 | `node scripts/legado-test.mjs` 全绿；夹具跑完搜索→详情→目录→正文四步；REPORT 里写清支持/不支持的规则语法清单 |
| R2-7 | **两端重新打包** | `release/` 下有新的 `EBOOK_<version>_x64-setup.exe` 和 `EBOOK_<version>.apk`；桌面版装上能启动、拉到书目 |
| R2-8 | （可选，等 Claude 在 PROGRESS 里把「安卓返回键 / 安全区前端」标完成再做）**模拟器走查**：本机 SDK 没有系统镜像和 AVD，需要装 cmdline-tools + 一个 x86_64 镜像（约 1GB）；走「首页 → 搜索 → 下载 → 阅读 → 翻页 → 下拉书签 → 返回键」 | REPORT 里贴 390 宽截图和问题清单；下载太慢就标「阻塞」写原因 |

版本号：这一轮统一升到 **0.2.0**（`package.json`、`tauri.conf.json`、`android/app/build.gradle` 的 versionName，versionCode 2）。

## 开工前先读

- `docs/SCHEDULE.md`（今天的分工和文件归属）
- `src/lib/net.js`（Claude 这轮在改：多镜像并行竞速，按上面的 opts 约定调用你的 `nativeGetText/Binary`）
- 参照：`C:\Users\ys221\Desktop\我的网页\noel-desktop`（同一用户已上线的 Tauri 客户端）
