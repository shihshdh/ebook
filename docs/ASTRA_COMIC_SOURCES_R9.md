# 第九轮：扩充漫画源（接续 Claude）

2026-10-18 接续核验；以下网站实测来自 Claude 于 2026-10-17 保存的直连和代理 JSON，并非今天重新测遍网站。2026-10-18 重新运行离线测试 13/13、生产构建均通过。

## 当前成果

- 随包源 21 → 38；默认开启 10 → 24。新增 17 个站点，另用社区版本替换包子、漫画1234、少年 Jump+。
- 同一批探索第一页：改前 10 个源 / 原始 445 部 / 书名规范化去重 415 部；改后 24 个源 / 原始 997 部 / 去重 834 部。
- 这是各源第一页的样本数，不能当成完整书库数量；去重只按全半角、括注、标点和大小写，不含跨语言译名及繁简归并。
- 改后历史测试跑了 26 个源；其中 comick 详情超时、MYCOMIC 被 Cloudflare 拦，最终生成包关闭这两个，余下 24 个全部搜索→详情→章节→首图通过。
- 新增默认打开的社区源按国内直连的封面和探索结果挑选；代理仅为辅助记录，不用代理成功替代直连失败。
- 包子保留为现有可读源的例外：章节图改到 s1.bzcdn.net 后成功，搜索/探索封面仍可能 403；不宣称 24 个源全部封面正常。
- 热辣/拷贝、好看/311、动漫屋/漫画人等同后台来源不同时默认开启。

## 主分支接入（2026-10-18）

已接入包版本升级：旧账户补入本轮新增站点，已删除的旧站点和替换站点不会恢复；旧内置脚本在社区修复版本更新时替换，保留用户开关、Cookie 和自定义域名。用户自己安装的版本与更高版本优先。包子仅迁移原默认图床。迁移写完列表再写版本标记，中断可重试；7 项迁移回归通过。

社区脚本按固定提交随应用升级，记录 from，不用官方仓库的同名文件覆盖社区修复版。社区源自动跟踪其仓库最新版不是本次行为。

## 候选逐项实测

直连列按搜索→详情→章节→首图；封面为搜索/探索的成功张数；缺少代理 JSON 标为未保存，不推断成功。源脚本由既有 comic-test 沙箱加载；报告中的状态仅代表该次网络采样。

| 仓库 | key / 名字 | 语言 | 直连 | 代理 | 封面（直连 搜索 / 探索） | 探索第一页 / 第二页新增 | 收录情况 |
|---|---|---|---|---|---|---|---|
| casthan321 | noymanga / NoyManga | 中文/待逐站确认 | 搜索：尚未登录 NoyManga：请先在源设置中点“登录”（会打开网页），完成后再点“连接测试”里的“测试”。无需手动提取令牌。 | 搜索：尚未登录 NoyManga：请先在源设置中点“登录”（会打开网页），完成后再点“连接测试”里的“测试”。无需手动提取令牌。 | — / — | 0 / 探索出错 尚未登录 NoyManga：请先在源设置中点“登录”（会打开网页），完成后再点“连接测试”里的“测试 | 不收此版本（重复或实测不通过） |
| casthan321 | tencent_comics / 腾讯动漫 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 18 / 不分页 | 不收此版本（重复或实测不通过） |
| EZvenera | mangaplus / MangaPlus | 中文/待逐站确认 | 搜索：HTTP 403 | 未保存 | — / — | 0 / 没有探索页 | 不收此版本（重复或实测不通过） |
| handahao666-boop | GfmhApp / 古风漫画 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / — | 0 / 探索出错 Invalid status code: 500 | 不收此版本（重复或实测不通过） |
| handahao666-boop | Komiic / Komiic | 中文/待逐站确认 | 通过 | 章节：Komiic 游客每日图片额度已用尽，请登录账号后重试（登录可恢复额度） | 3/3 / 3/3 | 20 / 20 | 不收此版本（重复或实测不通过） |
| handahao666-boop | baihehui / 百合会 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / 3/3 | 19 / 不分页 | 不收此版本（重复或实测不通过） |
| handahao666-boop | bilimanga / 嗶哩漫畫 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / — | 0 / 探索出错 Client network socket disconnected before secure T | 不收此版本（重复或实测不通过） |
| handahao666-boop | copy_manga / 拷贝漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 43 / 不分页 | 不收此版本（重复或实测不通过） |
| handahao666-boop | dm5 / 动漫屋 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 33 / 不分页 | 不收此版本（重复或实测不通过） |
| handahao666-boop | dongman_la / 动漫啦 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / — | 0 / 探索出错 Client network socket disconnected before secure T | 不收此版本（重复或实测不通过） |
| handahao666-boop | dongmanmanhua / 咚漫 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / 3/3 | 69 / 不分页 | 不收此版本（重复或实测不通过） |
| handahao666-boop | ffppt / 飞翔漫画 | 中文/待逐站确认 | 图片：Client network socket disconnected before secure TLS connection was es | 图片：Client network socket disconnected before secure TLS connection was es | 1/1 / 3/3 | 27 / 0 | 不收此版本（重复或实测不通过） |
| handahao666-boop | hipmh / 嬉皮漫畫 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 39 / 不分页 | 不收此版本（重复或实测不通过） |
| handahao666-boop | ikmmh_v2 / 爱看漫 | 中文/待逐站确认 | 搜索：搜索失败：爱看漫反爬校验未通过（403）：https://www.ikmmh.com/search?searchkey=%E6%B5%B7% | 搜索：搜索失败：爱看漫反爬校验未通过（403）：https://www.ikmmh.com/search?searchkey=%E6%B5%B7% | — / — | 0 / 探索出错 探索页面加载失败：爱看漫反爬校验未通过（403）：https://www.ikmmh.com/ | 不收此版本（重复或实测不通过） |
| handahao666-boop | manga51 / 51漫画 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / — | 0 / 探索出错 Invalid status code: 500 | 不收此版本（重复或实测不通过） |
| handahao666-boop | mangabz / Mangabz | 中文/待逐站确认 | 通过 | 搜索：Client network socket disconnected before secure TLS connection was es | 3/3 / 3/3 | 28 / 0 | 不收此版本（重复或实测不通过） |
| handahao666-boop | manhuaren / 漫画人 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 74 / 0 | 不收此版本（重复或实测不通过） |
| handahao666-boop | manhuauo_banana_v2 / 香蕉漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 60 / 不分页 | 不收此版本（重复或实测不通过） |
| handahao666-boop | manwang / 漫网 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / 0/0 | 0 / 不分页 | 不收此版本（重复或实测不通过） |
| handahao666-boop | mh4399 / 4399漫画网 | 中文/待逐站确认 | 搜索：Invalid status code: 503 | 搜索：Invalid status code: 503 | — / 3/3 | 35 / 不分页 | 不收此版本（重复或实测不通过） |
| handahao666-boop | mojoin_v2 / MOJOIN | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / 3/3 | 20 / 20 | 不收此版本（重复或实测不通过） |
| handahao666-boop | noymanga / NoyManga | 中文/待逐站确认 | 搜索：尚未登录 NoyManga：请先在源设置中点“登录”（会打开网页），完成后再点“连接测试”里的“测试”。无需手动提取令牌。 | 搜索：尚未登录 NoyManga：请先在源设置中点“登录”（会打开网页），完成后再点“连接测试”里的“测试”。无需手动提取令牌。 | — / — | 0 / 探索出错 尚未登录 NoyManga：请先在源设置中点“登录”（会打开网页），完成后再点“连接测试”里的“测试 | 不收此版本（重复或实测不通过） |
| handahao666-boop | qq_comic_official_v1 / 腾讯动漫（正版） | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 18 / 不分页 | 不收此版本（重复或实测不通过） |
| handahao666-boop | rumanhua_fixed_v15 / 如漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 36 / 不分页 | 不收此版本（重复或实测不通过） |
| handahao666-boop | sfacg_manhua / SF漫画 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / 3/3 | 22 / 不分页 | 不收此版本（重复或实测不通过） |
| handahao666-boop | tuku_cc / 图库漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 47 / 不分页 | 不收此版本（重复或实测不通过） |
| handahao666-boop | webtoons_zh_hant / LINE WEBTOON | 中文/待逐站确认 | 章节：没有图片 | 章节：没有图片 | 1/1 / 3/3 | 71 / 不分页 | 不收此版本（重复或实测不通过） |
| handahao666-boop | wmanhua / W漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 36 / 不分页 | 不收此版本（重复或实测不通过） |
| handahao666-boop | ykmh / 优酷漫画 (修复版) | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 21 / 0 | 不收此版本（重复或实测不通过） |
| handahao666-boop | zerobyw33 / zero搬运网 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 24 / 0 | 不收此版本（重复或实测不通过） |
| LX7kM9 | Komiic / Komiic | 中文/待逐站确认 | 章节：account 0 login failed | 章节：account 0 login failed | 3/3 / 3/3 | 20 / 20 | 不收此版本（重复或实测不通过） |
| LX7kM9 | baihehui / 百合会 | 中文/待逐站确认 | 搜索：百合会搜索需要登录账号，请先在「我的」中登录百合会 | 搜索：百合会搜索需要登录账号，请先在「我的」中登录百合会 | — / 3/3 | 19 / 不分页 | 不收此版本（重复或实测不通过） |
| LX7kM9 | banana / 香蕉漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 60 / 不分页 | 收录/默认开 |
| LX7kM9 | baozi / 包子漫画 | 中文/待逐站确认 | 搜索：Invalid status code: 403 | 搜索：Invalid status code: 403 | — / — | 0 / 探索出错 Invalid status code: 403 | 收录/默认开 |
| LX7kM9 | bilimanga / 哔哩漫画 | 中文/待逐站确认 | 搜索：搜索请求未通过源站 JS 校验。建议浏览器搜索漫画后复制链接到 Venera 解析。 | 搜索：搜索请求未通过源站 JS 校验。建议浏览器搜索漫画后复制链接到 Venera 解析。 | — / — | 0 / 探索出错 Client network socket disconnected before secure T | 不收此版本（重复或实测不通过） |
| LX7kM9 | bukamh / 布卡漫画 | 中文/待逐站确认 | 搜索：Invalid status: 500 | 搜索：Invalid status: 500 | — / — | 0 / 探索出错 Invalid status: 500 | 不收此版本（重复或实测不通过） |
| LX7kM9 | ccc / CCC追漫台 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 66 / 不分页 | 不收此版本（重复或实测不通过） |
| LX7kM9 | comic_walker / カドコミ | 日文 | 搜索：搜不到 | 搜索：搜不到 | — / 3/3 | 21 / 不分页 | 不收此版本（重复或实测不通过） |
| LX7kM9 | comick / comick | 英文 | 通过 | 通过 | 3/3 / 3/3 | 101 / 不分页 | 不收此版本（重复或实测不通过） |
| LX7kM9 | copy_manga / 拷贝漫画 | 中文/待逐站确认 | 装载：Setting not found: sub_accounts | 装载：Setting not found: sub_accounts | — / — | — / — | 不收此版本（重复或实测不通过） |
| LX7kM9 | cycomic / 次元漫画 | 中文/待逐站确认 | 搜索：Client network socket disconnected before secure TLS connection was es | 搜索：Client network socket disconnected before secure TLS connection was es | — / — | 0 / 探索出错 Client network socket disconnected before secure T | 不收此版本（重复或实测不通过） |
| LX7kM9 | dm5 / 动漫屋 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 74 / 不分页 | 不收此版本（重复或实测不通过） |
| LX7kM9 | dongman / 咚漫 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / 3/3 | 70 / 不分页 | 不收此版本（重复或实测不通过） |
| LX7kM9 | dongman_la / 动漫啦 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / — | 0 / 探索出错 Client network socket disconnected before secure T | 不收此版本（重复或实测不通过） |
| LX7kM9 | ffppt / 飞翔漫画 | 中文/待逐站确认 | 图片：Client network socket disconnected before secure TLS connection was es | 图片：Client network socket disconnected before secure TLS connection was es | 1/1 / 3/3 | 27 / 0 | 不收此版本（重复或实测不通过） |
| LX7kM9 | gfmh / 古风漫画 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / — | 0 / 探索出错 Invalid status code: 500 | 不收此版本（重复或实测不通过） |
| LX7kM9 | goda / GoDa漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 64 / 不分页 | 不收此版本（重复或实测不通过） |
| LX7kM9 | guazimanhua / 瓜子漫画 | 中文/待逐站确认 | 通过 | 通过 | 1/1 / 3/3 | 20 / 不分页 | 收录/默认开 |
| LX7kM9 | haokan_txt / 好看漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 20 / 0 | 收录/默认关 |
| LX7kM9 | hipmh / 嬉皮漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 39 / 不分页 | 不收此版本（重复或实测不通过） |
| LX7kM9 | ikmmh / 爱看漫 | 中文/待逐站确认 | 搜索：搜索失败：爱看漫反爬校验未通过（403）：https://www.ikmmh.com/search?searchkey=%E6%B5%B7% | 搜索：搜索失败：爱看漫反爬校验未通过（403）：https://www.ikmmh.com/search?searchkey=%E6%B5%B7% | — / — | 0 / 探索出错 探索页面加载失败：爱看漫反爬校验未通过（403）：https://www.ikmmh.com/ | 不收此版本（重复或实测不通过） |
| LX7kM9 | kanman / 看漫画 | 中文/待逐站确认 | 通过 | 通过 | 0/0 / 3/3 | 46 / 0 | 不收此版本（重复或实测不通过） |
| LX7kM9 | laimanhua_split / 来漫画 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / 3/3 | 65 / 0 | 不收此版本（重复或实测不通过） |
| LX7kM9 | manben / 漫本 | 中文/待逐站确认 | 章节：Invalid status: 500 | 章节：Invalid status: 500 | 0/0 / 3/3 | 18 / 不分页 | 不收此版本（重复或实测不通过） |
| LX7kM9 | manga51 / 51漫画 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / — | 0 / 探索出错 Invalid status code: 500 | 不收此版本（重复或实测不通过） |
| LX7kM9 | mangabz / Mangabz | 中文/待逐站确认 | 通过 | 详情：Client network socket disconnected before secure TLS connection was es | 3/3 / 3/3 | 18 / 不分页 | 收录/默认开 |
| LX7kM9 | manhuapi / 漫画皮 | 中文/待逐站确认 | 搜索：Invalid status: 403 | 搜索：Invalid status: 403 | — / — | 0 / 探索出错 首页未解析到任何分区 | 不收此版本（重复或实测不通过） |
| LX7kM9 | manhuaren / 漫画人 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 74 / 不分页 | 不收此版本（重复或实测不通过） |
| LX7kM9 | manwang / 漫网 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / 0/0 | 0 / 不分页 | 不收此版本（重复或实测不通过） |
| LX7kM9 | mh1234 / 漫画1234 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 17 / 不分页 | 收录/默认开 |
| LX7kM9 | mh4399 / 4399漫画网 | 中文/待逐站确认 | 搜索：Invalid status code: 503 | 搜索：Invalid status code: 503 | — / 3/3 | 35 / 不分页 | 不收此版本（重复或实测不通过） |
| LX7kM9 | mhkan / 漫画kan | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 17 / 0 | 收录/默认开 |
| LX7kM9 | mkzhan / 漫客栈 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 44 / 0 | 收录/默认开 |
| LX7kM9 | mojoin / MOJOIN | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / 3/3 | 20 / 20 | 不收此版本（重复或实测不通过） |
| LX7kM9 | mycomic / MYCOMIC | 中文/待逐站确认 | 搜索：Cloudflare 验证拦截：请在漫画源设置中点击「登录」，通过内置浏览器完成一次 Cloudflare 验证后即可正常使用。 | 搜索：Cloudflare 验证拦截：请在漫画源设置中点击「登录」，通过内置浏览器完成一次 Cloudflare 验证后即可正常使用。 | — / — | 0 / 探索出错 Cloudflare 验证拦截：请在漫画源设置中点击「登录」，通过内置浏览器完成一次 Cloudfl | 不收此版本（重复或实测不通过） |
| LX7kM9 | noymanga / NoyManga | 中文/待逐站确认 | 搜索：尚未登录 NoyManga：请在源设置中填写账号与密码登录（点账号菜单 → 登录）。 | 搜索：尚未登录 NoyManga：请在源设置中填写账号与密码登录（点账号菜单 → 登录）。 | — / — | 0 / 探索出错 尚未登录 NoyManga：请在源设置中填写账号与密码登录（点账号菜单 → 登录）。 | 不收此版本（重复或实测不通过） |
| LX7kM9 | one_kkk / 极速漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 74 / 不分页 | 不收此版本（重复或实测不通过） |
| LX7kM9 | qq_comic_official / 腾讯动漫（正版） | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 18 / 不分页 | 不收此版本（重复或实测不通过） |
| LX7kM9 | rumanhua / 如漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 30 / 不分页 | 不收此版本（重复或实测不通过） |
| LX7kM9 | s311_com / 311漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 25 / 0 | 收录/默认开 |
| LX7kM9 | sfacg_manhua / SF漫画 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / 3/3 | 22 / 不分页 | 不收此版本（重复或实测不通过） |
| LX7kM9 | shonen_jump_plus / 少年ジャンプ＋ | 日文 | 通过 | 通过 | 3/3 / 3/3 | 21 / 不分页 | 收录/默认关 |
| LX7kM9 | tuku_cc / 图库漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 47 / 不分页 | 收录/默认开 |
| LX7kM9 | webtoons_zh_hant / LINE WEBTOON | 中文/待逐站确认 | 章节：没有图片 | 章节：没有图片 | 1/1 / 3/3 | 71 / 不分页 | 不收此版本（重复或实测不通过） |
| LX7kM9 | wmanhua / W漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 36 / 不分页 | 收录/默认开 |
| LX7kM9 | xmanhua / X漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 40 / 不分页 | 收录/默认开 |
| LX7kM9 | yemancomic / 野蛮漫画 | 中文/待逐站确认 | 搜索：Request Error: 403 https://yemancomic.com/search?searchkey=%E6%B5%B7%E | 搜索：Request Error: 403 https://yemancomic.com/search?searchkey=%E6%B5%B7%E | — / — | 0 / 探索出错 Request Error: 403 https://yemancomic.com/ | 不收此版本（重复或实测不通过） |
| LX7kM9 | ykmh / 优酷漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 21 / 不分页 | 不收此版本（重复或实测不通过） |
| LX7kM9 | zaimanhua / 再漫画 | 中文/待逐站确认 | 详情：漫画不存在或已被删除 | 详情：漫画不存在或已被删除 | 3/3 / 3/3 | 20 / 20 | 不收此版本（重复或实测不通过） |
| LX7kM9 | zerobyw / zero搬运网 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 24 / 0 | 收录/默认开 |
| venera-app | comic_walker / カドコミ | 日文 | 装载：Client network socket disconnected before secure TLS connection was es | 装载：Client network socket disconnected before secure TLS connection was es | — / — | — / — | 收录/默认关 |
| venera-app | comick / comick | 英文 | 通过 | 详情：详情超时 | 3/3 / 3/3 | 101 / 不分页 | 收录/默认关 |
| venera-app | happy / 嗨皮漫画 | 中文/待逐站确认 | 搜索：Client network socket disconnected before secure TLS connection was es | 搜索：Client network socket disconnected before secure TLS connection was es | — / — | 0 / 探索出错 Client network socket disconnected before secure T | 收录/默认关 |
| venera-app | hot_manga / 热辣漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 28 / 不分页 | 收录/默认关 |
| venera-app | ikmmh / 爱看漫 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / — | 0 / 探索出错 探索页面加载失败：加载探索页面失败，状态码：403 | 收录/默认关 |
| venera-app | mh1234 / 漫画1234 | 中文/待逐站确认 | 搜索：Client network socket disconnected before secure TLS connection was es | 搜索：Client network socket disconnected before secure TLS connection was es | — / 0/0 | 0 / 不分页 | 不收此版本（重复或实测不通过） |
| venera-app | shonen_jump_plus / 少年ジャンプ＋ | 日文 | 搜索：Unexpected token '<', "<html>
 <h"... is not valid JSON | 搜索：Unexpected token '<', "<html>
 <h"... is not valid JSON | — / — | 0 / 探索出错 Unexpected token '<', "<html>
 <h"... is not valid | 不收此版本（重复或实测不通过） |
| venera-app | zaimanhua / 再漫画 | 中文/待逐站确认 | 详情：漫画不存在或已被删除 | 详情：漫画不存在或已被删除 | 3/3 / 3/3 | 20 / 20 | 收录/默认关 |
| 137syh | ikmmh / 爱看漫 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / — | 0 / 探索出错 探索页面加载失败：加载探索页面失败，状态码：403 | 不收此版本（重复或实测不通过） |
| 137syh | vomic / vomic | 中文/待逐站确认 | 装载：HTTP 404 https://raw.githubusercontent.com/137syh/venera-syh/a746f0cf6 | 装载：HTTP 404 https://raw.githubusercontent.com/137syh/venera-syh/a746f0cf6 | — / — | — / — | 不收此版本（重复或实测不通过） |
| token1008 | acqq / 腾讯漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 30 / 30 | 收录/默认开 |
| token1008 | damotu / 大魔兔 | 中文/待逐站确认 | 图片：HTTP 200，不是图片 | 图片：HTTP 200，不是图片 | 3/3 / 3/3 | 20 / 20 | 不收此版本（重复或实测不通过） |
| token1008 | dongmanla / 动漫啦 | 中文/待逐站确认 | 搜索：Client network socket disconnected before secure TLS connection was es | 搜索：Client network socket disconnected before secure TLS connection was es | — / — | 0 / 探索出错 Client network socket disconnected before secure T | 不收此版本（重复或实测不通过） |
| token1008 | guoman8 / 国漫吧 | 中文/待逐站确认 | 搜索：Invalid status code: 503 | 搜索：Invalid status code: 503 | — / — | 0 / 探索出错 Invalid status code: 503 | 不收此版本（重复或实测不通过） |
| token1008 | jisu_1kkk / 极速漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 21 / 21 | 不收此版本（重复或实测不通过） |
| token1008 | kanman / 看漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 25 / 14 | 收录/默认开 |
| token1008 | liumanhua / 六漫画 | 中文/待逐站确认 | 搜索：Invalid status code: 500 | 搜索：Invalid status code: 500 | — / — | 0 / 探索出错 Invalid status code: 500 | 不收此版本（重复或实测不通过） |
| token1008 | manhua178 / 178漫画网 | 中文/待逐站确认 | 搜索：超时 | 图片：HTTP 403，不是图片 | — / — | 0 / 探索出错 超时 | 不收此版本（重复或实测不通过） |
| token1008 | manhuaba / 漫画吧网 | 中文/待逐站确认 | 搜索：Invalid status code: 403 | 搜索：Invalid status code: 403 | — / — | 0 / 探索出错 Invalid status code: 403 | 不收此版本（重复或实测不通过） |
| token1008 | manman / 漫漫漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 10 / 10 | 收录/默认开 |
| token1008 | miaoqu / 喵趣漫画 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / — | 0 / 探索出错 Invalid status code: 403 | 不收此版本（重复或实测不通过） |
| token1008 | mkzhan / 漫客栈 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 30 / 30 | 不收此版本（重复或实测不通过） |
| token1008 | zymk / 知音漫客 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / 3/3 | 17 / 16 | 不收此版本（重复或实测不通过） |
| YHQY-Dev | baozi / 包子漫画 | 中文/待逐站确认 | 搜索：Invalid status code: 403 | 搜索：Invalid status code: 403 | — / — | 0 / 探索出错 Invalid status code: 403 | 不收此版本（重复或实测不通过） |
| YHQY-Dev | bukamh / 布卡漫画 | 中文/待逐站确认 | 搜索：Invalid status: 500 | 搜索：Invalid status: 500 | — / — | 0 / 探索出错 Invalid status: 500 | 不收此版本（重复或实测不通过） |
| YHQY-Dev | cycomic / 次元漫画 | 中文/待逐站确认 | 搜索：Client network socket disconnected before secure TLS connection was es | 搜索：Client network socket disconnected before secure TLS connection was es | — / — | 0 / 探索出错 Client network socket disconnected before secure T | 不收此版本（重复或实测不通过） |
| YHQY-Dev | dm5 / 动漫屋 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 86 / 出错 Invalid status: 404 | 收录/默认关 |
| YHQY-Dev | dongmanla / 动漫啦 | 中文/待逐站确认 | 搜索：Client network socket disconnected before secure TLS connection was es | 搜索：Client network socket disconnected before secure TLS connection was es | — / — | 0 / 探索出错 Client network socket disconnected before secure T | 不收此版本（重复或实测不通过） |
| YHQY-Dev | isamanhua / 爱飒漫画 | 中文/待逐站确认 | 搜索：Invalid status: 404 | 搜索：Invalid status: 404 | — / 3/3 | 46 / 14 | 不收此版本（重复或实测不通过） |
| YHQY-Dev | kanman / 看漫画 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / 3/3 | 46 / 66 | 不收此版本（重复或实测不通过） |
| YHQY-Dev | manben / 漫本 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / 0/0 | 10 / 0 | 不收此版本（重复或实测不通过） |
| YHQY-Dev | mangabz / Mangabz | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 12 / 12 | 不收此版本（重复或实测不通过） |
| YHQY-Dev | manhuagui / 漫画柜 | 中文/待逐站确认 | 搜索：Client network socket disconnected before secure TLS connection was es | 搜索：Client network socket disconnected before secure TLS connection was es | — / — | 0 / 探索出错 Client network socket disconnected before secure T | 不收此版本（重复或实测不通过） |
| YHQY-Dev | manhuapi / 漫画皮 | 中文/待逐站确认 | 搜索：Invalid status: 403 | 搜索：Invalid status: 403 | — / — | 0 / 探索出错 Invalid status: 403 | 不收此版本（重复或实测不通过） |
| YHQY-Dev | mhkan / 漫画看 | 中文/待逐站确认 | 章节：Invalid status: 404 | 章节：Invalid status: 404 | 2/3 / 3/3 | 17 / 0 | 不收此版本（重复或实测不通过） |
| YHQY-Dev | mkzhan / 漫客栈 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 20 / 20 | 不收此版本（重复或实测不通过） |
| YHQY-Dev | remenmanhua / 热门漫画 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / 3/3 | 13 / 0 | 不收此版本（重复或实测不通过） |
| YHQY-Dev | rumanhua / 如漫画 | 中文/待逐站确认 | 搜索：搜不到 | 搜索：搜不到 | — / — | 0 / 探索出错 HTTP Error 500 | 不收此版本（重复或实测不通过） |
| YHQY-Dev | sisimanhua / 思思漫画 | 中文/待逐站确认 | 通过 | 通过 | 0/3 / 0/3 | 30 / 0 | 收录/默认关 |
| YHQY-Dev | xmanhua / X漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 12 / 12 | 不收此版本（重复或实测不通过） |
| zhimouzhou | 733_2 / 733动漫 | 中文/待逐站确认 | 搜索：733动漫 experimental: 当前检测存在 Cloudflare/人机验证，尚未完成搜索、详情、章节、图片解析。 | 搜索：733动漫 experimental: 当前检测存在 Cloudflare/人机验证，尚未完成搜索、详情、章节、图片解析。 | — / — | 0 / 探索出错 733动漫 experimental: 当前检测存在 Cloudflare/人机验证，尚未完成搜索、 | 不收此版本（重复或实测不通过） |
| zhimouzhou | dm5 / 动漫屋 | 中文/待逐站确认 | 章节：No images parsed: https://m.dm5.com/m1419274/ | 章节：No images parsed: https://m.dm5.com/m1419274/ | 3/3 / 3/3 | 74 / 0 | 不收此版本（重复或实测不通过） |
| zhimouzhou | dumanwu1 / 读漫屋 | 中文/待逐站确认 | 详情：getComicInfo failed, url=http://www.dumanwu1.com/tbsvwhl/, All dumanwu | 详情：getComicInfo failed, url=http://www.dumanwu1.com/tbsvwhl/, All dumanwu | 3/3 / 3/3 | 72 / 0 | 不收此版本（重复或实测不通过） |
| zhimouzhou | mangabz / Mangabz | 中文/待逐站确认 | 章节：No images parsed: https://www.mangabz.com/m418076/ | 章节：No images parsed: https://www.mangabz.com/m418076/ | 3/3 / 3/3 | 19 / 0 | 不收此版本（重复或实测不通过） |
| zhimouzhou | one_kkk / 极速漫画 | 中文/待逐站确认 | 章节：No images parsed: https://m.1kkk.com/ch1022-1419274/ | 章节：No images parsed: https://m.1kkk.com/ch1022-1419274/ | 0/0 / 3/3 | 74 / 0 | 不收此版本（重复或实测不通过） |
| zhimouzhou | rumanhua2 / 如漫画 | 中文/待逐站确认 | 通过 | 通过 | 3/3 / 3/3 | 66 / 0 | 收录/默认开 |
| zhimouzhou | source_43 / 海猫吧 | 中文/待逐站确认 | 搜索：海猫吧 experimental: 当前检测存在 Cloudflare/人机验证，尚未完成搜索、详情、章节、图片解析。 | 搜索：海猫吧 experimental: 当前检测存在 Cloudflare/人机验证，尚未完成搜索、详情、章节、图片解析。 | — / — | 0 / 探索出错 海猫吧 experimental: 当前检测存在 Cloudflare/人机验证，尚未完成搜索、详情 | 不收此版本（重复或实测不通过） |
| zhimouzhou | source_54 / 漫画园漫画 | 中文/待逐站确认 | 搜索：漫画园漫画 experimental: 当前检测存在 Cloudflare/人机验证，尚未完成搜索、详情、章节、图片解析。 | 搜索：漫画园漫画 experimental: 当前检测存在 Cloudflare/人机验证，尚未完成搜索、详情、章节、图片解析。 | — / — | 0 / 探索出错 漫画园漫画 experimental: 当前检测存在 Cloudflare/人机验证，尚未完成搜索、 | 不收此版本（重复或实测不通过） |
| zhimouzhou | yemancomic / 野蛮漫画 | 中文/待逐站确认 | 搜索：Request Error: 403 https://yemancomic.com/search?searchkey=%E6%B5%B7%E | 搜索：Request Error: 403 https://yemancomic.com/search?searchkey=%E6%B5%B7%E | — / — | 0 / 探索出错 Request Error: 403 https://yemancomic.com/ | 不收此版本（重复或实测不通过） |

## 固定上游与复验

官方提交：`e28e134074308c0006408272639a53b9af9ce9da`。社区各来源、固定提交及文件路径见生成器 REPOS/COMMUNITY 和 default-sources.js 的 from 字段。脚本保留原样字符串，仅去注释与空白。

```powershell
node scripts/comic-test.mjs
npm run build
node scripts/comic-test.mjs --live --bundled --deep --json=after-direct.json
```

源筛选、旧账户迁移、打包内容与离线回归已接入；三端客户端整体验收记录随 0.4.1 发布补充。
