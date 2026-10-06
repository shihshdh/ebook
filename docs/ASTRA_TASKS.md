# 给 ASTRA 的任务书 · LIBRARIUM（夜读）

你和 Claude 一起做这个项目，分工并行。**Claude 负责**：应用骨架、路由、导航、开屏、数据插件（mojimoon 书源）、首页 / 探索 / 书架 / 书籍详情 / 插件页，以及效果 ①②③⑤。**你负责下面 4 块**，按顺序做，每块做完在 `docs/ASTRA_REPORT.md` 追加一段说明（做了什么、文件清单、怎么验证、已知问题）。

## 项目是什么

一个轻小说阅读器，网页 + Windows 桌面（Tauri 2）+ Android（Capacitor 6）三端同一套前端。
书源是 GitHub 上的 mojimoon/wenku8（静态 JSON + GitHub Releases 里的 EPUB），**纯前端、没有后端**。

- 项目根目录：`C:\Users\ys221\Desktop\我的网页\文库\librarium`
- 技术栈：Vite 5 + React 18（JSX，不用 TS）+ react-router-dom 6（HashRouter）+ epubjs + three@0.168
- Claude 的开发服务器用 5180 端口；你要自己起的话用 **5181**（`npx vite --port 5181`）

## 硬规矩

1. **只改/新建下面分给你的文件。** 其它文件（尤其 `src/App.jsx`、`src/main.jsx`、`src/styles/tokens.css`、`src/styles/base.css`、`src/lib/*.js` 里不属于你的）只读。需要改约定，在 REPORT 里写清楚，由 Claude 来改。
2. 不要 `git commit`，不要删别人的文件。可以 `npm i` 加依赖，但只加你这块需要的，并写进 REPORT。
3. 代码风格：中文注释、说"为什么"；动效只动 transform / opacity / clip-path；所有 rAF 循环在不可见或已收敛时停下；`prefers-reduced-motion` 和触屏要有降级。
4. 视觉语言必须对齐家族标准（下面"参照"）：暖黑底 `#080706`、金 `#e9cb8b`、淡紫只点缀；衬线标题（`var(--serif)`），Cinzel 字标（`var(--display)`）；液态玻璃面板用全局类 `.glass`。**先读** `src/styles/tokens.css` 和 `src/styles/base.css`，直接用里面的变量和类。

## 参照（先读）

- 六个效果的设计笔记：`C:\Users\ys221\.claude\design-patterns\interaction-effects.md`（④⑥ 的参数都在里面，已调好）
- Pixel Reconstruction：`C:\Users\ys221\Desktop\sharp-web`
  - `components/GlassInvite.tsx` —— ④ 玻璃折射的成品实现，**直接移植**
  - `lib/liquid.ts`、`lib/motion.ts`、`app/globals.css`
- ORACULUM 塔罗：`C:\Users\ys221\Desktop\我的网页\tarot-gesture-app\src\index.css`（黑金玻璃）
- Noël 圣诞树：`C:\Users\ys221\Desktop\我的网页\html\index.html`
- 项目里已有：`src/lib/motion.js`（Spring / LiquidSpring / prefersReduced / isTouch / hash / seeded）、`src/lib/perf.js`（`tier()` 返回 'ultra'|'high'|'balanced'|'low'，`canWebGL2()`）

---

## 任务 1 · 阅读器（最重要）

**文件**：`src/pages/Reader.jsx`（default export）、`src/styles/reader.css`、可选 `src/reader/*`

路由 `/read/:id` 会渲染 `<Reader />`（Claude 在 App.jsx 里挂好），`id` 是书架条目 id（`useParams().id`，记得 `decodeURIComponent`）。

数据接口（已写好，见 `src/lib/shelf.js`、`src/lib/prefs.js`）：
- `getShelfItem(id)` → ShelfItem（title / author / ext / progress {cfi, percent, chapter}）
- `getShelfBlob(id)` → Blob（EPUB；`ext === 'txt'` 时是纯文本）
- `updateProgress(id, {cfi, percent, chapter})`（你做 500ms 防抖）
- `listBookmarks / addBookmark(id, {ref, label}) / removeBookmark(id, ref)`
- `usePrefs()` → `[prefs, setPrefs]`；`READER_THEMES`（night/paper/sepia/oled，每个有 page/text/link/chrome 色）、`READER_FONTS`（serif/sans/kai）；prefs 字段：readerTheme / readerFont / fontSize(%) / lineHeight / readerMode('paginated'|'scrolled')

要求：
- epub.js 渲染；翻页模式 + 滚动模式；主题、字体、字号、行距改了不重建 rendition（滚动/翻页切换才重建）
- **沉浸式**：默认只有正文；点屏幕中间 1/3 呼出上下两条玻璃工具栏（顶部：返回、书名·章节；底部：进度滑条 + 百分比、目录、书签、设置）。再点或 3 秒无操作收起
- 翻页：点左/右 1/3、键盘方向键/空格/PageUp/PageDown、**手机左右滑动**（在 iframe 文档里监听 touch，阈值 40px，带一点跟手位移的视觉反馈更好）
- 目录抽屉（桌面左侧滑出 / 手机底部 sheet）、书签列表、设置面板（主题四个色块、字体、字号 ±、行距、翻页/滚动 切换）——设置面板用 `.glass`
- 进度：`book.locations.generate(1200)` 后计算百分比；进度条可拖动跳转
- 打开时恢复 `progress.cfi`；退出时（返回按钮）`navigate(-1)`，没有历史就去 `/shelf`
- TXT：把文本按 `第X章/卷/回/节` 正则切章，渲染成自己的分页/滚动视图（或者转成内存 EPUB 再走 epub.js，二选一，写清楚）
- 进入动画：Claude 会在打开书时做一个从封面位置展开的 clip-path 转场（① 效果），你的页面只需在首帧就把背景色设成当前主题的 `chrome` 色，正文渲染好后 300ms 淡入
- 桌面宽屏（≥1100px）翻页模式下正文最大宽度约 720px 居中，两侧留暗；手机全屏，注意 safe-area

## 任务 2 · ⑥ 书页之河（首页英雄区背景）

**文件**：`src/effects/PageRiver.jsx`（default export）、可选 `src/effects/PageRiver.css`

把笔记里的"咖啡豆粒子"换成**书页**：几千片薄纸页（InstancedMesh，细长的薄盒或微弯的平面，米白/旧纸色，少量金边页）组成一条从左上流向右下的"纸河"，缓慢漂移自转；整体很暗，**只有鼠标附近被一盏暖色台灯照亮**（跟随指针的 PointLight，衰减距离小 + 极弱环境光）；指针划过推开一个空洞，被推的纸页**翻滚散开**，弹簧慢慢漂回原位；景深感（可以用 fog + 尺寸/亮度分层代替 BokehPass，以性能为先）。

- Props：`{ className?: string, style?: object }`；组件铺满父元素（父元素 position:relative，由 Claude 控制尺寸）
- 数量按 `tier()`：ultra 5000 / high 3500 / balanced 1800 / low 或 reduced-motion 或无 WebGL2 → 不跑 WebGL，渲染一个静态的 CSS 版（暗底 + 一团暖色径向光 + 几片 CSS 纸页即可）
- 触屏：手指按住拖动 = 台灯跟手；松手后台灯缓慢回到画面中心偏右
- 按需渲染：IntersectionObserver 不可见就停；`document.hidden` 停；窗口 resize 防抖
- `three` 用动态 `import('three')`，不要进主包
- 卸载时 dispose 全部 geometry/material/renderer

## 任务 3 · ④ Prism 玻璃折射（搜索页英雄区）

**文件**：`src/effects/PrismGlass.jsx`（default export）、`src/effects/PrismGlass.css`

把 `sharp-web/components/GlassInvite.tsx` 移植成 JSX：
- Props：`{ title: string[] /* 例如 ['找一本', '今晚的书。'] */, lead?: string, caption?: string /* 右下角小字，默认 'TRANSMISSION · IOR 1.46 · DISPERSION' */, children /* 叠在上面的真实 HTML，比如搜索框 */, height?: string /* 默认 'min(72vh, 640px)' */ }`
- **只用深色调色板**（`#0b0b0d` 底、金色柔光 `#d4af6a26`、灰蓝 `#4f6f9622`），不需要主题监听
- children 放在一个绝对定位的层里，位置由 CSS 决定（Claude 会放一个搜索框在标题下方）；这一层不随玻璃倾斜
- 字体：标题用 `var(--serif)` 的计算值（`getComputedStyle`），`document.fonts.ready` 后重画
- 降级：reduced-motion / 触屏 / `tier()==='low'` / 无 WebGL2 → 静态版（同样的标题排版 + CSS 柔光 + 一层 CSS 玻璃碎片的假象即可）
- 只在可见且未收敛时渲染；卸载 dispose

## 任务 4 · 三端打包

**文件**：`src/lib/native.js`（实现 TODO）、`src-tauri/**`、`capacitor.config.json`、`android/**`（cap 生成）、`package.json` 的 scripts（只加，不删）、`打包桌面版.bat`、`打包安卓版.bat`、`docs/BUILD.md`

- `native.js`：实现 Tauri 分支（`@tauri-apps/plugin-http` 的 fetch，已装）和 Capacitor 分支（`CapacitorHttp`，binary 用 `responseType: 'blob'` 或 base64 转 Blob）。签名见文件顶部注释，**不要改签名**
- Tauri 2：参照 `C:\Users\ys221\Desktop\我的网页\noel-desktop`（同一个用户的已上线客户端：nsis、currentUser、SimpChinese、single-instance、window-state）。productName `LIBRARIUM`，identifier `app.librarium.reader`，窗口 1280×820、最小 380×640、深色背景 `#080706` 无白闪。http 插件权限放行：`https://cdn.jsdelivr.net/*`、`https://raw.githubusercontent.com/*`、`https://github.com/*`、`https://release-assets.githubusercontent.com/*`、`https://objects.githubusercontent.com/*`、`https://gh-proxy.org/*`、`https://gh-proxy.com/*`、`https://ghfast.top/*`、`https://api.bgm.tv/*`、`https://lain.bgm.tv/*`
- 图标：用 `public/favicon.svg` 的图形生成一张 1024 的 `app-icon.png`（可以用 node + sharp/resvg，或者先画个占位）然后 `tauri icon`
- Capacitor 6：appId `app.librarium.reader`，appName `LIBRARIUM`，webDir `dist`，androidScheme https，启用 CapacitorHttp，状态栏深色、沉浸
- Android SDK 在 `%LOCALAPPDATA%\Android\Sdk`（ANDROID_HOME 没设，脚本里自己设），JDK 17 在 PATH 里。目标：`打包安卓版.bat` 能产出 debug APK
- Rust 1.98 已装。目标：`打包桌面版.bat` 能产出 nsis 安装包
- 两个都实际跑一遍构建，把产物路径写进 REPORT

---

## 汇报

每完成一块，在 `docs/ASTRA_REPORT.md` 追加：

```
## 任务 N · 名称 —— 完成 / 部分完成
- 文件：…
- 做法要点：…
- 验证：…（怎么看到效果）
- 已知问题 / 需要 Claude 配合的：…
```
