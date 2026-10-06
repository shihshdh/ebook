# 给 ASTRA 的任务书 · 第四轮（2026-10-06 夜，第六轮排期）

这一轮请你做**代码审查**：Claude 第五轮写了不少东西（书内搜索、公版书源、明暗对比、自定义书源、封面加载、客户端卡死防护），你帮忙挑毛病。**只读不改**——发现的问题写进报告，由 Claude 来修（文件归属不变，避免两边改同一个文件）。

## 硬规矩

1. **不改任何代码文件**，只追加 `docs/ASTRA_REPORT.md`（「## 第四轮 · 代码审查」一节），并把 `docs/PROGRESS.md` 第六轮里你那一行的状态/备注改掉。
2. 不跑 `npm run dev` / `desktop:dev` / `tauri build` / Gradle / 模拟器；需要验证可以写小的 node 脚本放 `scripts/review/`，跑完留着给 Claude 复现。
3. 不 `git commit`。中文写。

## 审查范围（按这个顺序）

| # | 文件 | 重点看 |
|---|---|---|
| 1 | `src/lib/legado.js`、`src/components/LegadoSources.jsx`、`src/pages/Search.jsx`（自定义书源一节）、`src/plugins/booksource/index.js` | 并发与中止（换关键词、离开页面时有没有泄漏的请求/定时器）；导入时坏 JSON、超大文件、重复书源；下载整本时某章失败、目录为空、书源被删的处理；搜索结果里来自网站的文字有没有当 HTML 渲染（XSS）；`importFromUrl` 的地址校验 |
| 2 | `src/lib/covers.js`、`src/components/Cover.jsx`、`src/lib/net.js`（record / score 的改动） | 排队有没有可能饿死或卡住（job 永远不 resolve）；`onError` 会不会死循环；记住的地址在什么情况下会错；`near()` 每次出队都算 getBoundingClientRect 的开销 |
| 3 | `src/plugins/public/index.js`（`parseGutenberg`）、`src/reader/txt.js`、`src/reader/chapter.js` | 分章/接段的边界情况：全是短行的诗集、没有任何标题的书、超长行、Windows/Mac 换行、BOM；用 `scripts/review/` 写几个小夹具跑一下 |
| 4 | `src/reader/search.js`、`src/pages/Reader.jsx`（搜索部分） | 跨节点匹配的 CFI 是否总能定位；中止后还会不会 setState；超过 1000 条、单字搜索的性能 |
| 5 | `src-tauri/src/main.rs`（`guard_frozen_instance`、主窗口关闭处理） | unsafe 代码的正确性（句柄泄漏、pid 为 0、窗口在探测和结束之间换了进程）；`app_handle.exit(0)` 放在 Destroyed 里有没有问题 |

## 报告格式

每条一行，按严重程度排：

`[高/中/低] 文件:行号 — 问题是什么 — 什么情况下会出事（具体输入/操作）— 建议怎么改`

最后写一句总评，和你没来得及看的部分。看完就停，不要自己动手改。
