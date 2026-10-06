# EBOOK 时间表

## 第六轮（2026-10-06 夜起）

ASTRA：R4-1 只读代码审查（`docs/ASTRA_TASKS_R4.md`），不改代码。Claude：C9 公版古籍简体版 → C10 安卓模拟器走查 → C11 按审查报告修。文件归属同下表。

---

# 第五轮（2026-10-06 晚，已完成）

第四轮收尾：0.2.0 两个安装包已出（`release/`），电脑上已装到 `D:\EBOOK`、桌面有 EBOOK 快捷方式。
**ASTRA（Codex）已就绪**，回到分工模式：ASTRA 做 Legado 引擎（任务书 `docs/ASTRA_TASKS_R3.md`），Claude 做前端各项，最后 Claude 把引擎接进界面并打 0.3.0。

方向不变：**客户端优先**（Windows Tauri / 安卓 APK）、国内直连可用、界面不显示设备配置、低功耗（效果不砍，空闲限帧）。
颗粒度同 PROGRESS.md：一行一个能单独验证的模块；状态只用 `待做 / 进行中 / 完成 / 阻塞`。看板以 `PROGRESS.md` 第五轮那张表为准。

## 文件归属（防止两边改同一个文件）

| 归属 | 文件 |
|---|---|
| Claude | `src/App.jsx`、`src/main.jsx`、`src/pages/*`、`src/components/*`、`src/styles/*`、`src/lib/*`（除 native.js）、`src/reader/*`、`src/plugins/registry.js`、`src/plugins/mojimoon/*`、`src/plugins/local/*`、`src/plugins/public/*`、`public/*`、`index.html`、`docs/PROGRESS.md`（除 ASTRA 那几行的状态/备注） |
| ASTRA | `src/lib/native.js`、`src-tauri/**`、`android/**`、`capacitor.config.json`、`src/plugins/legado/*`、`scripts/**`、`docs/ASTRA_*`、`docs/BUILD.md`、`打包*.bat`、`release/` |

C8 打包要改版本号（`src-tauri`、`android` 里的文件）：等 ASTRA 那几行都完成或停下后由 Claude 做，届时在这里写一句再动。
**2026-10-06 晚：ASTRA 的 R3-1 ~ R3-4 都已完成（74/74），Claude 开始 C8：版本号升 0.3.0、两端重新打包。**

## 顺序

| 顺序 | Claude | ASTRA |
|---|---|---|
| 1 | C2 书内全文搜索 | R3-1 `nativeRequest` |
| 2 | C3 公版书源（维基文库 + Gutenberg） | R3-2 规则层 |
| 3 | C4 浅色 / 深色逐页走查 | R3-3 四步流程 + 翻页 |
| 4 | C6 Legado 导入界面（等 R3-3） | R3-4 GBK 编码 + checkSource |
| 5 | C8 汇总 + 打包 0.3.0 | R3-5（可选）模拟器走查 |

ASTRA 中途停摆的话，Claude 做完自己那列再接它剩下的行（同第四轮）。
