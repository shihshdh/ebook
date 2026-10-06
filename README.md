# EBOOK

一个好看的轻小说阅读器：黑金 / 象牙纸两套主题、液态玻璃界面，Windows（Tauri）、安卓（Capacitor）和网页三端同一套代码。

## 功能

- **书库**：轻小说文库书目约 4300 本（读取 [mojimoon/wenku8](https://github.com/mojimoon/wenku8) 公开的整理结果，插图重制版按卷下载）；Project Gutenberg 中文公版书 427 本（四大名著、诸子、史书……，可下繁体原文或自动转换的简体版，自动分章）；本地 TXT / EPUB 导入
- **自定义书源**：兼容 Legado（阅读 App）书源规则的子集，书源由用户自己导入，不执行书源里的脚本
- **阅读器**：分页 / 滚动、四种纸张、字体字号行距、目录侧栏、书签、划线笔记、书内全文搜索（Ctrl+F）
- **书架**：继续阅读、阅读统计（今日 / 本周 / 连续天数）、筛选搜索排序、最近划线（导出 Markdown）、按书架题材推荐
- **推荐**：近年口碑佳作，偏文笔细腻的作品；探索页按奇幻 / 校园 / 科幻 / 恋爱 / 悬疑五个题材分区
- **客户端**：多镜像竞速（国内直连优先）、低功耗（空闲限帧）、本地多账户与备份、Windows 无边框玻璃标题栏

## 运行与打包

```bash
npm install
npm run dev               # 网页预览 http://localhost:5180
npm run desktop:build     # Windows 安装包
```

安卓与签名、版本号等细节见 [docs/BUILD.md](docs/BUILD.md)；开发进度看 [docs/PROGRESS.md](docs/PROGRESS.md)。

## 说明

EBOOK 本身不存放任何书籍内容，书目和文件都来自上面列出的第三方公开来源或用户自己导入；请支持正版。
