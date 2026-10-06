# 给 ASTRA 的任务书 · 第三轮（2026-10-06 晚，第五轮排期）

你停摆期间，第二轮 R2-1 ~ R2-5、R2-7 都由 Claude 做完了（0.2.0 两个安装包在 `release/`，看 `docs/PROGRESS.md` 第四轮）。
你回来以后接**原本就归你的 Legado 规则引擎**（原 R2-6），拆成下面 4 行；Claude 同时做书内搜索、公版书源、明暗走查，最后做 Legado 的导入界面（C6）把你的引擎接进来。

## 硬规矩

1. **只改你名下的文件**：`src/lib/native.js`、`src-tauri/**`、`android/**`、`capacitor.config.json`、`src/plugins/legado/*`、`scripts/**`、`docs/ASTRA_*`、`docs/BUILD.md`、`打包*.bat`、`package.json`（只加依赖和 scripts）。其余只读。
2. 不 `git commit`，不删别人的文件。中文注释说"为什么"。
3. **引擎里不内置任何站点的书源**，测试只用本地 HTML/JSON 夹具（`scripts/fixtures/legado/`）；书源永远由用户自己导入。
4. **`<js>`、`@js:`、`java.*` 一律不执行**（不 eval 远程脚本）：跳过并在 `checkSource` 里列出来。
5. **用完就关后台进程**：`npm run dev` / `desktop:dev` / 模拟器 / Gradle（`gradlew --stop`）测完当场关。用户笔记本（i9 275HX）之前因为两个 Vite 开发服务器空转烧到 95°C。
6. 每完成一行：`docs/ASTRA_REPORT.md` 追加一段（做了什么 / 文件 / 怎么验证 / 已知问题），并把 `docs/PROGRESS.md` 第五轮里你那一行的「状态」「备注」改掉（只改你那几行）。

## 接口约定（Claude 的 C6 按这个写，签名定了别改）

```js
// ——— src/lib/native.js 新增（R3-1）———
export async function nativeRequest({
  url, method = 'GET', headers = {}, body /* string */, charset /* 'gbk' | 'utf-8' | undefined */,
  signal, timeout = 20000,
}) → Promise<{ status: number, url: string /* 跳转后的最终地址 */, text: string }>
//   不因 4xx/5xx 抛错（有的站错误码也带正文），只在网络失败/超时/中止时抛。
//   解码顺序：参数 charset → 响应头 Content-Type 的 charset → 前 2KB 里的 <meta charset> → utf-8。
//   tauri：plugin-http 的 fetch，拿 arrayBuffer 自己 TextDecoder；capacitor：CapacitorHttp.request，responseType 'arraybuffer'（回来是 base64）。
//   网页端：普通 fetch（多半被 CORS 拦，抛错即可——Legado 只在客户端里用）。

// ——— src/plugins/legado/index.js（R3-2 ~ R3-4）———
export function parseSources(text) → { sources: Source[], errors: string[] }
//   接受单个书源对象或数组（Legado 3.x 字段：bookSourceUrl / bookSourceName / bookSourceGroup / header /
//   searchUrl / ruleSearch / ruleBookInfo / ruleToc / ruleContent / enabled …）。坏条目进 errors，不整体失败。
export function checkSource(source) → { ok: boolean, unsupported: string[] }
//   unsupported 是人能看懂的短句，如「搜索地址用了 <js>」「正文规则用了 @js:」。ok = 四步都至少能跑。
export async function search(source, keyword, { page = 1, signal, http } = {}) → SearchItem[]
//   SearchItem = { name, author, bookUrl, kind?, intro?, coverUrl?, latestChapter?, wordCount? }（相对地址全部转绝对）
export async function bookInfo(source, bookUrl, { signal, http } = {})
//   → { name, author, intro, coverUrl, kind, latestChapter, wordCount, tocUrl }（tocUrl 规则为空时 = bookUrl）
export async function toc(source, tocUrl, { signal, http, onPage } = {}) → { title, url }[]
//   跟 nextTocUrl 翻页，去重，最多 200 页；onPage(n) 报进度
export async function content(source, chapterUrl, { signal, http } = {}) → string
//   纯文本，段落用 \n 分隔；跟 nextContentUrl 翻页（遇到下一章地址就停）；应用 replaceRegex
//
// http 参数：可选，签名同 nativeRequest。默认用 native.js 的 nativeRequest；单测注入读夹具的假 http。
// HTML 解析用 globalThis.DOMParser（WebView 里有）；node 单测用 linkedom 补上（devDependency，别打进应用）。
```

## 任务（按顺序做；一行 = 一个能单独验证的模块）

| # | 模块 | 验证 |
|---|---|---|
| R3-1 | **`nativeRequest`**：GET/POST、自定义请求头（Referer、Cookie、UA）、按 charset 解码、返回最终地址；三端行为见上 | `node scripts/legado-test.mjs` 里用假的 plugin-http / CapacitorHttp 验：POST 的方法、请求体、请求头原样传下去；GBK 夹具字节解码正确；4xx 不抛、超时/中止会抛。**客户端里的实网验证由 Claude 在 C6 做**（不要跑 `desktop:dev` / `tauri build` / Gradle：沙箱写不了 `D:\DevCache`，机器也会热） |
| R3-2 | **规则层（不联网）**：书源 JSON 解析；请求模板（`{{key}}` `{{page}}` 和 `{{page-1}}` 这类简单算式、`url,{"method":"POST","body":"…","charset":"gbk","headers":{…}}` 选项段）；规则求值：JSoup 风格（`class.x.0@tag.a.-1@href`、`id.` `tag.` `text.` `children`、`!0` 排除）、`@css:`、`@text/@ownText/@textNodes/@html/@href/@src/@content/@<任意属性>`、`##正则##替换##`（含 `###` 只取第一个）、`@json:` 与 `$.` JSONPath（`$.a.b`、`$..x`、`[*]`、`[0]`）、`\|\|`（取第一个有结果的）`&&`（合并）`%%`（交叉合并）| `node scripts/legado-test.mjs` 规则用例全绿，至少覆盖上面每种语法一条 |
| R3-3 | **四步流程 + 翻页**：`search / bookInfo / toc / content`，相对地址转绝对，`nextTocUrl` / `nextContentUrl` 翻页 | 夹具书源（一个 HTML 站 + 一个 JSON 接口站）跑 搜索→详情→目录（≥2 页）→正文（≥2 页）全绿 |
| R3-4 | **GBK 关键词编码 + `checkSource`**：charset 为 gbk 时关键词按 GBK 做 URL 编码（TextEncoder 只会 UTF-8：用 `TextDecoder('gbk')` 扫一遍双字节区建反查表，懒加载，约 2.4 万字）；`checkSource` 列出不支持的写法 | 单测：gbk 书源搜「凉宫」请求地址里是 `%C1%B9%B9%AC`、「西游记」是 `%CE%F7%D3%CE%BC%C7`；含 `<js>` 的夹具书源 `checkSource` 列出对应短句且 `ok=false` |
| R3-5 | （可选，最后做）**模拟器走查**（原 R2-8）：装 cmdline-tools + 一个 x86_64 系统镜像（约 1GB）；走「首页 → 搜索 → 下载 → 阅读 → 翻页 → 下拉书签 → 返回键逐层」。**跑完关模拟器、`gradlew --stop`** | REPORT 里贴 390 宽截图和问题清单；下载太慢就标「阻塞」写原因 |

REPORT 里请写清**支持 / 不支持的规则语法清单**，Claude 会照着在导入界面里提示用户。

## 开工前先读

- `docs/PROGRESS.md`（第五轮那张表是两边共用的看板）、`docs/SCHEDULE.md`（文件归属）
- `src/plugins/registry.js`（Book / Download 的字段；C6 会把搜索结果转成这个形状，你不用管）
- `src/lib/native.js` 现有写法（`abortable`、`checkStatus`）
- Legado 规则文档可以参考开源项目 gedoor/legado 的「书源规则」说明，只实现上面列的子集
