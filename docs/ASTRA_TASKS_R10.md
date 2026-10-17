# ASTRA 第十轮任务书：重新设计 EBOOK 的应用图标（2026-10-17）

用户原话：「我们的图标太丑了，按照 Claude 和 GPT 的图标设计风格给我重新设计一下」。

## 工作区（必须遵守）

- 只在 `C:\Users\ys221\Desktop\我的网页\文库\librarium-icon` 里干活，分支 `feat/new-icon`（从 main 0.4.0 分出来）。
- **不要碰** `librarium-ios`（Claude 在改漫画加载）、`librarium-sources`（另一个会话在找漫画源）、`librarium`。
- 只改图标相关：`public/app-icon.svg`（完整图标）、`public/app-icon-fg.svg`（安卓自适应前景）、`public/favicon.svg`、
  `scripts/make-icons.mjs` 生成出来的文件（`src-tauri/app-icon.png`、`src-tauri/icons/*`、`android/app/src/main/res/mipmap-*`、
  `ios/App/App/Assets.xcassets/AppIcon.appiconset/*`），需要的话改 `make-icons.mjs` / `ios-assets.mjs` 里的底色常量；
  再加 `docs/ICON_R10.md`（设计说明 + 预览图）。别的代码不动。
- 提交到 `feat/new-icon`，**不要推送、不要合并 main、不要发版**。

## 设计要求

- 参照 Claude 和 ChatGPT 应用图标的**风格**（不是照抄它们的图形、不能出现它们的标志）：
  - 一个简单、居中、几何化的单一符号，第一眼就认得出，16px 也看得清；
  - 平涂的纯色底（或极轻的渐变），不要写实、不要高光反光、不要细碎装饰、不要文字（不写 EBOOK 字样）；
  - 符号用一种颜色，线条粗细统一、圆角统一，留白充足（符号约占画布 55–62%）。
- **不要再用「夜读」这个主题**（用户明确说的）：不要月牙、夜空、暖黑夜色这类意象，也不必沿用现在的暖黑 + 金色。
- 意思要对：这是一个看轻小说和漫画的阅读器（书 + 漫画）。符号可以从「书页 / 翻开的书 / 书签 / 漫画分格」里提炼，
  抽象到 Claude 那个星芒、ChatGPT 那个花结的简洁程度。
- 配色自由，参照 Claude（单一暖色底 + 浅色符号）、ChatGPT（纯黑 / 纯白底 + 单色符号）那种干净的两色搭配。
  出 2–3 个方案，每个方案都出 1024 预览，并排放 iOS 圆角矩形蒙版、安卓圆形 / 圆角方形蒙版、Windows 任务栏 32px / 16px 的效果，
  放进 `docs/ICON_R10.md`。改了底色的话，同步改 `make-icons.mjs`、`ios-assets.mjs` 里的底色常量。
- 选一个你认为最好的设为正式图标，跑 `node scripts/make-icons.mjs` 和 `npx tauri icon src-tauri/app-icon.png`、
  `node scripts/ios-assets.mjs`（只为生成 iOS 图标的话可以只跑生成那段）生成全部尺寸。安卓自适应图标前景要落在 66dp 安全区里。
- 检查：各尺寸 PNG 都生成、尺寸对、没有透明边错位；`npm run build` 通过。

## 交付

`docs/ICON_R10.md` 里放方案对比图和选择理由；`docs/ASTRA_REPORT.md` 加「第十三轮」摘要；提交。做完在 ICON_R10.md 最后写「完成」。
