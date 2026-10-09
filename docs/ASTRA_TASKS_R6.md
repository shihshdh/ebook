# ASTRA 第九轮：下载链路体检（别再让上游悄悄改地址把下载弄坏）

背景：2026-10 上游 mojimoon 把全部插图重制版（208 本、1649 卷）的 Releases 从 `mojimoon/wenku8` 搬到了 `mojimoon/wenku8-epub`，
`out/epub_index.json` 里多了 `repo` 字段。客户端还拼老仓库地址，所有线路 404，插图版全部下载失败，还提示用户「换个网络」。
Claude 已在 0.3.14 修好（提交 `fa523b4`：按 `repo` 字段拼地址；404/410 不再提示换网络）。这一轮把**其余所有下载链路**都体检一遍，并加上能及时发现这类问题的检查。

规矩：
- **文件归属**：只改 `src/plugins/mojimoon/*`、`src/plugins/public/*`、`scripts/**`、`docs/ASTRA_*`。
  Claude 正在改流畅度，工作区里 `src/App.jsx`、`src/components/*`、`src/effects/*`、`src/pages/*`、`src/styles/*`、`src/lib/covers.js`、`src/lib/jacket*.js`、`src/lib/warm.js` 都有没提交的改动，**一个字都别碰**。
  确实要改 `src/lib/net.js`（比如线路列表）的话可以改，但在 REPORT 里单独说明改了什么、为什么。
- **不提交、不推送、不打包**，改完留在工作区，REPORT 里列清楚改了哪些文件。
- **不跑性能测量、不开 vite dev / preview 服务器**（Claude 在同一台笔记本上测帧率，两边一起跑数字就不准了）。
- 访问网络要克制：只用 HEAD 或 `Range: bytes=0-1023` 的 GET，并发不超过 4，每类抽样，不要全量扫。
- 每项做完在 `docs/ASTRA_REPORT.md` 写一段：做了什么、抽了多少、坏了多少、怎么修的。

| # | 内容 | 验证 |
|---|---|---|
| R6-1 | 写 `scripts/check-downloads.mjs`：用 Node 直接取上游三份文件（`out/wenku_catalog.json`、`out/merged.csv`、`out/epub_index.json`，线路同 `repoFileUrls`），跑插件里的 `build()` 得到下载入口（`src/plugins/mojimoon/index.js` 依赖 `net.js` / 原生模块的话，把纯函数部分拆出来或在脚本里垫一层，**不要**为此改 net.js 的行为）。按类抽样：插图版各卷 50 个、纯文本 EPUB 50 个、蓝奏云 30 个；公版古籍（`src/plugins/public`）30 个。每个入口把它的**每一条线路**都试一下，输出：每类成功率、每条线路（gh-proxy.org / edgeone / ghfast / gh.llkk / jsDelivr 各节点 / 直连）的成功率和平均耗时、失败清单（书名 + 地址 + 状态码）。蓝奏云只看分享页能打开、不是「文件取消分享 / 来晚啦」页 | 跑一遍，REPORT 贴汇总表 |
| R6-2 | 按 R6-1 的结果修：哪类地址拼错了、哪条线路整条不通、哪个字段上游改名了，就改对应插件（同 `fa523b4` 的思路：优先读上游数据里给的字段，没有才用旧的默认值）。整条线路已经死掉的从候选里拿掉或挪到最后 | 再跑一遍 R6-1，失败只剩个别书本身的问题（REPORT 里说明是哪种） |
| R6-3 | 写 `scripts/mojimoon-test.mjs`：用夹具（放 `scripts/fixtures/mojimoon/`，从真实数据里截几本：有 `repo` 字段的插图版、没有 `repo` 的老格式、blocked、只有 TXT、带蓝奏云台版）测 `build()` 出来的下载入口和地址，尤其是「有 repo 用 repo、没 repo 用 mojimoon/wenku8」 | `node scripts/mojimoon-test.mjs` 全绿；`node scripts/legado-test.mjs` 仍然 96/96 |

不做：书源（Legado）那边的下载（用户书源各不相同，另说）；改界面；发版。
