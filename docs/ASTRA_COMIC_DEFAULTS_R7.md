# 默认漫画源体检

时间：2026-10-15T07:25:55.901Z；内置提交：`e28e134074308c0006408272639a53b9af9ce9da`。

上游：[venera-configs main index](https://github.com/venera-app/venera-configs/blob/main/index.json)。版本比较仅基于索引版本号；不表示代码内容相同。

索引：main 与固定提交索引均读取成功。

| 源 | 内置版本 | 最新版本 | 实测结果 | 失败原因 |
|---|---|---|---|---|
| 拷贝漫画 | 1.4.2 | 1.4.2 | 通过：搜到 21，400 话，第一话 209 张，图 332KB (9.7s) | — |
| Komiic | 1.0.3 | 1.0.3 | 通过：搜到 3，228 话，第一话 210 张，图 182KB (6.4s) | — |
| 包子漫画 | 1.1.6 | 1.1.6 | 失败 (4.7s) | 章节：Invalid status code: 403 |
| MangaDex | 1.2.0 | 1.2.0 | 通过：搜到 10，34 话，第一话 36 张，图 1009KB (19.6s) | — |
| 优酷漫画 | 1.0.0 | 1.0.0 | 通过：搜到 4，2 话，第一话 139 张，图 208KB (8.9s) | — |
| 漫画柜 | 1.2.1 | 1.2.1 | 通过：搜到 10，649 话，第一话 23 张，图 191KB (9.9s) | — |
| CCC追漫台 | 1.0.1 | 1.0.1 | 通过：搜到 20，52 话，第一话 19 张，图 154KB (9.3s) | — |
| GoDa漫画 | 1.2.1 | 1.2.1 | 通过：搜到 18，4 话，第一话 45 张，图 180KB (8.6s) | — |
| 漫画人 | 1.0.0 | 1.0.0 | 通过：搜到 22，4 话，第一话 180 张，图 333KB (1.0s) | — |
| MYCOMIC | 1.1.0 | 1.1.0 | 失败 (0.9s) | 搜索：Cloudflare 验证拦截：请在漫画源设置中点击「登录」，通过内置浏览器完成一次 Cloudflare 验证后即可正常使用。 |
| 爱看漫 | 1.0.6 | 1.0.6 | 失败 (5.6s) | 搜索：搜不到 |
| 少年ジャンプ＋ | 1.1.1 | 1.1.1 | 失败 (4.2s) | 搜索：Unexpected token '&lt;', "&lt;html&gt; &lt;h"... is not valid JSON |
| comick | 1.2.0 | 1.2.0 | 通过：搜到 50，2548 话，第一话 51 张，图 37KB (65.1s) | — |
| 再漫画 | 1.0.2 | 1.0.2 | 失败 (0.3s) | 详情：漫画不存在或已被删除 |
| Lanraragi | 1.1.0 | 1.1.0 | 跳过：自建服务器 | — |
| Komga | 1.0.0 | 1.0.0 | 跳过：自建服务器 | — |
| カドコミ | 1.0.1 | 1.0.1 | 失败 (0.3s) | 装载：Client network socket disconnected before secure TLS connection was es |
| 漫画1234 | 1.0.0 | 1.0.0 | 失败 (5.4s) | 搜索：Cannot read properties of null (reading 'attributes') |
| 热辣漫画 | 1.0.0 | 1.0.0 | 通过：搜到 20，400 话，第一话 209 张，图 332KB (11.5s) | — |
| Kavita | 1.0.0 | 1.0.0 | 跳过：自建服务器 | — |
| 嗨皮漫画 | 1.0.0 | 1.0.0 | 失败 (0.3s) | 搜索：Client network socket disconnected before secure TLS connection was es |

相对固定提交新增（仅列名字，是否收录仍由 policy.js 白名单人工审核）：无。

相对固定提交删除：无。

实测：10 通过、8 失败、0 缺失；自建服务器按原测试器规则跳过。

测试子进程退出码：0；正常结束。注意原测试器即使线上源失败也可能返回 0，本脚本按逐源结果判断。

## 实测原始输出

    ✓ 装载：元信息、搜索选项默认值、设置快照
    ✓ 搜索：HTML 解析（GBK 网页）、cookie、浏览器 UA（首字母大写）
    ✓ 详情：表单请求体、分组章节、标签
    ✓ 章节：hmac 签名、AES-CBC 不去填充、源自己的 UA、设置改了立即生效
    ✓ 图片：onImageLoad 的请求头、onResponse 解密
    ✓ 设置：换域名、回调按钮
    ✓ Convert 和 Node 的 crypto 对得上
    ✓ 原生桥：Tauri 的删掉，iOS / 旧安卓的拒绝运行
    ✓ 网址检查：本机和局域网不许
    ✓ 白名单：成人站、没审过的不收

    10/10 通过

    真实源（随包附带 @e28e1340，18 个）：
      ✗ 包子漫画         章节：Invalid status code: 403  (4.7s)
      ✓ CCC追漫台       搜到 20，52 话，第一话 19 张，图 154KB  (9.3s)
      ✗ カドコミ         装载：Client network socket disconnected before secure TLS connection was es  (0.3s)
      ✓ comick       搜到 50，2548 话，第一话 51 张，图 37KB  (65.1s)
      ✓ 拷贝漫画         搜到 21，400 话，第一话 209 张，图 332KB  (9.7s)
      ✓ GoDa漫画       搜到 18，4 话，第一话 45 张，图 180KB  (8.6s)
      ✗ 嗨皮漫画         搜索：Client network socket disconnected before secure TLS connection was es  (0.3s)
      ✓ 热辣漫画         搜到 20，400 话，第一话 209 张，图 332KB  (11.5s)
      ✗ 爱看漫          搜索：搜不到  (5.6s)
      ✓ Komiic       搜到 3，228 话，第一话 210 张，图 182KB  (6.4s)
      ✓ MangaDex     搜到 10，34 话，第一话 36 张，图 1009KB  (19.6s)
      ✓ 漫画柜          搜到 10，649 话，第一话 23 张，图 191KB  (9.9s)
      ✓ 漫画人          搜到 22，4 话，第一话 180 张，图 333KB  (1.0s)
      ✗ 漫画1234       搜索：Cannot read properties of null (reading 'attributes')  (5.4s)
      ✗ MYCOMIC      搜索：Cloudflare 验证拦截：请在漫画源设置中点击「登录」，通过内置浏览器完成一次 Cloudflare 验证后即可正常使用。  (0.9s)
      ✗ 少年ジャンプ＋      搜索：Unexpected token '<', "<html>
    <h"... is not valid JSON  (4.2s)
      ✓ 优酷漫画         搜到 4，2 话，第一话 139 张，图 208KB  (8.9s)
      ✗ 再漫画          详情：漫画不存在或已被删除  (0.3s)
      能用 10 / 18
