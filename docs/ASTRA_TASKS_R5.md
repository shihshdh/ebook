# ASTRA 第八轮：Legado 规则兼容（让更多用户自己导入的书源能用）

背景：0.3.7 里 Claude 已经补了 XPath、`lastChapter`、列表规则、无 `$` 的 JSONPath、`{{$.id}}` / `{{@@…}}` 模板，并把「用不了」收窄到必经规则（见 PROGRESS #73）。
用用户桌面「书源」文件夹做静态检查（只解析规则，**不访问任何网站**）：851 个书源里 275 个能过，468 个要执行脚本（不做），**109 个卡在下面这些写法上**。

规矩不变：
- **不执行书源里的任何脚本**（`<js>`、`@js:`、`java.*`、任意 `{{表达式}}`）。下面 R5-2 只认写死的几种无副作用片段，用正则整段匹配，不是解释执行。
- **不连真实网站**。测试一律用夹具（`scripts/fixtures/legado/`）和假 http。
- 文件归属同前：`src/plugins/legado/*`、`scripts/**`、`docs/ASTRA_*`。改到 `src/lib/legado.js` 的 `FATAL` 判断请在 REPORT 里说一声。
- 每项做完：`node scripts/legado-test.mjs` 全绿 + 新用例，并在 `docs/ASTRA_REPORT.md` 写一行（做了什么、静态检查从多少到多少）。

| # | 模块 | 涉及书源 | 验证 |
|---|---|---|---|
| R5-1 | 宽松 JSON：请求选项段 `,{…}` 和 `header` 允许单引号、键不带引号、结尾逗号（阅读 App 用 GSON lenient 解析）；`header` 是一整串 UA（`Mozilla/5.0 …`）时当成 `{"User-Agent": …}` | 约 28 | 单测：`/s,{'method':'POST',body:'q={{key}}'}`、`{'User-Agent':'x'}`、裸 UA 串都能 buildRequest；真·坏 JSON 仍报错 |
| R5-2 | 无副作用的模板片段白名单：`{{cookie.removeCookie(source.getKey())}}`、`{{cookie.removeCookie(source.key)}}` → 空串；`{{url=source.getKey();cookie.removeCookie(url);url}}`（分号、换行都可能）→ 书源地址。只认这几种整段写法，其余照旧当脚本拒绝 | 约 23 | 单测：上面几种渲染正确；`{{cookie.removeCookie(x);alert(1)}}` 之类仍被拒 |
| R5-3 | 变量存取 `@put:{key:规则}` / `@get:{key}`：一次「搜索→详情→目录→正文」流程内共享（按书源 + 书隔离），`@put` 可以出现在规则末尾、和别的规则用 `&&` 串着 | 约 11 | 夹具：搜索时 put 书号，详情 / 目录地址里 get 出来拼地址 |
| R5-4 | 下标区间：`dd[8:]`、`.book_other[1:2]`、`span.3:7:-1`、`td.5:4`（阅读 App 的区间 / 步长写法）和 `@css:` 里的 `:eq(n)` | 约 10 | 单测：对 rules.html 夹具取出正确的元素 |
| R5-5 | 汇总：写 `scripts/legado-check-dir.mjs <目录>`，对一个目录里的书源 JSON 做静态检查，输出 能过 / 要脚本 / 规则不认识（按原因分组）| — | 对用户的「书源」文件夹跑一遍，REPORT 里贴改前改后数字 |

不做：`webView` 选项（要真浏览器渲染）、没有搜索地址的发现页书源、任何需要执行脚本的书源。
