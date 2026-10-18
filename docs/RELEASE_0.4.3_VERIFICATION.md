# EBOOK 0.4.3 验收记录

产品与最终构建提交：`4899705380a9d17ec4bcc1795f586ea773f622b0`。后续仅补充验收脚本与文档，不改变产品资源。

本轮修复漫画连续翻页和跨章节黑屏、iPhone 详情弹层底部圆角，以及底栏玻璃滑块。以 iPhone 16 Pro 为主，另覆盖 SE、Pro Max 和横屏。

正文使用独立的有限缓冲队列：手机前向四张、反向两张，桌面前向六张；最多三项下载。页面按 URL 维持同一个 DOM 节点，目标未显示时保留原画面，跨章节显式转移图片所有权并等待新图片身份匹配，避免旧加载回调提前释放过渡帧。页面离开窗口及时释放 URL；不缓存整话。

玻璃交互参考 Apple 官方 [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) 和 [Build a UIKit app with the new design](https://developer.apple.com/videos/play/wwdc2025/284/)。当前为跨平台 WebView 实现，保留背景模糊、半透明材质、轻微放大和色散，改进弹簧与落位，不宣称使用原生 UITabBar 或完全复制系统折射。

本地验收：

- 44 项平台、缓存、迁移、正文缓冲及请求回归，另有 3 项实际书单并发及 1 项巡检脚本转义回归通过，共 48 项。
- 固定 1600×2260 JPEG，每张传输人为延迟 350ms。旧版 Chromium 十次连翻多数 216–232ms，慢图时出现无图帧；新版已缓冲页 Chromium 约 5–16ms，WebKit 约 20–81ms。两轮中均保留画面，未采样到黑屏。这是受控夹具对比，不代表所有源站速度。
- WebKit：四张前向缓冲、慢图保留上一页、503 后重试、下一话预热、连续跳章、玻璃拖动/取消/快速切换/键盘/减少动态效果/深色模式通过。
- 安卓正文传输由浏览器桥接夹具执行，包含实际 Worker/base64 解码路径；上下滚动、反向回看、宽屏双页、RTL 通过。此项不是安卓模拟器原生验收。
- 缓冲样本持有 7 个 URL，远跳保留旧帧时有额外过渡页，离开后释放。不会保留整话。
- 16 Pro 402×874、顶部 62/底部 34 点安全区夹具：弹层左右各 10 点，顶部 72，底部 840，底部圆角 34；最后目录行完整可滚出。SE、Pro Max、横屏均无横向溢出。
- 玻璃选中滑块宽约 56、高 48 点；按住时约 65×53，背景保持 blur(8px)，最终中心偏差小于 0.01 点。

最终 [GitHub Actions](https://github.com/shihshdh/ebook/actions/runs/39116838165)：iPhone 构建、启动自检，以及 SE、16 Pro、16 Pro Max、16 Pro 深色四组原生模拟器巡检全部成功，共 93 屏，0 项失败。四组实际漫画连续五次翻页均未采样到黑屏；16 Pro 两组的滑块中心偏差约 0.003 点，收尾标记正确释放。

最终三端包已校验，截图、机器结果和完整日志保存在本机 `release/verification/0.4.3/` 与 `release/verification/reader-turns/`。

Windows 最终程序使用真实 Tauri HTTP 访问本机慢网夹具：15 次连翻 3–5ms，683 个采样帧无空白，图片显示尺寸约 724×1023。

WKWebView 动画完成通知延迟时，按动画时长保障收尾；WebKit 模拟通知永不返回的故障回归通过，最终原生模拟器四组的玻璃释放状态全部通过。严格跨话检查也包含整个图片区 DOM 暂时消失的情况，未出现黑屏帧。

安卓：versionCode=20，原正式签名证书 SHA-256 `ae240e84b49ae8f8b64bbea8374148e9af334a5f010a71e381c26e1a4ab09cf4` 保持一致；103 个网页资源逐文件完全一致。

iPhone：0.4.3（build 40），arm64，最低 iOS 15.0；103 个网页资源中 97 个字节一致，6 个仅 Windows/macOS 换行差异，无内容差异。IPA 未签名。

最终安装包 SHA-256：

```text
84424d08379964d66809983a6550c413140ea64f5a66410537b6fb1522e9e0e7  EBOOK_0.4.3_x64-setup.exe
268f6bbb09b81d5580be5dc2239640692354b8e5bc07d931b92e99af4f8cb1a9  EBOOK_0.4.3.apk
5c7e805b395658498f7a7a1ea620432a1dc3742390249217a60645fa0934be69  EBOOK_0.4.3_ios-unsigned.ipa
```
