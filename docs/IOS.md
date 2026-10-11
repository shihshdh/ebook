# iOS 客户端

没有 Mac、只有普通（免费）Apple 账号时的做法：GitHub 的云端 Mac 编出**不签名**的安装包（IPA），
你在 Windows 上用 **SideStore**（推荐）或 **AltStore** 拿自己的 Apple 账号签名，装到自己的 iPhone 上。

- 最低 iOS 16.4（iPhone 8 及以后的机型都能升到）。用 Xcode 27（iOS 27 SDK）编，iOS 27 上按新系统的规矩走（场景生命周期、液态玻璃导航栏）。
- 免费 Apple 账号签的应用 **7 天有效**，到期前要续签（续签不是重装，书和设置都在）。这是 Apple 的限制，绕不过去。
  SideStore 可以在手机上自己续签，不用每周接电脑；AltStore 要电脑上开着 AltServer、和手机在同一个 Wi-Fi。
- 免费账号同时最多 3 个侧载应用、每周最多注册 10 个应用 ID。

## 1. 拿到安装包

- **正式版**：GitHub Releases 里的 `EBOOK_<版本>.ipa`（发版时云端自动编好传上去，比 Windows / 安卓包晚十来分钟出现）。
  国内加速：`https://ghfast.top/https://github.com/shihshdh/ebook/releases/download/v<版本>/EBOOK_<版本>.ipa`
- **试用版**（还没发版的改动）：GitHub → Actions → 「iOS 安装包」→ 点最新一次运行 → 页面底部 Artifacts 里下 `EBOOK_<版本>_ipa`（是个 zip，解开就是 IPA）。

## 2. 第一次安装

按 SideStore 官方文档装好 SideStore 本身（要在电脑上做一次配对；文档会随版本变，以官方为准）：
<https://docs.sidestore.io>。用 AltStore 的话看 <https://faq.altstore.io>（Windows 上要装苹果官网版的 iTunes 和 iCloud，不是微软商店版）。

装好以后：把 IPA 存到 iPhone 的「文件」里 → 打开 SideStore（或 AltStore）→「My Apps / 我的应用」→ 左上角「+」→ 选这个 IPA。
第一次打开 EBOOK 前，iPhone 可能要你在「设置 → 通用 → VPN 与设备管理」里信任你的 Apple 账号。

## 3. 更新

EBOOK 里检查到新版本时，点「更新」会在 Safari 里下载新的 IPA，下好后同样在 SideStore 里「+」选它安装，覆盖旧版，书和设置都在。

## 和安卓版不一样的地方

- 检查更新：iOS 不允许应用自己装更新，所以是「Safari 下载 + SideStore 安装」。
- 导出（账户备份、笔记）：弹「存储到文件」，你选一个文件夹存进去。
- 「用 EBOOK 打开」：在「文件」或别的应用里分享 EPUB / TXT / ZIP，选 EBOOK。
- 没有系统返回键：用页面里的返回 / 关闭按钮（书详情还可以往下拖关），和电脑版一样操作。

## 给开发者

- 工程在 `ios/`（Capacitor 6）。iOS 27 的场景生命周期是手接的（`AppDelegate.swift` + `SceneDelegate.swift`），
  升到 Capacitor 8.5 以后可以换成它自带的。原生插件 `EbookNativePlugin.swift` 和安卓的 `EbookNative.java` 同名同参数。
- 云端编译：`.github/workflows/ios.yml`。推代码会编一次；发 Release 时编好自动传 IPA。版本号用 `package.json`，
  构建号用安卓的 `versionCode`，iOS 工程里不用另外改版本。
- 本地没有 Mac 也能改：改完推上去，看 Actions 的日志。
