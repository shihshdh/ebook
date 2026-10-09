// 由 scripts/legado-bundle-defaults.mjs 生成；仅静态检查通过，未标记为实测成功。
export default {
  "version": 2,
  "validation": "static",
  "files": 4,
  "candidates": 852,
  "passed": 301,
  "excludedCredentials": 11,
  "excludedAdult": 13,
  "excluded": {
    "成人内容": 13,
    "漫画": 8,
    "听书": 5,
    "不是书站": 4,
    "网址是 IP 或写坏了": 5,
    "来路不明的站": 2,
    "不是文字书": 2
  },
  "sources": [
    {
      "source": {
        "bookSourceName": "篱笆文学（优+++）",
        "bookSourceUrl": "https://m.libahao.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://m.libahao.com/sou?wd={{key}}",
        "ruleSearch": {
          "author": ".book-author@text",
          "bookList": ".book-item",
          "bookUrl": "href",
          "coverUrl": "img@src",
          "intro": ".book-description@text",
          "name": ".book-title@text"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "img@src",
          "intro": "[property=\"og:description\"]@content",
          "kind": "[property～=category|status|update_time]@content",
          "lastChapter": "[property~=las?test_chapter_name]@content",
          "name": "[property=\"og:novel:book_name\"]@content",
          "tocUrl": "[property=\"og:novel:read_url\"]@content"
        },
        "ruleToc": {
          "chapterList": ".chapter-list.1@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": ".chapter-content@html",
          "nextContentUrl": "text.下一页@href"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "八零小说（优++）",
        "bookSourceUrl": "http://wap.80zw.la/",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/modules/article/search.php,{\n  \"body\": \"searchkey={{key}}\",\n  \"charset\": \"UTF-8\",\n  \"method\": \"POST\"\n}",
        "ruleSearch": {
          "author": "ownText##.*\\/",
          "bookList": ".line",
          "bookUrl": "a@href",
          "coverUrl": "a@href##/((\\d+)\\d{3})/##http://wap.80zw.la/$2/$1/$1s.jpg",
          "kind": "ownText##\\[|\\].*",
          "name": "a@text"
        },
        "ruleBookInfo": {
          "author": "text.作者@text##作者：",
          "coverUrl": "img@src",
          "intro": ".intro_info@text##最新章节推荐地址.*",
          "kind": "text.分类@text##分类：",
          "lastChapter": "p.-1@text",
          "name": "a.1@text",
          "tocUrl": "text.查看更多章节@href",
          "wordCount": "p[-2:-3]@text"
        },
        "ruleToc": {
          "chapterList": "dl dd a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": "option@value||text.下一页@href"
        },
        "ruleContent": {
          "content": "#nr1@html",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##求书网.*|txt下载.*"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "天天小说（优++）",
        "bookSourceUrl": "https://ttks.tw/",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/novel/search?q={{key}}",
        "ruleSearch": {
          "author": "tag.li.1@text",
          "bookList": "class.pure-u-1-1 pure-u-xl-1-3 pure-u-lg-1-3 pure-u-md-1-2 novel_cell",
          "bookUrl": "tag.a@href",
          "coverUrl": "amp-img@src",
          "intro": "tag.li.2@text",
          "name": "h3@text"
        },
        "ruleBookInfo": {
          "author": "tag.li.2@a@text",
          "coverUrl": "class.novel_info@amp-img@src",
          "intro": "p@text",
          "kind": "tag.li.2@text##類別：",
          "lastChapter": "class.near_chapter@all",
          "name": "h1@text",
          "tocUrl": "baseUrl"
        },
        "ruleToc": {
          "chapterList": "class.chapters_frame@class.pure-g@class.chapter_cell@tag.a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "class.content@p@textNodes",
          "replaceRegex": "##【記住.*超靠譜 】|天天看小說.+超靠譜"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "鲸云轻说（优++）",
        "bookSourceUrl": "https://jyapi.jyacg.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/web/search?name={{key}}&page={{page}}&type=1",
        "ruleSearch": {
          "author": "author",
          "bookList": "data",
          "bookUrl": "/web/books/detail?id={{$.id}}",
          "coverUrl": "cover_image",
          "intro": "intro",
          "kind": "labels.name&&serial_status",
          "name": "name",
          "wordCount": "{{$.total_words}}万字"
        },
        "ruleBookInfo": {
          "author": "author",
          "coverUrl": "cover_image",
          "init": "data",
          "intro": "book_label&&intro##(^|\\/)##  ✱ ",
          "kind": "serial_status&&new_seciton_time##\\s.*",
          "lastChapter": "new_section",
          "name": "name@put:{bid:id}",
          "tocUrl": "/web/books/directory?books_id={{$.id}}",
          "wordCount": "{{$.total_words}}万字"
        },
        "ruleToc": {
          "chapterList": "data[*].directory[*]",
          "chapterName": "title",
          "chapterUrl": "/web/books/read?page={{$.page}}&books_id=@get:{bid}"
        },
        "ruleContent": {
          "content": "data.content##o:"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "神凑轻说（优++）",
        "bookSourceUrl": "http://www.shencou.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/modules/article/search.php?searchtype=articlename+selected&searchkey={{key}}&page={{page}},{\n  \"charset\": \"gbk\"\n}",
        "header": "{\n\t\"User-Agent\":\"Mozilla/5.0 (Linux; Android 11; V1981A Build/RP1A.200720.012;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.79 Mobile Safari/537.36\",\n\"Referer\":\"http://www.shencou.com/\"\n}",
        "ruleSearch": {
          "author": "tag.td.2@text",
          "bookList": "id.content@tag.tr!0",
          "bookUrl": "tag.td.0@tag.a@href",
          "coverUrl": "tag.td.0@tag.a@href<js>\nvar id = result.match(/(\\d+)\\.html/)[1];\nvar iid = parseInt(id/1000);\n'/files/article/image/'+iid+'/'+id+'/'+id+'s.jpg';\n</js>",
          "kind": "tag.td.-1@text&&tag.td.-2@text&&tag.td.-3@text",
          "lastChapter": "tag.td.1@tag.a@text",
          "name": "tag.td.0@tag.a@text"
        },
        "ruleBookInfo": {
          "coverUrl": "@css:#content table tr:nth-of-type(3) table tr td:nth-of-type(2) img@src",
          "intro": "@css:#content table tr:nth-of-type(3) table tr td:nth-of-type(2)@html##.+内容简介：\\s*(.+)本书公告：.+##$1",
          "tocUrl": "@css:.btnlink:contains(开始阅读)@href"
        },
        "ruleToc": {
          "chapterList": "class.zjlist4@tag.a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "body@textNodes"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.coverUrl用了 <js>",
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "轻说百科（优++）",
        "bookSourceUrl": "https://lnovel.tw",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/books?page={{page}}&q%5Bname_cont%5D={{key}}",
        "ruleSearch": {
          "bookList": "class.col-6 col-md-4 col-md-3 col-lg-6 col-xl-4",
          "bookUrl": "href",
          "coverUrl": "img@src",
          "name": "text"
        },
        "ruleBookInfo": {
          "author": ".text-body-tertiary.0@text",
          "coverUrl": "https://lnovel.tw{{@@class.w-100 h-100.0@src}}",
          "intro": "&nbsp;\n🎁：{{@@.card-body@p@text}}",
          "kind": "{{@@dd.1@a@text}},{{@@dd.2@a@text}}",
          "name": "h1@text"
        },
        "ruleToc": {
          "chapterList": ".accordion-item@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "class.card-body.0@html##{{title}}"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "茶马小说（优++）",
        "bookSourceUrl": "https://www.chamabooks.net",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/search?s={{key}}",
        "header": "{\n\t \"User-Agent\":\"Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1\",\n\t \"Referer\": \"https://www.chamabooks.net/\"\n}",
        "ruleSearch": {
          "author": ".misc-value a@text",
          "bookList": ".novel-item",
          "bookUrl": "h4 a@href",
          "intro": "p.novel-desc@text",
          "kind": ".category,.upload-date@text",
          "name": "h4 a@text",
          "wordCount": ".word-count@text"
        },
        "ruleBookInfo": {
          "author": "h1 a@text##作者:",
          "coverUrl": "[property=\"og:image\"]@content",
          "intro": ".novel-summary-content@html",
          "kind": "@js:\nconst get = (sel) => String(java.getString(sel))\nlet cat = book.kind || get(\".category@text\")\nlet count = get(\"@@.misc-value.2@text\");\ncount = count ? \",章节数：\"+count : \"\";\ncat.concat(count)",
          "lastChapter": "option.-1@value",
          "name": "h1@ownText##《|》",
          "wordCount": ".misc-value.1@text##$##字"
        },
        "ruleToc": {
          "chapterList": "option",
          "chapterName": "text",
          "chapterUrl": "value"
        },
        "ruleContent": {
          "content": "#novel-content@html##{{title}}"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.kind用了 @js:",
          "详情规则.kind用了 java.*"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "趣悦小说（优++）",
        "bookSourceUrl": "https://vreader.vivo.com.cn/",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://vreader.vivo.com.cn/book/search.do,{'method': 'POST',\n'body': '{\"model\":\"MI PAD 4\",\"imei\":\"123456789012345\",\"clientVersion\":\"121020\",\"elapsedtime\":\"343343\",\"sysver\":\"\",\"nt\":\"wifi\",\"ver\":\"121020\",\"u\":\"\",\"pver\":\"0\",\"resolution\":\"1920*1200\",\"bookVersion\":\"30800\",\"vreaderVersion\":121020,\"pixel\":\"320\",\"av\":\"27\",\"adrVerName\":\"8.1.0\",\"timestamp\":\"1675854786926\",\"openudid\":\"b443cebc6f614746\",\"udid\":\"\",\"channel\":\"0\",\"personalRecommend\":1,\"bookshelfBookIds\":[],\"bookShelfListenBookIds\":[],\"packageName\":\"com.vivo.vreader\",\"featureValues\":\"2\",\"androidId\":\"b443cebc6f614746\",\"page\":0,\"size\":20,\"keyword\":\"{{key}}\",\"tab\":0}'\n}",
        "header": "{\"User-Agent\":\"Mozilla/5.0 (Linux; Android 8.1.0; MI PAD 4 Build/OPM1.171019.019; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/71.0.3578.99 Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": "$.author",
          "bookList": "$..bookList[*]",
          "bookUrl": "https://vreader.vivo.com.cn/book/detail.do,{'method': 'POST',\n'body': '{\"model\":\"MI PAD 4\",\"imei\":\"\",\"clientVersion\":\"121020\",\"elapsedtime\":\"980289\",\"sysver\":\"\",\"nt\":\"wifi\",\"ver\":\"121020\",\"u\":\"\",\"pver\":\"0\",\"resolution\":\"1920*1200\",\"sessionId\":\"11901470641675854550446\",\"pixel\":\"320\",\"av\":\"27\",\"adrVerName\":\"8.1.0\",\"timestamp\":\"1675855423873\",\"browserSystem\":\"1\",\"browserSubSystem\":\"1\",\"personalRecommend\":\"1\",\"bookVersion\":\"30800\",\"vreaderVersion\":\"121020\",\"packageName\":\"com.vivo.vreader\",\"udid\":\"\",\"openudid\":\"b443cebc6f614746\",\"bookshelfBookIds\":[],\"bookShelfListenBookIds\":[],\"featureValues\":\"2\",\"bookId\":\"{{$.bookId}}\",\"order\":1}'\n}",
          "coverUrl": "$.cover",
          "intro": "$.description",
          "kind": "{{$.typeLabel}}\n{{$.categoryLabel}}",
          "name": "$.title",
          "wordCount": "$.wordCount"
        },
        "ruleBookInfo": {
          "author": "$.author@put:{bid:bookId}",
          "coverUrl": "$.cover",
          "init": "$.data",
          "intro": "$.description",
          "kind": "{{java.timeFormat(java.getString('$.latestChapterTimestamp'))}}\n{{$.typeLabel}}\n{{$.categoryLabel}}##/##-",
          "lastChapter": "$.latestChapter",
          "name": "$.title",
          "tocUrl": "https://vreader.vivo.com.cn/book/catalogue.do,{'method': 'POST',\n'body': '{\"model\":\"MI PAD 4\",\"imei\":\"\",\"clientVersion\":\"121020\",\"elapsedtime\":\"981277\",\"sysver\":\"\",\"nt\":\"wifi\",\"ver\":\"121020\",\"u\":\"\",\"pver\":\"0\",\"resolution\":\"1920*1200\",\"sessionId\":\"11901470641675854550446\",\"pixel\":\"320\",\"av\":\"27\",\"adrVerName\":\"8.1.0\",\"timestamp\":\"1675855424862\",\"browserSystem\":\"1\",\"browserSubSystem\":\"1\",\"personalRecommend\":\"1\",\"bookVersion\":\"30800\",\"vreaderVersion\":\"121020\",\"packageName\":\"com.vivo.vreader\",\"udid\":\"\",\"openudid\":\"b443cebc6f614746\",\"bookshelfBookIds\":[],\"bookShelfListenBookIds\":[],\"featureValues\":\"2\",\"bookId\":\"{{$.bookId}}\"}'\n}",
          "wordCount": "$.wordCount"
        },
        "ruleToc": {
          "chapterList": "$.data[*]",
          "chapterName": "$.title",
          "chapterUrl": "https://vreader.vivo.com.cn/book/chapter/content.do,{'method': 'POST',\n'body': '{\"model\":\"MI PAD 4\",\"imei\":\"\",\"clientVersion\":\"121020\",\"elapsedtime\":\"981290\",\"sysver\":\"\",\"nt\":\"wifi\",\"ver\":\"121020\",\"u\":\"\",\"pver\":\"0\",\"resolution\":\"1920*1200\",\"sessionId\":\"11901470641675854550446\",\"pixel\":\"320\",\"av\":\"27\",\"adrVerName\":\"8.1.0\",\"timestamp\":\"1675855424879\",\"browserSystem\":\"1\",\"browserSubSystem\":\"1\",\"personalRecommend\":\"1\",\"bookVersion\":\"30800\",\"vreaderVersion\":\"121020\",\"packageName\":\"com.vivo.vreader\",\"udid\":\"\",\"openudid\":\"b443cebc6f614746\",\"bookshelfBookIds\":[],\"bookShelfListenBookIds\":[],\"featureValues\":\"2\",\"bookId\":\"@get:{bid}\",\"order\":\"{{$.order}}\"}'\n}",
          "updateTime": "字数::{{$.wordCount}}"
        },
        "ruleContent": {
          "content": "$..content"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.kind用了 java.*"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "疯读小说（优++）",
        "bookSourceUrl": "https://fiction.fengduxiaoshuo.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://fiction.fengduxiaoshuo.com/doReader/search/result?_token=d2a094ff-b75f-4b60-ba2c-19e1cfe6cf73&key_words={{key}}&api_version=v6&nid=f0439a4f53b774fa0b4d90b48738e4f1&_sv=v2",
        "header": "{\"User-Agent\": \"okhttp/3.12.0\"}",
        "ruleSearch": {
          "author": "$.bookAuthor",
          "bookList": "$..books[*]",
          "bookUrl": "https://fiction.fengduxiaoshuo.com/doReader/enter_bookinfo_index?_token=d2a094ff-b75f-4b60-ba2c-19e1cfe6cf73&bookId={{$.bookId}}&_sv=v2",
          "coverUrl": "$.bookCoverImage",
          "intro": "$.bookDesc",
          "kind": "$.chapters_update_time&&$.c_class_name&&{$.crazy_rating}分",
          "name": "$.bookTitle##（+.*|.*最新章节|\\(+.*",
          "wordCount": "$.book_words_num"
        },
        "ruleBookInfo": {
          "lastChapter": "$..detailedBookInfo.bookChapterAllInfo[-1].chapterTitle"
        },
        "ruleToc": {
          "chapterList": "$..detailedBookInfo.bookChapterAllInfo[*]",
          "chapterName": "$.chapterTitle##[\\(（].*[求更谢乐发推].*[）\\)]",
          "chapterUrl": "https://fiction.fengduxiaoshuo.com/doReader/get_content_by_chapterId?_token=d2a094ff-b75f-4b60-ba2c-19e1cfe6cf73&bookId={{$.bookId}}&chapterId={{$.chapterId}}&chapterCount=1&_sv=v2"
        },
        "ruleContent": {
          "content": "$..chapterContent",
          "imageStyle": "0"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name",
          "详情规则.lastChapter：不支持的 JSONPath：[-1].chapterTitle"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "风扇枕说（日+）",
        "bookSourceUrl": "https://kakuyomu.jp/",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/search?q={{key}}&page={{page}}",
        "ruleSearch": {
          "author": "class.WorkTitle_workLabelAuthor__Kxy5E@children@text",
          "bookList": "class.NewBox_borderSize-bb-m__wEqyb",
          "bookUrl": "class. Gap_size-4s__F67Nf Gap_direction-x__RsHk8@tag.a@href",
          "checkKeyWord": "僕",
          "kind": "class.Meta_metaTruncatedItem__X_PoQ@text",
          "name": "class. Gap_size-4s__F67Nf Gap_direction-x__RsHk8@text",
          "wordCount": "class.WorkMetaBasicInformation_bg-none__s41TO@children@children@class.Meta_metaItemWrapper__JzV2P.3@children@text"
        },
        "ruleBookInfo": {
          "intro": "class.CollapseTextWithKakuyomuLinks_lineHeight-m__sr9Tu@text"
        },
        "ruleToc": {
          "chapterList": "class.WorkTocSection_link__ocg9K",
          "chapterName": "class.WorkTocSection_title__H2007@text##《　|　》",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "class.widget-episode-inner@tag.p@text"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "有度轻说（优+）",
        "bookSourceUrl": "https://www.yodu.org/qingxiaoshuo",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://www.yodu.org/sa/all-{{key}}-{{page}}.html",
        "ruleSearch": {
          "author": "class.vam mr10.1@text||class.c_small mb5 mr15 ell ttc fs16.0@text",
          "bookList": "class.ser-ret@li||class.j_bookList@li",
          "bookUrl": "a@href",
          "coverUrl": "img@_src",
          "kind": "class.vam mr10.0@text&&tag.span.2@text&&class.c_small mb5 mr15 ell ttc fs16.1@text",
          "lastChapter": "class.vam@a@text",
          "name": "h3@text||h2@text"
        },
        "ruleBookInfo": {
          "author": "class.mr15 ttl@a@text",
          "coverUrl": "class.g_thumb@img@src",
          "intro": "class.h112 mb15 det-abt lh1d8 c_strong fs16 hm-scroll@html",
          "kind": "class.mr15 ttc hisp@text",
          "lastChapter": "class.ell lst-chapter dib vam@text",
          "name": "class.mb15 lh1d2 oh@text"
        },
        "ruleToc": {
          "chapterList": "id.chapterList@li@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.TextContent@html##（本章未完）",
          "nextContentUrl": "text.下一章@href"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "天天书吧（优+）",
        "bookSourceUrl": "https://m.ttshu8.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/search.html,{\n  \"body\": \"searchkey={{key}}\",\n  \"method\": \"POST\"\n}",
        "header": "{\"referer\": \"{{source.getKey()}}\",\n\"x-requested-with\": \"mark.via\",\n\"accept-language\": \"zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7\",\n\"user-agent\": \"Mozilla/5.0 (Linux; Android 10; PACM00 Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.5359.79 Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": "a.2@text",
          "bookList": ".list li",
          "bookUrl": "a.0@href",
          "checkKeyWord": "剑来",
          "coverUrl": "img@src",
          "intro": "p.-2@text",
          "kind": "span@text",
          "lastChapter": "a.-1@text",
          "name": "a.1@text"
        },
        "ruleBookInfo": {
          "author": ".author@text",
          "coverUrl": ".detail img@src",
          "downloadUrls": "text.TXT下载@href",
          "intro": ".intro p.0@text",
          "kind": ".detail a.1@text&&.detail span.0@text&&.detail p.-1@text",
          "lastChapter": ".detail a.-1@text",
          "name": ".name@text",
          "tocUrl": ".now a@href",
          "wordCount": ".detail span.1@text"
        },
        "ruleToc": {
          "chapterList": ".read li a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": "option@value||text.下一页@href"
        },
        "ruleContent": {
          "content": ".content@html",
          "nextContentUrl": "text.下一@href",
          "replaceRegex": "##喜欢.+收藏.*更新速度最快。"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则暂不支持 downloadUrls"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "中文书城（优+）",
        "bookSourceUrl": "https://cxb-pro.cread.com/",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://cxb-pro.cread.com/cx/searchbooks,{\n\"charset\": \"\",\n\"method\": \"POST\",\n\"body\": \"keyword={{key}}&pageNo={{page}}\"\n}",
        "header": "{\r\n\"uid\":\"110496550\",\r\n\"cnid\":\"10005\",\r\n\"version\":\"7.6.0\",\r\n\"packname\":\"com.mianfeizs.book\",\r\n\"oscode\":\"30\",\r\n\"vcode\":\"134\",\r\n\"channelId\":\"10005\",\r\n\"platform\":\"android\",\r\n\"appname\":\"mfzs\"\n}",
        "ruleSearch": {
          "author": "$.author",
          "bookList": "$.list",
          "bookUrl": "https://readbook-service-freebook.cread.com/cx/bookDetailYS?bookid={{$.id}}",
          "coverUrl": "$.cover",
          "intro": "$.summary",
          "kind": "$.categoryName",
          "name": "$.name",
          "wordCount": "$.words"
        },
        "ruleBookInfo": {
          "author": "$..bookVo.authorName",
          "intro": "$..bookVo.introduction",
          "lastChapter": "$..bookVo.lastUpdateChapterName",
          "name": "$..bookVo.bookName@put:{bookid:$..bookVo.bookId}",
          "tocUrl": "https://cxb-pro.cread.com/cx/itf/getvolume?bookId={{$..bookVo.bookId}}"
        },
        "ruleToc": {
          "chapterList": "$..bookChapters[*]",
          "chapterName": "$.name",
          "chapterUrl": "https://cxb-pro.cread.com:443/cx/itf/chapterRead?bookId=@get:{bookid}&chapterId={{$.id}}&full=0",
          "updateTime": "$.updateDate@js:java.timeFormat(result)"
        },
        "ruleContent": {
          "content": "$..content"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "目录规则.updateTime用了 @js:",
          "目录规则.updateTime用了 java.*"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "中华典藏（优+）",
        "bookSourceUrl": "https://www.zhonghuadiancang.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "{{cookie.removeCookie(source.getKey())}}\n/e/search/index.php,{\n    \"method\": \"POST\",\n    \"body\": \"tbname=bookname&show=title,writer&tempid=1&keyboard={{key}}\"\n}",
        "ruleSearch": {
          "author": "a.1@text",
          "bookList": "tbody@tr",
          "bookUrl": "a.0@href",
          "intro": "p@text",
          "name": "a.0@text"
        },
        "ruleBookInfo": {
          "author": ".panel-heading@small@a@text",
          "coverUrl": ".fmpic@img@src",
          "intro": ".m-summary@text##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": ".breadcrumb@a.1@text",
          "lastChapter": "id.booklist@a.-1@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".breadcrumb@a.2@text"
        },
        "ruleToc": {
          "chapterList": ".vv-book@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.content@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "古龙武侠（优+）",
        "bookSourceUrl": "http://m.gulongbbs.com/wuxia",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "http://m.gulongbbs.com/index.php?m=search&c=index&a=init&typeid=1&siteid=1&q={{key}}",
        "ruleSearch": {
          "bookList": "class.c wrap@li",
          "bookUrl": "tag.a.0@href",
          "intro": "tag.p@text",
          "lastChapter": "class.adds@text##发布时间：",
          "name": "h5@text"
        },
        "ruleBookInfo": {
          "author": "##作者：(.*?)&##$1###",
          "name": "class.crumbs@tag.a.-1@text",
          "tocUrl": "class.crumbs@tag.a.-1@href"
        },
        "ruleToc": {
          "chapterList": "table@tr@td@a||class.list@li@a||tag.html",
          "chapterName": "class.title@text||text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.div_content@html||class.content@html##<!--内容关联投票-->|[\\s\\S]+?敬请关注 \"古龙武侠网\" 微信公众号|.*全面支持https访问",
          "nextContentUrl": "text.下一页@href"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "金庸小说（优+）",
        "bookSourceUrl": "https://www.jinyongwang.net#♤yc",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/search/{{key}}/",
        "ruleSearch": {
          "bookList": ".article_li",
          "bookUrl": "a.0@href",
          "checkKeyWord": "雪山",
          "intro": "p.0@text##\\s",
          "kind": "a.1@text&&span@text",
          "name": "a.0@text"
        },
        "ruleBookInfo": {
          "author": ".author a@text",
          "coverUrl": ".bookimg img@src",
          "kind": ".title h1@text&&.time@text##.*小说|出版时间.|出版社.",
          "lastChapter": ".mlist a.-1@text",
          "name": ".title span@text##小说"
        },
        "ruleToc": {
          "chapterList": ".mlist li@a||h1",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "#vcon@p@html||#con@html",
          "imageStyle": "0"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "盗墓笔记（优+）",
        "bookSourceUrl": "http://www.daomubiji.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "-",
        "ruleSearch": {
          "author": "text##(|)",
          "bookList": "class.container@tag.li!0",
          "bookUrl": "tag.a@href",
          "name": "class.menu-item@tag.a.0@text"
        },
        "ruleBookInfo": {
          "intro": "class.focusbox-text@text"
        },
        "ruleToc": {
          "chapterList": "class.excerpts-wrapper@tag.a",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "class.article-content@tag.p@text"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "古诗词网（优+）",
        "bookSourceUrl": "https://m.gushici.net/",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://m.gushici.net/chaxun/all/{{key}}",
        "ruleSearch": {
          "author": "p.0@text||.juab@text||p.1@a.1@text",
          "bookList": ".shici-pic||.ju-box||.gushici",
          "bookUrl": "a@href",
          "checkKeyWord": "李白",
          "coverUrl": "@js:'https://s21.ax1x.com/2024/05/29/pk3AYzd.png'",
          "intro": "🐾\n{{@@.tag@text}}{{@@p@text}}",
          "kind": "p.1@a.0@text##>>",
          "name": "b@text||.juaa@text||p.0@text"
        },
        "ruleBookInfo": {
          "author": "p.0@a.1@text",
          "intro": "🐾\n{{@@.tag@text}}{{@@p@text}}",
          "kind": "p.0@a.0@text",
          "name": "h1@text"
        },
        "ruleToc": {
          "chapterList": "dl dd a||tag.html",
          "chapterName": "h1@text||text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": ".gushici.0@html&&.shici@html",
          "replaceRegex": "##上一章|目录|下一章"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.coverUrl用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "熊猫文学（优+）",
        "bookSourceUrl": "https://www.dxmwx.org",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/list/{{key}}.html",
        "ruleSearch": {
          "author": "class.margin0h5.0@tag.a.1@text",
          "bookList": "@css:#ListContents>div[style*='margin']",
          "bookUrl": "class.margin0h5.0@tag.a.0@href",
          "coverUrl": "tag.img.0@src",
          "intro": "class.neirongh5.0@tag.a.0@text",
          "kind": "class.biaoqian.0@tag.a.0@text",
          "lastChapter": "@css:a[href='javascript:void(0)']@textNodes",
          "name": "class.margin0h5.0@tag.a.0@text"
        },
        "ruleBookInfo": {
          "author": "//meta[@property='og:novel:author']/@content",
          "coverUrl": "//meta[@property='og:image']/@content",
          "intro": "//meta[@property='og:description']/@content",
          "kind": "//meta[@property='og:novel:category']/@content",
          "lastChapter": "//meta[@property='og:novel:latest_chapter_name']/@content",
          "name": "//meta[@property='og:novel:book_name']/@content",
          "tocUrl": "@css:a[href^='/chapter/']@href"
        },
        "ruleToc": {
          "chapterList": "@css:a[href^='/read/']:not([title])",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.Lab_Contents.0@html"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.author：当前环境不支持 XPath",
          "详情规则.coverUrl：当前环境不支持 XPath",
          "详情规则.intro：当前环境不支持 XPath",
          "详情规则.kind：当前环境不支持 XPath",
          "详情规则.lastChapter：当前环境不支持 XPath",
          "详情规则.name：当前环境不支持 XPath"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "百合爱会（优+）",
        "bookSourceUrl": "https://www.yamibo.com/site/novel",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://www.yamibo.com/search/novel?SearchForm%5Bkeyword%5D={{key}}&page={{page}}",
        "ruleSearch": {
          "author": "tag.td.2@text",
          "bookList": "class.table table-hover@tag.tbody@tag.tr",
          "bookUrl": "tag.td.1@tag.a@href",
          "coverUrl": "tag.img.0@src",
          "kind": "tag.td.3@tag.a@text",
          "name": "tag.td.1@tag.a@text"
        },
        "ruleBookInfo": {
          "coverUrl": "tag.img.1@src",
          "intro": "class.panel-body.1@text"
        },
        "ruleToc": {
          "chapterList": "class.col-md-4 col-xs-6!0:1:2",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "class.row@tag.p@textNodes",
          "imageStyle": "0.0"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "全本小说（优+）",
        "bookSourceUrl": "https://m.qbxsba.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/modules/article/search.php,{\n  \"body\": \"searchkey={{key}}&action=login&searchtype=all\",\n  \"charset\": \"UTF-8\",\n  \"method\": \"POST\"\n}",
        "ruleSearch": {
          "author": "a.2@text",
          "bookList": "class.cover@p",
          "bookUrl": "a.1@href",
          "checkKeyWord": "我的",
          "kind": "a.0@text##\\[|\\]",
          "name": "a.1@text"
        },
        "ruleBookInfo": {
          "coverUrl": "class.block_img2@img@src",
          "intro": "class.intro_info@text",
          "lastChapter": "class.block_txt2@p.6@a@text"
        },
        "ruleToc": {
          "chapterList": "class.chapter@li",
          "chapterName": "a@text",
          "chapterUrl": "a@href",
          "nextTocUrl": "id.pagelink@a.11@href"
        },
        "ruleContent": {
          "content": "id.nr1@html",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##本章未完.*"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "💠 笔趣阁22",
        "bookSourceUrl": "https://m.22biqu.com",
        "bookSourceGroup": "哈哈",
        "searchUrl": "{{cookie.removeCookie(source.getKey())}}\n/ss/,{\n  \"body\": \"searchkey={{key}}\",\n  \"method\": \"POST\"\n}",
        "ruleSearch": {
          "author": ".author[0]@text",
          "bookList": ".bookbox",
          "bookUrl": "a.1@href",
          "coverUrl": "img@src",
          "kind": ".author[1]@text##.*：",
          "lastChapter": "a.2@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "a.1@text"
        },
        "ruleBookInfo": {
          "author": ".synopsisArea_detail@b@text",
          "coverUrl": ".synopsisArea_detail@img@src",
          "init": "",
          "intro": ".review@p@html",
          "kind": ".synopsisArea_detail@p.0:1:3@text##.*：|\\s..:.*",
          "lastChapter": ".synopsisArea_detail@a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "id.top@span@text",
          "wordCount": ""
        },
        "ruleToc": {
          "chapterList": ".directoryArea!0@p@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href",
          "nextTocUrl": "option@value||.index-container-btn@href"
        },
        "ruleContent": {
          "content": "id.chaptercontent@p@html",
          "nextContentUrl": "id.pt_next@href",
          "replaceRegex": "##\\\\s*({{ book.durChapterTitle }}|.*作者：.*|PS：.*求推荐！|PS：.*求收藏！|感谢.*打赏.*|感谢.*推荐票.*|感谢.*月票.*|（.*月票.*）|（为大家的.*票加更.*）|第二更在.*|为防止采集.*支持！|网址：sudugu\\\\.com|更多.*書吧看！|无错.*小说。|必应.*速读谷|loadAdv.*)\\\\s*\"",
          "sourceRegex": ""
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "三七小说（优+）",
        "bookSourceUrl": "https://www.37yq.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://www.37yq.com/so.html?searchkey={{key}}&page={{page}}&searchtype=all",
        "ruleSearch": {
          "author": "class.bookinfo@a.0@text",
          "bookList": "class.search-result-list clearfix",
          "bookUrl": "class.btn@a.0@href||class.tit@a.0@href||class.imgbox fl se-result-book@a.0@href",
          "checkKeyWord": "魔女之旅",
          "coverUrl": "class.imgbox fl se-result-book@a.0@tag.img.0@src",
          "intro": "class.fl se-result-infos@p.0@text",
          "kind": "class.bookinfo@a.1@text%%class.bookinfo@span.0@text",
          "name": "class.tit@a.0@text##\\(.*?\\)",
          "wordCount": "class.bookinfo@tag.span.1@all##\\D+"
        },
        "ruleBookInfo": {
          "author": "class.au-name@text",
          "coverUrl": "class.book-img fl@tag.img@src",
          "intro": "class.book-dec Jbook-dec hide@p@text",
          "kind": "class.book-label@children@text## ##,",
          "lastChapter": "class.tit fl.0@text",
          "name": "class.book-name@text##\\(.*?\\)",
          "tocUrl": "class.btn read-btn@href",
          "wordCount": "@js:\n// 这里字数还是有问题，不过是网站给的数据有问题，我不知道咋改了\nlet wordCountStr = java.getString(\"class.nums@tag.i.1@text\");\nlet wordCount = parseInt(wordCountStr, 10);\nlet doubledWordCount = wordCount * 2;\nlet formattedWordCount = `${doubledWordCount}万字`;\nformattedWordCount\n"
        },
        "ruleToc": {
          "chapterList": "class.col-4",
          "chapterName": "class.col-4@a@text",
          "chapterUrl": "class.col-4@a@href",
          "isVolume": "class.v-line@text"
        },
        "ruleContent": {
          "content": "class.read-content@all&&class.divimage@tag.img@all",
          "sourceRegex": "/files.*",
          "title": "id.mlfy_main_text@h1@text"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.wordCount用了 @js:",
          "详情规则.wordCount用了 java.*",
          "正文规则暂不支持 sourceRegex"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "大唐小说（优+）",
        "bookSourceUrl": "https://www.dtxsw.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/search.php?q={{key}}&p={{page}}",
        "ruleSearch": {
          "author": ".book_other:nth-child(3)@text",
          "bookList": ".row:nth-child(2) > .col-12:nth-child(n+1)",
          "bookUrl": "h3 > a@href",
          "coverUrl": "img@src",
          "kind": "{{@@h3 > a@text##\\[(.*)\\].*##$1}}\n{{@@.book_other:nth-child(4),\n.book_other:nth-child(5)@text##[\\u4e00-\\u9fa5]+：}}",
          "lastChapter": ".book_other:nth-child(6)@text##[\\u4e00-\\u9fa5]+：",
          "name": "h3 > a@text##\\[.*\\]"
        },
        "ruleBookInfo": {
          "author": "[property$=author]@content",
          "intro": "{{@@[property$=description]@content##(^|[。！？]+[”」）】]?)##$1<br>}}",
          "kind": "[property~=category|status|update_time]@content",
          "name": "[property$=book_name]@content"
        },
        "ruleToc": {
          "chapterList": ".book_list2 .col-md-3:nth-child(n+1) > a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": ".page-item.4@a@href\n@js:\nvar resultStr = result && result.length > 0 ? result[0] : \"\";\nvar match = resultStr.match(/\\/index_(\\d+)\\.html/);\nvar n = match && match[1] ? parseInt(match[1], 10) : 1; \nvar list = [];\nfor (var i = 1; i <= n; i++) {\n    list.push(\"index_\" + i + \".html\"); \n}\nlist;"
        },
        "ruleContent": {
          "content": ".font_max@html",
          "nextContentUrl": "text.下一@href",
          "replaceRegex": "##第\\(\\d+\\/\\d+\\)页|dengbi.net|dmxsw.com|qqxsw.com|yifan.netshuyue.net|epzw.net|qqwxw.com|xsguan.comxs007.com|zhuike.net|readw.com|23zw.cc"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "目录规则.nextTocUrl用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "阅读库子（优+）",
        "bookSourceUrl": "http://www.yuedsk.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "http://www.yuedsk.com/modules/article/search.php?q={{key}}",
        "ruleSearch": {
          "author": ".c_tag span.1@text",
          "bookList": ".c_row",
          "bookUrl": "a.1@href",
          "coverUrl": "img@src",
          "kind": ".c_tag span.3:7:-1@text",
          "lastChapter": ".c_value a@text",
          "name": "a.1@text",
          "wordCount": ".c_tag span.5@text"
        },
        "ruleBookInfo": {
          "author": "[property$=author]@content",
          "coverUrl": ".divbox img@src",
          "kind": "[property~=category|status]@content",
          "name": "[property$=book_name]@content",
          "tocUrl": ".btnlink@href"
        },
        "ruleToc": {
          "chapterList": ".chapters li a",
          "chapterName": "text##^0+\\s*(\\d+)(?!\\s*章)##$1章",
          "chapterUrl": "href",
          "updateTime": "title"
        },
        "ruleContent": {
          "content": "#clickeye_content@html",
          "replaceRegex": "##\\(阅读库.*\\)|阅读库.+com"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "安读书网（优+）",
        "bookSourceUrl": "https://www.88haoshu.com/",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "{{url=source.getKey();\ncookie.removeCookie(url);\nurl}}sss/?searchkey={{key}}",
        "ruleSearch": {
          "author": "td.2@text",
          "bookList": "tr!0",
          "bookUrl": "a.0@href",
          "checkKeyWord": "我的模拟长生路",
          "coverUrl": "a.0@href##.*\\/(\\d+)\\/(\\d+)\\/.*##https://img.88haoshu.com/$1/$2/$2s.jpg",
          "kind": "td.-1@text",
          "lastChapter": "{{@@td.3@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求含理更谢乐发推票盟补加字].*?[】）\\)]}}•{{@@td.-1@text}}\n@js:result\n.replace(\"••\",\"\")\n.replace(/^(\\d+).第/,'第')\n.replace(/^(\\d+)[、．]第.+章/,'第$1章')\n.replace(/^(\\d+)、\\d+、/,'第$1章 ')\n.replace(/^(\\d+)、\\d+/,'第$1章')\n.replace(/^(第.+章)\\s?\\d+/,'$1')\n.replace(/^(\\d+)、/,'第$1章 ')\n.replace(/^(第.+章)\\s?第.+章/,'$1')\n.replace(/第\\s(.+)\\s章/,'第$1章')\n.replace(/.*(chapter|Chapter)\\s?(\\d+)\\s?/,'$1 $2 ')\n.replace(/\\(.+\\)/,'')\n.replace(/\\[|。/,'')\n.replace(/第([零一二两三四五六七八九十百千]+)章/g,java.toNumChapter(result))\n##(章)([^\\s]+)(\\s·)##$1 $2$3",
          "name": "td.1@text"
        },
        "ruleBookInfo": {
          "author": "[property$=author]@content",
          "coverUrl": "[property$=image]@content",
          "intro": "🕰  更新时间：\n{{@@[property$=update_time]@content##\\s.*}}\n📜  内容简介：\n{{@@[property$=description]@content}}##(^|[。！？……；]+[”」）】]?)##$1<br>",
          "kind": "[property~=category|status|update_time]@content##\\s.*",
          "lastChapter": "{{@@[property$=chapter_name]@content##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求含理更谢乐发推票盟补加字].*?[】）\\)]}}•{{@@[property$=update_time]@content##\\s.*}}\n@js:result\n.replace(\"••\",\"\")\n.replace(/^(\\d+).第/,'第')\n.replace(/^(\\d+)[、．]第.+章/,'第$1章')\n.replace(/^(\\d+)、\\d+、/,'第$1章 ')\n.replace(/^(\\d+)、\\d+/,'第$1章')\n.replace(/^(第.+章)\\s?\\d+/,'$1')\n.replace(/^(\\d+)、/,'第$1章 ')\n.replace(/^(第.+章)\\s?第.+章/,'$1')\n.replace(/第\\s(.+)\\s章/,'第$1章')\n.replace(/.*(chapter|Chapter)\\s?(\\d+)\\s?/,'$1 $2 ')\n.replace(/\\(.+\\)/,'')\n.replace(/\\[|。/,'')\n.replace(/第([零一二两三四五六七八九十百千]+)章/g,java.toNumChapter(result))\n##(章)([^\\s]+)(\\s·)##$1 $2$3",
          "name": "[property$=book_name]@content"
        },
        "ruleToc": {
          "chapterList": "#list@dl@dd@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "#content@p@html",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##.本章完.|{{try{title}catch(e){\"\"} }}"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.lastChapter用了 @js:",
          "搜索规则.lastChapter用了 java.*",
          "详情规则.lastChapter用了 @js:",
          "详情规则.lastChapter用了 java.*"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "快眼看书（优+）",
        "bookSourceUrl": "http://www.booksky.cc",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "http://www.booksky.cc/modules/article/search.php?searchkey={{key}}",
        "ruleSearch": {
          "author": "class.info@tag.span.1@text",
          "bookList": "class.librarylist@tag.li",
          "bookUrl": "class.info@tag.span.0@tag.a@href",
          "coverUrl": "class.pt-ll-l@tag.a@tag.img@src",
          "lastChapter": "class.last@tag.a@text",
          "name": "class.info@tag.span.0@tag.a@text"
        },
        "ruleBookInfo": {
          "author": "class.novelinfo-l@tag.li.0@text##作者：",
          "coverUrl": "class.novelinfo-r@tag.a@tag.img@src",
          "intro": "class.novelintro@text##各位书友要是.*",
          "kind": "[property=\"og:novel:category\"]@content&&[property=\"og:novel:status\"]@content",
          "lastChapter": "class.novelinfo-l@li@a@text",
          "name": "class.w-left@tag.h1@text"
        },
        "ruleToc": {
          "chapterList": "class.fulldir@tag.ul@tag.li@tag.a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.chaptercontent@textNodes"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "快眼看书（优+）",
        "bookSourceUrl": "http://www.xbotaodz.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/modules/article/search.php?searchkey={{key}}",
        "ruleSearch": {
          "author": "class.info@tag.span.1@text",
          "bookList": "class.librarylist@tag.li",
          "bookUrl": "class.info@tag.span.0@tag.a@href",
          "coverUrl": "class.pt-ll-l@tag.a@tag.img@src",
          "lastChapter": "class.last@tag.a@text",
          "name": "class.info@tag.span.0@tag.a@text"
        },
        "ruleBookInfo": {
          "author": "class.novelinfo-l@tag.li.0@text##作者：",
          "coverUrl": "class.novelinfo-r@tag.a@tag.img@src",
          "intro": "class.novelintro@text",
          "name": "class.w-left@tag.h1@text"
        },
        "ruleToc": {
          "chapterList": "class.fulldir@tag.ul@tag.li@tag.a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.chaptercontent@textNodes"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "轻之文库（优+）",
        "bookSourceUrl": "https://www.linovel.net:443/",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://www.linovel.net:443/search?kw={{key}}",
        "ruleSearch": {
          "author": "class.book-extra@text##丨.*",
          "bookList": "class.rank-book||class.rank-book-list@tag.a",
          "bookUrl": "tag.a@href||href",
          "coverUrl": "img@src",
          "intro": "class.book-intro@textNodes",
          "kind": "class.book-tags@text",
          "name": "class.book-name@text||class.title@text"
        },
        "ruleBookInfo": {
          "intro": "class.about-text@html##(^|[。！？]++”?+)##$1<br>"
        },
        "ruleToc": {
          "chapterList": "class.chapter",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "class.l@textNodes"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name",
          "详情规则.intro：无效的替换正则"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "书法小说（优+）",
        "bookSourceUrl": "http://www.sfwx.com/",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/search.php?q={{key}}<,&p={{page}}>",
        "ruleSearch": {
          "author": "span.0@text",
          "bookList": ".col-12 dl",
          "bookUrl": "a@href",
          "coverUrl": "img@src",
          "kind": ".book_other[1:2]@text##状态|更新时间|：",
          "lastChapter": ".book_other.-1@text##最新章节：",
          "name": "h3@text##\\[\\w+\\]"
        },
        "ruleBookInfo": {
          "author": "@get:{a}",
          "coverUrl": "@get:{c}",
          "init": "@put:{n:\"[property$=book_name]@content\",\na:\"[property$=author]@content\",\nk:\"[property~=category|status|update_time]@content\",\nw:\".caption-bookinfo span.1@text\",\nl:\"[property$=latest_chapter_name]@content\",\ni:\"[property$=description]@content\",\nc:\"img@src\",\nt:\"text.全部章节@href\"}",
          "intro": "@get:{i}",
          "kind": "@get:{k}",
          "lastChapter": "@get:{l}",
          "name": "@get:{n}"
        },
        "ruleToc": {
          "chapterList": ".book_list2 ul li a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": ".page-item@a@href"
        },
        "ruleContent": {
          "content": ".font_max@html",
          "nextContentUrl": "text.下一章@href",
          "replaceRegex": "##\\s第\\(\\d+/\\d+\\)页|第\\(1/\\d+\\)页"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "爱久久网（优+）",
        "bookSourceUrl": "http://www.jjjxsw.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/e/search/index.php,{\n  \"method\": \"POST\",\n  \"body\": \"show=title&keyboard={{key}}\"\n}",
        "ruleSearch": {
          "author": "text##.*：",
          "bookList": ".searchTopic",
          "bookUrl": "a@href",
          "name": "a@text"
        },
        "ruleBookInfo": {
          "author": ".zuozhe@a@text",
          "coverUrl": ".img@img@src##\\?.*",
          "intro": "id.mainSoftIntro@html##^##&nbsp;📥【本书源网站支持小说下载】{{'\\n'+'​'}}",
          "kind": ".downInfoRowL@li.5@span@text&&.downInfoRowL@li.1:6@textNodes##小说",
          "name": "id.downInfoArea@h1@text##《|》",
          "tocUrl": ".yuedu@a@href##1\\.html|(?<=read)/\\d+",
          "wordCount": ".downInfoRowL@li.2@textNodes"
        },
        "ruleToc": {
          "chapterList": ".view_content_list@li@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.view_content_txt@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "桔纸书屋（优+）",
        "bookSourceUrl": "https://m.juzhishuwu.com/",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "modules/article/search.php,{\n  \"body\": \"searchkey={{key}}&code=1234\",\n  \"charset\": \"gbk\",\n  \"method\": \"POST\"\n}",
        "ruleSearch": {
          "author": "td.2@text",
          "bookList": "#nr",
          "bookUrl": "a.0@href",
          "checkKeyWord": "我的模拟长生路",
          "kind": "td.-1:-2@text",
          "lastChapter": "{{@@td.1@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求含理更谢乐发推票盟补加字].*?[】）\\)]}}•{{@@td.-2@text}}\n@js:result\n.replace(\"••\",\"\")\n.replace(/^(\\d+).第/,'第')\n.replace(/^(\\d+)[、．]第.+章/,'第$1章')\n.replace(/^(\\d+)、\\d+、/,'第$1章 ')\n.replace(/^(\\d+)、\\d+/,'第$1章')\n.replace(/^(\\d+)、/,'第$1章 ')\n.replace(/^(第.+章)\\s?第.+章/,'$1')\n.replace(/第\\s(.+)\\s章/,'第$1章')\n.replace(/.*(chapter|Chapter)\\s?(\\d+)\\s?/,'$1 $2 ')\n.replace(/\\(.+\\)/,'')\n.replace(/\\[|。/,'')\n.replace(/第([零一二两三四五六七八九十百千]+)章/g,java.toNumChapter(result))\n##(章)([^\\s]+)(\\s·)##$1 $2$3",
          "name": "td.0@a@text"
        },
        "ruleBookInfo": {
          "author": "[property$=author]@content",
          "coverUrl": ".imgbox@img@src",
          "intro": "🕰  更新时间：\n{{@@[property$=update_time]@content##\\s.*}}\n📜  内容简介：\n{{@@class.m-desc xs-show@textNodes##.*观看小说\\:}}##(^|[。！？……；]+[”」）】]?)##$1<br>",
          "kind": "[property~=category|status|update_time]@content##\\s.*",
          "lastChapter": "{{@@[property$=chapter_name]@content##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求含理更谢乐发推票盟补加字].*?[】）\\)]}}•{{@@[property$=update_time]@content##\\s.*}}\n@js:result\n.replace(\"••\",\"\")\n.replace(/^(\\d+).第/,'第')\n.replace(/^(\\d+)[、．]第.+章/,'第$1章')\n.replace(/^(\\d+)、\\d+、/,'第$1章 ')\n.replace(/^(\\d+)、\\d+/,'第$1章')\n.replace(/^(\\d+)、/,'第$1章 ')\n.replace(/^(第.+章)\\s?第.+章/,'$1')\n.replace(/第\\s(.+)\\s章/,'第$1章')\n.replace(/.*(chapter|Chapter)\\s?(\\d+)\\s?/,'$1 $2 ')\n.replace(/\\(.+\\)/,'')\n.replace(/\\[|。/,'')\n.replace(/第([零一二两三四五六七八九十百千]+)章/g,java.toNumChapter(result))\n##(章)([^\\s]+)(\\s·)##$1 $2$3",
          "name": "[property$=book_name]@content",
          "tocUrl": "{{baseUrl.replace('.html',\"/1/\")}}"
        },
        "ruleToc": {
          "chapterList": ".section-list.1@li@a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": "<js>\ntry{\nn=java.getString('@@.pagination@text').match(/第1页，共(\\d+)页/)[1];\nfor(i=2,list=[];i<=n;i++){\n\tlist.push(baseUrl.replace(/\\/1\\/$/,'\\/'+i+'\\/'))\n}\nlist\n}catch(e){[]}\n</js>"
        },
        "ruleContent": {
          "content": "#content@textNodes",
          "nextContentUrl": "text.下一页@href"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.lastChapter用了 @js:",
          "搜索规则.lastChapter用了 java.*",
          "详情规则.lastChapter用了 @js:",
          "详情规则.lastChapter用了 java.*",
          "目录规则.nextTocUrl用了 <js>",
          "目录规则.nextTocUrl用了 java.*",
          "详情规则.tocUrl：模板里是脚本表达式：{{baseUrl.replace('.html',\"/1/\")}}"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "秋风书屋（优+）",
        "bookSourceUrl": "https://www.qiufengshuwu.com#",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://www.qiufengshuwu.com/s.html,{\n  \"body\": \"s={{key}}&type=articlename\",\n  \"charset\": \"GBK\",\n  \"method\": \"POST\"\n}",
        "header": "{\"User-Agent\": \"Mozilla/5.0 (Linux; Android 9) Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": "span@text",
          "bookList": "p.sone",
          "bookUrl": "a.0@href",
          "checkKeyWord": "剑来",
          "kind": "0",
          "name": "a.0@text"
        },
        "ruleBookInfo": {
          "author": ".infotype a.0@text",
          "coverUrl": ".infohead img@src",
          "intro": "#intro p@text",
          "kind": ".infotype p.1:3:2@text\n##作品类型：|作品状态：|更新时间：",
          "lastChapter": ".list_xm li.0@text",
          "name": "h3.0@text",
          "tocUrl": "text.章节目录@href"
        },
        "ruleToc": {
          "chapterList": ".chapters li",
          "chapterName": "text",
          "chapterUrl": "a@href"
        },
        "ruleContent": {
          "content": "#novelcontent p@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "铅笔轻说（优+）",
        "bookSourceUrl": "https://www.qxsw.cc",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/search/?searchkey={{key}}&submit=",
        "header": "{\n  \"User-Agent\":\"Mozilla/5.0 (Linux; Android 12.0; wv) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/4.0 Chrome/100.0.2987.108 Mobile Safari/537.36\"\n}",
        "ruleSearch": {
          "author": ".txt@textNodes",
          "bookList": "dl",
          "bookUrl": "a@href",
          "coverUrl": ".lazy@data-original",
          "intro": ".book_des@text||.name@text",
          "kind": ".book_other@span@text",
          "name": "h3 a@text||h3@text##（.*"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "[property=\"og:image\"]@content",
          "intro": "[property=\"og:description\"]@content",
          "kind": "[property~=category|status]@content",
          "lastChapter": "{{@@[property=\"og:novel:latest_chapter_name\"]@content}} | {{@@[property=\"og:novel:update_time\"]@content}}",
          "name": "[property=\"og:novel:book_name\"]@content##（.*"
        },
        "ruleToc": {
          "chapterList": "#chapterList li a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "#TextContent@html##{{book.name}}.+最新章节",
          "replaceRegex": "##铅笔小说"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "神话之后（优+）",
        "bookSourceUrl": "https://www.shenhuazhihou.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://www.shenhuazhihou.com/e/search/index.php,{\n  \"body\": \"tbname=bookname&show=title,writer&tempid=1&keyboard={{key}}\",\n  \"method\": \"POST\"\n}",
        "ruleSearch": {
          "author": ".author@text",
          "bookList": ".book-coverlist",
          "bookUrl": "a.0@href",
          "coverUrl": "img@src",
          "intro": ".intro@text",
          "name": "h4@a@text"
        },
        "ruleBookInfo": {
          "author": ".m-infos@span.0@text",
          "coverUrl": "img@src",
          "intro": "p.0@text\n##(^|[。！？……]+[”」）……】]?)##$1<br>",
          "kind": ".m-infos@span.1:2@text##.*：|.*：",
          "lastChapter": ".m-upd@a@text",
          "name": "h1@text"
        },
        "ruleToc": {
          "chapterList": "#play_0@li@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.chaptercontent@p@html",
          "nextContentUrl": "text.下一@href"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "过期杂志（优+）",
        "bookSourceUrl": "https://www.52dzxy.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "#",
        "header": "{\"User-Agent\": \"Mozilla/5.0 (Linux; Android 9; MIX 2 Build/PKQ1.190118.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/80.0.3987.99 Mobile Safari/537.36\"}",
        "ruleSearch": {
          "bookList": ".magazine-grid .magazine-item",
          "bookUrl": "a@href",
          "name": "a@text##更多..."
        },
        "ruleBookInfo": {
          "coverUrl": ".sidebar@img@src"
        },
        "ruleToc": {
          "chapterList": ".catalog-section-title,.article-title a||.maglistbox dt,.maglistbox dl dd a",
          "chapterName": "text",
          "chapterUrl": "href",
          "isVolume": ".catalog-section-title@text||span@text"
        },
        "ruleContent": {
          "content": "tag.p@html##我爱读者校园网"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "追光阅读（优）",
        "bookSourceUrl": "http://touchlife.cootekservice.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "http://touchlife.cootekservice.com/doReader/search_book?_token=e72ca407-9caa-475d-a829-46e15d3d4834&action=search_book&search_keyword={{key}}",
        "ruleSearch": {
          "author": "bookAuthor",
          "bookList": "result",
          "bookUrl": "http://touchlife.cootekservice.com/doReader/enter_bookinfo_index?_token=e72ca407-9caa-475d-a829-46e15d3d4834&bookId={$.bookId}",
          "coverUrl": "bookCoverImage",
          "intro": "bookRecommendWords||bookDesc&&copyright_owner",
          "kind": "bookBClassificationName",
          "name": "bookTitle"
        },
        "ruleBookInfo": {},
        "ruleToc": {
          "chapterList": "result.detailedBookInfo.bookChapterAllInfo",
          "chapterName": "chapterTitle",
          "chapterUrl": "http://touchlife.cootekservice.com/doReader/get_content_by_chapterId?_token=e72ca407-9caa-475d-a829-46e15d3d4834&bookId={$.bookId}&chapterId={$.chapterId}"
        },
        "ruleContent": {
          "content": "$..chapterContent"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "夜天连看（优）",
        "bookSourceUrl": "http://www.yetianlian.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "http://www.yetianlian.com/s.php?ie=gbk&q={{key}}",
        "ruleSearch": {
          "author": "class.author@text##作者：",
          "bookList": "class.bookbox",
          "bookUrl": "tag.a.1@href",
          "coverUrl": "tag.img@src",
          "intro": "tag.p@text",
          "kind": "class.cat@text##分类：",
          "lastChapter": "class.update@tag.a@text",
          "name": "tag.h4@text"
        },
        "ruleBookInfo": {
          "author": "class.info@tag.span.0@text##作者：",
          "coverUrl": "class.cover@tag.img@src",
          "intro": "class.intro@text##简介：|作者.*",
          "kind": "class.info@tag.span.1@text##分类：",
          "lastChapter": "class.info@class.last.1@tag.a@text&&class.info@class.last.0@text##更新时间：|..\\:.*",
          "name": "class.info@tag.h2@text",
          "wordCount": "class.info@tag.span.3@text##字数："
        },
        "ruleToc": {
          "chapterList": "class.listmain@tag.dd!0:1:2:3:4:5:6:7:8:9:10:11",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "id.content@html",
          "imageStyle": "0",
          "replaceRegex": "##http://www.yetianlian.com.*.html|请记住本书首发.*"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "博览群书（优）",
        "bookSourceUrl": "https://readnovelfull.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://readnovelfull.com/novel-list/search?keyword={{key}}",
        "ruleSearch": {
          "author": ".author@text",
          "bookList": "class.row",
          "bookUrl": "h3 a@href",
          "coverUrl": "img@src",
          "lastChapter": "h3 a@href<js>java.ajax('https://readnovelfull.com'+result)</js>.item-value@text&&.item-time@text\n<js>result.replace(/\\n/,' • ')</js>",
          "name": "h3@text"
        },
        "ruleBookInfo": {
          "author": ".info-meta@li.1@text##Author:",
          "coverUrl": ".book img@src",
          "intro": "&nbsp;&nbsp;Update：{{@@.item-time@text}}    Status：{{@@.text-primary@text}}    Rating：{{@@.small@strong.0@text}}{{'\\n&lrm;\\n'}}{{@@.desc-text@html}}",
          "kind": ".info-meta@li.2@a@text",
          "lastChapter": ".item-value@text",
          "name": "class.title.0@text",
          "tocUrl": "https://readnovelfull.com/ajax/chapter-archive?novelId={{@@#rating@data-novel-id}}"
        },
        "ruleToc": {
          "chapterList": "li a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": ".chr-c@html",
          "replaceRegex": "##Chapter \\d+: Chapter \\d+|Chapter \\d+(?=\\n)"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.lastChapter用了 <js>",
          "搜索规则.lastChapter用了 java.*",
          "详情规则.intro：模板里是脚本表达式：{{'\\n&lrm;\\n'}}"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "文桑小说（优）",
        "bookSourceUrl": "http://www.wensang.net",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/home/search?type=action&q={{key}}",
        "ruleSearch": {
          "author": "span.1@text",
          "bookList": "id.sitebox@dl",
          "bookUrl": "a.1@href",
          "coverUrl": "img@src",
          "kind": "span.3:2:0@text##\\s.*",
          "lastChapter": "a.4@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "a.1@text"
        },
        "ruleBookInfo": {
          "author": ".field@a.0@text",
          "coverUrl": "id.bookCover@img@src",
          "intro": ".desc-short@text##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": ".field@span.1:2:5@text##.*：|\\s..:.*",
          "lastChapter": ".logs@a.1@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".infos@h1@text"
        },
        "ruleToc": {
          "chapterList": ".chapter@li@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.BookText@textNodes"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "商店小说（优）",
        "bookSourceUrl": "http://www.16kbook.net",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "http://www.16kbook.net/search.php?q={{key}}&p={{page}}",
        "header": "{\"User-Agent\": \"Mozilla/5.0 (Linux; Android 9) Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": "dd.1@span@text",
          "bookList": "class.col-12 col-md-6",
          "bookUrl": "h3@a@href",
          "checkKeyWord": "我的",
          "coverUrl": "dt@a@img@src",
          "lastChapter": "dd.4@a@text",
          "name": "h3@a@text##\\]|\\["
        },
        "ruleBookInfo": {
          "author": "@get:{a}",
          "coverUrl": "@get:{c}",
          "init": "@put:{n:\"[property$=book_name]@content\",\na:\"[property$=author]@content\",\nk:\"[property~=category|status|update_time]@content\",\nl:\"[property$=lastest_chapter_name]@content\",\ni:\"[property$=description]@content\",\nc:\"[property$=image]@content\"}",
          "intro": "@get:{i}",
          "kind": "@get:{k}",
          "lastChapter": "@get:{l}",
          "name": "@get:{n}"
        },
        "ruleToc": {
          "chapterList": "class.row@li",
          "chapterName": "a@text",
          "chapterUrl": "a@href",
          "nextTocUrl": "class.page-item@a@href"
        },
        "ruleContent": {
          "content": "class.font_max@html",
          "nextContentUrl": "text.下一章@href",
          "replaceRegex": "##最近转码严重.*退出阅读模式.*|.*新书.*支持.*|第.*页|.*com.*"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "五五读书（优）",
        "bookSourceUrl": "https://www.changduzw.com#",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://www.changduzw.com/modules/article/search.php,{\n'charset': 'utf-8',\n'method': 'POST',\n'body': 'searchkey={{key}}&type=submit'\n}",
        "ruleSearch": {
          "author": "td.2@text",
          "bookList": "body > div.warpper > div.o_all > div.o_content > div > table > tbody > tr!0",
          "bookUrl": "td.0@a@href",
          "kind": "class.even@text",
          "lastChapter": "td.1@a@text",
          "name": "td.0@a@text"
        },
        "ruleBookInfo": {
          "author": "class.status@tag.p.1@text",
          "coverUrl": "class.imgbox@tag.img@src",
          "intro": "class.con@tag.p@text",
          "kind": "class.status@tag.a.0@text",
          "lastChapter": "class.red.1@text",
          "name": "class.status@tag.h1@text",
          "tocUrl": "text.点击阅读@href",
          "wordCount": "class.status@tag.p.-3@text##总字数."
        },
        "ruleToc": {
          "chapterList": "class.mulu_list@tag.a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.htmlContent@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "同人小说（优）",
        "bookSourceUrl": "http://tongren.faloo.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/r/0/1.html?t=1&k={{key}},{\"charset\": \"gb2312\"}",
        "header": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "ruleSearch": {
          "author": "tag.a.2@text",
          "bookList": "class.l_main1@class.l_bar",
          "bookUrl": "tag.a.0@href",
          "coverUrl": "class.l_pic@tag.img@src",
          "intro": "class.a_333@tag.a.0@text",
          "kind": "tag.a.3@text",
          "lastChapter": "class.l_nn@tag.a@text",
          "name": "tag.h1.0@text"
        },
        "ruleBookInfo": {
          "author": ".ni_10 > a@text",
          "coverUrl": ".ni_5 img@src",
          "intro": "#con_tab11_box1 > .a_666@text",
          "kind": ".a_666:nth-child(1) > .a_666@text",
          "lastChapter": "#con_tab11_box3 > h1@text",
          "name": ".a_24b@h1@text"
        },
        "ruleToc": {
          "chapterList": "class.ni_list@tag.td",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": ".noveContent@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "言情港吧（优）",
        "bookSourceUrl": "https://www.yanqinggang.com#",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://www.yanqinggang.com/modules/article/search.php,{\n\t \"body\": \"searchkey={{key}}\",\n\t \"charset\": \"gbk\",\n\t \"method\": \"POST\"\n}",
        "ruleSearch": {
          "author": ".category-div@span.0@text",
          "bookList": "class.border3.commend.flex.flex-between.category-commend@.category-div",
          "bookUrl": "h3@a@href",
          "checkKeyWord": "遮天",
          "coverUrl": "img.lazy@src",
          "intro": "div.intro.indent@text##精.*彩.*连.*载.*书.*",
          "name": ".category-div@h3@a.0@text"
        },
        "ruleBookInfo": {
          "author": "div.w100.dispc@span@a@text##本书作者：",
          "coverUrl": "img.lazy@src",
          "intro": "div.info-main-intro@p@text##精.*彩.*连.*载.*书.*",
          "kind": "div.info-title@a.1@text&&.info-main@.dispc.1@textNodes&&.info-main@span.1@text##.*：",
          "lastChapter": ".info-chapters.flex.flex-wrap.0@a.0@text",
          "name": "h1@text",
          "tocUrl": "java.refreshBookUrl()"
        },
        "ruleToc": {
          "chapterList": "div.container.border3-2.mt8.mb20@div.info-chapters.flex.flex-wrap@a",
          "chapterName": "text",
          "chapterUrl": "href",
          "isVip": "true"
        },
        "ruleContent": {
          "content": "#article@textNodes",
          "nextContentUrl": "#next_url@href"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.tocUrl用了 java.*"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "无线电子（优）",
        "bookSourceUrl": "https://www.wxdzs.net",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://www.wxdzs.net/wxlist/{{key}}.html",
        "header": "{\"User-Agent\": \"Mozilla/5.0 (Linux; Android 9; MIX 2 Build/PKQ1.190118.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/80.0.3987.99 Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": "a.2@text",
          "bookList": "#ListContents > div[style^=margin]",
          "bookUrl": "a.1@href",
          "checkKeyWord": "剑来",
          "coverUrl": "img@src",
          "intro": "a.4@text",
          "kind": ".biaoqian a@text",
          "lastChapter": "{{@a.5@textNodes}}•{{@span.-1@text}}",
          "name": "a.1@text"
        },
        "ruleBookInfo": {
          "author": "@get:{a}",
          "coverUrl": "@get:{c}",
          "init": "@put:{n:\"[property$=book_name]@content\",\na:\"[property$=author]@content\",\nk:\"[property~=category|status|update_time]@content\",\nl:\"[property~=las?test_chapter_name]@content\",\ni:\"div[style$=margin: 10px 0px;]@text\",\nc:\"[property$=image]@content\"}",
          "intro": "@get:{i}",
          "kind": "@get:{k}",
          "lastChapter": "@get:{l}",
          "name": "@get:{n}"
        },
        "ruleToc": {
          "chapterList": "div.book_list_top~div a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": ".onlyh5.-1@a@href"
        },
        "ruleContent": {
          "content": "#Lab_Contents@html"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.lastChapter：模板里是脚本表达式：{{@a.5@textNodes}}",
          "详情规则.init：不支持的选择器：div[style$=margin: 10px 0px;]"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "无奈书库（优）",
        "bookSourceUrl": "https://www.52shuku123.cc",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/modules/article/search.php,{\n  \"body\": \"searchkey={{key}}\",\n  \"charset\": \"GBK\",\n  \"method\": \"POST\"\n}",
        "ruleSearch": {
          "author": ".author.0@text",
          "bookList": ".bookbox",
          "bookUrl": "a.0@href",
          "checkKeyWord": "我的",
          "coverUrl": "a.0@href##\\D+((\\d+)\\d{3})\\D*##https://tu.52shuku123.org/$2/$1/$1s.jpg###",
          "intro": ".update@ownText",
          "kind": "span.0@text",
          "lastChapter": "a.1@text",
          "name": "h4@text",
          "wordCount": ".author.1@text##字数：|字"
        },
        "ruleBookInfo": {
          "author": "a.0@text",
          "coverUrl": "img@src",
          "init": ".book",
          "intro": ".bookintro@text",
          "kind": "span.2@text&&p.-1@text\n##更新时间：",
          "lastChapter": "a.-1@text",
          "name": "h1@text",
          "wordCount": "span.0@text"
        },
        "ruleToc": {
          "chapterList": "#list-chapterAll dd a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": ".readcontent@textNodes",
          "nextContentUrl": "text.下一页@href"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "搜书小说（优）",
        "bookSourceUrl": "http://www.soshu8.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "http://www.soshu8.com/search.php?q={{key}}",
        "header": "{\"User-Agent\": \"Mozilla/5.0 (Linux; Android 10) Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": ".book_other@span@text",
          "bookList": ".row@dl",
          "bookUrl": "dt@a@href",
          "coverUrl": "dt@a@img@src",
          "kind": "dd@h3@text##\\[|\\].*",
          "lastChapter": "{{@@.book_other.-1@a@text}}·{{@@.book_other.-2@text##更新时间：|\\s.*}}",
          "name": "dd@h3@text##\\[.*\\]"
        },
        "ruleBookInfo": {
          "author": ".options@li.0@a@text",
          "coverUrl": "img@src",
          "intro": "[property$=og:description]@content",
          "lastChapter": "{{@@.options@li.-3@a@text}}{{@@.options@li.1@text##更新时间：|\\s.*}}",
          "name": ".info@h1@text"
        },
        "ruleToc": {
          "chapterList": ".book_list2@li",
          "chapterName": "a@text",
          "chapterUrl": "a@href",
          "nextTocUrl": ".page-link@href"
        },
        "ruleContent": {
          "content": ".font_max@html##第\\(\\d+\\/\\d+\\)页|.*\\.org|.*\\.cc|.*\\.cn|.*\\.com",
          "nextContentUrl": "text.下一章@href"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "就爱文学（优）",
        "bookSourceUrl": "http://www.92xs.info",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/modules/article/search.php,{\n  \"method\": \"post\",\n  \"body\": \"searchtype=articlename=author&searchkey={{key}}\"\n}",
        "ruleSearch": {
          "author": ".odd.1@text",
          "bookList": "id.author@tbody@tr!0",
          "bookUrl": "a.0@href",
          "coverUrl": "a.0@href##.*/(\\d+)(\\d+)(\\d+)(\\d+).*##/files/article/image/$1/$1$2$3$4/$1$2$3$4s.jpg",
          "kind": ".even.2@text&&.odd.2@text",
          "lastChapter": ".even.0@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".odd.0@text",
          "wordCount": ".even.1@text"
        },
        "ruleBookInfo": {
          "author": ".p_author@text",
          "coverUrl": "id.bookimg@img@src",
          "downloadUrls": "id.button_all@a.1@href",
          "intro": "id.bookintro@p.-1@text##(^|[。！？]+[”」）】]?)##$1<br>@js:result.replace(/【展开】.*/g,\"\")",
          "kind": "id.count@span.0:3@text&&id.keywords@text##.*：|小说|\\s.*",
          "lastChapter": "id.newlist@a.1@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".d_title@h1@text",
          "tocUrl": ".newrap@a.0@href",
          "wordCount": "id.count@span.2@text"
        },
        "ruleToc": {
          "chapterList": ".ccss",
          "chapterName": "a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "a@href"
        },
        "ruleContent": {
          "content": "id.ccontent@textNodes"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro用了 @js:",
          "详情规则暂不支持 downloadUrls"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "速读谷子（优）",
        "bookSourceUrl": "https://www.sudugu.org/",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "i/sor.aspx?key={{key}}<,&p={{page}}>",
        "ruleSearch": {
          "author": "text.作者：@text",
          "bookList": ".item",
          "bookUrl": "a.0@href",
          "coverUrl": "img@src",
          "kind": "span@text&&i.1@text",
          "lastChapter": "li.0@a@text",
          "name": "h3@a,b@text"
        },
        "ruleBookInfo": {
          "author": "text.作者：@text",
          "canReName": "1",
          "coverUrl": ".item@img@src",
          "intro": ".des.0@html",
          "kind": ".item@span@text&&#dir@span@text##更新时间：",
          "lastChapter": ".item@li.0@a@text",
          "name": "h1@a@text",
          "wordCount": "h1@i@text"
        },
        "ruleToc": {
          "chapterList": ".dir@li",
          "chapterName": "text",
          "chapterUrl": "a@href",
          "nextTocUrl": ".gr@href"
        },
        "ruleContent": {
          "content": ".con@html",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##\\(本章完\\)"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "蚂蚁文学（优）",
        "bookSourceUrl": "https://www.mayiwsk.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/modules/article/search.php,{\n  \"method\": \"post\",\n  \"body\": \"searchkey={{key}}&searchtype=articlename\"\n}",
        "ruleSearch": {
          "author": "td.2@text",
          "bookList": "id.nr",
          "bookUrl": "a.0@href",
          "coverUrl": "a.0@href##.+\\D((\\d+)\\d{3})\\D##/files/article/image/$2/$1/$1s.jpg###",
          "kind": "td.5:4@text",
          "lastChapter": "td.1@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "td.0@text",
          "wordCount": "td.3@text"
        },
        "ruleBookInfo": {
          "author": "id.info@p.0@text",
          "coverUrl": "id.fmimg@img@src",
          "intro": "id.intro@text##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": "id.info@p.2@text##.*：|\\s..:.*",
          "lastChapter": "id.info@a.-1@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "id.info@h1@text"
        },
        "ruleToc": {
          "chapterList": "id.list@dd@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.content@html",
          "replaceRegex": "##最新网址.*"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "乐文阁网（优）",
        "bookSourceUrl": "http://www.lewenge.cc",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/modules/article/search.php,{\n  \"method\": \"post\",\n  \"body\": \"searchkey={{key}}\"\n}",
        "ruleSearch": {
          "author": "span.0@text##.*：",
          "bookList": "id.alistbox",
          "bookUrl": "a.0@href",
          "coverUrl": "img@src",
          "intro": ".intro@text",
          "lastChapter": "a.2@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "a.1@text"
        },
        "ruleBookInfo": {
          "author": ".ui_tb1@em@text",
          "coverUrl": ".pic@img@src",
          "intro": ".intro@text##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": ".ui_tb1@tr.4@td.0@textNodes&&.ui_tb1@tr.4@td.2@textNodes&&.ui_tb1@tr.5@td.3@textNodes",
          "lastChapter": ".con@a.0@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".ui_tb1@h1@ownText",
          "tocUrl": ".btopt@a@href",
          "wordCount": "tbody@tr.5@td.1@textNodes##字"
        },
        "ruleToc": {
          "chapterList": "tbody.0@td@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.content@p@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "三五中文（优）",
        "bookSourceUrl": "http://www.xkushu.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "http://www.xkushu.com/modules/article/search.php?searchkey={{key}}",
        "ruleSearch": {
          "author": "class.odd.1@text",
          "bookList": "class.grid@tr",
          "bookUrl": "class.odd.0@tag.a.0@href",
          "coverUrl": "tag.a.0@href##^.+?(\\d+)\\D(\\d+).+##/35zwhtml/$1/$2/$2s.jpg",
          "kind": "class.even.2@text",
          "lastChapter": "class.even@a@text",
          "name": "class.odd@a@text"
        },
        "ruleBookInfo": {
          "intro": "id.intro@text",
          "lastChapter": "id.details@tag.a.2@text",
          "name": "id.info@tag.h1@text"
        },
        "ruleToc": {
          "chapterList": "id.list@dd@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.content@textNodes"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "零零小说（优）",
        "bookSourceUrl": "https://www.00shu.la",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/modules/article/search.php?q={{key}}",
        "ruleSearch": {
          "author": "td.2@text",
          "bookList": "tbody@tr!0",
          "bookUrl": "a.0@href",
          "coverUrl": "a.0@href<js>\nvar id = result.match(/(\\d+)\\/?$/)[1];\nvar iid = parseInt(id/1000);\n'/files/article/image/'+iid+'/'+id+'/'+id+'s.jpg';\n</js>",
          "kind": "td.5:4@text",
          "lastChapter": "a.1@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "a.0@text",
          "wordCount": "td.3@text"
        },
        "ruleBookInfo": {
          "author": "id.info@p.0@text",
          "coverUrl": "id.fmimg@img@src",
          "intro": "id.intro@p!0@text##(^|[。！？]+[”」）】]?)##$1<br>@js:result.replace(/各位书友要.*/g,\"\")",
          "kind": ".con_top@a.2@text&&id.info@p.1:2@text##.*：|\\s.*",
          "lastChapter": "id.info@a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "id.info@h1@text",
          "tocUrl": "text.在线阅读@href"
        },
        "ruleToc": {
          "chapterList": "id.list@dd@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.content@html",
          "replaceRegex": "##最新网址：.*"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.coverUrl用了 <js>",
          "详情规则.intro用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "八一中文（优）",
        "bookSourceUrl": "https://www.blxs.info/",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/modules/article/search.php,{\"method\":\"post\",\"body\":\"searchkey={{key}}&searchtype=articlename\"}",
        "ruleSearch": {
          "author": "td[2]@text",
          "bookList": "#nr",
          "bookUrl": "a@href",
          "checkKeyWord": "明克街",
          "coverUrl": "a@href##(\\d+(/\\d+))##/files/article/image/$1$2s.jpg###",
          "kind": "td[5,4,3]@text",
          "lastChapter": "td[1]@text",
          "name": "td[0]@text"
        },
        "ruleBookInfo": {
          "author": "#info p[0]@text",
          "coverUrl": "img@src",
          "init": ".box_con,#list",
          "intro": "#info p[2]@text&&#intro@text",
          "lastChapter": "#list a[0]@text",
          "name": "h1@text"
        },
        "ruleToc": {
          "chapterList": "#list a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "#content@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "铅笔小说（优）",
        "bookSourceUrl": "https://www.23qb.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/search.html?searchkey={{key}}",
        "ruleSearch": {
          "bookList": "class.module-search-item",
          "bookUrl": "tag.a.0@href",
          "coverUrl": "tag.img.0@data-src",
          "intro": "class.novel-info-item.0@text",
          "kind": "class.tag-link.0@tag.span.0@text## ##,",
          "name": "tag.a.0@title"
        },
        "ruleBookInfo": {
          "author": "//meta[@property='og:novel:author']/@content",
          "coverUrl": "//meta[@property='og:image']/@content",
          "intro": "//meta[@property='og:description']/@content",
          "kind": "//meta[@property='og:novel:tags']/@content&&//meta[@property='og:novel:status']/@content@js:result[0]=String(result[0]).replace(/^\\./,'').replace(`${book.author}\\.`,'').replace(`${book.name}\\.`,'').replace(/(\\.| )/g,',')",
          "lastChapter": "//meta[@property='og:novel:latest_chapter_name']/@content",
          "name": "//meta[@property='og:novel:book_name']/@content",
          "tocUrl": "class.catalog-more.0@href",
          "wordCount": "class.novel-info-aux.0@tag.span.-1@text"
        },
        "ruleToc": {
          "chapterList": "class.module-row-text",
          "chapterName": "tag.span.0@text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "class.article-content.0@html##\\(本章完\\)"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.kind用了 @js:",
          "详情规则.author：当前环境不支持 XPath",
          "详情规则.coverUrl：当前环境不支持 XPath",
          "详情规则.intro：当前环境不支持 XPath",
          "详情规则.lastChapter：当前环境不支持 XPath",
          "详情规则.name：当前环境不支持 XPath"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "手机看书（优）",
        "bookSourceUrl": "https://www.sjks88.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/e/search/index.php,{\n  \"charset\": \"gb2312\",\n  \"method\": \"post\",\n  \"body\": \"keyboard={{key}}&show=title&classid=0\"\n}",
        "ruleSearch": {
          "bookList": ".box ul li",
          "bookUrl": "a.0@href",
          "checkKeyWord": "洪荒：",
          "intro": "p@text",
          "kind": "a.1@text&&span@textNodes",
          "name": "a.0@text##（.*|\\(.*"
        },
        "ruleBookInfo": {
          "author": ".box-artic div.0@text##\\_.*",
          "intro": ".desc@html",
          "kind": ".box-artic div.2:1@text##.*：",
          "name": ".box-artic h1@text##（.*|\\(.*"
        },
        "ruleToc": {
          "chapterList": ".list li a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": ".content@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "殓师灵异（优）",
        "bookSourceUrl": "http://www.rulianshi.org/#pb1101",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "http://www.rulianshi.org/s.php?ie=utf-8&q={{key}}",
        "ruleSearch": {
          "author": "class.author@text",
          "bookList": "class.bookbox",
          "bookUrl": "h4@a@href",
          "coverUrl": "img@src",
          "lastChapter": "class.update@a@text",
          "name": "h4@a@text"
        },
        "ruleBookInfo": {
          "author": "class.info@class.small@tag.span.0@text",
          "coverUrl": "class.cover@img@src",
          "intro": "class.info@ownText",
          "kind": "class.info@class.small@tag.span.4@text&&\nclass.info@class.small@tag.span.1@text&&\nclass.info@class.small@tag.span.2@text##分类：|状态：|更新时间：",
          "lastChapter": "class.info@class.small@tag.span.5@a@text",
          "name": "class.info@h2@text",
          "wordCount": "class.info@class.small@tag.span.3@text##字数："
        },
        "ruleToc": {
          "chapterList": "class.listmain@dd",
          "chapterName": "a@text",
          "chapterUrl": "a@href"
        },
        "ruleContent": {
          "content": "id.content@html##http.*html|请记住本书首发.*org",
          "nextContentUrl": "text.下一页@href"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "天堂深圳（优）",
        "bookSourceUrl": "http://tiantangxiangzuoshenzhenwangyou.qwyd.net",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "http://tiantangxiangzuoshenzhenwangyou.qwyd.net/",
        "ruleSearch": {
          "bookList": "class.active",
          "bookUrl": "tag.a@href",
          "name": "tag.a@text"
        },
        "ruleBookInfo": {
          "author": "class.container@tag.p.0@text##一段悲.*\n版权所有©2013-2016 天堂向左 深圳往右 作者慕容雪村",
          "intro": "class.container@tag.p.0@text##作者：.*",
          "name": "tag.h1@text"
        },
        "ruleToc": {
          "chapterList": "class.thumbnail",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "class.span12@html",
          "nextContentUrl": "text.下一页@href"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "全本同人（优）",
        "bookSourceUrl": "https://www.qbtr.me/",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/e/search/index.php,{\n  \"charset\": \"gb2312\",\n  \"method\": \"POST\",\n  \"body\": \"keyboard={{key}}&show=title&classid=0\"\n}",
        "ruleSearch": {
          "author": ".booknews@ownText##.*：",
          "bookList": ".bk",
          "bookUrl": "a.0@href",
          "coverUrl": "img@src",
          "intro": "p@text##简介.",
          "kind": "label@text",
          "lastChapter": "h3@text##\\S+\\(|\\)",
          "name": "h3@text##\\(\\S+"
        },
        "ruleBookInfo": {
          "author": ".date span@text##.*：",
          "coverUrl": ".pic img@src",
          "intro": ".infos p@html",
          "kind": ".menNav a.1@text&&.date@textNodes##.*：|小说",
          "lastChapter": ".book_list a.-1@text",
          "name": ".infos h1@text##\\(\\S+"
        },
        "ruleToc": {
          "chapterList": ".book_list a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": ".read_chapterDetail@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "爱尚小说（优）",
        "bookSourceUrl": "http://www.23hh.la/",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "http://www.23hh.la/modules/article/search.php,{\n  \"charset\": \"gbk\",\n  \"method\": \"POST\",\n  \"body\": \"searchkey={{key}}&action=login\"\n}",
        "ruleSearch": {
          "author": "class.c_row@tag.span.3@text||id.info@tag.span.0@text",
          "bookList": "class.book_info||class.box@tag.div!0",
          "bookUrl": "class.c_row@tag.span.0@tag.a.0@href",
          "coverUrl": "class.c_row@tag.a.0@tag.img.0@src||class.pic@tag.img.0@src",
          "kind": "class.c_row@tag.span.5@text||",
          "lastChapter": "class.c_row@tag.span.13@tag.a.0@text||id.info@tag.a.4@text",
          "name": "class.c_row@tag.span.0@tag.a.0@text||id.info@tag.h1.0@text"
        },
        "ruleBookInfo": {
          "coverUrl": "class.book_info@class.pic@tag.img.0@src",
          "intro": "class.book_info@class.bookinfo_intro@textNodes"
        },
        "ruleToc": {
          "chapterList": "class.book_list@tag.li@tag.a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.htmlContent@textNodes"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "蚂蚁阅读（优）",
        "bookSourceUrl": "http://wap.imayitxt.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "http://wap.imayitxt.com/modules/article/search.php?searchkey={{key}}",
        "ruleSearch": {
          "author": "p@text",
          "bookList": "class.onefourbox@tag.a",
          "bookUrl": "tag.a@href",
          "coverUrl": "img@src",
          "kind": "span@text",
          "name": "h3@text"
        },
        "ruleBookInfo": {
          "author": "class.book_inf@tag.p.0@text",
          "canReName": "true",
          "coverUrl": "img@src.0",
          "intro": "class.h3_rf creat_time@text&&class.book_desc@text",
          "kind": "class.book_inf@tag.p.1@text##类别：",
          "lastChapter": "class.h3_rf new_time.0@tag.a@text",
          "name": "class.book_inf@h3@text",
          "tocUrl": "class.more-chapter@href",
          "wordCount": "class.book_inf@tag.p.2@text##总字数："
        },
        "ruleToc": {
          "chapterList": "class.mulu_uld@li",
          "chapterName": "h3@text##>",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "class.textarticle@html",
          "nextContentUrl": "text.下一章@href",
          "replaceRegex": "##最新网址.*|一秒记住.*，更新快，，免费读！|>>本章未完，继续下章阅读|免费小说，无弹窗小说网，.*下载，请记住蚂蚁阅读网.*|\\s*.*第.*章.*\\s*|一秒记住【花小说网】，为您提供精彩小说阅读。"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.coverUrl：不支持的提取方式：src.0"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "霹雳书坊（优）",
        "bookSourceUrl": "https://www.pilisf.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://www.pilisf.com/s.php,{\n  \"body\": \"s={{key}}&type=articlename\",\n  \"charset\": \"GBK\",\n  \"method\": \"POST\"\n}",
        "header": "{\"User-Agent\": \"Mozilla/5.0 (Linux; Android 9) Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": "a.1@text",
          "bookList": ".sone",
          "bookUrl": "a.0@href",
          "checkKeyWord": "剑来",
          "coverUrl": "@js:\"https://www.pilisf.com/17mb/style/noimg.jpg\"",
          "kind": "0",
          "name": "a.0@text"
        },
        "ruleBookInfo": {
          "author": ".infotype@a.0@text",
          "coverUrl": ".infohead img@src",
          "intro": "#intro@html",
          "kind": ".infotype p.1:2:3@text\n##作品类型：|更新时间：|作品状态：",
          "lastChapter": ".list_xm@li.0@text",
          "name": "h3.0@text",
          "tocUrl": "text.章节目录@href"
        },
        "ruleToc": {
          "chapterList": ".chapters li",
          "chapterName": "a@text||.juan@text",
          "chapterUrl": "a@href",
          "isVolume": ".juan@text"
        },
        "ruleContent": {
          "content": "#novelcontent@p@textNodes"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.coverUrl用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "电线看书（优）",
        "bookSourceUrl": "https://101kanshu.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/search/{{key}}/{{page}}.html",
        "header": "{\n\"User-Agent\":\"Mozilla/5.0 (Linux; Android 9) Mobile Safari/537.36\",\"referer\":\"{{baseUrl}}\"\n}",
        "ruleSearch": {
          "author": ".labelbox label.0@text",
          "bookList": "#article_list_content li",
          "bookUrl": "a.0@href",
          "coverUrl": ".imgbox@img.0@data-src",
          "intro": ".ellipsis_2@text",
          "name": "h3@text"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "[property=\"og:image\"]@content",
          "intro": "[property=\"og:description\"]@content",
          "kind": "[property=\"og:novel:category\"]@content",
          "lastChapter": "[property=\"og:novel:latest_chapter_name\"]@content",
          "name": "[property=\"og:novel:book_name\"]@content",
          "tocUrl": "@js:\nresult = \"/ajax_novels/chapterlist/\" + baseUrl.match(/book\\/(\\d+)/)[1]+\".html\";"
        },
        "ruleToc": {
          "chapterList": "li a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "#txtcontent@html"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.tocUrl用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "歌书网吧（优）",
        "bookSourceUrl": "http://www.gashuw.com/",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "http://www.gashuw.com/modules/article/search.php?searchkey={{key}}",
        "ruleSearch": {
          "author": ".odd.1@text",
          "bookList": "#nr",
          "bookUrl": "a.0@href",
          "kind": ".even.-1@text",
          "lastChapter": ".even.0@text",
          "name": ".odd.0@text",
          "wordCount": ".even.-2@text"
        },
        "ruleBookInfo": {
          "author": "text.作者：@text",
          "coverUrl": "img@src",
          "intro": ".tabcontent@.tabvalue.0@text",
          "kind": ".tabcontent@tbody@tr.0@td.0@text##类 别：",
          "name": "text.txt下载.-2@text##txt下载",
          "tocUrl": ".ulrow@a.0@href",
          "wordCount": ".tabcontent@tbody@tr.0@td.1@text##字 数："
        },
        "ruleToc": {
          "chapterList": "dl dd[8:]",
          "chapterName": "a@text",
          "chapterUrl": "a@href"
        },
        "ruleContent": {
          "content": "#content@textNodes##www.gebiqu.com"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "爱下电子（繁）",
        "bookSourceUrl": "https://ixdzs.tw/",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://ixdzs.tw/bsearch?q={{key}}",
        "ruleSearch": {
          "author": ".bauthor@a@text",
          "bookList": ".burl",
          "bookUrl": ".bname@a@href",
          "coverUrl": ".l-img@img@src",
          "intro": ".l-p2@text",
          "kind": ".lz@text&&.l-time@text",
          "lastChapter": ".l-last@a@text",
          "name": ".bname@a@text",
          "wordCount": ".size@text"
        },
        "ruleBookInfo": {
          "tocUrl": "{{java.put(\"url\",baseUrl);\n\t\"https://ixdzs.tw/novel/clist/\"}},{\n  \"body\": \"bid={{baseUrl.match(/(\\d+).$/)[1]}}\",\n  \"method\": \"POST\"\n}"
        },
        "ruleToc": {
          "chapterList": "$.data",
          "chapterName": "$.title",
          "chapterUrl": "@get:{url}p{{$.ordernum}}.html",
          "isVolume": "$.ctype"
        },
        "ruleContent": {
          "content": ".page-content@p@text"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.tocUrl用了 java.*",
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "新读小说（繁）",
        "bookSourceUrl": "https://m.dxs.tw/",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://m.dxs.tw/serch.html?siteid=m.dxs.tw&q={{key}}&page={{page}}",
        "ruleSearch": {
          "author": "class.author@ownText",
          "bookList": "class.sort-view-book",
          "bookUrl": "h4@a@href",
          "coverUrl": "class.book-img@a@img@src",
          "intro": "class.intro@ownText",
          "kind": "class.blue@text",
          "name": "h4@a@text"
        },
        "ruleBookInfo": {
          "lastChapter": "class.book-main@update@a@text"
        },
        "ruleToc": {
          "chapterList": "class.chapter-list@li",
          "chapterName": "a@text",
          "chapterUrl": "a@href",
          "nextTocUrl": "class.hidden@href"
        },
        "ruleContent": {
          "content": "id.txt@html",
          "nextContentUrl": "id.pt_next@href",
          "replaceRegex": "##本章尚未.*|本章已.*|(?<=[\\u4e00-\\u9fa5])\\s"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "爱写小说（日）",
        "bookSourceUrl": "https://ncode.syosetu.com/",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "https://yomou.syosetu.com/search.php?word={{key}}&p={{page}}",
        "header": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
        "ruleSearch": {
          "author": "tag.a.1@text",
          "bookList": "class.searchkekka_box",
          "bookUrl": "class.tl@href",
          "intro": "tag.td@class.ex@text",
          "kind": "tag.td@a@text",
          "lastChapter": "tag.td:contains(最終更新日:)",
          "name": "class.tl@text",
          "wordCount": "tag.td@class.marginleft.0@text"
        },
        "ruleBookInfo": {
          "author": "class.p-novel__author@text##作者：",
          "intro": "id.novel_ex@text",
          "lastChapter": "class.p-eplist__sublist.-1@tag.a@text",
          "name": "class.p-novel__title@text"
        },
        "ruleToc": {
          "chapterList": "class.p-eplist__sublist",
          "chapterName": "class.p-eplist__subtitle@text",
          "chapterUrl": "class.p-eplist__subtitle@href",
          "nextTocUrl": "class.c-pager__item--next@href",
          "updateTime": "class.p-eplist__update@text"
        },
        "ruleContent": {
          "content": "class.js-novel-text@text||class.p-novel__text@text",
          "nextContentUrl": "class.c-pager__item--next@href"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "英文小说（英）",
        "bookSourceUrl": "https://www.yingyuxiaoshuo.com",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "/search/{{key}}",
        "ruleSearch": {
          "author": "@css:.grow>div:nth-child(2)@text",
          "bookList": "@css:.main-list-container>div.h-36",
          "bookUrl": "a@href",
          "checkKeyWord": "加",
          "coverUrl": "img@src",
          "intro": "@css:.grow>div:nth-child(3)@text",
          "kind": "@css:.grow>div:nth-child(4) span:first-child@text",
          "name": "@css:.grow h2>a:nth-child(n)@text"
        },
        "ruleBookInfo": {
          "author": "@css:.listshadow1 .text-danger:nth-child(2)@text",
          "coverUrl": "@css:.listshadow1 img@src",
          "intro": "@css:.listshadow1 .text-intro1@text",
          "kind": "@css:.listshadow1 .text-danger:nth-child(n+3)@text",
          "name": "@css:.listshadow1 .text-danger:first-child h2@text"
        },
        "ruleToc": {
          "chapterList": "@css:.shadow-listshadow1 .grid .text-danger",
          "chapterName": "class.text-danger@text",
          "chapterUrl": "class.text-danger@href"
        },
        "ruleContent": {
          "content": "{{@css:.text-content1 .c-en@text||.text-content1@text}}"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "双语小说（英）",
        "bookSourceUrl": "http://www.shubang.net/book#",
        "bookSourceGroup": "小说 书源",
        "searchUrl": "http://www.shubang.net/book/?q={{key}}",
        "ruleSearch": {
          "author": "class.cont@p@text",
          "bookList": "class.mcon@a",
          "bookUrl": "a@href",
          "coverUrl": "class.cover@img@src",
          "intro": "class.cont@ownText",
          "name": "h3@text"
        },
        "ruleBookInfo": {
          "kind": "class.tags@a@text",
          "lastChapter": "tr.-1@td@a@text"
        },
        "ruleToc": {
          "chapterList": "tr@td",
          "chapterName": "a@text",
          "chapterUrl": "a@href"
        },
        "ruleContent": {
          "content": ".line_en@text%%.line_cn@title",
          "nextContentUrl": "class.pagebar@a.-1@href"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "天涯知识（优）",
        "bookSourceUrl": "http://book.sbkk8.com",
        "bookSourceGroup": "特殊 书源",
        "searchUrl": "/plus/search.php,{\n  'charset': 'gb2312',\n  'method': 'POST',\n  'body': 'kwtype=0&q={{key}}&searchtype=title'\n}",
        "ruleSearch": {
          "bookList": ".mululist||.bookList",
          "bookUrl": "a.-1@href",
          "coverUrl": "img@src",
          "name": "a.-1@text"
        },
        "ruleBookInfo": {
          "coverUrl": ".fm img@src",
          "intro": ".des p@html",
          "lastChapter": ".mulu a.-1@text"
        },
        "ruleToc": {
          "chapterList": ".mulu li a||h1",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "#content p@html",
          "imageStyle": "FULL",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##book.sbkk8.coM"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "起点中文（优+）",
        "bookSourceUrl": "https://m.qidian.com#按钮筛选",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "/so/{{key}}.html?pageNum={{page}}",
        "header": "{\"User-Agent\":\"Mozilla/5.0 (Linux; U; Android 13; zh-Hans-CN; PFJM10 Build/TP1A.220905.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/135.0.4896.58 Quark/6.13.6.581 Mobile Safari/537.36\",\"Accept-Language\":\"zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7\"}",
        "ruleSearch": {
          "author": "p.-4@text",
          "bookList": ".y-list__item",
          "bookUrl": "{{@@a.0@href##chapter##book}}##\\/0\\/\n",
          "coverUrl": "img@data-src",
          "intro": "h2+p@html",
          "kind": "p[-3:]@text",
          "name": "h2@text"
        },
        "ruleBookInfo": {
          "author": ".detail__header-detail__author@a@textNodes",
          "coverUrl": "[property$=image]@content",
          "intro": "\n&nbsp;\n📖 书名：{{@@[property=\"og:title\"]@content}}\n👤 作者：{{@@[property=\"og:novel:author\"]@content}}\n📜 状态：{{@@[property=\"og:novel:status\"]@content}}\n✏  分类：{{@@[class=\"detail__header-detail__line\"].0@text}}\n🔖 标签：{{@@.tags-wrapper@.tag@text##\\n##\\#}}\n🕰 最新：{{@@[property=\"og:novel:latest_chapter_name\"]@content}}\n🗿 更新时间：{{@@[property=\"og:novel:update_time\"]@content}}\n👁 榜单信息：{{@@[class=\"novelbook__honorinfo\"]@text##(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s*##\n$2:$1\n$4:$3\n$6:$5}}\n🏷 简介：{{@@[class=\"detail__summary__content\"]@html}}\n",
          "kind": "[property~=category|status|update_time]@content##\\s.*",
          "lastChapter": "[property$=chapter_name]@content",
          "name": "\n\n.detail__header-detail__title@text",
          "tocUrl": "{{baseUrl}}/catalog/",
          "wordCount": ".detail__header-detail__line@text##.*\\/.*|\\|.*|\\n"
        },
        "ruleToc": {
          "chapterList": ".y-list__item@a,._chapterBar_fps9g_592",
          "chapterName": "h2@text||text",
          "chapterUrl": "href",
          "isVip": "span@text\n@js:\nresult=result==\"免费\"?false:true;\nresult;",
          "isVolume": "textNodes\n@js:\nresult=result?true:false;\nresult;",
          "preUpdateJs": "java.refreshTocUrl()",
          "updateTime": "alt\n@js:\nresult=(result.match(/首发时间: (.*)章节字数/) || [\"\",\"\"])[1];\nresult;"
        },
        "ruleContent": {
          "content": ".content@p@html",
          "imageStyle": "FULL"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "目录规则.isVip用了 @js:",
          "目录规则.isVolume用了 @js:",
          "目录规则.preUpdateJs用了 java.*",
          "目录规则.updateTime用了 @js:",
          "详情规则.tocUrl：模板里是脚本表达式：{{baseUrl}}",
          "目录规则暂不支持 preUpdateJs"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "次元姬子（优）",
        "bookSourceUrl": "https://www.ciyuanji.com",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "/search/{{key}}_0_0_0_0_0_{{page}}.html",
        "ruleSearch": {
          "author": "a.2@text",
          "bookList": ".search_book__ieDvY||.card_card__yeC5Y li||.card_book__ctZ9S||.desc_list__R8WJh li",
          "bookUrl": "a.1@href",
          "coverUrl": "img@data-src",
          "intro": "p.-1@text",
          "kind": "a.3:4@text",
          "lastChapter": "a.5@text##最新.",
          "name": "a.1@text",
          "wordCount": "p.-3@span.0@text"
        },
        "ruleBookInfo": {
          "author": ".book_detail_content__SQOg8 span.1@text",
          "coverUrl": ".book_detail_cover__rKpN6 img@data-src",
          "intro": "🏷️   {{@@.book_detail_tags__pkrm2@text}}{{'\\n'+'​'}}\n{{@@article@text}}##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": ".book_detail_content__SQOg8 span.2:3@text&&.book_detail_head__L3w3i span.3@text##\\s.*",
          "lastChapter": ".book_detail_head__L3w3i strong@text",
          "name": ".book_detail_content__SQOg8 span.0@text",
          "wordCount": ".book_detail_content__SQOg8 span.4@text"
        },
        "ruleToc": {
          "chapterList": ".book_detail_chapter__wsMUy a",
          "chapterName": "text",
          "chapterUrl": "href",
          "isVip": ".book_detail_lock__eNRvE@text"
        },
        "ruleContent": {
          "content": ".chapter_article__vWEkb@html"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro：模板里是脚本表达式：{{'\\n'+'​'}}"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "独阅读网",
        "bookSourceUrl": "https://www.duread8.com##喜静",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "https://www.duread8.com/index/get_search_book_list/{{key}}",
        "ruleSearch": {
          "author": "##作者[:：]([^<]+)<##$1###",
          "bookList": "class.book-list@li",
          "bookUrl": "tag.a.0@href",
          "coverUrl": "img@data-original",
          "intro": "class.summaries@html",
          "lastChapter": "class.smaller@text##.*? / ",
          "name": "class.book-name@text"
        },
        "ruleBookInfo": {
          "intro": "class.desc@text",
          "name": "class.book-title@text"
        },
        "ruleToc": {
          "chapterList": "#chapter_list@a",
          "chapterName": "text",
          "chapterUrl": "href##$##,{\"webView\":true}"
        },
        "ruleContent": {
          "content": ".article-content@p@textNodes"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "笔尚小说",
        "bookSourceUrl": "https://www.bsxiaoshuo.com#yc1101",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "/s.php?sid=3&k={{key}}",
        "ruleSearch": {
          "author": "p.1@textNodes",
          "bookList": "#j li",
          "bookUrl": "a@href",
          "coverUrl": "img@src",
          "intro": "p.0@text",
          "kind": "s@text",
          "name": "b@text"
        },
        "ruleBookInfo": {
          "author": ".name strong@text",
          "coverUrl": ".pic img@src",
          "intro": ".summary@ownText##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": ".cate@text&&h4 .time@text##\\s.*",
          "lastChapter": "h4 a@text##>>",
          "name": "h2@text",
          "tocUrl": ".index@href",
          "wordCount": ".words@text##字"
        },
        "ruleToc": {
          "chapterList": ".float-list li",
          "chapterName": "a@text",
          "chapterUrl": "a@href",
          "isVip": "##isvip##🔒###",
          "updateTime": "span@text"
        },
        "ruleContent": {
          "content": ".page-content@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "追书神器",
        "bookSourceUrl": "http://zhuishushenqi.com/",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "https://www.zhuishushenqi.com/search?val={{key}}",
        "ruleSearch": {
          "author": ".author@span.0@text",
          "bookList": ".books-list@.book",
          "bookUrl": "data-href",
          "checkKeyWord": "剑来",
          "coverUrl": "img@src",
          "intro": ".desc@text",
          "kind": ".author@span.-1@text",
          "name": ".name@text"
        },
        "ruleBookInfo": {},
        "ruleToc": {
          "chapterList": "class.chapter-list.-1@li",
          "chapterName": "a@text##^(.*?)第",
          "chapterUrl": "a@href"
        },
        "ruleContent": {
          "content": ".inner-text@html"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "猫九小说",
        "bookSourceUrl": "http://www.maojiuxs.com/",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "http://www.maojiuxs.com/shuku/?offset={{page*8}}&section_id=1&",
        "ruleSearch": {
          "author": ".author@text",
          "bookList": ".recom_top li||.book_con li",
          "bookUrl": "a@href",
          "coverUrl": ".imgbox img@src",
          "intro": ".instro@text",
          "kind": ".cation@text&&.status@text&&.time@text##\\s.*",
          "lastChapter": ".up@text",
          "name": ".name@text",
          "wordCount": ".statusbox span.2@text"
        },
        "ruleBookInfo": {
          "author": ".introtwo span.0@text",
          "coverUrl": ".imgbox img@src",
          "intro": ".tabs_content p.0@html##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": ".cation span@text&&.update span.1@text##\\s.*",
          "lastChapter": ".update span.0@text",
          "name": ".intro div.0@text",
          "tocUrl": ".tabs_header a.1@href",
          "wordCount": ".intro_num div.0@text"
        },
        "ruleToc": {
          "chapterList": ".recommendeddirectory a",
          "chapterName": "text",
          "chapterUrl": "href##$##,{'webView': true}",
          "isVip": "img@src"
        },
        "ruleContent": {
          "content": "#showReading@p@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "百度小说",
        "bookSourceUrl": "https://dushu.baidu.com/",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "/api/getSearchResultData?page={{page}}&count=10&query={{key}}",
        "ruleSearch": {
          "author": "author",
          "bookList": "$..novelList[*]",
          "bookUrl": "https://boxnovel.baidu.com/boxnovel/wiseapi/chapterList?bookid={$.bookId}&pageNum=1&order=asc&site=",
          "checkKeyWord": "青春",
          "coverUrl": "cover",
          "intro": "description@put:{'intro':'description'}",
          "kind": "{{$.tagList}},{{$.status}}",
          "name": "title"
        },
        "ruleBookInfo": {
          "intro": "@js:'<br>'+java.get('intro')",
          "lastChapter": "共{$.data.chapter.chapterCount}##[\\(（【].*?[求更谢乐发订合补加].*?[】）\\)]"
        },
        "ruleToc": {
          "chapterList": "data.chapter.chapterInfo",
          "chapterName": "chapter_title##默认卷.|正文.|[\\(（【].*?[求更谢乐发订合补加].*?[】）\\)]",
          "chapterUrl": "http://dushu.baidu.com/api/pc/getChapterContent?data=%7B%22book_id%22:%22{$.book_id}%22,%22cid%22:%22{$.book_id}%7C{$.chapter_id}%22,%22need_bookinfo%22:0%7D",
          "isVip": "price",
          "nextTocUrl": "@js:\nvar n=(JSON.parse(result).data.chapter.chapterCount)/50+1;\nvar list=[];\nbaseUrl=baseUrl.replace(/1&order=asc&site=/,'');\nfor(var i=2;i<n;i++){\nvar url=baseUrl+i+'&order=asc&site=';\nlist.push(url);\n}\nlist;"
        },
        "ruleContent": {
          "content": "data.novel.content"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro用了 @js:",
          "详情规则.intro用了 java.*",
          "目录规则.nextTocUrl用了 @js:",
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "企鹅阅读",
        "bookSourceUrl": "https://ubook.reader.qq.com/?g_f=4000001",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "https://book.qq.com/book-search/{{key}}",
        "header": "{\n  \"User-Agent\": \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.74 Safari/537.36 Edg/99.0.1150.55\"\n}",
        "ruleSearch": {
          "author": ".other@a.0@text",
          "bookList": ".result-item",
          "bookUrl": "a.0@href",
          "checkKeyWord": "深空彼岸",
          "coverUrl": ".result-item@a.0@href##(\\d+)(...)##https://wfqqreader-1252317822.image.myqcloud.com/cover/$2/$1$2/t5_$1$2.jpg###",
          "intro": ".intro@text",
          "kind": ".other@a.1@text&&.other@span.0@text##\\·",
          "name": "a.0@title",
          "wordCount": ".other@span.1@text##\\·"
        },
        "ruleBookInfo": {
          "author": ".book-title-wrap@a.0@text",
          "coverUrl": ".book-wrap@tag.a.1@tag.img@src",
          "intro": ".book-info@div.5@html",
          "kind": "a.tag@text&&.update-time@text##.*：",
          "lastChapter": ".book-last-chapter@a.0@text",
          "name": ".book-info@h1.0@text",
          "tocUrl": "text.目录@href"
        },
        "ruleToc": {
          "chapterList": ".book-dir.1@li",
          "chapterName": "span@text##更新时间.*",
          "chapterUrl": "a@href",
          "isVip": ".list@.lock@html"
        },
        "ruleContent": {
          "content": "id.article@p@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "纵横中文",
        "bookSourceUrl": "https://www.zongheng.com/##zhbyjm7783",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "https://search.zongheng.com/search/book?keyword={{key}}&sort=null&pageNo=1&pageNum=20&isFromHuayu=0",
        "header": "{\"User-Agent\": \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36\"}",
        "ruleSearch": {
          "author": "authorName",
          "bookList": "data.datas.list",
          "bookUrl": "https://bookapi.zongheng.com/api/chapter/getChapterList,{\"method\":\"POST\",\"body\":\"bookId={$.bookId}\"}",
          "coverUrl": "https://static.zongheng.com/upload{{$.coverUrl}}",
          "intro": "description",
          "kind": "{{$.cateFineName&&$.tomeName&&$.catePName&&$.keyword&&$.updateTime}}\n连载{{$.serialStatus}}完结##\\<font color\\=\\\"RED\\\"\\>|\\<\\/font\\>\n@js:result.replace(/连载1完结/g,'完结').replace(/连载0完结/g,'连载')",
          "lastChapter": "chapterName&&updateTime",
          "name": "name##\\<font color\\=\\\"RED\\\"\\>|\\<\\/font\\>",
          "wordCount": "totalWord"
        },
        "ruleBookInfo": {},
        "ruleToc": {
          "chapterList": "result.chapterList[*].chapterViewList[*]",
          "chapterName": "chapterName",
          "chapterUrl": "https://read.zongheng.com/chapter/{$.bookId}/{$.chapterId}.html",
          "isVip": "level",
          "updateTime": "{{$.createTime}} 字数：{{$.wordNums}}"
        },
        "ruleContent": {
          "content": ".content@p@text"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.kind用了 @js:",
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "天地中文",
        "bookSourceUrl": "http://www.tiandizw.com",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "http://www.tiandizw.com/search.php/newindex?keyword={{key}}&Paixu=0&page={{page}}",
        "header": "{\n\t\"x-requested-with\": \"XMLHttpRequest\",\n\t\"User-Agent\": \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.5938.92 Safari/537.36\"\n}",
        "ruleSearch": {
          "author": "class.content@tag.span.0@tag.a@text",
          "bookList": "class.list_details@li",
          "bookUrl": "class.content@h3@tag.a@href",
          "coverUrl": "tag.a.0@img@src",
          "intro": "class.intro@text",
          "lastChapter": "class.details@tag.span@a@text##最新章节",
          "name": "class.content@h3@tag.a@text",
          "wordCount": "class.content@tag.span.1@tag.a@text||##最新章节.*"
        },
        "ruleBookInfo": {
          "tocUrl": "text.目录@href"
        },
        "ruleToc": {
          "chapterList": "class.mulu_list@li",
          "chapterName": "tag.a@text##VIP##🔒",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "p@textNodes"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "追书出版",
        "bookSourceUrl": "http://www.zhuishushenqi.com/chuban",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "https://www.zhuishushenqi.com/search?val={{key}}",
        "ruleSearch": {
          "author": "class.author@tag.span.0@text",
          "bookList": "class.book",
          "bookUrl": "a@href",
          "coverUrl": "img@src",
          "kind": "class.author@tag.span.2@text&&class.popularity@text##\\|.*",
          "lastChapter": "class.popularity@text##.*\\|",
          "name": "class.name@text"
        },
        "ruleBookInfo": {
          "coverUrl": "class.book-info@img@src",
          "intro": "class.content intro@textNodes",
          "lastChapter": "class.chapter-list clearfix@tag.li.0@a@text"
        },
        "ruleToc": {
          "chapterList": "id.J_chapterList@li@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "class.inner-text@p@html"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "栀子欢波",
        "bookSourceUrl": "http://m.zhizihuan.com#♤yc",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "http://s.zhizihuan.com/m/?key={{key}}",
        "ruleSearch": {
          "author": "p.1@textNodes##.*：",
          "bookList": ".column-2",
          "bookUrl": "a@href",
          "coverUrl": "img@src",
          "kind": "span@text&&p.3@text##.*：|\\s.*",
          "lastChapter": "p.2@text",
          "name": "p.0@text"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "[property=\"og:image\"]@content",
          "intro": "#htmljieshao@html##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": "[property=\"og:novel:category\"]@content&&[property=\"og:novel:status\"]@content&&[property=\"og:novel:update_time\"]@content##\\s.*",
          "lastChapter": "[property=\"og:novel:latest_chapter_name\"]@content",
          "name": "[property=\"og:novel:book_name\"]@content",
          "tocUrl": ".g_btn a@href"
        },
        "ruleToc": {
          "chapterList": ".list_li li a",
          "chapterName": "text",
          "chapterUrl": "href##$##,{'webView': true}",
          "isVip": "font@text"
        },
        "ruleContent": {
          "content": "#htmlContent@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "九怀小说",
        "bookSourceUrl": "https://www.jiuhuaiwenxue.com",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "/search?content={{key}}",
        "ruleSearch": {
          "author": "class.font2@span.0@text",
          "bookList": "class.allbook-item",
          "bookUrl": "a.1@href##$##,{'webView': true}",
          "checkKeyWord": "珍珠",
          "coverUrl": "img@src",
          "intro": "class.font3@text",
          "kind": "class.font2@span.1:2@text&&class.font4@span.1@text",
          "name": "a.1@text",
          "wordCount": "class.font4@span.0@text"
        },
        "ruleBookInfo": {
          "author": "class.left.1@text",
          "coverUrl": "class.zuopin-img@img@src",
          "intro": "id.bookIntro@text",
          "kind": "class.tag-box@tag.a@text&&class.other-shuzi@span.2@text",
          "lastChapter": "class.he@span.1@text",
          "name": "h1@text",
          "wordCount": "class.other-shuzi@span.0@text"
        },
        "ruleToc": {
          "chapterList": "@css:#mulun>.juan,#mulun table tbody tr td",
          "chapterName": "a@text||.juan@text",
          "chapterUrl": "a@href##$##,{'webView': true}",
          "isVip": "span@tag.i@class",
          "isVolume": ".juan@text"
        },
        "ruleContent": {
          "content": "#chaptercontent@html||.z-dingyue@html",
          "payAction": "{{baseUrl}}"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "正文规则暂不支持 payAction"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "铁血读书",
        "bookSourceUrl": "http://book.tiexue.net",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "/SearchResults.aspx?pageindex={{page}}&keywords={{key}},{\n  \"charset\": \"gb2312\"\n}",
        "ruleSearch": {
          "author": "tag.a.2@text",
          "bookList": "class.tianZhi_list@tag.dl",
          "bookUrl": "tag.a.1@href",
          "coverUrl": "tag.img@src",
          "intro": "class.cel02_row3@tag.p@text##简介.",
          "kind": "class.keyWords@tag.a@text",
          "name": "tag.a.1@text"
        },
        "ruleBookInfo": {
          "author": "class.xQing@tag.u.0@text",
          "coverUrl": "class.li_01@tag.img@src",
          "intro": "class.bookPrdt colorGray@text",
          "kind": "class.xQing@tag.u.1@text&&class.keyWords colorTh undLine@tag.a@text",
          "lastChapter": "tag.h3@tag.a.0@text",
          "name": "class.normaltitle@tag.span@text",
          "tocUrl": "@js:baseUrl.replace(/\\/?$/, '/list.html')",
          "wordCount": "class.orange.5@text"
        },
        "ruleToc": {
          "chapterList": "class.list01@tag.li@tag.p",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href",
          "isVip": "tag.span@text"
        },
        "ruleContent": {
          "content": "id.mouseRight@tag.p@text",
          "imageStyle": "0",
          "nextContentUrl": "text.下一章@href"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.tocUrl用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "九阅小说",
        "bookSourceUrl": "https://api.9yread.com",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "/search/book, {\n\t\"method\": \"POST\",\n\t\"body\": \"size=20&page={{page}}&keyword={{key}}\"\n\t}",
        "ruleSearch": {
          "author": "author.name",
          "bookList": "data.books.*",
          "bookUrl": "/ebook/book/{{$.id}}",
          "coverUrl": "cover",
          "intro": "introduction",
          "kind": "tags",
          "name": "name",
          "wordCount": "wordCount"
        },
        "ruleBookInfo": {
          "author": "data.author.name",
          "coverUrl": "data.cover##//##https://",
          "intro": "data.introduction",
          "kind": "data.tags",
          "lastChapter": "data.newestChapter.name",
          "name": "data.name",
          "tocUrl": "/ebook/book/{{$.data.id}}/chapter_list?fetchTotal=1&size=100&page=1",
          "wordCount": "data.wordCount"
        },
        "ruleToc": {
          "chapterList": "data.chapters.*",
          "chapterName": "name",
          "chapterUrl": "/ebook/read/{{$.bookId}}/{{$.id}}?autoBuy=1",
          "isVip": "fee",
          "isVolume": "volume",
          "nextTocUrl": "/ebook/book/{{$.data.chapters[0].bookId}}/chapter_list?fetchTotal=1&size=100&page={{(Number(baseUrl[baseUrl.length-1])+1)}}",
          "updateTime": "@js:java.timeFormat({{$.updateTime}})"
        },
        "ruleContent": {
          "content": "data.content",
          "title": "data.name"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "目录规则.updateTime用了 @js:",
          "目录规则.updateTime用了 java.*",
          "目录规则.nextTocUrl：模板里是脚本表达式：{{(Number(baseUrl[baseUrl.length}}"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "酷我小说",
        "bookSourceUrl": "http://appi.kuwo.cn",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "/novels/api/book/search?keyword={{key}}&pi={{page}}&ps=30",
        "header": "{\n\t\"Accept\": \"*/*\",\n\t\"Connection\": \"Close\",\n\t\"User-Agent\": \"Dalvik/2.1.0 (Linux; U; Android 8.0.0; LND-AL40 Build/HONORLND-AL40)\"\n}",
        "ruleSearch": {
          "author": "$.author_name",
          "bookList": "$.data",
          "bookUrl": "/novels/api/book/{{$.book_id}}",
          "coverUrl": "$.cover_url",
          "intro": "$.intro",
          "kind": "{{$.category_name}},{{$.status}}@js:result.replace(/30/,\"连载\").replace(/50/,\"完结\")",
          "name": "$.title",
          "wordCount": "$.all_words"
        },
        "ruleBookInfo": {
          "author": "$.author_name",
          "coverUrl": "$.cover_url",
          "init": "$.data",
          "intro": "$.intro##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": "{{$.category_name}},{{$.status}},{{$.update_time}}@js:result.replace(/30/,\"连载\").replace(/50/,\"完结\").replace(/\\s..:.*/,\"\")",
          "lastChapter": "$.new_chapter_name##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "$.title",
          "tocUrl": "/novels/api/book/{{$.book_id}}/chapters?paging=0",
          "wordCount": "$.all_words"
        },
        "ruleToc": {
          "chapterList": "$.data",
          "chapterName": "$.chapter_title##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "/novels/api/book/{{$.book_id}}/chapters/{{$.chapter_id}}",
          "updateTime": "{{$.volume_name}}•{{$.original_words}}字"
        },
        "ruleContent": {
          "content": "$.data.content"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.kind用了 @js:",
          "详情规则.kind用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "刺猬猫吧",
        "bookSourceUrl": "https://www.ciweimao.com",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "/get-search-book-list/0-0-0-0-0-0/全部/{{key}}/{{page}}",
        "ruleSearch": {
          "author": "class.cnt.0@tag.p.1@tag.a.0@text||class.author@text",
          "bookList": "class.rank-book-list@tag.li||class.book-list-table@tag.tr!0",
          "bookUrl": "class.cnt.0@class.tit.0@tag.a.0@href||class.name@tag.a@href",
          "coverUrl": "class.cover@tag.img@data-original||tag.img.0@src",
          "intro": "class.desc@text",
          "lastChapter": "@css:p:matches(最近更新)@text||.chapter@text\n@js:result.includes('最近更新') ? result.replace(/最近更新：(\\d+-\\d+-\\d+).*\\/(.*)/,'$2（$1）') : result",
          "name": "class.cnt.0@class.tit.0@tag.a.0@text||class.name@tag.a@text"
        },
        "ruleBookInfo": {
          "coverUrl": "class.cover ly-fl@tag.img@src",
          "intro": "class.book-desc.0@text@js:result.replace(/(&.{3}br.{3,4};)+|[\\n\\s]+/g,\"\\n\").replace(/\\n\\s*\\n/g,\"\\n\").replace(/^\\s*\\n/g,\"\").replace(/\\n\\s*/g,\"\\n\\u3000\\u3000\").replace(/^\\s*/g,\"\\u3000\\u3000\")",
          "tocUrl": "class.btn btn-lg btn-danger@tag.a.0@href||text.所有章节@href"
        },
        "ruleToc": {
          "chapterList": ".book-chapter-box@li@a",
          "chapterName": "text",
          "chapterUrl": "href##$##,{'webView': true}",
          "isVip": "@js:result.outerHtml().includes('icon-lock')"
        },
        "ruleContent": {
          "content": "#J_BookRead .chapter@textNodes"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.lastChapter用了 @js:",
          "详情规则.intro用了 @js:",
          "目录规则.isVip用了 @js:",
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "苏轻小说",
        "bookSourceUrl": "https://book.sfacg.com",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "http://s.sfacg.com/?Key={{key}}&S=1&SS=0",
        "header": "{\n  \"User-Agent\": \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36\"\n}",
        "ruleSearch": {
          "author": "li.1@text##.+综合信息：\\s*([^\\/]+).*##$1",
          "bookList": "tbody ul",
          "bookUrl": "a@href",
          "coverUrl": "img@src",
          "intro": "li.1@text##.+\\d+:\\d+\\s*(.+).*##$1",
          "kind": "li.1@text##.+\\/(\\d+\\/\\d+\\/\\d+).*##$1",
          "name": "a@text"
        },
        "ruleBookInfo": {
          "author": ".author-name@text",
          "coverUrl": ".summary-pic img@src",
          "intro": "标签：{{@.tag-list@text}}{{@.introduce@html}}##(^|[。！？]+[”」）】]?)##$1<br>@js:result.replace(//g,\"\")",
          "kind": ".title span!0@text&&.count-detail span.0:1:3@text##.*：|.*\\[|\\]|\\s.*",
          "lastChapter": ".chapter-title a@text",
          "name": ".title span.0@text",
          "tocUrl": "#BasicOperation a.0@href",
          "wordCount": ".count-detail span.1@text##.*：|字.*"
        },
        "ruleToc": {
          "chapterList": ".catalog-list li a",
          "chapterName": "textNodes##[\\(（【].*?[求更谢乐发推打加].*?[】）\\)]",
          "chapterUrl": "href",
          "isVip": ".icn_vip@text"
        },
        "ruleContent": {
          "content": "#ChapterBody@html",
          "imageStyle": "FULL"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "梧桐中文",
        "bookSourceUrl": "http://www.wtzw.com",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "http://www.wtzw.com/search-{{key}}.html?null",
        "ruleSearch": {
          "author": "tag.a.2@text",
          "bookList": "class.searchList@li",
          "bookUrl": "class.sTit@tag.a@href",
          "coverUrl": "tag.img@src",
          "lastChapter": "tag.a.3@text",
          "name": "class.sTit@text"
        },
        "ruleBookInfo": {
          "author": "class.sName@text",
          "coverUrl": "class.w_pic@tag.img@src",
          "intro": "class.pWorkInformation@text",
          "lastChapter": "class.li_upDate@tag.a@text",
          "name": "class.li_tit@tag.a@text"
        },
        "ruleToc": {
          "chapterList": "class.w_ulTxt w_ulTxt_3 clearfix@tag.li",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "class.article@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "安之原创",
        "bookSourceUrl": "http://www.azycjd.com#yc1101",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "/webnovelmis/mobile/msearchresult,{\n  \"method\": \"POST\",\n  \"body\": \"searchtxts={{key}}\"\n}",
        "ruleSearch": {
          "author": "p.0@text##作者.",
          "bookList": ".list_main li",
          "bookUrl": "a@href",
          "coverUrl": "img@src",
          "intro": ".intro@text",
          "kind": "span.0@text",
          "name": "h3@text"
        },
        "ruleBookInfo": {
          "intro": "class.top_main.0@p@html##(^|[。！？]+[”」）】]?)##$1<br>",
          "lastChapter": "class.top_main.-1@a@text"
        },
        "ruleToc": {
          "chapterList": "class.top_main chapter@li",
          "chapterName": "p@text",
          "chapterUrl": "a@href"
        },
        "ruleContent": {
          "content": ".novel@p@text",
          "imageStyle": "0"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "经致文学",
        "bookSourceUrl": "http://www.jingzhi5.com",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "http://www.jingzhi5.com/?s=search&a=index&keyword={{key}}&page=0&page={{page}}",
        "ruleSearch": {
          "author": "class.search-info@text##.*作者：",
          "bookList": "class.works-list.0@li",
          "bookUrl": "class.search-info@tag.a.0@href",
          "coverUrl": "img@src",
          "intro": "class.search-sumary@a@text",
          "kind": "class.times@text##最后更新：",
          "name": "class.search-info@tag.a.0@text"
        },
        "ruleBookInfo": {
          "author": "class.author-zone column-2@class.right@a@text",
          "coverUrl": "class.pic@img@src",
          "intro": "class.note@text",
          "kind": "h4@span@text##更新",
          "lastChapter": "h4@tag.a.0@text##>>",
          "name": "h2@text",
          "tocUrl": "class.buttons clearfix@tag.a.0@href",
          "wordCount": "class.words@text##字"
        },
        "ruleToc": {
          "chapterList": "class.float-list fill-block@li",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href",
          "isVip": "@js:result.select('a').hasClass('isvip')",
          "updateTime": "class.time@text"
        },
        "ruleContent": {
          "content": "class.page-content@html"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "目录规则.isVip用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "心轻小说",
        "bookSourceUrl": "http://s.sfacg.com/",
        "bookSourceGroup": "正版小说 书源",
        "searchUrl": "http://s.sfacg.com/?Key={{key}}&S=1&SS=0",
        "ruleSearch": {
          "author": "tag.li.1@text##.+综合信息：\\s*([^\\/]+).*##$1",
          "bookList": "tag.form@tag.table.-2@tag.ul",
          "bookUrl": "tag.a@href",
          "coverUrl": "tag.img@src",
          "intro": "tag.li.1@text##.+\\d+:\\d+\\s*(.+).*##$1",
          "lastChapter": "tag.li.1@text##.+\\/(\\d+\\/\\d+\\/\\d+).*##$1",
          "name": "tag.a@text"
        },
        "ruleBookInfo": {
          "kind": "class.tag-list@class.text@text",
          "tocUrl": "text.点击阅读@href"
        },
        "ruleToc": {
          "chapterList": "class.catalog-list@tag.ul@tag.li@tag.a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "class.article-content font16@html"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "五二书库🥈",
        "bookSourceUrl": "https://www.po5.net#🎃",
        "bookSourceGroup": "🌸女频[优],🍅番茄",
        "searchUrl": "https://www.po5.net/so/search.php?q={{key}}",
        "ruleSearch": {
          "author": "header@h2@h4@text##\\d+\\.\\s.*_(.*)【.*##$1",
          "bookList": "div@.excerpt",
          "bookUrl": "header@h2@a@href",
          "checkKeyWord": "红楼梦",
          "intro": ".note@text##.*文案：　|\\(所属栏目：.*",
          "kind": ".auth-span@.muted@a@text",
          "name": "header@h2@h4@text##\\d+\\.\\s|_.*",
          "wordCount": "header@h2@h4@text##\\d+\\.\\s.*_.*【(.*)】##$1"
        },
        "ruleBookInfo": {
          "intro": ".article-content@p.1@text##.*文案：　"
        },
        "ruleToc": {
          "chapterList": ".clearfix@.mulu@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": ".article-content@p@all##目录\\s+上一页.*|Tips.*|传送门：.*",
          "nextContentUrl": "",
          "replaceRegex": "##小贴士：如果觉得52书库不错，记得收藏网址 https://www.po5.net/ 或推荐给朋友哦~拜托啦 (>.<)\n"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "速读谷²",
        "bookSourceUrl": "https://www.shudugu.org",
        "bookSourceGroup": "🍀起点源",
        "searchUrl": "/i/sor.aspx?key={{key}}",
        "header": "{\"User-Agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\"}",
        "ruleSearch": {
          "author": "@css:.itemtxt p:eq(1) a@text##作者：",
          "bookList": "@css:.item",
          "bookUrl": "@css:.itemtxt h3 a@href",
          "checkKeyWord": "没钱修什么仙",
          "coverUrl": "@css:.item a img@src",
          "kind": "p@span@text",
          "lastChapter": "@css:.itemtxt ul li:eq(0) a@text",
          "name": "@css:.itemtxt h3 a@text"
        },
        "ruleBookInfo": {
          "author": "@css:.itemtxt p:eq(1) a@text##作者：",
          "coverUrl": "@css:.item a img@src",
          "intro": "class.des.0@text",
          "kind": "@css:.itemtxt p:eq(0) span:eq(1)@text",
          "lastChapter": "@css:.itemtxt ul li:eq(0) a@text",
          "name": "@css:.itemtxt h1 a@text",
          "wordCount": "@css:.itemtxt h1 i@text"
        },
        "ruleToc": {
          "chapterList": "@css:#list ul li",
          "chapterName": "@css:a@text",
          "chapterUrl": "@css:a@href",
          "nextTocUrl": "@css:#pages a.gr@href"
        },
        "ruleContent": {
          "content": "@css:.con p@text",
          "nextContentUrl": "@css:.prenext span:eq(2) a@href"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "无错小说",
        "bookSourceUrl": "https://www.wcshuba.com",
        "bookSourceGroup": "🍀起点源",
        "searchUrl": "https://www.wcshuba.com/search/?searchkey={{key}}",
        "ruleSearch": {
          "author": "dd:last-of-type a@text",
          "bookList": ".content > dl",
          "bookUrl": "dt.cover-wrapper a@href",
          "coverUrl": "img@src",
          "intro": "dd:first-of-type@text",
          "name": "dt a@title"
        },
        "ruleBookInfo": {
          "tocUrl": ".bookchaptermore@href"
        },
        "ruleToc": {
          "chapterList": ".bookchapter>ul>li",
          "chapterName": "a@text",
          "chapterUrl": "a@href",
          "nextTocUrl": "a:contains(下一页)@href"
        },
        "ruleContent": {
          "content": ".content@html"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "365小说网",
        "bookSourceUrl": "http://www.shukuge.com/",
        "bookSourceGroup": "🍅番茄,💫通用源",
        "searchUrl": "Search?wd={{key}}",
        "ruleSearch": {
          "author": ".sp@span.0@text##作者：",
          "bookList": ".listitem",
          "bookUrl": ".bookdesc@a@href",
          "coverUrl": "img@src",
          "intro": ".desc.1@text##简介：",
          "kind": ".sp@span.1@text##分类：",
          "lastChapter": ".desc.0@text##最新章节：",
          "name": ".bookdesc@h2@text"
        },
        "ruleBookInfo": {
          "author": ".bookdmore@p.2@a@text",
          "coverUrl": ".bookdcover@img@src",
          "intro": ".bookdtext@p.0@text",
          "kind": ".bookdmore@p.0@a@text",
          "lastChapter": ".bookdmore@p.6@a@text",
          "name": ".bookd-title@text##TXT全集",
          "tocUrl": ".bookdtext@p.6@a@href"
        },
        "ruleToc": {
          "chapterList": ".box_con@dd",
          "chapterName": "a@text",
          "chapterUrl": "a@href"
        },
        "ruleContent": {
          "content": "#content@textNodes##投推荐票|上一章|←|章节目录|→|下一章|加入书签",
          "title": ".bookd-title@text##作者：[\\u4e00-\\u9fa5]+|更新时间：[\\d]{4}-[\\d]{2}-[\\d]{2}|[\\d]{2}:[\\d]{2}:[\\d]{2}"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🎉 多多书院",
        "bookSourceUrl": "https://www.txtduo.com",
        "bookSourceGroup": "🍅番茄",
        "searchUrl": "/search.html,{\n  \"method\": \"post\",\n  \"body\": \"searchkey={{key}}&searchtype=all&Submit=\"\n}",
        "ruleSearch": {
          "author": "span@text",
          "bookList": "id.alistbox",
          "bookUrl": "a.1@href",
          "coverUrl": "img@src",
          "intro": ".intro@text",
          "lastChapter": "a.2@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "a.1@text"
        },
        "ruleBookInfo": {
          "author": "id.info@a.1@text",
          "coverUrl": "id.fmimg@img@src",
          "intro": ".introtxt@text##(^|[。！？]+[”」）】]?)##$1<br>@js:result.replace(/简介./g,\"\")",
          "kind": ".con_top@a.1@text&&id.info@p.3@text##.*：|\\s..:.*",
          "lastChapter": "id.info@a.-1@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "id.info@h1@text"
        },
        "ruleToc": {
          "chapterList": "id.list@dd@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.content@p@html"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "五二书库1🥈",
        "bookSourceUrl": "https://www.52shuku.net/",
        "bookSourceGroup": "🌸女频[优]",
        "searchUrl": "/so/search.php?q={{key}}&m=no&f=_all&syn=no&p={{page}}",
        "ruleSearch": {
          "author": "tag.h4@text##^.*?_(.*?)【.*##$1",
          "bookList": "class.excerpt",
          "bookUrl": "tag.a@href",
          "intro": "class.note@text##\\(所属栏目.*##",
          "kind": "class.auth-span tag.a@text",
          "name": "tag.h4@text##^\\d+\\.\\s*|_.*##"
        },
        "ruleBookInfo": {
          "author": "class.article-title@text##.*?_(.*?)【.*##$1",
          "intro": "@css:.article-content@html##[\\s\\S]*?小说简介：|所属专题：[\\s\\S]*",
          "kind": "class.article-content tag.p.2 tag.a@text",
          "name": "class.article-title@text##_.*##"
        },
        "ruleToc": {
          "chapterList": "class.mulu",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "id.nr1@html##<script[\\s\\S]*?</script>|<div class=\"pagination2\"[\\s\\S]*"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "福书网1",
        "bookSourceUrl": "https://m.fushuw.org/",
        "bookSourceGroup": "🌸女频[优]",
        "searchUrl": "/e/search/index.php,{\"method\":\"POST\",\"body\":\"keyboard={{key}}&show=title\"}",
        "ruleSearch": {
          "author": "tag.span@text",
          "bookList": "class.r",
          "bookUrl": "tag.a@href",
          "name": "tag.a@text"
        },
        "ruleBookInfo": {
          "author": "class.title_info_right@tag.p.0@text##^作者：",
          "coverUrl": "class.title_info_left@tag.img@src",
          "intro": "@css:td#text@html##总书评数[\\s\\S]*?<p></p><br>|<p>第[\\s\\S]*",
          "name": "class.title_info_right@tag.h1@text"
        },
        "ruleToc": {
          "chapterList": "tag.select@tag.option",
          "chapterName": "@text",
          "chapterUrl": "@value"
        },
        "ruleContent": {
          "content": "@css:td#text@html##[\\s\\S]*?立意：[^<]+</p><br>|<table[\\s\\S]*</table>|<script[\\s\\S]*?</script>|\\s*<select[\\s\\S]*?</select>|\\s*<div[^>]*class=\"m\\.fushutxt[\\s\\S]*?</div>|\\s*<p[^>]*class=\"pageLink\">[\\s\\S]*?</p>|耽美小说.*福书.*网",
          "nextContentUrl": "text.下一页@href"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "言情小说网",
        "bookSourceUrl": "https://m.bgnovel.com",
        "bookSourceGroup": "🌸女频[优]",
        "searchUrl": "https://m.bgnovel.com/e/search/index.php,{\"method\":\"POST\",\"body\":\"keyboard={{key}}&show=title&tempid=1&tbname=article\"}",
        "ruleSearch": {
          "author": "span.-1@text",
          "bookList": "h2.r",
          "bookUrl": "a.l@href",
          "name": "a.l@text"
        },
        "ruleBookInfo": {
          "author": ".title_info_right p.0@text##作者：",
          "coverUrl": ".title_info_left img@data-original",
          "intro": "#text@html##总书评数[\\s\\S]*?文案</p>|<p>---\\*下一本预收\\*---[\\s\\S]*|<p>内容标签[\\s\\S]*|<p>作品荣誉[\\s\\S]*|<p>主角视角[\\s\\S]*|<p>一句话简介[\\s\\S]*|<p>立意[\\s\\S]*|<p>第\\d+章[\\s\\S]*",
          "name": "h1@text"
        },
        "ruleToc": {
          "chapterList": ".pageLink select option",
          "chapterName": "text",
          "chapterUrl": "value"
        },
        "ruleContent": {
          "content": "#text@html##<div[^>]*class=\"m\\.fushutxt\\.cc\"[\\s\\S]*?</div>|<div style=\"font-size: 16px[\\s\\S]*?</div>|<p[^>]*class=\"pageLink\"[\\s\\S]*?</p>",
          "nextContentUrl": "text.下一页@href"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "领域小说",
        "bookSourceUrl": "https://www.linuxgod.cn",
        "bookSourceGroup": "🍀起点源,💫通用源",
        "searchUrl": "https://www.linuxgod.cn/search.php?searchkey={{key}}&action=login&submit=",
        "header": "{\"User-Agent\":\"Mozilla/5.0 (Linux; U; Android 13; zh-Hans-CN; PFJM10 Build/TP1A.220905.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.58 Quark/6.13.6.581 Mobile Safari/537.36\",\"Accept-Language\":\"zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7\"}",
        "ruleSearch": {
          "author": "a.2@text",
          "bookList": ".bookbox",
          "bookUrl": "a.0@href",
          "coverUrl": "img@data-original",
          "intro": ".update@html##简介：",
          "kind": ".author.1:2@text##分类：|更新时间：",
          "lastChapter": "a.3@text",
          "name": "a.1@text"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "[property=\"og:image\"]@content",
          "intro": ".bookintromore@html",
          "kind": "[property~=category|status|update_time]@content",
          "lastChapter": "[property~=las?test_chapter_name]@content",
          "name": "[property=\"og:novel:book_name\"]@content"
        },
        "ruleToc": {
          "chapterList": "#chapter@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "#TextContent@p@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "格格党haogushi88",
        "bookSourceUrl": "https://www.haogushi8.cc",
        "bookSourceGroup": "🌸女频[优]",
        "searchUrl": "/search/,{\n  \"body\": \"searchkey={{key}}\",\n  \"method\": \"POST\"\n}",
        "ruleSearch": {
          "author": ".author.0@text",
          "bookList": ".bookbox",
          "bookUrl": "a.0@href",
          "intro": ".update@text",
          "lastChapter": ".cat@a@text",
          "name": "h4@a@text"
        },
        "ruleBookInfo": {
          "author": "[property$=author]@content",
          "coverUrl": "[property$=image]@content",
          "intro": "[property$=description]@content",
          "kind": "[property~=category|status|update_time]@content",
          "lastChapter": "{{@@[property$=chapter_name]@content}}\n@js:result\n.replace(\"••\",\"\")\n.replace(/^(\\d+).第/,'第')\n.replace(/^(正文|VIP章节|最新章节)?(\\s+|_)|[\\(\\{（｛【].*[求含理更谢乐发推票盟补加字Kk\\/].*/g,'')\n.replace(/^(\\d+)[、．]第.+章/,'第$1章')\n.replace(/^(\\d+)、\\d+、/,'第$1章 ')\n.replace(/^(\\d+)、\\d+/,'第$1章')\n.replace(/^(第.+章)\\s?\\d+/,'$1')\n.replace(/^(\\d+)、/,'第$1章 ')\n.replace(/^(第.+章)\\s?第.+章/,'$1')\n.replace(/第\\s(.+)\\s章/,'第$1章')\n.replace(/.*(chapter|Chapter)\\s?(\\d+)\\s?/,'$1 $2 ')\n.replace(/\\(.+\\)/,'')\n.replace(/\\[|。/,'')\n.replace(/第([零一二两三四五六七八九十百千]+)章/g,java.toNumChapter(result))\n##(章)([^\\s]+)(\\s·)##$1 $2$3",
          "name": "[property$=book_name]@content"
        },
        "ruleToc": {
          "chapterList": "id.list-chapterAll@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.rtext@p@html",
          "nextContentUrl": "id.linkNext@href",
          "replaceRegex": "##第.*章.*|\\(本章完\\)"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.lastChapter用了 @js:",
          "详情规则.lastChapter用了 java.*"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "斋书苑",
        "bookSourceUrl": "http://www.xiangshu100.net/",
        "bookSourceGroup": "🌸女频[优]",
        "searchUrl": "http://www.xiangshu100.net/searchaa.html,{\"charset\":\"utf-8\",\"method\":\"POST\",\"body\":\"searchkey={{key}}&page={{page}}\"}",
        "header": "{\n  \"User-Agent\": \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36\",\n  \"Content-Type\": \"application/x-www-form-urlencoded\",\n  \"Referer\": \"http://www.xiangshu100.net/\"\n}",
        "ruleSearch": {
          "author": ".book_other span@text",
          "bookList": "#sitebox dl",
          "bookUrl": "a.0@href",
          "checkKeyWord": "快穿",
          "coverUrl": "img.lazy@img@src",
          "intro": ".book_des@text",
          "kind": ".book_other span:nth-child(2)@text",
          "lastChapter": ".book_other a@text",
          "name": "h3 a@text"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "[property=\"og:image\"]@content",
          "intro": "[property=\"og:description\"]@content",
          "kind": "[property=\"og:novel:category\"]@content&&\n[property=\"og:novel:status\"]@content&&\n[property=\"og:novel:update_time\"]@content",
          "lastChapter": "{{@@[property$=chapter_name]@content}}\n@js:result\n.replace(\"••\",\"\")\n.replace(/^(\\d+).第/,'第')\n.replace(/^(正文|VIP章节|最新章节)?(\\s+|_)|[\\(\\{（｛【].*[求含理更谢乐发推票盟补加字Kk\\/].*/g,'')\n.replace(/^(\\d+)[、．]第.+章/,'第$1章')\n.replace(/^(\\d+)、\\d+、/,'第$1章 ')\n.replace(/^(\\d+)、\\d+/,'第$1章')\n.replace(/^(第.+章)\\s?\\d+/,'$1')\n.replace(/^(\\d+)、/,'第$1章 ')\n.replace(/^(第.+章)\\s?第.+章/,'$1')\n.replace(/第\\s(.+)\\s章/,'第$1章')\n.replace(/.*(chapter|Chapter)\\s?(\\d+)\\s?/,'$1 $2 ')\n.replace(/\\(.+\\)/,'')\n.replace(/\\[|。/,'')\n.replace(/第([零一二两三四五六七八九十百千]+)章/g,java.toNumChapter(result))\n##(章)([^\\s]+)(\\s·)##$1 $2$3",
          "name": "[property=\"og:novel:book_name\"]@content"
        },
        "ruleToc": {
          "chapterList": " id.chapterList@li@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.TextContent@p@html",
          "nextContentUrl": "text.下一@href",
          "replaceRegex": "##本章完"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.lastChapter用了 @js:",
          "详情规则.lastChapter用了 java.*"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "天命皆烬小说",
        "bookSourceUrl": "https://www.genwohua.com",
        "bookSourceGroup": "🍀起点源",
        "searchUrl": "/search.php?keyword={{key}}",
        "ruleSearch": {
          "author": "td:nth-child(4)@text",
          "bookList": "table.table tr:nth-child(n+2)",
          "bookUrl": "td:nth-child(2) a@href",
          "checkKeyWord": "蘑菇",
          "kind": "td:nth-child(1)@text",
          "lastChapter": "td:nth-child(3) a@text",
          "name": "td:nth-child(2) a@text"
        },
        "ruleBookInfo": {
          "author": "a.red@text",
          "coverUrl": "img.img-thumbnail@src",
          "intro": "#bookIntro@text",
          "lastChapter": ".panel-chapterlist > dd:first-child a@text",
          "name": "h1.bookTitle@text",
          "tocUrl": "@self",
          "wordCount": "span:nth-child(2)@text"
        },
        "ruleToc": {
          "chapterList": ".panel-chapterlist dd",
          "chapterName": "a@text",
          "chapterUrl": "a@href"
        },
        "ruleContent": {
          "content": "#booktxt > div:first-child@html",
          "nextContentUrl": "#linkNext@href",
          "title": "h1.readTitle@text"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "悠久小说",
        "bookSourceUrl": "http://wap.ujxsw.org/##@鱼",
        "bookSourceGroup": "🍀起点源,🍅番茄,💫通用源",
        "searchUrl": "/searchbooks.php,{\n  \"body\": \"searchkey={{key}}\",\n  \"method\": \"POST\"\n}",
        "ruleSearch": {
          "author": ".author a@text",
          "bookList": ".bookbox",
          "bookUrl": "a@href",
          "coverUrl": "img@src",
          "lastChapter": "{{@@.intro_line a@text}}🔸{{@@.cat@text##时间：}}",
          "name": ".bookname a@text"
        },
        "ruleBookInfo": {
          "author": ".block_txt2 tag.a.1@text",
          "coverUrl": ".block_img2 img@src",
          "intro": "☁️ 更新时间：\n\n{{@@.block_txt2@tag.p.6@text##更新时间：}}\n\n👻  简介：\n\n{{@@.bk-intro-bd@textNodes##.*网址.*}}",
          "kind": ".block_txt2@tag.p.3@tag.a@text",
          "lastChapter": ".block_txt2 tag.a.-1@text",
          "name": "h2@text",
          "tocUrl": "text.章节目录@href",
          "wordCount": "{{@@.block_txt2@tag.p.5@text##热度：}}{{@@.block_txt2@tag.p.4@text##状态：}}"
        },
        "ruleToc": {
          "chapterList": "#chapterList a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "#nr@html##.*悠久小说.*|.*百度.*|.*佰度.*|.*第.*页.*|.*标记书.*|.*转载自网络.*|上一章|下一章|上一页|下一页|关灯|护眼|报错|查看目录|最新网址.*|.*免费小说.*|.*入书架.*|手机版|电脑版|催更|.*联系予.*|.*继续阅读.*|\\*|.*本章完.*|.*本章节.*|.*第\\d章.*|79免费.*",
          "nextContentUrl": "text.下一页@href"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "五二书库1🥈",
        "bookSourceUrl": "https://www.52shukuw.cc",
        "bookSourceGroup": "🌸女频[优]",
        "searchUrl": "https://www.52shukuw.cc/sousuo/search.php?q={{key}}",
        "ruleSearch": {
          "author": "h2 a@text##.*作者：",
          "bookList": "ul.list@li",
          "bookUrl": "h2 a@href",
          "coverUrl": "small span a@text",
          "name": "h2 a@text"
        },
        "ruleBookInfo": {
          "tocUrl": "ul.catalog@li"
        },
        "ruleToc": {
          "chapterList": "ul.catalog li",
          "chapterName": "a@text",
          "chapterUrl": "a@href"
        },
        "ruleContent": {
          "content": "div.book_con p@text",
          "nextContentUrl": "div.page a:contains(下一页)@href",
          "title": "h1.art_tit@text"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "笔下文学",
        "bookSourceUrl": "https://www.bxwx.co/",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "{{cookie.removeCookie(source.key)}}\n/search.html,{\n  \"body\": \"searchtype=all&&369koolearn={{key}}\",\n  \"method\": \"POST\"\n}",
        "header": "Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US) AppleWebKit/525.13 (KHTML, like Gecko) Chrome/0.2.149.29 Safari/525.13",
        "ruleSearch": {
          "author": "class.book_other.0@tag.span.0@text",
          "bookList": "id.sitembox@dl",
          "bookUrl": "dd@h3@a@href",
          "coverUrl": "img@src##http.*co/##https://img.71bxwx.com/",
          "intro": "class.book_des.0@text",
          "kind": "class.book_other.0@tag.span.2@text",
          "lastChapter": "class.book_other.1@tag.a@text",
          "name": "h3@a@text",
          "wordCount": "class.book_other.0@tag.span.3@text"
        },
        "ruleBookInfo": {
          "author": "[property$=author]@content",
          "coverUrl": "[property=\"og:url\"]@content@js:\nlet ids = result.match(/b\\/(\\d+)\\/(\\d+)\\/$/);\nif(ids){\n\t let [, sid, id] = ids;\n\t `https://img.71bxwx.com//files/article/image/${sid}/${id}/${id}s.jpg`\n}",
          "intro": "#bookintro@html",
          "kind": "[property~=category|status|update_time]@content##小说|T.*",
          "lastChapter": "[property$=latest_chapter_name]@content",
          "name": "[property$=book_name]@content",
          "tocUrl": "[property$=read_url]@content",
          "wordCount": "li:contains(字 数：) span@text"
        },
        "ruleToc": {
          "chapterList": "dt:contains(章节列表) ~ dd a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "#content@html##.*请大家收藏：.*",
          "imageStyle": "full",
          "nextContentUrl": "text.下一页@href"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.coverUrl用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🍅木里书屋🍅",
        "bookSourceUrl": "https://mulides-pyfq.ms.show/",
        "bookSourceGroup": "🍅番茄",
        "searchUrl": "https://novel.snssdk.com/api/novel/channel/homepage/search/search/v1/?device_platform=android&parent_enterfrom=novel_channel_search.tab.&offset={{(page-1)*10}}&aid=1967&q={{key}}",
        "header": "{\n\t\"user-agent\":\"Mozilla/5.0 (Linux; Android 10; TAS-AN00 Build/HUAWEITAS-AN00; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/114.0.5735.61 Mobile Safari/537.36 Super 4.6.5\"\n}",
        "ruleSearch": {
          "author": "author##</?em>",
          "bookList": "$.data.ret_data.*||$..book_info[*]",
          "bookUrl": "https://mulides-pyfq.ms.show/api/book/@get:{book_id}",
          "checkKeyWord": "我的26岁女房客",
          "coverUrl": ".audio_thumb_uri",
          "intro": ".abstract",
          "kind": "category&&score",
          "name": "book_name||title@put:{book_id: book_id}##<em>|</em>|《|》",
          "wordCount": "连载{{$.creation_status}}完结##连载0|1完结"
        },
        "ruleBookInfo": {
          "author": "$.book.author",
          "coverUrl": "$.book.thumb_url",
          "intro": "&nbsp;&nbsp;\n🆔ID:{{$.book.book_id}}\n📕 书名：{{$..book_name}}\n📇 状态：__status__-连载{{$..creation_status}}完结\n⌨️ 字数：{{$..word_count}}字\n📎 分类：{{$..category##/##,}}\n🏷️ 标签：🏷{{$..tags}}\n📜 简介：\n{{$..abstract}}",
          "kind": "男生{{$..gender}}女生\n{{$..category}}\n连载{{$..creation_status}}完结\n{{$..score}}分\n{{java.timeFormatUTC(java.getString(\"$..last_chapter_update_time\")*1000,'yyyy-MM-dd',8)}} \n##连载0|1完结|男生0|1女生\n@js:result\n.replace(\"男生2女生\",\"出版\")\n.replace(\"连载4完结\",\"断更\")\n.replace(\"连载-1完结\",\"未知\");",
          "lastChapter": "{{$..last_chapter_title}} • {{java.timeFormat(java.getString(\"$..last_chapter_update_time\")*1000)}}",
          "name": "$.book.book_name@put:{book_id: $.book.book_id}",
          "tocUrl": "https://fanqienovel.com/api/reader/directory/detail?bookId={{$..book_id}}",
          "wordCount": "$..word_count"
        },
        "ruleToc": {
          "chapterList": "$.data.chapterListWithVolume[*].*",
          "chapterName": "$.title",
          "chapterUrl": "https://mulides-pyfq.ms.show/api/book/@get:{book_id}/chapter/{{$.itemId}}",
          "formatJs": "$.volume_name",
          "updateTime": "发布于 {{java.timeFormat(java.getString('$.firstPassTime')*1000)}}"
        },
        "ruleContent": {
          "content": "$.content",
          "title": "$.title"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.kind用了 @js:",
          "详情规则.kind用了 java.*",
          "详情规则.lastChapter用了 java.*",
          "目录规则.updateTime用了 java.*",
          "目录规则暂不支持 formatJs"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "不格小说",
        "bookSourceUrl": "https://m.bugexs.com",
        "bookSourceGroup": "🍅番茄",
        "searchUrl": "/s.php?s={{key}}&page={{page}}",
        "header": "{\"referer\": \"{{source.getKey()}}/\",\n\"x-requested-with\": \"mark.via\",\n\"accept-language\": \"zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7\",\n\"user-agent\": \"Mozilla/5.0 (Linux; Android 10; PACM00 Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.5359.79 Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": "class.info@span.0@text",
          "bookList": "class.clearfix@li",
          "bookUrl": "class.tit@href##$##,{\"webView\":true}",
          "checkKeyWord": "娱乐圈",
          "coverUrl": "class.pic lazy@img@data-original",
          "intro": "class.intro@text",
          "kind": "class.type@text",
          "name": "class.tit@text||class.header@h1@text"
        },
        "ruleBookInfo": {
          "author": "class.info@span.0@a@text",
          "coverUrl": "class.base clearfix@dt@img@src",
          "intro": "class.intro clearfix@text",
          "kind": "class.info@span.1@a@text",
          "lastChapter": "class.info@span.4@a@text",
          "name": "class.base clearfix@dd@h2@text||class.header@h1@text",
          "tocUrl": "<js>\njava.log(baseUrl);\nurl = baseUrl.replace(/.html/,'');\n //java.log(url);\n</js>"
        },
        "ruleToc": {
          "chapterList": "class.list@li@a",
          "chapterName": "text",
          "chapterUrl": "href##$##,{\"webView\":true}"
        },
        "ruleContent": {
          "content": "class.content@p!-1@html"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.tocUrl用了 <js>",
          "详情规则.tocUrl用了 java.*"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "ryw笔趣阁78",
        "bookSourceUrl": "https://www.biquge78.cc",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "{{cookie.removeCookie(source.getKey())}}/search/,{\n\"method\": \"POST\",\n  \"body\": \"searchkey={{key}}\"\n}",
        "ruleSearch": {
          "author": "div.author.0@text",
          "bookList": "div.bookbox",
          "bookUrl": "a.del_but@href",
          "checkKeyWord": "借剑",
          "intro": "div.update@text",
          "lastChapter": "div.cat@text",
          "name": "h4.bookname@text"
        },
        "ruleBookInfo": {
          "author": "p.booktag@a@text",
          "intro": "p.bookintro@text",
          "kind": "ol.breadcrumb@li.1@text",
          "lastChapter": "a.bookchapter@text",
          "name": "h1.booktitle@text",
          "tocUrl": "div.list-chapterAll@dd@a@href",
          "wordCount": "p.booktag@span.0@text"
        },
        "ruleToc": {
          "chapterList": "#list-chapterAll@dd",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "class.readcontent@tag.p@html",
          "nextContentUrl": "id.linkNext@href"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "新笔趣阁",
        "bookSourceUrl": "https://www.biquges123.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/search?keyword={{key}}&page={{page}}",
        "ruleSearch": {
          "author": ".author@text",
          "bookList": "class.hot_4@tag.li",
          "bookUrl": "class.hot_4_item@tag.a@href",
          "coverUrl": "class.cover@tag.img@src",
          "intro": "class.hot_des@text",
          "name": ".hot_name@text"
        },
        "ruleBookInfo": {
          "author": "class.info_ct@tag.div.2@text",
          "coverUrl": "class.info_lt@tag.img@src",
          "init": "tag.main",
          "intro": "class.des@tag.span@text",
          "kind": "class.bread@tag.a.1@text",
          "lastChapter": "class.ud@tag.a@text",
          "name": "class.info_title@text"
        },
        "ruleToc": {
          "chapterList": "class.list@tag.li",
          "chapterName": "tag.a@title",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "class.article@html",
          "nextContentUrl": "class.text_btn@tag.a.2@href",
          "title": "class.text@tag.h1@text"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "新百强小说",
        "bookSourceUrl": "http://m.xinbqg.info/",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/s.php?q={{key}}",
        "ruleSearch": {
          "author": ".author@text##^\\w{2,4}：",
          "bookList": ".bookinfo",
          "bookUrl": "h4 a@href",
          "checkKeyWord": "明克街",
          "coverUrl": "a.0@href\n@js:\nvar match = result.match(/(\\d+)(?=[^\\d]*$)/);\nvar id = match ? match[1] : '';\nvar iid = parseInt(id / 1000);\n'/files/article/image/' + iid + '/' + id + '/' + id + 's.jpg';",
          "kind": ".cat@text##^\\w{2,4}：",
          "lastChapter": ".update a@text",
          "name": "h4@text"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "[property=\"og:image\"]@content",
          "intro": "[property=\"og:novel:update_time\"]@content&&\n[property=\"og:description\"]@content@js:'更新时间：'+result",
          "kind": "[property~=category|status|tags]@content",
          "lastChapter": "[property~=las?test_chapter_name]@content",
          "name": "[property=\"og:novel:book_name\"]@content",
          "tocUrl": "a[href*=\"all\"]@href"
        },
        "ruleToc": {
          "chapterList": "dd@a[href$=\"html\"]",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "#chaptercontent@textNodes##（本章未完，请点击下一页继续阅读）|记住手机版网址：m.xinbqg.info",
          "nextContentUrl": "#chaptercontent@text##/(\\d+)页[)）]##$1###\n<js>\nArray.from(\n    { length: Number(result[0]) - 1 },\n    (_, i) => baseUrl.replace(/\\.html/g, '_' + (i + 2) + '.html,{\"webView\": true}')\n)\n</js>",
          "replaceRegex": "##((?<=[。？！”』」]\\n)|(?<=[^。？！”』」\\s]))\\s*.* \\(第\\d\\/\\d页\\)\\s*|.* \\(第\\d\\/\\d页\\)$"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.coverUrl用了 @js:",
          "详情规则.intro用了 @js:",
          "正文规则.nextContentUrl用了 <js>"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🌸 轨道小说",
        "bookSourceUrl": "https://www.biqueg.cc",
        "bookSourceGroup": "🌸女频[优]",
        "searchUrl": "/search.php?q={{key}}",
        "ruleSearch": {
          "author": "class.book_other.0@text",
          "bookList": "class.col-12@dl",
          "bookUrl": "a.0@href",
          "coverUrl": "img@src",
          "lastChapter": "class.book_other.-1@a@text",
          "name": "h3@text"
        },
        "ruleBookInfo": {
          "author": "i@a@text",
          "intro": "class.intro@text##\\s{1,}##<br>",
          "kind": "p@span.0@text&&p@span.2@text",
          "lastChapter": "class.flex to100@a@text",
          "name": "h1@text",
          "wordCount": "p@span.1@text"
        },
        "ruleToc": {
          "chapterList": "class.book_list.-1@a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": "@js:\npage = String(java.getString(\"@class.page-link.0@text\")).match(/\\/(\\d+)/)?.[1]??0;\nlist = [];\nfor(let i=2;i<=page;i++){\n\tlist.push(baseUrl+\"index_\"+i)\n\t}\nlist"
        },
        "ruleContent": {
          "content": "tag.article@html",
          "nextContentUrl": "text.下一章@href",
          "replaceRegex": "##第\\(\\d+/\\d+\\)页"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "目录规则.nextTocUrl用了 @js:",
          "目录规则.nextTocUrl用了 java.*"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "笔心小说网",
        "bookSourceUrl": "https://www.nboxin.com",
        "bookSourceGroup": "🌸女频[优]",
        "searchUrl": "/search.html,{\n  \"body\": \"s={{key}}\",\n  \"method\": \"POST\"\n}",
        "header": "{\"User-Agent\":\"Mozilla/5.0 (Linux; U; Android 13; zh-Hans-CN; PFJM10 Build/TP1A.220905.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/135.0.4896.58 Quark/6.13.6.581 Mobile Safari/537.36\",\"Accept-Language\":\"zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7\"}",
        "ruleSearch": {
          "author": "span.0@text",
          "bookList": ".block@li",
          "bookUrl": "a.0@href",
          "coverUrl": "{{\"https://www.nboxin.com/novel/defaultimg.png\"}}",
          "name": "a.0@text"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "[property=\"og:image\"]@content",
          "intro": "[property=\"og:description\"]@content",
          "kind": "[property~=category|status|update_time]@content",
          "lastChapter": "[property~=las?test_chapter_name]@content",
          "name": "[property=\"og:novel:book_name\"]@content",
          "tocUrl": "{{baseUrl}}##$##1/desc.html"
        },
        "ruleToc": {
          "chapterList": "-.p2@li@a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": "option@value"
        },
        "ruleContent": {
          "content": "#novelcontent@p@html",
          "nextContentUrl": "text.下一@href\n@js:\nvar next=/_\\d+\\.html/.test(result) ? result : '';\nnext;",
          "replaceRegex": "##.*域名.*停用.*域名.*|《{{book.name}}》.*（.*页）|本章.*下一.*阅读.*"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "正文规则.nextContentUrl用了 @js:",
          "搜索规则.coverUrl：模板里是脚本表达式：{{\"https://www.nboxin.com/novel/}}",
          "详情规则.tocUrl：模板里是脚本表达式：{{baseUrl}}"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "圣墟小说网",
        "bookSourceUrl": "http://www.shengxuxu.net",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/search.html?/,{\n  \"body\": \"searchkey={{key}}\",\n  \"method\": \"POST\"\n}",
        "header": "{\"User-Agent\": \"Mozilla/5.0 (Linux; Android 9) Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": ".info span:nth-child(2)@text",
          "bookList": ".librarylist li ",
          "bookUrl": "a:nth-child(1)@href",
          "coverUrl": "a.0@href##\\D((\\d+)\\d{3})##http://www.shengxuxu.net/headimgs/$2/$1/s$1.jpg###\na.0@href##\\/(\\d+)$##$1###",
          "intro": "@get:{i}",
          "kind": ".info span:nth-child(3) a@text",
          "lastChapter": ".last@text",
          "name": ".info span:nth-child(1)@text ##.*《|》.*"
        },
        "ruleBookInfo": {
          "author": "@get:{a}",
          "coverUrl": "@get:{c}",
          "init": "@put:{n:\"[property$=book_name]@content\",\n\ta:\"[property$=author]@content\",\nk:\"[property~=category|status|update_time]@content\",\nl:\"[property$=lastest_chapter_name]@content\",\ni:\"[property$=description]@content\",\nc:\"[property$=image]@content\"}",
          "intro": "@get:{i}",
          "kind": "@get:{k}",
          "lastChapter": "@get:{l}",
          "name": "@get:{n}"
        },
        "ruleToc": {
          "chapterList": ".dirlist@li",
          "chapterName": "a@text",
          "chapterUrl": "a@href",
          "nextTocUrl": "option@value||text.下一页@href"
        },
        "ruleContent": {
          "content": ".content@html##.本章完.|^一秒记住ｈｔｔｐs://ｍ\\.\\/?$",
          "nextContentUrl": "text.下一页@href"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.coverUrl：正则替换段过多"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🎉 八零小说",
        "bookSourceUrl": "http://www.80zw.la",
        "bookSourceGroup": "🍀起点源",
        "searchUrl": "/modules/article/search.php,{\n  \"method\": \"post\",\n  \"body\": \"searchkey={{key}}&searchtype=articlename\"\n}",
        "ruleSearch": {
          "author": "a.2@text",
          "bookList": ".storelistbt5",
          "bookUrl": "a.1@href",
          "coverUrl": "img@src",
          "intro": "p.1@text",
          "kind": "p.0@textNodes&&span.1@text&&p.2@text##.*更新.|最新.*|.*：|\\s",
          "lastChapter": "p.2@text##.*最新章节.|正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "a.1@text##\\《|\\》.*"
        },
        "ruleBookInfo": {
          "author": ".soft_info_r@a.0@text",
          "coverUrl": ".soft_info_r@img@src",
          "intro": "id.mainSoftIntro@text##(^|[。！？]+[”」）】]?)##$1<br>@js:result.replace(/.*推荐给你的朋友！|八零电子书.*|【展开】.*|更多.*TXT.*/g,\"\")",
          "kind": ".soft_info_r@li.6@strong@text&&.soft_info_r@li.7@textNodes##\\s..:.*",
          "lastChapter": ".soft_info_r@li.9@textNodes##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "id.soft_info_para@h1@text##TXT.*",
          "tocUrl": ".soft_info_r@a.-1@href"
        },
        "ruleToc": {
          "chapterList": "id.yulan@li@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href##www\\.qiushu\\.info\\/t##wap\\.80zw\\.la"
        },
        "ruleContent": {
          "content": "id.nr1@text",
          "nextContentUrl": "id.pt_next@href",
          "replaceRegex": "##求书网.*"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "📖鲲弩小说",
        "bookSourceUrl": "https://www.kunnu.com/",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/page/{{page}}/?s={{key}}",
        "header": "{\"User-Agent\": \"Mozilla/5.0 (Linux; Android 12; 22041211AC Build/SP1A.210812.016) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36\"}",
        "ruleSearch": {
          "bookList": ".pd-search@ul@li",
          "bookUrl": "a@href",
          "intro": "@js:\"🕵️这里好像什么也没有说哎，要不你点进去看看吧!\"",
          "name": "a@text"
        },
        "ruleBookInfo": {
          "author": "p.0@text",
          "coverUrl": "img@src",
          "intro": "🔖简介：{{@@.describe-html.0@text}}",
          "kind": "p.1@text",
          "lastChapter": "{{@@p.4@text##最新章节：}}|{{@@p.3@text##最近更新：}}更新",
          "name": ".book-describe@h1@text",
          "wordCount": "p.2@text"
        },
        "ruleToc": {
          "chapterList": ".book-list@ul@li@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "div@id.nr1@p@text##© 所有内容版权归版权方或原作者所有 / All contents are copyrighted by their respective owners or authors.",
          "replaceRegex": "##.*鲲*弩*小*说* 🐱 … K u n N u … c om|鲲*弩*小*说*"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.intro用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "69好书",
        "bookSourceUrl": "https://www.69haoshu.com",
        "bookSourceGroup": "🍀起点源",
        "searchUrl": "{{cookie.removeCookie(source.key)}}/ss/?searchkey={{key}}",
        "ruleSearch": {
          "author": "class.btm@a@text",
          "bookList": "id.hotcontent@class.item",
          "bookUrl": "dl@dt@a@href",
          "checkKeyWord": "魔兔兔",
          "coverUrl": "class.image@img@src",
          "intro": "dl@dd@text##.*简介：",
          "kind": "class.btm@em.1@text",
          "lastChapter": "tag.td.1@tag.a@text##免费章节 |正文卷 |正文 |VIP章节 ",
          "name": "dl@dt@a@text",
          "wordCount": "class.btm@em.0@text"
        },
        "ruleBookInfo": {
          "author": "id.info@p.0@text",
          "intro": "&nbsp;\n更新时间🕰：\n{{@@[property$=update_time]@content}}\n简介内容📜：\n{{@@id.intro@text}}",
          "kind": "id.info@p.1@text&&[property$=update_time]@content##状态：|更新：",
          "lastChapter": "id.info@p.2@a@text",
          "name": "id.info@h1"
        },
        "ruleToc": {
          "chapterList": "id.list@dl@a!0:1:2:3:4:5:6:7",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.content@html",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##本章未完，点击.*|.*本章阅读完毕.*"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "错层小说网",
        "bookSourceUrl": "https://www.cuoceng.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/book/search.html?pageNo={{page}}&kw={{key}}&sortBy=hits",
        "header": "{\"User-Agent\":\"Mozilla/5.0 (Linux; U; Android 13; zh-Hans-CN; PFJM10 Build/TP1A.220905.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/135.0.4896.58 Quark/6.13.6.581 Mobile Safari/537.36\",\"Accept-Language\":\"zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7\"}",
        "ruleSearch": {
          "author": "authName",
          "bookList": "content[*]",
          "bookUrl": "/book/{{$.id}}.html",
          "coverUrl": "bkCover",
          "intro": "bkDesc",
          "kind": "cateName&&lastChapterUpdateTime",
          "name": "bkName",
          "wordCount": "bkWords"
        },
        "ruleBookInfo": {
          "author": ".tit@a@text##\\s著",
          "coverUrl": ".bookCover@img@data-src",
          "intro": ".intro_txt@p@html",
          "kind": ".item.0@a@text&&.item.1@em@text&&i.0@text##更新时间：",
          "lastChapter": ".book_tit@a.0@text",
          "name": ".tit@h1@text",
          "tocUrl": "text.目录@href##\\.html$##/1.html",
          "wordCount": ".item.3@em@text"
        },
        "ruleToc": {
          "chapterList": ".dirList@ul@li@a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": "@js:\na=Math.ceil(src.match(/pageNum\" value=\"(\\d+)\"\\/\\>/)[1] / 1000)\n//java.log(a)\nlist = [];\nfor (var i = 1; i <= a; i++) {\n\tlist.push(baseUrl.replace(/\\/\\d+\\.html/,\"/\" + i + \".html\")); \n}\nlist;",
          "updateTime": "span@title##.*字数:(\\d+)\\)##$1字"
        },
        "ruleContent": {
          "content": "#showReading@p@html"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "目录规则.nextTocUrl用了 @js:",
          "目录规则.nextTocUrl用了 java.*"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🌸棉花糖",
        "bookSourceUrl": "https://www.mhtxs.la/",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "https://www.mhtxs.la/search.php?searchkey={{key}}",
        "ruleSearch": {
          "author": "class.even.1@text",
          "bookList": "class.grid@tag.tr!0",
          "bookUrl": "tag.a.0@href",
          "coverUrl": "tag.a.0@href##.+\\D((\\d+)\\d{3})\\D##https://www.mhtxs.la/book/image/$2/$1/$1s.jpg###",
          "kind": "class.odd.1@text",
          "lastChapter": "class.odd.0@text##免费章节 |正文卷 |正文 |VIP章节 ",
          "name": "class.even.0@text"
        },
        "ruleBookInfo": {
          "author": "[name=\"og:novel:author\"]@content",
          "coverUrl": "[property=\"og:image\"]@content",
          "intro": "id.intro@textNodes",
          "kind": "[name=\"og:novel:category\"]@content&&[name=\"og:novel:status\"]@content&&[name=\"og:novel:update_time\"]@content",
          "lastChapter": "[name=\"og:novel:latest_chapter_name\"]@content##免费章节 |正文卷 |正文 |VIP章节 ",
          "name": "[name=\"og:novel:book_name\"]@content"
        },
        "ruleToc": {
          "chapterList": "tag.dd@tag.a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "class.content@html##最新网址.*(?:la|info)|下载本书最(.|\\n)* ",
          "imageStyle": "0"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "书斋阁",
        "bookSourceUrl": "https://www.shuzhaige.com",
        "bookSourceGroup": "🌸女频[优]",
        "searchUrl": "/e/search/index.php,{\n  \"body\": \"tbname=bookname&show=title,writer&tempid=1&keyboard={{key}}\",\n  \"method\": \"POST\"\n}",
        "header": "{\n  \"User-Agent\": \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36\"\n}",
        "ruleSearch": {
          "author": ".col-xs-4@text",
          "bookList": "class.table table-striped table-hover@tr!0",
          "bookUrl": ".col-xs-8@a@href",
          "kind": ".hidden-xs.1@text",
          "lastChapter": ".hidden-xs.0@text",
          "name": ".col-xs-8@text"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "[property=\"og:image\"]@content",
          "intro": "[property=\"og:description\"]@content",
          "kind": "[property~=category|status|update_time]@content",
          "lastChapter": "[property~=las?test_chapter_name]@content",
          "name": "[property=\"og:novel:book_name\"]@content",
          "tocUrl": ""
        },
        "ruleToc": {
          "chapterList": ".line3 a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "#content@p@textNodes",
          "replaceRegex": "##马上记住书斋阁.*|,如果被U.*"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "老幺小说网",
        "bookSourceUrl": "https://m.laoyaoxs.org#&喵~ 改",
        "bookSourceGroup": "🍅番茄",
        "searchUrl": "/s.php?s={{key}}&page={{page}}",
        "header": "{\"accept-language\":\"zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7\"}",
        "ruleSearch": {
          "author": ".info span@textNodes||[property=\"og:novel:author\"]@content",
          "bookList": ".clearfix li||head",
          "bookUrl": "class.tit@href",
          "checkKeyWord": "穿进赛博游戏后干掉BOSS成功上位",
          "coverUrl": "img@data-original||[property=\"og:image\"]@content",
          "intro": ".intro@text||[property=\"og:description\"]@content",
          "kind": ".type@text||[property~=category|status|update_time]@content",
          "name": ".tit@text||[property=\"og:novel:book_name\"]@content"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "[property=\"og:image\"]@content",
          "intro": "[property=\"og:description\"]@content",
          "kind": "[property~=category|status|update_time]@content",
          "lastChapter": "[property=\"og:novel:latest_chapter_name\"]@content||[property=\"og:novel:lastest_chapter_name\"]@content",
          "name": "[property=\"og:novel:book_name\"]@content",
          "tocUrl": "[property=\"og:novel:read_url\"]@content"
        },
        "ruleToc": {
          "chapterList": ".list a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "#txt p@text",
          "replaceRegex": "##.*不格小说.*",
          "title": ".headline@text"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "二三中文",
        "bookSourceUrl": "http://wap.ersanxs.info",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/s.php?keyword={{key}}",
        "ruleSearch": {
          "author": "span@text##\\/",
          "bookList": ".result@li",
          "bookUrl": "a.1@href",
          "kind": "a.0@text##\\[|\\]|\\s",
          "name": "a.1@text"
        },
        "ruleBookInfo": {
          "author": ".author@text",
          "coverUrl": ".synopsisArea_detail@img@src",
          "intro": ".review@html",
          "kind": ".synopsisArea_detail@p.1:2:4@text##.*：",
          "name": "h1@text",
          "tocUrl": "text.查看完整目录@href"
        },
        "ruleToc": {
          "chapterList": "#chapterlist p:nth-child(n+3) > a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "#chaptercontent@textNodes",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##\\s*(.*?\\(第\\d+/\\d+页\\)|.*本章未?完.*)\\s*"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "书客居小说",
        "bookSourceUrl": "https://www.j7ren.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/search/,{\n  \"body\": \"searchkey={{key}}&searchtype=all&Submit=\",\n  \"method\": \"POST\"\n}",
        "header": "{\"User-Agent\":\"Mozilla/5.0 (Linux; U; Android 13; zh-Hans-CN; PFJM10 Build/TP1A.220905.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/135.0.4896.58 Quark/6.13.6.581 Mobile Safari/537.36\",\"Accept-Language\":\"zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7\"}",
        "ruleSearch": {
          "author": "p.0@ownText",
          "bookList": ".searchresult",
          "bookUrl": "a.0@href",
          "coverUrl": "img@data-original",
          "intro": "p.1@text##.*简介",
          "kind": "{{@span.0@text##\\s\\/\\s##,}}\n{{@span.2@text##.*\\s}}",
          "lastChapter": "a.2@text",
          "name": "a.1@text",
          "wordCount": "span.2@text##\\s.*"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": ".novel_info_main@img@src",
          "intro": "[property=\"og:description\"]@content##.*{{book.name}}.*{{book.author}}.*著，?,?",
          "kind": "[property~=category|status|update_time]@content",
          "lastChapter": "[property~=las?test_chapter_name]@content",
          "name": "[property=\"og:novel:book_name\"]@content"
        },
        "ruleToc": {
          "chapterList": "#ul_all_chapters@li@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "#article@p@html",
          "nextContentUrl": "#next_url@href\n@js:\nvar next=/_\\d+\\.html/.test(result) ? result : '';\nnext;"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "正文规则.nextContentUrl用了 @js:",
          "搜索规则.kind：模板里是脚本表达式：{{@span.0@text##\\s\\/\\s##,}}"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "元尊小说",
        "bookSourceUrl": "https://www.yuanzunxs88.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "https://www.yuanzunxs88.com/modules/article/search.php,{\n\"charset\": \"gbk\",\n\"method\": \"POST\",\n\"body\": \"searchkey={{key}}&action=login\"\n}",
        "ruleSearch": {
          "author": "class.author.0@text##作者：",
          "bookList": ".bookbox",
          "bookUrl": ".bookname@a@href",
          "intro": "class.update@text##简介： |\\s",
          "lastChapter": "class.cat@text##更新到：",
          "name": "class.bookname@text"
        },
        "ruleBookInfo": {
          "author": "class.red.0@text",
          "coverUrl": "img@src",
          "intro": "<br>更新时间：\n{{@.booktime@text##更新时间：}}\n简介：\n{{@.bookintro@html}}",
          "kind": "class.red.1@text&&.booktime@text##更新时间：",
          "lastChapter": "class.bookchapter@text##《.*》正文\\s",
          "name": "class.booktitle@text",
          "wordCount": "class.blue.0@text"
        },
        "ruleToc": {
          "chapterList": "id.list-chapterAll@dd@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "class.readcontent@html##\\<!--AD4--\\>|本章未完，点击下一页继续阅读",
          "imageStyle": "0",
          "nextContentUrl": "text.下一页@href"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro：模板里是脚本表达式：{{@.booktime@text##更新时间：}}"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🌈阅读",
        "bookSourceUrl": "http://www.yuedu.info",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "http://www.yuedu.info/search/result.html?searchkey={{key}}",
        "header": "{\"User-Agent\":\"Mozilla/5.0 (Linux; Android 9) Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": "span:nth-child(2) > a@text",
          "bookList": "li",
          "bookUrl": ".novelname@href",
          "coverUrl": "img@src",
          "intro": ".intro@text",
          "lastChapter": ".last > a@text",
          "name": ".novelname@text"
        },
        "ruleBookInfo": {
          "author": ".novelinfo-l li:nth-child(1) > a@text",
          "coverUrl": ".novelinfo-r > img@src",
          "intro": "p@text",
          "kind": ".novelinfo-l li:nth-child(2) > a@text",
          "lastChapter": ".novelinfo-l li:nth-child(6) > a@text",
          "name": "h1@text",
          "tocUrl": ".dirlist@href"
        },
        "ruleToc": {
          "chapterList": ".dirlist > li",
          "chapterName": "a@text",
          "chapterUrl": "a@href"
        },
        "ruleContent": {
          "content": "p@text"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "📖读万卷",
        "bookSourceUrl": "http://wap.duwanjuan.info/##@Mengteen",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/modules/article/search.php?q={{key}}",
        "header": "{\"User-Agent\": \"Mozilla/5.0 (Linux; Android 12; 22041211AC Build/SP1A.210812.016) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": "a.1@text",
          "bookList": ".sone",
          "bookUrl": "a@href",
          "coverUrl": "img@src",
          "intro": "@js:\"🤔这里好像什么都没说介绍呢,要不你点进去看看!\"",
          "name": "a.0@text"
        },
        "ruleBookInfo": {
          "author": "p.0@text",
          "coverUrl": "img@src",
          "intro": "🏷简介：{{@@.intro@p@text}}",
          "kind": "p.1@text##类型：",
          "lastChapter": "p.3@text",
          "name": "h3.0@text",
          "wordCount": "p.2@text"
        },
        "ruleToc": {
          "chapterList": ".list_xm@ul@li@a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": "option@value"
        },
        "ruleContent": {
          "content": ".novelcontent@p@textNodes##（本章未完，请点击下一页继续阅读）",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##.*※※※"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.intro用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "60看书",
        "bookSourceUrl": "http://www.60ksw.com/",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "{{cookie.removeCookie(source.key)}}/modules/article/search.php,{\n\t\"method\": \"post\",\n  \"charset\": \"GBK\",\n\t\"body\": \"searchkey={{key}}&searchtype=articlename&page={{page}}\"\n\t}",
        "ruleSearch": {
          "author": ".odd.1@text",
          "bookList": "#nr",
          "bookUrl": "a@href",
          "checkKeyWord": "天命",
          "coverUrl": "a.0@href##.*\\/(\\d+)\\/(\\d+)\\/.*##http://www.60ksw.com/files/article/image/$1/$2/$2s.jpg",
          "kind": ".even.-1@text",
          "lastChapter": ".even.0@text",
          "name": ".odd.0@text",
          "wordCount": ".odd.-1@text"
        },
        "ruleBookInfo": {
          "intro": ".bookintro@html",
          "kind": "[name=\"og:novel:category\"]@content",
          "wordCount": ".count@span.-1@text"
        },
        "ruleToc": {
          "chapterList": "#chapterlist li a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "#content@html",
          "nextContentUrl": "text.下一@href"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "铅笔文学",
        "bookSourceUrl": "http://www.lbbin.com",
        "bookSourceGroup": "🌸女频[优]",
        "searchUrl": "{{cookie.removeCookie(source.getKey())}}\n/search/,{\n  \"body\": \"searchkey={{key}}&searchtype=all&Submit=\",\n  \"charset\": \"UTF-8\",\n  \"method\": \"POST\"\n}",
        "header": "{\n\"User-Agent\":\"Mozilla/5.0 (Linux; Android 9) Mobile Safari/537.36\",\"referer\":\"{{baseUrl}}\"\n}",
        "ruleSearch": {
          "author": "p.0@textNodes",
          "bookList": ".searchresult",
          "bookUrl": "a.0@href",
          "coverUrl": ".img_span@img.0@data-original",
          "intro": ".searchresult_p@text",
          "kind": "",
          "name": "h3@text",
          "wordCount": ""
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": ".novel_info_main@img.0@src",
          "intro": "[property=\"og:description\"]@content",
          "kind": "[property=\"og:novel:category\"]@content",
          "lastChapter": "[property=\"og:novel:latest_chapter_name\"]@content",
          "name": "[property=\"og:novel:book_name\"]@content",
          "tocUrl": "",
          "wordCount": ""
        },
        "ruleToc": {
          "chapterList": "#ul_all_chapters a",
          "chapterName": "text",
          "chapterUrl": "href",
          "isPay": "",
          "nextTocUrl": ""
        },
        "ruleContent": {
          "content": "#article@text",
          "nextContentUrl": "#next_url@href"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🎈去读书 #破冰",
        "bookSourceUrl": "http://www.qudushu.com/#♤pb",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "http://www.qudushu.com/modules/article/search.php?q={{key}}",
        "ruleSearch": {
          "author": "class.c_tag.0@tag.span.1@text",
          "bookList": "id.jieqi_page_contents@class.c_row",
          "bookUrl": "class.c_subject@a@href",
          "coverUrl": "img@src",
          "kind": "class.c_tag.0@tag.span.3@text&&\nclass.c_tag.0@tag.span.7@text&&\nclass.c_tag.1@tag.span.3@text",
          "lastChapter": "class.c_tag.1@tag.span.1@a@text",
          "name": "class.c_subject@a@text",
          "wordCount": "class.c_tag.0@tag.span.5@text"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "class.divbox cf@img@src",
          "intro": "class.tabcontent@class.tabvalue.0@text",
          "kind": "class.tabcontent@class.tabvalue.1@tag.td.2@text&&\nclass.tabcontent@class.tabvalue.1@tag.td.1@text&&\nclass.tabcontent@class.tabvalue.1@tag.td.0@text##最后更新：|连载状态：|作品分类：",
          "lastChapter": "h3@a@text",
          "name": "[property=\"og:novel:book_name\"]@content##\\（.*|\\(.*|免费阅读|全文.*阅读|最新章节|小说|笔趣阁|免费.*",
          "tocUrl": "text.点击阅读@href",
          "wordCount": "class.tabcontent@class.tabvalue.1@tag.td.6@text##全文字数："
        },
        "ruleToc": {
          "chapterList": "class.index@li",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "id.acontent@html##去读书推荐各位.*|去读书.*com|如果您中途有事.*以便以后接着观看！|\\(|\\)"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🌸 元尊小说",
        "bookSourceUrl": "https://www.yuanzunxs.cc#🎃",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "https://www.yuanzunxs.cc/modules/article/search.php,{\n\"charset\": \"gbk\",\n\"method\": \"POST\",\n\"body\": \"searchkey={{key}}&action=login\"\n}",
        "ruleSearch": {
          "author": "class.author.0@text##作者：",
          "bookList": ".bookbox",
          "bookUrl": ".bookname@a@href",
          "intro": "class.update@text##简介： |\\s",
          "kind": "",
          "lastChapter": "class.cat@text##更新到：",
          "name": "class.bookname@text",
          "wordCount": ""
        },
        "ruleBookInfo": {
          "author": "class.red.0@text",
          "coverUrl": "img@src",
          "intro": "img@text",
          "kind": "class.red.1@text",
          "lastChapter": "class.bookchapter@text##《.*》正文\\s",
          "name": "class.booktitle@text",
          "wordCount": "class.blue.0@text"
        },
        "ruleToc": {
          "chapterList": "id.list-chapterAll@dd@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "class.readcontent@html##\\<!--AD4--\\>|本章未完，点击下一页继续阅读",
          "imageStyle": "0",
          "nextContentUrl": "text.下一页@href"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🍊二次元小说网（刺猬猫菠萝包）壬二酸修复",
        "bookSourceUrl": "https://www.2cyread.com/",
        "bookSourceGroup": "🍬轻小说,🌸女频[优]",
        "searchUrl": "https://www.2cyread.com/search/,{\n  \"body\": \"searchkey={{key}}&searchtype=all&Submit=\",\n  \"charset\": \"UTF-8\",\n  \"method\": \"POST\"\n}",
        "ruleSearch": {
          "author": "tag.div.1@tag.p.0@textNodes",
          "bookList": "class.searchresult",
          "bookUrl": "tag.a.0@href",
          "checkKeyWord": "本武神",
          "coverUrl": "img@src",
          "intro": ".searchresult_p@text",
          "kind": "tag.div.1@tag.p.0@tag.span@textNodes",
          "lastChapter": "tag.div.1@tag.p.2@tag.a@textNodes",
          "name": "h3@text"
        },
        "ruleBookInfo": {
          "author": "",
          "coverUrl": ".novel_info_main@tag.img@src",
          "init": "",
          "intro": ".intro@text",
          "lastChapter": ".novel_info_title@tag.div.0@a.text",
          "name": ".novel_info_title h1@text",
          "tocUrl": ""
        },
        "ruleToc": {
          "chapterList": "id.ul_all_chapters@tag.li@tag.a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": "option@value"
        },
        "ruleContent": {
          "content": "id.article@html||class.content@html",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "",
          "sourceRegex": "",
          "webJs": ""
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.lastChapter：不支持的提取方式：a.text"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🌸 夜伴书屋",
        "bookSourceUrl": "https://www.ybsws.com#🎃",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "https://www.ybsws.com/plus/search.php?q={{key}}",
        "header": "{\"User-Agent\": \"Mozilla/5.0 (Linux; Android 9) Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": "td.1@text",
          "bookList": "tbody tr",
          "bookUrl": "a.0@href",
          "coverUrl": "",
          "intro": "",
          "kind": "0",
          "lastChapter": "",
          "name": "a.0@text##《|》",
          "wordCount": ""
        },
        "ruleBookInfo": {
          "author": "@get:{a}",
          "canReName": "",
          "coverUrl": "@get:{c}",
          "init": "@put:{n:\"[property$=book_name]@content\",\na:\"[property$=author]@content\",\nk:\"[property~=category|status|update_time]@content\",\nl:\"[property$=latest_chapter_name]@content\",\ni:\"[property$=description]@content\",\nc:\"[property$=image]@content\",\nd:\".reader-bar a.-1@href\"}",
          "intro": "@get:{i}",
          "kind": "@get:{k}",
          "lastChapter": "@get:{l}",
          "name": "@get:{n}",
          "tocUrl": "",
          "wordCount": ""
        },
        "ruleToc": {
          "chapterList": "#all-chapter a",
          "chapterName": "text",
          "chapterUrl": "href",
          "isVip": "",
          "isVolume": "",
          "nextTocUrl": "",
          "updateTime": ""
        },
        "ruleContent": {
          "content": "#cont-body p@textNodes",
          "imageStyle": "",
          "nextContentUrl": ".page a@href",
          "replaceRegex": "",
          "sourceRegex": "",
          "webJs": ""
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🌸 笔趣阁江",
        "bookSourceUrl": "http://m.bqgcn.net/",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "http://m.bqgcn.net/search,{\n  \"body\": \"_token=o5ZzhccItnlfVpT6FhpEDu2J67G9O3x4pOSqHLFU&kw={{key}}&submit=\",\n  \"method\": \"POST\"\n}",
        "ruleSearch": {
          "author": ".s3@text",
          "bookList": "dl > li",
          "bookUrl": ".s2@a@href",
          "coverUrl": ".s2@a@href##.+\\D((\\d+)\\d{3})\\D##http://img.bqgcn.com/$2/$1/$1s.jpg###",
          "kind": ".s1@text##\\[|\\]",
          "name": ".s2@text"
        },
        "ruleBookInfo": {
          "coverUrl": ".block_img2@img@src",
          "intro": ".intro_info@text##最新章节推荐.*",
          "kind": "class.block_txt2@p.-2@text&&class.block_txt2@p.-3@text&&class.block_txt2@p.-4@a@text##状态：|更新：",
          "lastChapter": "class.block_txt2@p.-1@a@text",
          "tocUrl": ""
        },
        "ruleToc": {
          "chapterList": ".chapter li a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": "option@value"
        },
        "ruleContent": {
          "content": "#nr1@html",
          "nextContentUrl": "@js:\nvar JsDom = Packages.org.jsoup.Jsoup;\nvar Document = Packages.org.jsoup.nodes.Document;\nvar Element = Packages.org.jsoup.nodes.Element;\n\nvar document = JsDom.parse(src);\n\nvar png = /next.png/.test(src);\nvar matchResult = src.match(/eval(.function.*)/);\nvar next = matchResult ? matchResult[1] : \"\";\nvar url = next ? eval(next) : \"\";\njava.log(url);\n\nif (url) {\n    \n    var nextChapterElement = document.select(\"*:contains(下一章)\").first();\n    \n    if (nextChapterElement) {\n        java.log(\"找到下一章，停止执行。\");\n    } else {\n        eval(url.replace(/var/, \"\"));\n    }\n}\n\n",
          "replaceRegex": "##本章未完，.*|《.*》,牢记网址.*"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "正文规则.nextContentUrl用了 @js:",
          "正文规则.nextContentUrl用了 java.*",
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🌸 果露小说",
        "bookSourceUrl": "https://www.guolu78.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "{{cookie.removeCookie(source.getKey())}}/modules/article/search.php,{\n  \"body\": \"searchkey={{key}}\",\n  \"charset\": \"GBK\",\n  \"method\": \"POST\"\n}",
        "header": "{\n\t\"User-Agent\":\"Mozilla/5.0 (Linux; Android 12.0; wv) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/4.0 Chrome/58.0.3029.110 Mobile Safari/537.36 T7/10.3 SearchCraft/2.6.2 (Baidu; P1 7.0)\"\n}",
        "ruleSearch": {
          "author": "class.author@text##作者.",
          "bookList": "class.bookbox",
          "bookUrl": "a@href",
          "checkKeyWord": "怪物来了",
          "coverUrl": "a@href##\\/((\\d{2})\\d+)\\/##https://www.guolu78.com/files/article/image/$2/$1/$1s.jpg###",
          "intro": "class.update@textNodes",
          "kind": "",
          "lastChapter": "class.cat@a@text",
          "name": "class.bookname@tag.a@text"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "[property=\"og:image\"]@content",
          "intro": "[property=\"og:description\"]@content",
          "kind": "[property~=category|status]@content",
          "lastChapter": "[property=\"og:novel:latest_chapter_name\"]@content",
          "name": "[property=\"og:novel:book_name\"]@content",
          "wordCount": ".blue.0@text"
        },
        "ruleToc": {
          "chapterList": "#list-chapterAll dd a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "class.readcontent@textNodes##推荐阅读：《.*?》",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##-->>\\s"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🌸幻想姬网",
        "bookSourceUrl": "https://www.huanxiangji.com/",
        "bookSourceGroup": "🌸女频[优]",
        "searchUrl": "{{cookie.removeCookie(source.getKey())}}/modules/article/search.php,{\n  \"body\": \"searchkey={{key}}\",\n  \"charset\": \"GBK\",\n  \"method\": \"POST\"\n}",
        "header": "{\"User-Agent\": \"Mozilla/5.0 (Linux; Android 9) Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": ".s4@text",
          "bookList": ".txt-list-row5 li!0",
          "bookUrl": "a.0@href##http##https",
          "coverUrl": "a.0@href<js>\nvar id = result.match(/(\\d+)\\/?$/)[1];\nvar iid = parseInt(id/1000);\n'https://www.huanxiangji.com/files/article/image/'+iid+'/'+id+'/'+id+'s.jpg';\n</js>",
          "kind": ".s1@text&&.s5@text##\\[|\\]|小说",
          "lastChapter": "a.1@text",
          "name": "a.0@text"
        },
        "ruleBookInfo": {
          "author": ".info p.0@text",
          "coverUrl": ".imgbox img@src",
          "init": "",
          "intro": ".desc@html",
          "kind": ".info p.1:2:4@text##.*：|小说|\\s.*",
          "lastChapter": "class.section-list.0@a.0@text",
          "name": ".top h1@text"
        },
        "ruleToc": {
          "chapterList": "#section-list li a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "#content@html",
          "replaceRegex": "##[????]|\\♂.*|\\<<.*>>|\\<<.*<<|小说免费.*平台|.*分享给你们的好友！|https.*\\/|.*天才一秒记住本站地址.*"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.coverUrl用了 <js>"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "全本同人",
        "bookSourceUrl": "https://qbtr.cc",
        "bookSourceGroup": "🍬轻小说,🌸女频[优]",
        "searchUrl": "/e/search/index.php,{\n  \"charset\": \"gb2312\",\n  \"method\": \"POST\",\n  \"body\": \"keyboard={{key}}&show=title&classid=0\"\n}",
        "header": "",
        "ruleSearch": {
          "author": ".booknews@ownText##.*：",
          "bookList": ".bk",
          "bookUrl": "a.0@href",
          "coverUrl": "img@src",
          "intro": "p@text##简介.",
          "kind": "label@text",
          "lastChapter": "h3@text##\\S+\\(|\\)",
          "name": "h3@text##\\(\\S+"
        },
        "ruleBookInfo": {
          "author": ".date span@text##.*：",
          "coverUrl": ".pic img@src",
          "init": "",
          "intro": ".infos p@html",
          "kind": ".menNav a.1@text&&.date@textNodes##.*：|小说",
          "lastChapter": ".book_list a.-1@text",
          "name": ".infos h1@text##\\(\\S+"
        },
        "ruleToc": {
          "chapterList": ".book_list a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": ".read_chapterDetail@html",
          "nextContentUrl": ""
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🍒休闲文学吧",
        "bookSourceUrl": "https://www.xxwx8.com/",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "https://www.xxwx8.com/xxlist/{{key}}_{{page}}.html",
        "ruleSearch": {
          "author": "td.1@a@text",
          "bookList": "table@tbody@tr!0",
          "bookUrl": "a.0@href",
          "checkKeyWord": "我的模拟长生路",
          "coverUrl": "a.0@href##xxbook\\/(.*)\\.html##https://www.xxwx8.com/images/xxid/$1.jpg###",
          "kind": "td.-1@text##\\/##-",
          "lastChapter": "{{@@td.-2@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求含理更谢乐发推票盟补加字].*?[】）\\)]}}•{{@@td.-1@text}}\n@js:result\n.replace(\"••\",\"\")\n.replace(/^(\\d+).第/,'第')\n.replace(/\\//g,'-')\n.replace(/^(\\d+)[、．]第.+章/,'第$1章')\n.replace(/^(\\d+)、\\d+、/,'第$1章 ')\n.replace(/^(\\d+)、\\d+/,'第$1章')\n.replace(/^(\\d+)、/,'第$1章 ')\n.replace(/^(第.+章)\\s?第.+章/,'$1')\n.replace(/第\\s(.+)\\s章/,'第$1章')\n.replace(/.*(chapter|Chapter)\\s?(\\d+)\\s?/,'$1 $2 ')\n.replace(/\\(.+\\)/,'')\n.replace(/\\[|。/,'')\n.replace(/第([零一二两三四五六七八九十百千]+)章/g,java.toNumChapter(result))\n##(章)([^\\s]+)(\\s·)##$1 $2$3",
          "name": "td.0@a@text"
        },
        "ruleBookInfo": {
          "author": ".nbs_1.0@a@text",
          "coverUrl": "img.4@src##^##https://www.xxwx8.com",
          "intro": "🕰  更新：\n{{@@table.0@tbody@tr@td.-1@text}}\n📜  简介：\n{{@@div.35@text##.*【内容简介】|【最新章节】.*}}##(^|[。！？……；]+[”」）】]?)##$1<br>",
          "kind": "{{@@.nbs_1.1@a@text}}\n{{@@table.0@tbody@tr@td.-1@text}}",
          "lastChapter": "{{@@table.0@tbody@tr@td.1@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求含理更谢乐发推票盟补加字].*?[】）\\)]}}•{{@@table.0@tbody@tr@td.-1@text}}\n@js:result\n.replace(\"••\",\"\")\n.replace(/^(\\d+).第/,'第')\n.replace(/^(\\d+)[、．]第.+章/,'第$1章')\n.replace(/^(\\d+)、\\d+、/,'第$1章 ')\n.replace(/^(\\d+)、\\d+/,'第$1章')\n.replace(/^(\\d+)、/,'第$1章 ')\n.replace(/^(第.+章)\\s?第.+章/,'$1')\n.replace(/第\\s(.+)\\s章/,'第$1章')\n.replace(/.*(chapter|Chapter)\\s?(\\d+)\\s?/,'$1 $2 ')\n.replace(/\\(.+\\)/,'')\n.replace(/\\[|。/,'')\n.replace(/第([零一二两三四五六七八九十百千]+)章/g,java.toNumChapter(result))\n##(章)([^\\s]+)(\\s·)##$1 $2$3",
          "name": "h1@text",
          "tocUrl": "{{baseUrl}}##xxbook##xxchapter"
        },
        "ruleToc": {
          "chapterList": ".chapterlist@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": ".ReadContents@html",
          "replaceRegex": "##{{book.name}}\\s.*|.*{{book.name}}目录.*"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.lastChapter用了 @js:",
          "搜索规则.lastChapter用了 java.*",
          "详情规则.lastChapter用了 @js:",
          "详情规则.lastChapter用了 java.*",
          "详情规则.tocUrl：模板里是脚本表达式：{{baseUrl}}"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "哎呦文学",
        "bookSourceUrl": "https://www.auwxw.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/aulist/{{key}}.html",
        "ruleSearch": {
          "author": ".right_wid a:nth-child(2)@text",
          "bookList": "#ListContents > div:nth-child(n+1)",
          "bookUrl": "a@href",
          "coverUrl": "img@src",
          "intro": ".neirongh5 > a@text",
          "kind": ".right_wid > .biaoqian > a@text",
          "lastChapter": "div:nth-child(4) > a@text##最新章节",
          "name": ".right_wid .fonttext@text"
        },
        "ruleBookInfo": {
          "author": "[property$=author]@content",
          "coverUrl": "[property$=image]@content",
          "init": "",
          "intro": "[property$=description]@content",
          "kind": "[property~=category|status|update_time]@content",
          "lastChapter": "[property$=latest_chapter_name]@content",
          "name": "[property$=book_name]@content",
          "tocUrl": "text.阅读目录@href"
        },
        "ruleToc": {
          "chapterList": "div:nth-child(n+5) > span:nth-child(n+1) > a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": ""
        },
        "ruleContent": {
          "content": "#Lab_Contents@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "懒人小说",
        "bookSourceUrl": "http://m.lazytxt.shop:8081",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "http://m.lazytxt.shop:8081/s.php,{\n  \"body\": \"s={{key}}&type=articlename\",\n  \"method\": \"POST\",\n  \"charset\": \"GBK\"\n}",
        "header": "{\n  \"User-Agent\": \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36\"\n}",
        "ruleSearch": {
          "author": "span@text",
          "bookList": ".sone",
          "bookUrl": "a.0@href",
          "name": "a.0@text"
        },
        "ruleBookInfo": {
          "author": ".infotype@p.0@a@text",
          "coverUrl": ".pic@img@src",
          "intro": ".intro@p@html",
          "kind": ".infotype@p.1@text##类型：",
          "lastChapter": ".infotype@p.-1@a@text",
          "name": ".cataloginfo@h3@text",
          "tocUrl": "text.章节目录@href##\\/m##/www"
        },
        "ruleToc": {
          "chapterList": ".book_list@ul@li@a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": "text.下一页@href"
        },
        "ruleContent": {
          "content": "#htmlContent@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "书海阁小说",
        "bookSourceUrl": "https://m.shuhaige.tw",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/search.html,{\n  \"body\": \"searchkey={{key}}\",\n  \"method\": \"POST\"\n}",
        "header": "",
        "ruleSearch": {
          "bookList": "class.layui-btn-container@a",
          "bookUrl": "href",
          "name": "text"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "[property=\"og:image\"]@content",
          "intro": "[property=\"og:description\"]@content##.*观看小说:",
          "kind": "[property~=category|status|update_time]@content",
          "lastChapter": "[property~=las?test_chapter_name]@content",
          "name": "[property=\"og:novel:book_name\"]@content",
          "tocUrl": "text.章节列表@href"
        },
        "ruleToc": {
          "chapterList": "class.read@li",
          "chapterName": "a@text",
          "chapterUrl": "a@href",
          "nextTocUrl": "option@value"
        },
        "ruleContent": {
          "content": "class.content@p!0@html",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##.*点击下一页继续阅读.*|喜.*书海阁.*"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "乐文小说网",
        "bookSourceUrl": "http://www.lwxs.net",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/search.php?q={{key}}&p={{page}}",
        "header": "{\n  \"User-Agent\": \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36\"\n}",
        "ruleSearch": {
          "author": "span.0@text",
          "bookList": ".col-md-6!0",
          "bookUrl": "a.0@href",
          "checkKeyWord": "剑来",
          "coverUrl": "img@src",
          "lastChapter": "dd.-1@a@text",
          "name": "h3@a@text##\\[.*\\]"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "[property=\"og:image\"]@content##\\/\\/",
          "intro": "[property=\"og:description\"]@content",
          "kind": "[property~=category|status|update_time]@content",
          "lastChapter": "[property~=las?test_chapter_name]@content",
          "name": "[property=\"og:novel:book_name\"]@content",
          "tocUrl": "{{baseUrl}}index_1.html"
        },
        "ruleToc": {
          "chapterList": ".book_list2@ul@li@a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": ".page-link.-1@href\n@js:\nif (res = String(result).match(/_(\\d+)/)) {\n  data = [];\n  for (i = 2; i <= res[1]; i++) {\n    data.push(baseUrl.replace(/index_1\\.html/g, \"index_\" + i + \".html\"));\n  }\n  data; // 明确返回结果\n}"
        },
        "ruleContent": {
          "content": ".font_max@html##第\\(.*页|<title[\\s\\S]+?</title>|.*com|.*net|.*cc|.*org",
          "nextContentUrl": "text.下一@href"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "目录规则.nextTocUrl用了 @js:",
          "详情规则.tocUrl：模板里是脚本表达式：{{baseUrl}}"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "无限小说网",
        "bookSourceUrl": "https://m.guihutech.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/book/search.aspx?key={{key}}&type=articlename",
        "header": "{\n  \"User-Agent\": \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36\"\n}",
        "ruleSearch": {
          "author": "a.2@text",
          "bookList": ".search_list",
          "bookUrl": "a.0@href",
          "coverUrl": "a.0@href##.*\\/0\\/(\\d+)\\/.*##http://m.guihutech.com/img/$1.jpg",
          "lastChapter": "a.1@text",
          "name": "a.0@text"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "[property=\"og:image\"]@content",
          "intro": "[property=\"og:description\"]@content",
          "kind": "[property~=category|status|update_time]@content",
          "lastChapter": "[property~=las?test_chapter_name]@content",
          "name": "[property=\"og:novel:book_name\"]@content",
          "tocUrl": ""
        },
        "ruleToc": {
          "chapterList": "ul.1@li@a",
          "chapterName": "text",
          "chapterUrl": "href##$##,{'webView': true}"
        },
        "ruleContent": {
          "content": ".novelcontent@html##\\<div.*|内容未完，.*|【本章阅读完毕.*",
          "nextContentUrl": "text.下一页@href##$##,{'webView': true}"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "笔趣阁",
        "bookSourceUrl": "https://m.biquge345.com",
        "bookSourceGroup": "🍀起点源",
        "searchUrl": "/waps.php,{\n  \"body\": \"s={{key}}\",\n  \"charset\": \"UTF-8\",\n  \"method\": \"POST\"\n}",
        "ruleSearch": {
          "author": "span[1]@text",
          "bookList": ".liebiao2 li",
          "bookUrl": "a@href",
          "checkKeyWord": "斗罗大陆",
          "name": "span[0]@text"
        },
        "ruleBookInfo": {
          "coverUrl": "img@src@js:url=\"https://m.biquge345.com\"+result",
          "intro": ".jianjie@p@text",
          "kind": ".p2@li[1:2:3]@text##(类型|状态|更新)："
        },
        "ruleToc": {
          "chapterList": ".mululist ul li a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": "text.下一页@href"
        },
        "ruleContent": {
          "content": "#txt@html",
          "nextContentUrl": "text下一页@href",
          "replaceRegex": "##一秒记住【.*】|.*更新快，无弹窗！"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.coverUrl用了 @js:",
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "耽美小说网",
        "bookSourceUrl": "https://m.bengben.com/",
        "bookSourceGroup": "🌸女频[优]",
        "searchUrl": "https://m.bengben.com/s.php,{\n  \"body\": \"type=articlename&s={{key}}&submit=%CB%D1%CB%F7\",\n  \"charset\": \"GBK\",\n  \"method\": \"POST\"\n}",
        "header": "{\"User-Agent\": \"Mozilla/5.0 (Linux; Android 9) Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": "p.2@a@text",
          "bookList": "class.block",
          "bookUrl": "h2@a@href",
          "checkKeyWord": "柯南",
          "coverUrl": "class.block_img@img@src",
          "kind": "p.3@a@text",
          "lastChapter": "p.4@a@text",
          "name": "h2@a@text"
        },
        "ruleBookInfo": {
          "author": "class.block_txt@p.2@a@text",
          "coverUrl": "img@src",
          "intro": "{{@class.block_txt@p[4:5]@text}}\n{{@class.intro_info@text}}",
          "kind": "class.block_txt@p.3@a@text",
          "lastChapter": "class.block_txt@p.6@a@text",
          "name": "class.block_txt@h2@a@text"
        },
        "ruleToc": {
          "chapterList": "class.chapter.1@li@a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": "class.right@a@href"
        },
        "ruleContent": {
          "content": "id.nr1@html",
          "nextContentUrl": "id.pt_next1@href"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro：模板里是脚本表达式：{{@class.block_txt@p[4:5]@text}}"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🌸若晨文学",
        "bookSourceUrl": "https://m.ruochenwenxue.com",
        "bookSourceGroup": "🌸女频[优]",
        "searchUrl": "https://m.ruochenwenxue.com/modules/article/search.php,{\n\t\"method\":\"POST\",\n\t\"body\":\"searchtype=all&searchkey={{key}}\"\n\t}",
        "ruleSearch": {
          "author": "class.gray@text##\\s*\\|.*",
          "bookList": "class.c_row",
          "bookUrl": "tag.a.0@href",
          "coverUrl": "tag.img@src",
          "intro": "class.gray@html##.*<br>",
          "kind": "",
          "lastChapter": "",
          "name": "h4@text"
        },
        "ruleBookInfo": {
          "author": "##字</span>(.*?) 著##$1###",
          "coverUrl": "",
          "init": "",
          "intro": "class.introa@html",
          "kind": "",
          "lastChapter": "class.c_row nw@a@text",
          "name": "class.mbs@ownText##《|》",
          "tocUrl": "text.目录@href##index/(\\d+)##https://www.ruochenwenxue.com/index/$1###",
          "wordCount": "##(\\d+)字</span>##$1###"
        },
        "ruleToc": {
          "chapterList": "class.index@dd@a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": "",
          "updateTime": ""
        },
        "ruleContent": {
          "content": "id.acontent@html",
          "nextContentUrl": "",
          "replaceRegex": ""
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "完本小说网🎃",
        "bookSourceUrl": "https://www.finalbooks.work#🎃",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "https://www.finalbooks.work/search/{{key}}/{{page}}",
        "ruleSearch": {
          "author": "span.2@text",
          "bookList": "class.SHsectionThree-middle@p",
          "bookUrl": "a.1@href",
          "checkKeyWord": "快穿",
          "kind": "span.0@text##\\[|\\]",
          "name": "span.1@text"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "[property=\"og:image\"]@content",
          "intro": "[property=\"og:description\"]@content\n##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": "[property=\"og:novel:category\"]@content&&\n[property=\"og:novel:status\"]@content&&\n[property=\"og:novel:update_time\"]@content",
          "lastChapter": "{{@@[property$=chapter_name]@content}}･{{@@[property$=update_time]@content##\\s.*}}\n@js:result\n.replace(\"••\",\"\")\n.replace(/^(\\d+).第/,'第')\n.replace(/^(正文|VIP章节|最新章节)?(\\s+|_)|[\\(\\{（｛【].*[求含理更谢乐发推票盟补加字Kk\\/].*/g,'')\n.replace(/^(\\d+)[、．]第.+章/,'第$1章')\n.replace(/^(\\d+)、\\d+、/,'第$1章 ')\n.replace(/^(\\d+)、\\d+/,'第$1章')\n.replace(/^(第.+章)\\s?\\d+/,'$1')\n.replace(/^(\\d+)、/,'第$1章 ')\n.replace(/^(第.+章)\\s?第.+章/,'$1')\n.replace(/第\\s(.+)\\s章/,'第$1章')\n.replace(/.*(chapter|Chapter)\\s?(\\d+)\\s?/,'$1 $2 ')\n.replace(/\\(.+\\)/,'')\n.replace(/\\[|。/,'')\n.replace(/第([零一二两三四五六七八九十百千]+)章/g,java.toNumChapter(result))\n##(章)([^\\s]+)(\\s·)##$1 $2$3",
          "name": "[property=\"og:novel:book_name\"]@content",
          "tocUrl": "text.查看全部章节@href"
        },
        "ruleToc": {
          "chapterList": "ol@class.BCsectionTwo-top@li",
          "chapterName": "a@text",
          "chapterUrl": "a@href##$##,{\"webView\": true}",
          "nextTocUrl": "text.下一页@href"
        },
        "ruleContent": {
          "content": "class.RBGsectionThree-content@html",
          "nextContentUrl": ""
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.lastChapter用了 @js:",
          "详情规则.lastChapter用了 java.*"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🌸八一中文",
        "bookSourceUrl": "https://www.zwduxs.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "https://www.zwduxs.com/modules/article/search.php?searchkey={{key}}&searchtype=articlename",
        "ruleSearch": {
          "author": "class.odd.1@text",
          "bookList": "class.grid@tag.tr!0",
          "bookUrl": "class.odd.0@tag.a.0@href",
          "lastChapter": "class.even.0@tag.a.0@text",
          "name": "class.odd.0@tag.a.0@text"
        },
        "ruleBookInfo": {
          "author": "id.info@tag.p.0@text##作\\s*者：",
          "coverUrl": "id.fmimg@tag.img.0@src",
          "intro": "id.intro@text",
          "name": "id.info@tag.h1.0@text"
        },
        "ruleToc": {
          "chapterList": "id.list@tag.dd",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "id.content@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "免费读网",
        "bookSourceUrl": "https://www.mianfeidu.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/search.html?keyword={{key}}",
        "ruleSearch": {
          "author": "dd@p.0@a.0@text",
          "bookList": "class.secd-rank-list",
          "bookUrl": "class.bigpic-book-name@href",
          "checkKeyWord": "汉",
          "coverUrl": "dt@a@img@data-original",
          "intro": "class.big-book-info@text",
          "kind": "dd@p.0@a.1@text&&class.clicknum@em[0,1,2]@text",
          "lastChapter": "dd@p.-1@a@text##最近更新\\s",
          "name": "class.bigpic-book-name@text"
        },
        "ruleBookInfo": {
          "name": ""
        },
        "ruleToc": {
          "chapterList": "class.cate-list@li@a",
          "chapterName": ".chapter_name@text",
          "chapterUrl": "href",
          "updateTime": ".chapter_date@text"
        },
        "ruleContent": {
          "content": "class.read-content j_readContent@html"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🌸七七读书",
        "bookSourceUrl": "http://www.77shuku.net",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/modules/article/search.php?searchkey={{key}}",
        "ruleSearch": {
          "author": "tag.td.5@text||class.shu_xinxi@h4@small@text",
          "bookList": "class.BOX@tag.tr!0||class.shu_cont@children",
          "bookUrl": "class.red@href||class.shu_xinxi@h4@a@href",
          "coverUrl": "img@src|class.red@href<js>'/files/article/image'+String(result).replace(/.*?(\\d*?)(\\d{1,3})\\//,'/$1/$1$2/$1$2s.jpg').replace('//','/0/')</js>",
          "kind": "tag.td.1@text##\\[|\\]",
          "lastChapter": "tag.td.3@text",
          "name": "tag.td.2@text||class.shu_xinxi@h4@a@text##搜索关键词.*"
        },
        "ruleBookInfo": {
          "coverUrl": "tag.img.1@src",
          "init": "",
          "intro": "id.intro@text",
          "lastChapter": "class.update@a@text",
          "name": "tag.h1@text##搜索关键词.*"
        },
        "ruleToc": {
          "chapterList": "class.zjlist@tag.dd",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "id.ChapterContents@html##(txt下载地址：|更新速度最快赶|全集txt下载)[\\s\\S]+"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.coverUrl用了 <js>"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "九五小说",
        "bookSourceUrl": "http://www.xfjxs.com#",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/modules/article/search.php?ie=gbk&searchkey={{key}}&ct=2097152",
        "ruleSearch": {
          "author": "td.2@text",
          "bookList": "tbody tr!0",
          "bookUrl": "a.0@href",
          "coverUrl": "a.0@href##.+\\D((\\d+)\\d{3})\\D##http://www.xfjxs.com/files/article/image/$2/$1/$1s.jpg###",
          "kind": "td.5:4@text",
          "lastChapter": "td.1@text##[\\(（【].*?[求更票谢乐发订合补加].*?[】）\\)]",
          "name": "td.0@text",
          "wordCount": "td.3@text"
        },
        "ruleBookInfo": {
          "author": ".author a@text",
          "coverUrl": ".con_limg img@src",
          "intro": ".r_cons@html",
          "kind": ".txt_nav a.1@text&&.lastrecord@ownText##小说|.*\\(|\\).*",
          "lastChapter": ".lastrecord a@text##[\\(（【].*?[求更票谢乐发订合补加].*?[】）\\)]",
          "name": "h1@text",
          "tocUrl": ".r_tools a.1@href"
        },
        "ruleToc": {
          "chapterList": ".novel_list dd a",
          "chapterName": "text##[\\(（【].*?[求更票谢乐发订合补加].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "#content@textNodes",
          "replaceRegex": "##\\.pbtxt."
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "无限小说",
        "bookSourceUrl": "http://www.txt97.org",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "{{cookie.removeCookie(source.getKey())}}/search07.html?searchkey={{key}}&searchtype=all",
        "header": "",
        "ruleSearch": {
          "author": "p.0@html##<\\/i>(.+)<span##$1###",
          "bookList": ".searchresult",
          "bookUrl": "a@href",
          "coverUrl": ".lazy@data-original",
          "intro": ".searchresult_p@text",
          "kind": ".img_span@span@text",
          "lastChapter": "p.-1@text",
          "name": "h3@text",
          "wordCount": ".s_gray@html##\\>(.+)\\&n##$1###"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "init": "meta",
          "intro": "[property=\"og:description\"]@content",
          "kind": "[property=\"og:novel:category\"]@content",
          "lastChapter": "[property=\"og:novel:lastest_chapter_name\"]@content",
          "name": "[property=\"og:title\"]@content"
        },
        "ruleToc": {
          "chapterList": "#ul_all_chapters li a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": ".content@html",
          "nextContentUrl": "text.下一页@href"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "星星小说网",
        "bookSourceUrl": "http://www.xxtxt.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "http://www.xxtxt.com/search.php?q={{key}},{\n  \"method\": \"GET\"\n}",
        "ruleSearch": {
          "author": ".book_other.0@span.0@text",
          "bookList": "class.col-12 col-md-6",
          "bookUrl": "a.0@href",
          "checkKeyWord": "",
          "coverUrl": "img@src",
          "kind": ".book_other.1:2@text##.*：|.*：",
          "lastChapter": ".book_other.3@a@text",
          "name": "h3@a@text##.*\\]"
        },
        "ruleBookInfo": {
          "author": "[property$=author]@content",
          "coverUrl": "[property$=image]@content",
          "intro": "[property$=description]@content",
          "kind": "[property~=category|status|update_time]@content",
          "lastChapter": "{{@@[property$=chapter_name]@content}}\n@js:result\n.replace(\"••\",\"\")\n.replace(/^(\\d+).第/,'第')\n.replace(/^(正文|VIP章节|最新章节)?(\\s+|_)|[\\(\\{（｛【].*[求含理更谢乐发推票盟补加字Kk\\/].*/g,'')\n.replace(/^(\\d+)[、．]第.+章/,'第$1章')\n.replace(/^(\\d+)、\\d+、/,'第$1章 ')\n.replace(/^(\\d+)、\\d+/,'第$1章')\n.replace(/^(第.+章)\\s?\\d+/,'$1')\n.replace(/^(\\d+)、/,'第$1章 ')\n.replace(/^(第.+章)\\s?第.+章/,'$1')\n.replace(/第\\s(.+)\\s章/,'第$1章')\n.replace(/.*(chapter|Chapter)\\s?(\\d+)\\s?/,'$1 $2 ')\n.replace(/\\(.+\\)/,'')\n.replace(/\\[|。/,'')\n.replace(/第([零一二两三四五六七八九十百千]+)章/g,java.toNumChapter(result))\n##(章)([^\\s]+)(\\s·)##$1 $2$3",
          "name": "[property$=book_name]@content",
          "tocUrl": ""
        },
        "ruleToc": {
          "chapterList": ".book_list2 li a",
          "chapterName": "text",
          "chapterUrl": "href",
          "isPay": "",
          "isVip": "",
          "nextTocUrl": ".page-link@a@href\n@js:\nnext = [];\nurl = result[0];\nlength = result.length;\np = src.match(/page-link\">1\\/(\\d+)/)||[];\npage = Number(p[1]);\nif(length < page){\n\tfor(i = 2; i <= page; i++){\n\t\tlink = String(url).replace(/_\\d+/,`_${i}`);\n\t\tnext.push(link)\n\t\t}\n\t\tnext;\n\t}else result"
        },
        "ruleContent": {
          "content": "class.font_max@html",
          "nextContentUrl": "text.下一@href",
          "replaceRegex": ""
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.lastChapter用了 @js:",
          "详情规则.lastChapter用了 java.*",
          "目录规则.nextTocUrl用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🎉 狗狗书籍",
        "bookSourceUrl": "http://www.qiushu.info",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/search.php,{\n  \"method\": \"post\",\n  \"body\": \"searchkey={{key}}\"\n}",
        "ruleSearch": {
          "author": ".t2@text##\\s更新.*",
          "bookList": ".read_list@li",
          "bookUrl": ".t1@a@href",
          "checkKeyWord": "",
          "coverUrl": "img@src",
          "intro": ".t3@text",
          "kind": ".text@text&&.rl@text##.*时间.",
          "lastChapter": ".tl@a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".t1@a@text##《|》|最新章节"
        },
        "ruleBookInfo": {
          "author": ".author@text##.*\\/",
          "coverUrl": ".book_cover@img@src##img##www",
          "intro": ".intro@p!0:-1:-2:-3@text##(^|[。！？]+[”」）】]?)##$1<br>@js:result.replace(/【展开】|【收起】/g,\"\")",
          "kind": ".nowplace@ownText&&id.view_new@text##.*>\\s|\\s>|.*时间.|\\s..:.*",
          "lastChapter": ".book_con_list[0]@a.0@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".book_cover@a@text##最新章节"
        },
        "ruleToc": {
          "chapterList": ".book_con_list@li@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.content@textNodes"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🎉 精品小说",
        "bookSourceUrl": "https://jpxs123.cc",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/e/search/indexsearch.php,{\n  \"charset\": \"gb2312\",\n  \"method\": \"post\",\n  \"body\": \"keyboard={{key}}&show=title&classid=0\"\n}",
        "ruleSearch": {
          "author": ".booknews@ownText",
          "bookList": ".bk",
          "bookUrl": "a.0@href",
          "coverUrl": "img@src",
          "intro": "p@text##简介.",
          "kind": ".date@text",
          "lastChapter": "",
          "name": "h3@text##\\(.*",
          "wordCount": ".size@text"
        },
        "ruleBookInfo": {
          "author": ".date@a@text",
          "coverUrl": ".pic@img@src",
          "intro": ".infos@p@text##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": ".menNav@a.1@text&&.date@span.1@text&&.date@textNodes##小说|.*：",
          "name": ".infos@h1@text##\\(.*",
          "wordCount": ""
        },
        "ruleToc": {
          "chapterList": ".clearfix@li@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": ".read_chapterDetail@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🎉 歌书小说",
        "bookSourceUrl": "http://m.gashuw.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/s.php,{\n  \"body\": \"keyword={{key}}&t=1\",\n  \"method\": \"post\"\n}",
        "ruleSearch": {
          "author": "p.1@text##.*：",
          "bookList": ".hot_sale",
          "bookUrl": "a@href",
          "coverUrl": "a@href##.+\\D((\\d+)\\d{3})\\D##http://image.gashuw.com/$2/$1/$1s.jpg###",
          "kind": "p.1:2@text##小说|\\s.*",
          "lastChapter": "p.2@text##.*：|正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "p.0@text"
        },
        "ruleBookInfo": {
          "author": ".synopsisArea_detail@p.0@text",
          "coverUrl": ".synopsisArea_detail@img@src",
          "intro": ".review@text##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": ".synopsisArea_detail@p.1:2:4@text##.*：|小说",
          "lastChapter": ".directoryArea@a.0@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "span.title@text"
        },
        "ruleToc": {
          "chapterList": ".directoryArea@p@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href",
          "nextTocUrl": ".right@a@href"
        },
        "ruleContent": {
          "content": "id.chaptercontent@textNodes",
          "nextContentUrl": "id.pt_next@href",
          "replaceRegex": "##\\s*.*点击下一页.*\\s*|www.gebiqu.com"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "盗文阁",
        "bookSourceUrl": "https://www.daowenge.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "https://www.daowenge.com/search.html,{\n  \"body\": \"searchkey={{key}}\",\n  \"charset\": \"UTF-8\",\n  \"method\": \"POST\"\n}",
        "ruleSearch": {
          "author": "span.1@text",
          "bookList": "class.pr pb20 mb20",
          "bookUrl": "a.1@href",
          "coverUrl": "img@_src",
          "intro": "p.0@text",
          "kind": "span.0@text",
          "lastChapter": "a.-1@text",
          "name": "a.1@text"
        },
        "ruleBookInfo": {
          "author": "class.mr15 ttl@text",
          "coverUrl": "img.1@src",
          "intro": "class.h112 mb15 det-abt lh1d8 c_strong fs16 hm-scroll@text",
          "kind": "class.mr15 ttc@text",
          "lastChapter": "class.fs16 c_strong@a.0@text",
          "name": "class.mb15 lh1d2 oh@text"
        },
        "ruleToc": {
          "chapterList": "ol@li",
          "chapterName": "a.0@text",
          "chapterUrl": "a.0@href"
        },
        "ruleContent": {
          "content": "id.TextContent@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🎉 独步小说",
        "bookSourceUrl": "https://www.dbxsn.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/plus/search.php?q={{key}}",
        "header": "{\n  'User-Agent': 'Mozilla/5.0 (Linux; Android 9; PDBM00 Build/PPR1.180610.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/70.0.3538.110 Mobile Safari/537.36'\n}",
        "ruleSearch": {
          "author": "td.1@text",
          "bookList": ".table@tbody@tr",
          "bookUrl": "a.0@href",
          "checkKeyWord": "",
          "coverUrl": "a.0@href<js>\nvar id = result.match(/(\\d+)\\/?$/)[1];\n'/uploads/cover/'+id+'s.jpg';\n</js>",
          "intro": "",
          "kind": "",
          "lastChapter": "",
          "name": "a.0@text##《|》"
        },
        "ruleBookInfo": {
          "author": ".media-body@a.1@text",
          "coverUrl": ".book-img-middel@src",
          "init": "",
          "intro": ".book-detail@text##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": ".col-md-4@text##.*：|\\s..:.*",
          "lastChapter": ".media-body@a.2@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".book-name@a@text",
          "wordCount": ""
        },
        "ruleToc": {
          "chapterList": "id.all-chapter@div@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.cont-body@html  ",
          "nextContentUrl": ".page@a@href"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.coverUrl用了 <js>"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🎉 唐三中文",
        "bookSourceUrl": "http://www.xtangsanshu.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/s.php?ie=utf-8&s=&q={{key}}",
        "ruleSearch": {
          "author": ".author@text",
          "bookList": ".bookbox",
          "bookUrl": "a.0@href",
          "coverUrl": "img@src",
          "kind": ".cat@text##.*：|小说",
          "lastChapter": ".update@a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".bookname@text"
        },
        "ruleBookInfo": {
          "author": ".small@span.0@text",
          "coverUrl": ".cover@img@src",
          "intro": ".intro@textNodes##(^|[。！？]+[”」）】]?)##$1<br>@js:result.replace(/作者.*《.*|无弹窗推荐.*/g,\"\")",
          "kind": ".small@span.1:2:4@text##小说|.*：|\\s..:.*",
          "lastChapter": ".last@a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".info@h2@text",
          "wordCount": ".small@span.3@text##.*："
        },
        "ruleToc": {
          "chapterList": ".listmain@dd@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.content@html",
          "replaceRegex": "##\\s*http.*//.*\\s*|\\s*请记住本书首.*\\s*"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🎉 蚂蚁阅读",
        "bookSourceUrl": "http://www.mayitxt.org",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/modules/article/search.php?q={{key}}&searchtype=all&s=17333194950446968473",
        "header": "{\n    \"User-Agent\": \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36\"\n}",
        "ruleSearch": {
          "author": "span@text",
          "bookList": "tbody@tr!0",
          "bookUrl": "a.1@href",
          "checkKeyWord": "",
          "coverUrl": "a.1@href##.+\\D((\\d+)\\d{3})\\D##/files/article/image/$2/$1/$1s.jpg###",
          "kind": "a.0@text&&td.6:4@text##\\[|\\]",
          "lastChapter": "a.2@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "a.1@text##全文.*",
          "wordCount": ""
        },
        "ruleBookInfo": {
          "author": ".author[0]@text",
          "coverUrl": "img.0@src",
          "init": "",
          "intro": ".breviary@html",
          "kind": ".data_list@i.0@text&&.list@i@text##\\s.*",
          "lastChapter": ".list@a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "id.main_title@h1@text##全文.*",
          "tocUrl": ".button_list@a.2@href",
          "wordCount": ".data_list@em.0@text##字"
        },
        "ruleToc": {
          "chapterList": ".float-list@li",
          "chapterName": "a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "a@href",
          "isVip": "",
          "updateTime": "createdate"
        },
        "ruleContent": {
          "content": "id.ChapterContents@html",
          "imageStyle": "",
          "replaceRegex": "##一秒记住.*|免费小说.*|.本章完.|正在手打中.*|.*蚂蚁阅读.*|.*精华书阁.*|为您提供.*好书签.|.*免费阅读.|\\s*最新网址：.*\\s*"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🎉 抖音小说",
        "bookSourceUrl": "https://www.douyinxs.com",
        "bookSourceGroup": "⭐正版源",
        "searchUrl": "{{cookie.removeCookie(source.getKey())}}\n/search/,{\n  \"method\": \"post\",\n  \"body\": \"searchkey={{key}}&Submit=\"\n}",
        "ruleSearch": {
          "author": ".s4@text",
          "bookList": ".novelslist2@li!0||.l@li",
          "bookUrl": "a.0@href",
          "checkKeyWord": "凡人修仙传",
          "coverUrl": "a.0@href<js>java.ajax(\"https://www.douyinxs.com\"+result)</js>id.fmimg@img@src",
          "kind": ".s1,.s7,.s6@text##\\[|\\]",
          "lastChapter": "a.1@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "a.0@text",
          "wordCount": ".s5@text"
        },
        "ruleBookInfo": {
          "author": "id.info@p.0@text",
          "coverUrl": "id.fmimg@img@src",
          "intro": "id.intro@p.1@text##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": ".con_top@a.1@text&&id.info@p.2@text##.*：|\\s..:.*",
          "lastChapter": "id.list@a.0@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "id.info@h1@text"
        },
        "ruleToc": {
          "chapterList": "id.list@dd@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href",
          "nextTocUrl": ".index-container@a.1@href"
        },
        "ruleContent": {
          "content": "id.content@html",
          "nextContentUrl": "id.next@href"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.coverUrl用了 <js>",
          "搜索规则.coverUrl用了 java.*"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🎉 黄易小说",
        "bookSourceUrl": "http://m.xhytd.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/SearchBook.php?keyword={{key}},{\"method\": \"get\"}",
        "ruleSearch": {
          "author": "p.1@a.1@text",
          "bookList": ".hot_sale",
          "bookUrl": "a.0@href",
          "checkKeyWord": "",
          "coverUrl": "a.0@href##.+\\D((\\d+)\\d{3})\\D##/files/article/image/$2/$1/$1s.jpg###",
          "intro": ".review@text##简介.",
          "kind": ".author!0@textNodes&&.score@text##\\s.*\\s##,",
          "lastChapter": ".author!0@a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "p.0@text"
        },
        "ruleBookInfo": {
          "author": ".author@a@text",
          "coverUrl": "id.thumb@img@src",
          "intro": ".review@text##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": "id.book_detail@li.1:2:3@text##.*：|T.*|小说",
          "lastChapter": "id.chapterlist@a.0@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "span.title@text",
          "tocUrl": ".btn@a.0@href"
        },
        "ruleToc": {
          "chapterList": "id.chapterlist@p@a",
          "chapterName": "text##.*直达页面.*|正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.chaptercontent@textNodes",
          "nextContentUrl": "id.pt_next@href",
          "replaceRegex": "##.*\\(第\\d/\\d页\\)|......//.*|.*星文阅读app.*",
          "title": ""
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🎉 小说三千",
        "bookSourceUrl": "http://www.xs3000.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/index/cate?wd={{key}}&submit=,{\"method\": \"get\"}",
        "ruleSearch": {
          "author": "span.0@text",
          "bookList": ".clear@li",
          "bookUrl": "a.1@href",
          "checkKeyWord": "长生",
          "coverUrl": ".book-img-box@img@src",
          "intro": "p.2@text",
          "kind": ".author@a@text&&span.1:2@text",
          "name": "a.1@text"
        },
        "ruleBookInfo": {
          "author": ".writer@text",
          "coverUrl": ".book-img@img@src",
          "intro": ".intro@text##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": ".gxsj@text##.*：",
          "lastChapter": "id.l2@a.0@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".book-info@h1@text",
          "tocUrl": ".mubtn@a@href"
        },
        "ruleToc": {
          "chapterList": "-.catalog_b@li@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": ".read-content@textNodes",
          "replaceRegex": "##\\s*请记住本站域名.*\\s*"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "💐 言情小说",
        "bookSourceUrl": "http://www.yqk.net",
        "bookSourceGroup": "🌸女频[优]",
        "searchUrl": "{{cookie.removeCookie(source.getKey())}}\n/search.php,{\n  'charset': 'gb2312',\n  'method': 'POST',\n  'body': 'searchkey={{key}}&page={{page}}'\n}",
        "ruleSearch": {
          "author": "a.2@text",
          "bookList": ".left li",
          "bookUrl": "a.1@href",
          "checkKeyWord": "哥哥",
          "coverUrl": "img.0@src",
          "intro": "p.4@text##.*简介.|\\s",
          "kind": "p.3@a@text",
          "lastChapter": "a.-1@text",
          "name": "a.1@text",
          "wordCount": "em.-1@text"
        },
        "ruleBookInfo": {
          "author": ".base a.2@text",
          "coverUrl": ".img img@src",
          "intro": ".intro@html##.*简介.",
          "kind": ".base p.4@a@text",
          "lastChapter": ".base p.5@a@text",
          "name": ".base a.1@text",
          "wordCount": ".base em.0@text"
        },
        "ruleToc": {
          "chapterList": ".chapter dd a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": ".content@textNodes"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "💐 若雨中文",
        "bookSourceUrl": "http://www.3yt.la",
        "bookSourceGroup": "🌸女频[优]",
        "searchUrl": "/book/search.aspx?searchkey={{key}}&SeaButton=",
        "ruleSearch": {
          "author": "td.4@text",
          "bookList": "tbody@tr",
          "bookUrl": "a.1@href",
          "coverUrl": "a.1@href##.+\\D((\\d+)\\d{3})\\D##/files/article/image/$2/$1/$1s.jpg###",
          "kind": "td.0:5:3@text##小说",
          "lastChapter": "td.2@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "td.1@text"
        },
        "ruleBookInfo": {
          "author": ".w_530@a.0@text##作品集",
          "coverUrl": ".img@img@src",
          "intro": ".h_260@p@text##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": ".path@a.1@text&&.w_200@li.0@text&&.h_260@em@text##.*：|\\s...:*|小说",
          "lastChapter": ".h_260@a.0@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".w_530@em.0@text",
          "tocUrl": ".w_200@a.1@href",
          "wordCount": ".w_200@li.1@text##.*已完成\\s|\\s字"
        },
        "ruleToc": {
          "chapterList": "id.BookText@li@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.BookText@textNodes"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "💐 ＵＣ书库",
        "bookSourceUrl": "http://m.ucshuku.net",
        "bookSourceGroup": "🌸女频[优]",
        "searchUrl": "/s.php,{\n  'method': 'POST',\n  'body': 'type=articlename&s={{key}}'\n}",
        "ruleSearch": {
          "author": "a.2@text",
          "bookList": ".search_list",
          "bookUrl": "a.0@href",
          "coverUrl": "a.0@href##.+\\D((\\d+)\\d{3})\\D##http://www.ucshuku.net/files/article/image/$2/$1/$1s.jpg###",
          "kind": "a.1@text##小说",
          "name": "a.0@text"
        },
        "ruleBookInfo": {
          "author": ".info@p.0@text",
          "coverUrl": ".info@img@src",
          "intro": "",
          "kind": ".info@p.1@text##.*：|\\s..:.*",
          "lastChapter": ".list[0]@a.0@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".info@h3@text"
        },
        "ruleToc": {
          "chapterList": ".list!0@li@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href",
          "nextTocUrl": ".right@a@href"
        },
        "ruleContent": {
          "content": "id.content@textNodes",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##UC小.*|\\s*.*点击下一页.*\\s*|最新网址.*"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "言情小筑",
        "bookSourceUrl": "https://www.yqxz.org",
        "bookSourceGroup": "🌸女频[优]",
        "searchUrl": "/e/search/index.php,{\n\"charset\": \"gbk\",\n\"method\": \"POST\",\n\"body\": \"keyboard={{key}}&show=title&classid=0\"\n}",
        "header": "",
        "ruleSearch": {
          "author": "class.autor@text",
          "bookList": "@css:.bk a",
          "bookUrl": "href",
          "intro": "tag.p@textNodes",
          "kind": "class.date@text##日期\\:\\s",
          "lastChapter": "{{@@class.date@text##日期\\:\\s}} • {{@@class.size@text##大小\\:\\s}}",
          "name": "tag.h3@text",
          "wordCount": "class.size@text##大小\\:\\s"
        },
        "ruleBookInfo": {
          "author": "",
          "canReName": "true",
          "downloadUrls": "https://www.yqxz.org{{@@.booktips@h3.0@a@href}}\n<js>java.ajax(result)</js>\n#dowloadnUrl@link",
          "init": "",
          "intro": "class.infos@tag.p@textNodes##^\\s*(文案|简介)*：",
          "kind": "class.tags@tag.a@text&&class.date@tag.span.2@text##状态：",
          "lastChapter": "text.时间：@text##时间：",
          "name": "",
          "tocUrl": ""
        },
        "ruleToc": {
          "chapterList": "@css:.book_list li a",
          "chapterName": "text##章##节",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "class.read_chapterDetail@html##\\?",
          "nextContentUrl": ""
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.downloadUrls用了 <js>",
          "详情规则.downloadUrls用了 java.*",
          "详情规则缺少 name",
          "详情规则暂不支持 downloadUrls"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "基友书屋",
        "bookSourceUrl": "https://www.gaysay.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/search/{{key}}/{{page}}",
        "ruleSearch": {
          "author": "a.2@text",
          "bookList": ".SHsectionThree-middle@p",
          "bookUrl": "a.1@href",
          "intro": "",
          "kind": "a.0@text",
          "lastChapter": "",
          "name": "a.1@text"
        },
        "ruleBookInfo": {
          "author": "p.author@a@text",
          "coverUrl": ".BGsectionOne-top-left@img@src",
          "intro": ".BGsectionTwo-bottom@text##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": "p.category@span!1@text&&p.time@span@text##\\s..:.*",
          "lastChapter": "p.newestChapter@a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "p.title@text",
          "tocUrl": ".BGsectionOne-bottom@a.1@href"
        },
        "ruleToc": {
          "chapterList": ".BCsectionTwo-top@li@a",
          "chapterName": "text",
          "chapterUrl": "href##$##,{'webView': true}",
          "nextTocUrl": "id.next@href"
        },
        "ruleContent": {
          "content": ".RBGsectionThree-content@p@html",
          "replaceRegex": "##.*网.*址.*社.*区|.*w.*w.*w.*点.*"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "💠 望书阁网",
        "bookSourceUrl": "http://wap.wangshugu.net",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/search.php?searchkey={{key}}",
        "ruleSearch": {
          "author": "p.3@text",
          "bookList": ".block",
          "bookUrl": "a.2@href",
          "checkKeyWord": "凡人",
          "coverUrl": "img@src",
          "kind": "p.2@text##.*：|小说",
          "lastChapter": "a.3@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "a.2@text"
        },
        "ruleBookInfo": {
          "author": ".block_txt2@p.2@text",
          "coverUrl": ".block_img2@img@src",
          "init": "",
          "intro": ".intro_info@text##(^|[。！？]+[”」）】]?)##$1<br>@js:result.replace(/各位书友.*|最新章节.*/g,\"\")",
          "kind": ".block_txt2@p.3:4:5@text##.*：|小说|T.*",
          "lastChapter": ".block_txt2@a.3@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".block_txt2@a.1@text"
        },
        "ruleToc": {
          "chapterList": ".chapter@li@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href",
          "nextTocUrl": "option@value"
        },
        "ruleContent": {
          "content": "id.nr1@html",
          "nextContentUrl": "id.pb_next@href",
          "replaceRegex": "##\\s*.*点击下一页继续.*\\s*|....wang.*|.*无弹窗.*|\\s*本书首发.*正版内容！\\s*"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "💠 玄幻阁网",
        "bookSourceUrl": "http://www.xuanyge.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/modules/article/search.php?s={{key}}&searchtype=articlename",
        "ruleSearch": {
          "author": "span.1@text",
          "bookList": "id.sitebox@dl",
          "bookUrl": "a.1@href",
          "coverUrl": "img@src",
          "intro": "dd.3@text",
          "kind": "span.2:0@text",
          "lastChapter": "a.2@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "a.1@text",
          "wordCount": "span.3@text"
        },
        "ruleBookInfo": {
          "author": "id.count@span.0@text",
          "coverUrl": "id.bookimg@img@src",
          "intro": "id.bookintro@p.0@text##(^|[。！？]+[”」）】]?)##$1<br>@js:result.replace(/最新.*关于：/g,\"\")",
          "kind": "id.count@span.1:2:3@text##\\s..:.*",
          "lastChapter": ".new@a.0@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".booktitle@h1@text",
          "tocUrl": ""
        },
        "ruleToc": {
          "chapterList": "id.readerlist@li@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.content@textNodes",
          "imageStyle": "",
          "replaceRegex": "##随机推荐.*|.*精华书阁.*|为您提供.*好书签.|.*免费阅读.|.*最快更新.*|\\(本章未完.*\\)"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "💠 选书小说",
        "bookSourceUrl": "http://www.xuanshu.org",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "{{cookie.removeCookie(source.getKey())}}\n/search.php,{\n  'method': 'post',\n  'body': 'searchkey={{key}}'\n}",
        "ruleSearch": {
          "author": "td.2@text",
          "bookList": "tbody@tr!0",
          "bookUrl": "a.0@href",
          "coverUrl": "a.0@href##.+\\D((\\d+)\\d{3})\\D##/tupian/$2/$1/$1s.jpg###",
          "kind": "td.3@text",
          "lastChapter": "td.1@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "td.0@text"
        },
        "ruleBookInfo": {
          "author": ".info_des@dl.0@text##.*：",
          "coverUrl": ".tupian@img@src",
          "intro": ".intro@text##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": "id.info@dd@a.1@text&&.info_des@dl.2@text##.*：|\\s..:.*|小说",
          "lastChapter": ".info_des@dl.3@a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".info_des@h1@text"
        },
        "ruleToc": {
          "chapterList": ".pc_list@li@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.content1@textNodes",
          "replaceRegex": ""
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "💠 乐库小说",
        "bookSourceUrl": "http://m.6lk.la",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/s.php,{\n  \"method\": \"post\",\n  \"body\": \"q={{key}}\"\n}",
        "ruleSearch": {
          "author": "p.3@text",
          "bookList": ".block",
          "bookUrl": "a.0@href",
          "checkKeyWord": "",
          "coverUrl": "img@src",
          "kind": "p.2@text##.*：",
          "lastChapter": "a.3@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "h2@text"
        },
        "ruleBookInfo": {
          "author": ".block_txt2@p.2@text",
          "coverUrl": ".block_img2@img@src",
          "intro": ".intro_info@text##(^|[。！？]+[”」）】]?)##$1<br>@js:result.replace(/最新章节推荐地址.*/g,\"\")",
          "kind": ".block_txt2@p.3:4:5@text##.*：|T.*",
          "lastChapter": ".block_txt2@a.3@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".block_txt2@h2@text"
        },
        "ruleToc": {
          "chapterList": ".chapter@li@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href",
          "nextTocUrl": ".right@a@href"
        },
        "ruleContent": {
          "content": "id.nr1@html",
          "nextContentUrl": "id.pb_next@href",
          "replaceRegex": "##\\s*.*\\(第\\d/\\d页\\)\\s*|\\s*（.*下一页.*）\\s*|最新网址：m.6lk.la"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "💠 达文小说",
        "bookSourceUrl": "http://www.dawensk.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/search.php,{\n  'method': 'POST',\n  'body': 'key={{key}}'\n}",
        "ruleSearch": {
          "author": "a.2@text",
          "bookList": ".result@li",
          "bookUrl": "a.1@href",
          "coverUrl": "img@data-original",
          "kind": "span.1:2:4@text##.*：|\\s..:.*",
          "lastChapter": "a.4@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "a.1@text",
          "wordCount": "span.3@text##.*："
        },
        "ruleBookInfo": {
          "author": ".c02@.zz@text",
          "coverUrl": ".f1_L@img@src",
          "init": "",
          "intro": "id.book_desc@text##(^|[。！？]+[”」）】]?)##$1<br>@js:result.replace(/阅读.*最新章节.*/g,'')",
          "kind": ".inf02@p.0:4@text&&.zj_con@.time@text##.*：|\\s..:.*",
          "lastChapter": ".zj_con@.zj@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".c01@a@text",
          "tocUrl": "a.mulu@href##$##,{'webView': true}",
          "wordCount": ".inf02@p.1@text##.*："
        },
        "ruleToc": {
          "chapterList": "id.chapter@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href##$##,{'webView': true}"
        },
        "ruleContent": {
          "content": "dd@p!-1@html",
          "replaceRegex": ""
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "💠 亿软小说",
        "bookSourceUrl": "http://www.yiruan.info",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/modules/article/search.php,{\n  \"method\": \"post\",\n  \"body\": \"searchkey={{key}}\"\n}",
        "ruleSearch": {
          "author": "td.2@text",
          "bookList": "tbody@tr!0",
          "bookUrl": "a.0@href",
          "coverUrl": "a.0@href##.+\\D((\\d+)\\d{3})\\D##/files/article/image/$2/$1/$1s.jpg###",
          "kind": "td.5:4@text",
          "lastChapter": "a.1@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "a.0@text",
          "wordCount": "td.3@text"
        },
        "ruleBookInfo": {
          "author": "id.info@p.0@text",
          "coverUrl": "id.fmimg@img@src",
          "intro": "id.intro@p.0@text##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": "id.info@p.1:3@text##.*：|类 别:|小说|\\s..:.*",
          "lastChapter": "id.info@a.0@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "id.info@h1@text"
        },
        "ruleToc": {
          "chapterList": "id.list@dd@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.content@html",
          "replaceRegex": "##最新网址.*"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "飞速中文feisuwx",
        "bookSourceUrl": "http://wap.feisuwx.org",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/modules/article/waps.php,{\n  'method': 'POST',\n  'body': 'keyword={{key}}'\n}",
        "ruleSearch": {
          "author": "class.author.0@text##.*作者：",
          "bookList": ".hot_sale",
          "bookUrl": "tag.a@href",
          "coverUrl": "tag.img@data-original||tag.a.0@href##.*_(\\d+)(\\d{3})/##/files/article/image/$1/$1$2/$1$2s.jpg",
          "kind": "class.author.1@text## . 更新：.*",
          "lastChapter": "class.author.1@text##.*更新：",
          "name": "class.title@text"
        },
        "ruleBookInfo": {
          "coverUrl": "img@src",
          "downloadUrls": "text.点击下载@href",
          "intro": "class.review@text##【收起】 本月强推.*",
          "lastChapter": "class.directoryArea@tag.p.0@a@text",
          "tocUrl": "text.完整目录@href"
        },
        "ruleToc": {
          "chapterList": ".directoryArea p!0",
          "chapterName": "a@text",
          "chapterUrl": "a@href",
          "nextTocUrl": "text.下一页@href"
        },
        "ruleContent": {
          "content": "id.chaptercontent@html##本章未完，请点击下一页继续阅读》》|催更和求书[\\s\\S]+发送消息。|查看\\s*81文学\\s*81文学[\\s\\S]+阅读体验。",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##(请认准.*g)\\s+|.*第\\d/\\d页.*\\s+|\\(飞速小说.*|（本章未完.*\\s+|最新网.*g\\s+"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name",
          "详情规则暂不支持 downloadUrls"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "💠 猪猪书网",
        "bookSourceUrl": "http://www.zzs5.info",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/index.php?m=search&c=index&a=init&typeid=2&siteid=1&q={{key}}",
        "ruleSearch": {
          "author": "a.1@href<js>java.ajax(result)</js>##作者.([^<]+)##$1###",
          "bookList": "tbody@tr",
          "bookUrl": "a.1@href",
          "coverUrl": "img@src",
          "kind": "p.0@text##.*：|\\s",
          "name": "a.1@text"
        },
        "ruleBookInfo": {
          "author": "tbody.1@tr.3@td.1@text||.bookd-title@dd@ownText##.*作者.|\\s.*",
          "intro": ".show_content!1@html",
          "kind": ".catpos@a.1@text&&tbody.1@tr.3@td.0@text&&.bookd-title@dd@ownText##.*：|小说|\\s.*",
          "lastChapter": "tbody.1@a@text||.list@a.-1@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "tbody.0@h1@text||.bookd-title@h1@text##下载",
          "tocUrl": "id.downlink@a.0@href",
          "wordCount": "tbody.1@tr.2@td.1@text##.*："
        },
        "ruleToc": {
          "chapterList": ".list@dd@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href",
          "formatJs": ""
        },
        "ruleContent": {
          "content": ".content!0@html"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.author用了 <js>",
          "搜索规则.author用了 java.*"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "💠 七零一七",
        "bookSourceUrl": "https://www.7017k.net",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/plus/search.php?kwtype=0&searchtype=&q={{key}}",
        "header": "",
        "ruleSearch": {
          "author": "a.3@text",
          "bookList": ".ul_b_list@li",
          "bookUrl": "a.0@href",
          "checkKeyWord": "",
          "coverUrl": "img@src",
          "intro": "p.2@text",
          "kind": "span.0@text&&p.0@text&&.arcurl@ownText##.*状态.|关键.*|.*更新.|..:.*|\\s",
          "name": "a.0@text"
        },
        "ruleBookInfo": {
          "author": ".info[0]@a.0@text",
          "coverUrl": ".pic[0]@img@src",
          "init": "",
          "intro": ".words@p@text##(^|[。！？]+[”」）】]?)##$1<br>@js:result.replace(/简介./g,\"\")",
          "kind": ".info@li.1:7@text&&.words@ownText##.*：|.*\\(|\\s..:.*",
          "lastChapter": ".words@a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".title@h1@text",
          "wordCount": "id.cms_ready_1@text"
        },
        "ruleToc": {
          "chapterList": ".list_box@li@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href",
          "updateTime": ""
        },
        "ruleContent": {
          "content": ".box_box@textNodes"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "💠 九五书包",
        "bookSourceUrl": "http://www.95dushu.net",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/modules/article/search.php?ie=gbk&searchkey={{key}}&ct=2097152",
        "ruleSearch": {
          "author": "td.2@text",
          "bookList": "tbody@tr!0",
          "bookUrl": "a.0@href",
          "checkKeyWord": "道观",
          "coverUrl": "a.0@href##.+\\D((\\d+)\\d{3})\\D##/files/article/image/$2/$1/$1s.jpg###",
          "kind": "td.5:4@text",
          "lastChapter": "td.1@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "td.0@text",
          "wordCount": "td.3@text"
        },
        "ruleBookInfo": {
          "author": ".author@a@text",
          "coverUrl": ".con_limg@img@src",
          "intro": ".r_cons@text##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": ".txt_nav@a.1@text&&.lastrecord@ownText##小说|.*\\(|\\).*",
          "lastChapter": ".lastrecord@a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".info@h1@text",
          "tocUrl": ".r_tools@a.1@href"
        },
        "ruleToc": {
          "chapterList": ".novel_list@dd@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.content@textNodes",
          "replaceRegex": "##\\.pbtxt."
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "爱微阅读",
        "bookSourceUrl": "https://m.2vdu.com/",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/search?kw={{key}}",
        "header": "{ \"User-Agent\": \"Mozilla/5.0 (Linux; Android 9) Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": "class.author@text",
          "bookList": "ul@a",
          "bookUrl": "href",
          "checkKeyWord": "剑来",
          "coverUrl": "img@data-original",
          "intro": ".line_3@text",
          "kind": "class.msg@span.0:2@text",
          "name": ".line_1@text",
          "wordCount": "class.count@text"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "[property=\"og:image\"]@content",
          "intro": "[property=\"og:description\"]@content",
          "kind": "[property=\"og:novel:category\"]@content&&[property=\"og:novel:status\"]@content&&[property=\"og:novel:update_time\"]@content",
          "lastChapter": "[property=\"og:novel:latest_chapter_name\"]@content",
          "name": "h1@text",
          "tocUrl": "class.title@tag.a@href",
          "wordCount": "class.award@text##.*\\|"
        },
        "ruleToc": {
          "chapterList": "ul@li@a",
          "chapterName": "p@ownText",
          "chapterUrl": "href",
          "nextTocUrl": ".right@.next@href"
        },
        "ruleContent": {
          "content": "class.content@p@textNodes",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##.*小说免费阅读.*请收藏.*|本章未完.*继续阅读.*|.*内容乱码错字顺序.*阅读模式.*"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🌸4020电子书",
        "bookSourceUrl": "https://m.iwurexs.net",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "https://m.iwurexs.net/search.php?searchkey={{key}}&submit=",
        "header": "{\"User-Agent\": \"Mozilla/5.0 (Linux; Android 9) Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": ".author@text",
          "bookList": ".bookbox",
          "bookUrl": "a.1@href",
          "checkKeyWord": "剑来",
          "coverUrl": "",
          "kind": "0",
          "lastChapter": "a.2@text",
          "name": "h4@text"
        },
        "ruleBookInfo": {
          "author": "@get:{a}",
          "coverUrl": "",
          "downloadUrls": "",
          "init": "@put:{n:\"[property$=book_name]@content\",\n\ta:\"[property$=author]@content\",\nk:\"[property~=category|status|update_time]@content\",\nl:\"[property$=latest_chapter_name]@content\",\ni:\"[property$=description]@content\"}",
          "intro": "@get:{i}",
          "kind": "@get:{k}",
          "lastChapter": "@get:{l}",
          "name": "@get:{n}",
          "tocUrl": ""
        },
        "ruleToc": {
          "chapterList": ".chapter.1@li a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": "option@value||text.下一页@href"
        },
        "ruleContent": {
          "content": "#nr1@textNodes",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##{{chapter.title}}|（本章未完.*继续阅读）|\\(第.+页\\)"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "💰 飞卢小说",
        "bookSourceUrl": "https://wap.faloo.com",
        "bookSourceGroup": "⭐正版源",
        "searchUrl": "/search_0_{{page}}.html?t=1&k={{key}},{\n'charset': 'gb2312'\n}",
        "ruleSearch": {
          "author": ".nl_r1_author a.0@text",
          "bookList": ".novelList li",
          "bookUrl": "a.1@href",
          "checkKeyWord": "",
          "coverUrl": "img.0@src",
          "intro": "a.2@text",
          "kind": ".nl_r1_author a.1@text&&em@text&&.date@text&&.tag@text",
          "name": "a.1@text",
          "wordCount": "i.0@text"
        },
        "ruleBookInfo": {
          "author": ".info a.0@text",
          "coverUrl": ".cover_box img@src",
          "intro": "🏷️   {{@class.tagList.0@text}}{{'\\n'+'​'}}\n{{@#novel_intro@html}}##展开收起|飞卢小说(.|\\n)*",
          "kind": ".info a.1@text&&.info .tag@text&&.info li.4@text##.*：|\\s.*|小说",
          "lastChapter": ".newNode@text##[\\(（【].*?[求更谢乐发订合补加].*?[】）\\)]",
          "name": ".info h1@text",
          "tocUrl": ".btnLayout@a.1@href",
          "wordCount": ".info li.2@textNodes##\\s.*"
        },
        "ruleToc": {
          "chapterList": ".v_nodeList li",
          "chapterName": "a@text##[\\(（【].*?[求更谢乐发订合补加].*?[】）\\)]",
          "chapterUrl": "a@href",
          "isVip": "i@html"
        },
        "ruleContent": {
          "content": ".nodeContent@p@html",
          "imageStyle": "FULL",
          "replaceRegex": "##本书来自.*|本书由飞卢.*|用飞卢.*",
          "sourceRegex": ""
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro：模板里是脚本表达式：{{@class.tagList.0@text}}"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "博仕书屋",
        "bookSourceUrl": "https://m.boshishuwu.com#🎃",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/s.php,{\n  \"body\": \"keyword={{key}}&t=1\",\n  \"method\": \"POST\"\n}",
        "header": "{\"User-Agent\": \"Mozilla/5.0 (Linux; Android 9) Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": "p.1@text##.*作者：",
          "bookList": ".hot_sale",
          "bookUrl": "a@href",
          "checkKeyWord": "剑来",
          "kind": "p.1:2@text##\\|.*",
          "lastChapter": "p.2@text##.*更新：",
          "name": "p.title@text"
        },
        "ruleBookInfo": {
          "author": "p.author@text",
          "coverUrl": ".synopsisArea_detail img@src",
          "init": "",
          "intro": "p.review@text",
          "kind": "text.类别：@text&&\ntext.状态：@text&&\ntext.更新：.0@text##.*：",
          "lastChapter": ".directoryArea p.0@text",
          "name": "span.title@text",
          "tocUrl": "text.完整目录@href"
        },
        "ruleToc": {
          "chapterList": "#chapterlist p!0@a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": "text.下一页@href\n@js:\nvar regex=/第\\d*.(\\d+)页.当前\\d*条.页/;\n//正则匹配页数\nvar page=src.match(regex);\npage=page?page[1]:\"\";\nvar next=result?result[0]:\"\";\nnext=String(next);\nvar url=[next];\nfor(i=2;i<=page;i++){\n\turl.push(next.replace(/p\\d+/,\"p\"+i))\n\t}\nurl;"
        },
        "ruleContent": {
          "content": "#chaptercontent@textNodes",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##阅读模式.*"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "目录规则.nextTocUrl用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🌸 文墨中文网",
        "bookSourceUrl": "http://www.maxreader.net/",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "http://www.maxreader.net/search/result.html?searchkey={{key}}",
        "ruleSearch": {
          "author": "class.fl color7@class.mr30@tag.a.0@title",
          "bookList": "class.pt-rank-detail",
          "bookUrl": "class.pt-rank-detail@tag.a.0@href",
          "coverUrl": "tag.img.0@src",
          "kind": "text.分类@text",
          "lastChapter": "class.fl lh100@tag.a@title",
          "name": "class.pt-rank-detail@tag.a.0@title"
        },
        "ruleBookInfo": {
          "coverUrl": "",
          "intro": "",
          "lastChapter": "",
          "tocUrl": "text.目录@href"
        },
        "ruleToc": {
          "chapterList": "id.readerlists@tag.li",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "class.size16 color5 pt-read-text@html## |本章未完.*|百度搜索阅读最新最全.*|猫扑中文|[()]|.*最新章节第一时间免费.*",
          "nextContentUrl": "text.下一页@href"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🌸 爱书包",
        "bookSourceUrl": "https://www.ishubao.org",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "https://www.ishubao.org/modules/article/search.php?s=12839966820499815668&entry=1&ie=gbk&q={{key}}",
        "header": "{\n  \"User-Agent\": \"Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.73 Safari/537.36\"\n}",
        "ruleSearch": {
          "author": "class.odd.1@text",
          "bookList": "class.grid@tag.tr!0",
          "bookUrl": "tag.a.0@href",
          "coverUrl": "tag.a.0@href<js>\nvar id = result.match(/(\\d+)\\/?$/)[1];\nvar iid = parseInt(id/1000);\n'https://www.ishubao.org/files/article/image/'+iid+'/'+id+'/'+id+'s.jpg';\n</js>",
          "intro": "",
          "kind": "class.odd.2@text",
          "lastChapter": "tag.a.1@text",
          "name": "tag.a.0@text",
          "wordCount": "class.even.1@text"
        },
        "ruleBookInfo": {
          "author": "class.info@h3@a@text",
          "coverUrl": "class.img@tag.img@src",
          "init": "",
          "intro": "id.intro@text",
          "kind": "class.info@tag.p.0@text##更新时间：",
          "lastChapter": "class.info@tag.span@a@text",
          "name": "class.info@tag.h1@text",
          "tocUrl": "",
          "wordCount": ""
        },
        "ruleToc": {
          "chapterList": "id.chapterlist@tag.li",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href",
          "isVip": "",
          "nextTocUrl": "",
          "updateTime": ""
        },
        "ruleContent": {
          "content": "id.book_text@html##一秒记住.*免费阅读！",
          "nextContentUrl": "class.book_content_text_next@tag.a.4@href",
          "sourceRegex": "",
          "webJs": ""
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.coverUrl用了 <js>"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🌸 灵域小说网",
        "bookSourceUrl": "https://m.lingyutxt.net",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "https://m.lingyutxt.net/search.php?type=undefined&keyword={{key}}",
        "ruleSearch": {
          "author": "tag.p.1@tag.a.1@text",
          "bookList": "class.hot_sale",
          "bookUrl": "tag.a.0@href",
          "coverUrl": "tag.a.0@href<js>java.ajax(\"https://m.lingyutxt.net\"+result)</js>[property=\"og:image\"]@content",
          "intro": "tag.a.0@href<js>java.ajax(\"https://m.lingyutxt.net\"+result)</js>[property=\"og:description\"]@content",
          "kind": "",
          "lastChapter": "tag.p.2@tag.a@text",
          "name": "tag.a@tag.p@text"
        },
        "ruleBookInfo": {
          "author": "class.author@tag.a@text",
          "coverUrl": "[property=\"og:image\"]@content",
          "init": "",
          "intro": "[property=\"og:description\"]@content",
          "kind": "class.sort@tag.a@text",
          "tocUrl": "text.章节列表@href",
          "wordCount": "tag.li.2@text##.*："
        },
        "ruleToc": {
          "chapterList": "id.chapterlist@p!0",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "id.chaptercontent@textNodes##166",
          "nextContentUrl": "text.下一页@href##/wapbook/\\d+_\\d+.html"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.coverUrl用了 <js>",
          "搜索规则.coverUrl用了 java.*",
          "搜索规则.intro用了 <js>",
          "搜索规则.intro用了 java.*",
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "碧曲书库",
        "bookSourceUrl": "http://wap.biqugewx.info/",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "http://wap.biqugewx.info/s.php,{\n\"method\":\"post\",\n\"body\":\"submit=&type=articlename&s={{key}}\"\n}",
        "ruleSearch": {
          "author": "a.2@text",
          "bookList": ".fk li",
          "bookUrl": "a.1@href",
          "kind": "a.0@text##\\[|\\]",
          "name": "a.1@text"
        },
        "ruleBookInfo": {
          "coverUrl": "img@src",
          "intro": "🕰  更新时间：{{@@.xsinfo li:nth-of-type(5)@text##更新时间：}}\n📒  作品Tags：{{@@.xsinfo li:nth-of-type(2) a@text}}\n📜  内容简介：\n{{@@div.jianjie@text## 亲爱的书友：您好，本站.*}}##(^|[。！？……；]+[”」）】]?)##$1<br>\n",
          "lastChapter": ".xsinfo li:nth-of-type(4) a@text"
        },
        "ruleToc": {
          "chapterList": "section:nth-of-type(3) li a",
          "chapterName": "text",
          "chapterUrl": "href",
          "nextTocUrl": "option@value"
        },
        "ruleContent": {
          "content": "article@html##最新网址：wap.biqugewx.info",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##--.*）"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则缺少 name"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "香书小说",
        "bookSourceUrl": "https://www.ibiquge.la",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/modules/article/waps.php?searchkey={{key}}",
        "header": "",
        "ruleSearch": {
          "author": "tag.td.2@text",
          "bookList": "tag.tbody.0@tag.tr.!0",
          "bookUrl": "tag.td.0@tag.a.0@href",
          "kind": "",
          "lastChapter": "tag.td.1@text",
          "name": "tag.td.0@text"
        },
        "ruleBookInfo": {
          "author": "//meta[@property='og:novel:author']/@content",
          "coverUrl": "//meta[@property='og:image']/@content",
          "intro": "//meta[@property='og:description']/@content",
          "kind": "//meta[@property='og:novel:category']/@content",
          "lastChapter": "id.info.0@tag.a.-1@text",
          "name": "//meta[@property='og:novel:book_name']/@content"
        },
        "ruleToc": {
          "chapterList": "id.list.0@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.content.0@textNodes"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.author：当前环境不支持 XPath",
          "详情规则.coverUrl：当前环境不支持 XPath",
          "详情规则.intro：当前环境不支持 XPath",
          "详情规则.kind：当前环境不支持 XPath",
          "详情规则.name：当前环境不支持 XPath"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "果露小说",
        "bookSourceUrl": "https://www.xguolu88.com#🎃",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "https://www.xguolu88.com/modules/article/search.php,{\n  \"body\": \"searchkey={{key}}\",\n  \"charset\": \"GBK\",\n  \"method\": \"POST\"\n}",
        "header": "{ \"User-Agent\": \"Mozilla/5.0 (Linux; Android 9) Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": ".author.0@text",
          "bookList": ".bookbox",
          "bookUrl": "a.0@href",
          "checkKeyWord": "",
          "intro": ".update@textNodes",
          "kind": "0",
          "lastChapter": "a.1@text",
          "name": "h4@text",
          "wordCount": ".author.1@text##字数："
        },
        "ruleBookInfo": {
          "author": "[property$=author]@content",
          "coverUrl": "[property$=image]@content",
          "intro": "[property$=description]@content",
          "kind": "[property~=category|status|update_time]@content",
          "lastChapter": "[property$=latest_chapter_name]@content\n##章节目录\\s",
          "name": "[property$=book_name]@content"
        },
        "ruleToc": {
          "chapterList": "#list-chapterAll@dd",
          "chapterName": "a@text",
          "chapterUrl": "a@href"
        },
        "ruleContent": {
          "content": ".readcontent@html",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##-->>|本章未完.*继续阅读"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "123言情网",
        "bookSourceUrl": "http://www.123yqw.com/",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "http://www.123yqw.com/search/{{key}}",
        "ruleSearch": {
          "author": "class.s4@text",
          "bookList": "class.l@li",
          "bookUrl": "class.s2@a@href",
          "checkKeyWord": "我有一剑",
          "kind": "class.s1@text##\\[|]",
          "lastChapter": "class.s3@a@text",
          "name": "class.s2@a@text"
        },
        "ruleBookInfo": {
          "author": "#info@p.0@a@text",
          "coverUrl": "img@src",
          "intro": "id.intro@html",
          "kind": "[property=\"og:novel:category\"]@content&&[property=\"og:novel:status\"]@content&&[property=\"og:novel:update_time\"]@content",
          "lastChapter": "id.info@tag.p.3@a@text",
          "name": "#info@h1@text",
          "wordCount": ""
        },
        "ruleToc": {
          "chapterList": "id.list@dd@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.content@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🌸蚂蚁阅读",
        "bookSourceUrl": "http://www.mayitxt.com#嘚嘚21.0201",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "http://www.imayitxt.com/modules/article/search.php?q={{key}}&searchtype=all,{\n  \"charset\": \"utf-8\"\n}",
        "ruleSearch": {
          "author": "class.author@text||tag.span@text",
          "bookList": "class.bd@tag.tr!0||class.BOX@tag.tr!0",
          "bookUrl": "tag.a.1@href",
          "coverUrl": "class.book-cover-img@tag.img@src",
          "kind": "class.tag@text||tag.a.0@text##\\[|\\]",
          "lastChapter": "class.chapter@text##正文.*?第##第",
          "name": "class.red@text||tag.a.1@text"
        },
        "ruleBookInfo": {
          "author": "class.author.0@text",
          "coverUrl": "tag.img@src",
          "intro": "class.intro@text",
          "name": "class.book_name@tag.h1@text",
          "tocUrl": "class.button_list@tag.a.2@href"
        },
        "ruleToc": {
          "chapterList": "class.float-list fill-block@tag.li",
          "chapterName": "tag.a@text##\\|",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "class.page-content@textNodes##一秒记住.*"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🎉 必去小说",
        "bookSourceUrl": "http://www.ibiquw.info",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/modules/article/search.php,{\n  \"method\": \"post\",\n  \"body\": \"action=login&searchkey={{key}}\"\n}",
        "ruleSearch": {
          "author": ".s3@text",
          "bookList": ".toplist@li",
          "bookUrl": "a.0@href",
          "coverUrl": "a.0@href@js:var o=result.match(/\\/book\\/(\\d+)/); if(o!=null){'/files/article/image/'+parseInt(o[1]/1000)+'/'+o[1]+'/'+o[1]+'s.jpg';}",
          "intro": "",
          "kind": ".s5,.s6@text",
          "lastChapter": ".s2@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".s1@text",
          "wordCount": ".s4@text"
        },
        "ruleBookInfo": {
          "author": ".options@span.0@text",
          "coverUrl": ".pic@img@src",
          "intro": ".bookinfo_intro@textNodes##(^|[。！？]+[”」）】]?)##$1<br>@js:result.replace(/您要是觉得《|》还不错.*/g,\"\")",
          "kind": ".title@a.1@text&&.update@ownText##小说|.*\\(|\\s..:.*",
          "lastChapter": ".update@a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "id.info@h1@text"
        },
        "ruleToc": {
          "chapterList": ".book_list@li",
          "chapterName": "a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "a@href"
        },
        "ruleContent": {
          "content": "id.htmlContent@html"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.coverUrl用了 @js:",
          "详情规则.intro用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🎉 独步小说",
        "bookSourceUrl": "https://www.dbxsd.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/plus/search.php?q={{key}}",
        "header": "{\n  'User-Agent': 'Mozilla/5.0 (Linux; Android 9; PDBM00 Build/PPR1.180610.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/70.0.3538.110 Mobile Safari/537.36'\n}",
        "ruleSearch": {
          "author": "td.1@text",
          "bookList": ".table@tbody@tr",
          "bookUrl": "a.0@href",
          "checkKeyWord": "",
          "coverUrl": "a.0@href<js>\nvar id = result.match(/(\\d+)\\/?$/)[1];\n'/uploads/cover/'+id+'s.jpg';\n</js>",
          "intro": "",
          "kind": "",
          "lastChapter": "",
          "name": "a.0@text##《|》"
        },
        "ruleBookInfo": {
          "author": ".media-body@a.1@text",
          "coverUrl": ".book-img-middel@src",
          "init": "",
          "intro": ".book-detail@text##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": ".col-md-4@text##.*：|\\s..:.*",
          "lastChapter": ".media-body@a.2@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".book-name@a@text",
          "wordCount": ""
        },
        "ruleToc": {
          "chapterList": "id.all-chapter@div@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.cont-body@html  ",
          "nextContentUrl": ".page@a@href"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.coverUrl用了 <js>"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🌐 乐阅读网",
        "bookSourceUrl": "https://www.22is.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "{{cookie.removeCookie(source.getKey())}}\n/search/,{\n  \"method\": \"post\",\n  \"body\": \"searchkey={{key}}&searchtype=all\"\n}",
        "header": "",
        "ruleSearch": {
          "author": "label.0@text",
          "bookList": ".newbox@li||.article_list_content@li",
          "bookUrl": "a.0@href",
          "checkKeyWord": "",
          "coverUrl": "img@src",
          "intro": "ol@text##天天看小说.*《.*》",
          "kind": "label.1:2@text&&.zxzj@span.1@text##小说",
          "lastChapter": ".zxzj@a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "h3@a@text",
          "wordCount": ".piaos@text"
        },
        "ruleBookInfo": {
          "author": ".booknav2@a.1@text",
          "coverUrl": ".bookimg2@img@src",
          "intro": ".navtxt@p!-1@html##天天看小说.*《.*》",
          "kind": ".booknav2@p.1:3@text##.*：|小说",
          "lastChapter": ".catalog@a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".booknav2@a.0@text",
          "tocUrl": "id.a_addbookcase@href",
          "wordCount": ".booknav2@p.2@text##\\s.*"
        },
        "ruleToc": {
          "chapterList": "#chapterList@li@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": ".txtnav@p!-1@html",
          "replaceRegex": ""
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "📚 六九书吧",
        "bookSourceUrl": "https://www.69hsz.com",
        "bookSourceGroup": "🍀起点源",
        "searchUrl": "{{cookie.removeCookie(source.getKey())}}\n/ss/?searchkey={{key}}",
        "ruleSearch": {
          "author": "a.2@text",
          "bookList": ".item",
          "bookUrl": "a.0@href",
          "checkKeyWord": "长生",
          "coverUrl": "img@data-original",
          "intro": "dd@text",
          "kind": "em.0@text",
          "lastChapter": "",
          "name": "a.1@text",
          "wordCount": "em.1@text"
        },
        "ruleBookInfo": {
          "author": "id.info@p.0@text",
          "coverUrl": "id.fmimg@img@data-original",
          "init": "",
          "intro": "id.intro@text##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": ".con_top@a.1@text&&id.info@p.1:3@text##.*：|小说|\\s..:.*",
          "lastChapter": "id.info@a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "id.info@h1@text",
          "wordCount": ""
        },
        "ruleToc": {
          "chapterList": "id.list@dl@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.booktxt@html",
          "nextContentUrl": ".bottem2@a.2@href",
          "replaceRegex": "##\\s*[\\(（]本章完[\\)）]\\s*"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🎉 圣武书库",
        "bookSourceUrl": "https://www.swskw.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/plus/search.php?q={{key}}",
        "header": "{\n\t\"User-Agent\": \"Mozilla/5.0 (Linux; Android 14; V2304A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/123.0.6312.118 Mobile Safari/537.36\",\n\t\"Referer\": \"https://www.swskw.com/\"\n}",
        "ruleSearch": {
          "author": "td.1@text",
          "bookList": "tbody@tr",
          "bookUrl": "a.0@href",
          "checkKeyWord": "",
          "coverUrl": "a.0@href##/(\\d+)##/uploads/cover/$1s.jpg###",
          "name": "a.0@text##.*《|》"
        },
        "ruleBookInfo": {
          "author": ".media@a.2@text",
          "coverUrl": ".book-img-middel@img@src",
          "intro": ".book-detail@text##(^|[。！？]+[”」）】]?)##$1<br>",
          "kind": ".col-md-4@text##.*：",
          "lastChapter": ".col-md-8[1]@a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "h1@a@text",
          "wordCount": ""
        },
        "ruleToc": {
          "chapterList": "id.all-chapter@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.cont-body@html",
          "nextContentUrl": ".text-center@a.2@href"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🌐 书满屋网",
        "bookSourceUrl": "https://m.shumanwu.net",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/s.php,{\n  \"charset\": \"gbk\",\n  \"method\": \"post\",\n  \"body\": \"s={{key}}&type=articlename\"\n}",
        "ruleSearch": {
          "author": "a.2@text",
          "bookList": ".line",
          "bookUrl": "a.1@href",
          "checkKeyWord": "快穿",
          "coverUrl": "a.1@href##.+\\D((\\d+)\\d{3})\\D##https://image.shumanwu.net/$2/$1/$1s.jpg###",
          "intro": "",
          "kind": "a.0@text##\\[|\\]",
          "name": "a.1@text"
        },
        "ruleBookInfo": {
          "author": ".block_txt2@p.2@a@text",
          "coverUrl": ".block_img2@img@src",
          "intro": ".intro_info@text##(^|[。！？]+[”」）】]?)##$1<br>@js:result.replace(/简介./g,\"\")",
          "kind": ".block_txt2@p.3:4:5@text##.*：|\\s..:.*",
          "lastChapter": "id.zuixin@a@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".block_txt2@h2@text",
          "tocUrl": ".ablum_read@a.1@href"
        },
        "ruleToc": {
          "chapterList": ".lie@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href",
          "nextTocUrl": ".page@a.-2@href"
        },
        "ruleContent": {
          "content": "id.nr1@textNodes",
          "nextContentUrl": "id.next_url@href",
          "replaceRegex": "##（本章未完，请翻页）|\\s*[\\(（]本章完[\\)）]\\s*|请牢记收藏.*最新最快.*|\\s*最近转码严重.*更新更快.*\\s*",
          "title": ""
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🌐 望书阁网",
        "bookSourceUrl": "http://wap.wangshugu.org",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/search.php?searchkey={{key}}",
        "ruleSearch": {
          "author": "p.3@text",
          "bookList": ".block",
          "bookUrl": "a.2@href",
          "checkKeyWord": "凡人",
          "coverUrl": "img@src",
          "kind": "p.2@text##.*：|小说",
          "lastChapter": "a.3@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "a.2@text"
        },
        "ruleBookInfo": {
          "author": ".block_txt2@p.2@text",
          "coverUrl": ".block_img2@img@src",
          "init": "",
          "intro": ".intro_info@text##(^|[。！？]+[”」）】]?)##$1<br>@js:result.replace(/各位书友.*|最新章节.*/g,\"\")",
          "kind": ".block_txt2@p.3:4:5@text##.*：|小说|T.*",
          "lastChapter": ".block_txt2@a.3@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".block_txt2@a.1@text"
        },
        "ruleToc": {
          "chapterList": ".chapter@li@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href",
          "nextTocUrl": "option@value"
        },
        "ruleContent": {
          "content": "id.nr1@html",
          "nextContentUrl": "id.pb_next@href",
          "replaceRegex": "##\\s*.*点击下一页继续.*\\s*|....wang.*|.*无弹窗.*|\\s*本书首发.*正版内容！\\s*"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "💠 玄幻阁网",
        "bookSourceUrl": "http://www.xuanyge.org",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/modules/article/search.php?s={{key}}&searchtype=articlename",
        "ruleSearch": {
          "author": "span.1@text",
          "bookList": "id.sitebox@dl",
          "bookUrl": "a.1@href",
          "coverUrl": "img@src",
          "intro": "dd.3@text",
          "kind": "span.2:0@text",
          "lastChapter": "a.2@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "a.1@text",
          "wordCount": "span.3@text"
        },
        "ruleBookInfo": {
          "author": "id.count@span.0@text",
          "coverUrl": "id.bookimg@img@src",
          "intro": "id.bookintro@p.0@text##(^|[。！？]+[”」）】]?)##$1<br>@js:result.replace(/最新.*关于：/g,\"\")",
          "kind": "id.count@span.1:2:3@text##\\s..:.*",
          "lastChapter": ".new@a.0@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": ".booktitle@h1@text",
          "tocUrl": ""
        },
        "ruleToc": {
          "chapterList": "id.readerlist@li@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "id.content@textNodes",
          "imageStyle": "",
          "replaceRegex": "##随机推荐.*|.*精华书阁.*|为您提供.*好书签.|.*免费阅读.|.*最快更新.*|\\(本章未完.*\\)"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.intro用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🌐 猪猪书网",
        "bookSourceUrl": "http://www.zzs5.net",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/index.php?m=search&c=index&a=init&typeid=2&siteid=1&q={{key}}",
        "ruleSearch": {
          "author": "a.1@href<js>java.ajax(result)</js>##作者.([^<]+)##$1###",
          "bookList": "tbody@tr",
          "bookUrl": "a.1@href",
          "coverUrl": "img@src",
          "kind": "p.0@text##.*：|\\s",
          "name": "a.1@text"
        },
        "ruleBookInfo": {
          "author": "tbody.1@tr.3@td.1@text||.bookd-title@dd@ownText##.*作者.|\\s.*",
          "intro": ".show_content!1@html",
          "kind": ".catpos@a.1@text&&tbody.1@tr.3@td.0@text&&.bookd-title@dd@ownText##.*：|小说|\\s.*",
          "lastChapter": "tbody.1@a@text||.list@a.-1@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "tbody.0@h1@text||.bookd-title@h1@text##下载",
          "tocUrl": "id.downlink@a.0@href",
          "wordCount": "tbody.1@tr.2@td.1@text##.*："
        },
        "ruleToc": {
          "chapterList": ".list@dd@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href",
          "formatJs": ""
        },
        "ruleContent": {
          "content": ".content!0@html"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.author用了 <js>",
          "搜索规则.author用了 java.*"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "香书小说",
        "bookSourceUrl": "http://wap.xbiqugu.la/",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/modules/article/waps.php,{\n  \"method\": \"post\",\n  \"body\": \"searchkey={{key}}\"\n}",
        "header": "{\n\t\"User-Agent\":\"Mozilla/5.0 (Linux; Android 13; V2148A Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.146 Mobile Safari/537.36\"\n\t}",
        "ruleSearch": {
          "author": "p[3]@text##作者：",
          "bookList": ".block",
          "bookUrl": "a@href",
          "checkKeyWord": "长生",
          "coverUrl": "a@href##.+\\D((\\d+)\\d{3})\\D##/files/article/image/$2/$1/$1s.jpg###",
          "kind": "p[2]@text##分类：",
          "lastChapter": "p[4]@a@text",
          "name": "h2@text"
        },
        "ruleBookInfo": {
          "author": "@get:{a}##作者：",
          "coverUrl": "@get:{i}",
          "init": "@put:{n:\".block_txt2@h2@text\",\na:\".block_txt2@p[2]@text\",\nc:\".block_txt2@p[3]@text&&.block_txt2@p[4]@text&&.block_txt2@p[5]@text\",\nl:\".block_txt2@p[6]@a@text\",\nd:\".intro_info@text\",\ni:\".block_img2@img src\"}",
          "intro": "@get:{d}##最新章节推荐.*",
          "kind": "@get:{c}##分类：|状态：|更新：",
          "lastChapter": "@get:{l}",
          "name": "@get:{n}"
        },
        "ruleToc": {
          "chapterList": ".chapter[!0]@li a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href",
          "nextTocUrl": "option@value"
        },
        "ruleContent": {
          "content": "#nr1@html",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##.*\\(第.*\\/.*页\\)\\s*|最新网址.*\\s*|\\s（本章.*\\s*"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "详情规则.init：不支持的提取方式：img src"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🎉 完本小说",
        "bookSourceUrl": "https://www.wbxs.org/",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "https://www.wbxs.org/s?keyword={{key}}",
        "ruleSearch": {
          "author": "td.1@text",
          "bookList": ".grid@tr!0",
          "bookUrl": "a@href",
          "checkKeyWord": "",
          "kind": "td.4:3@text",
          "name": "a@text",
          "wordCount": "td.2@text"
        },
        "ruleBookInfo": {
          "author": "text.作者：@em@text##作者：",
          "coverUrl": ".lf@img@src",
          "init": "",
          "intro": ".intro@text",
          "kind": ".place@a.1@text&&text.状态：@text&&text.更新时间：@text##状态：|更新时间：",
          "lastChapter": "text.最新章节：@em@text##最新章节：",
          "name": ".rt@h1@text"
        },
        "ruleToc": {
          "chapterList": ".mulu@li@a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": ".yd_text2@p!-1:-2@text"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🌐 炫书网站",
        "bookSourceUrl": "http://m.ibiquta.org",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/search.html,{\n  \"body\": \"searchkey={{key}}\",\n  \"method\": \"POST\"\n}",
        "header": "{\"referer\": \"{{source.getKey()}}\",\n\"x-requested-with\": \"mark.via\",\n\"accept-language\": \"zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7\",\n\"user-agent\": \"Mozilla/5.0 (Linux; Android 10; PACM00 Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.5359.79 Mobile Safari/537.36\"}",
        "ruleSearch": {
          "author": "a.1@text",
          "bookList": ".waps_one",
          "bookUrl": "a.0@href",
          "checkKeyWord": "剑来",
          "coverUrl": "a.0@href\n@js:\nvar id=result.match(/(\\d+).html/)[1];\nvar iid=parseInt(id/1000);\n`https://img.ibiquta.info/Cover/${iid}/${id}.jpg`",
          "intro": "",
          "kind": ".fenlei@text&&span.0@text##分类：",
          "name": "a.0@text"
        },
        "ruleBookInfo": {
          "author": ".detail a.0@text",
          "canReName": "true",
          "coverUrl": ".cover img@src",
          "downloadUrls": "#addmark.0@href",
          "intro": ".intro@text",
          "kind": ".detail p.1:2:-1@text\n##类别：|状态：|更新：",
          "lastChapter": ".chapter li.0@text",
          "name": ".caption p@text",
          "tocUrl": "text.更多章节@href",
          "wordCount": ".detail span.-1@text"
        },
        "ruleToc": {
          "chapterList": "#readlist li a",
          "chapterName": "text",
          "chapterUrl": "href"
        },
        "ruleContent": {
          "content": "#content@html",
          "nextContentUrl": "text.下一页@href",
          "replaceRegex": "##（本章未完.*继续阅读）|{{chapter.title}}|\\(第.+页\\)",
          "title": ""
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.coverUrl用了 @js:",
          "详情规则暂不支持 downloadUrls"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🌐 亿软网站",
        "bookSourceUrl": "https://www.yruan.com/",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "https://www.yruan.com/modules/article/search.php?searchkey={{key}}",
        "ruleSearch": {
          "author": "tag.td.2@text",
          "bookList": "class.grid@tag.tr!0",
          "bookUrl": "tag.td.0@tag.a@href",
          "coverUrl": "tag.td.0@tag.a@href@js:\r\nvar id = result.match(/\\/(\\d+)\\.?/)[1];\r\n'/files/article/image/'+parseInt(id/1000)+'/'+id+'/'+id+'s.jpg';",
          "kind": "tag.td.4@text&&\ntag.td.5@text",
          "lastChapter": "tag.td.1@tag.a@text##百度搜索.*",
          "name": "tag.td.0@tag.a@text",
          "wordCount": "tag.td.3@text"
        },
        "ruleBookInfo": {
          "author": "id.info@tag.p.0@text",
          "coverUrl": "id.fmimg@img@src",
          "init": "",
          "intro": "id.intro@tag.p.0@text",
          "kind": "id.info@tag.p.3@text&&\nid.info@tag.p.1@text##日 期：|类 别:",
          "lastChapter": "id.info@tag.p.2@a@text##百度搜索.*",
          "name": "id.info@tag.h1@text",
          "wordCount": ""
        },
        "ruleToc": {
          "chapterList": "id.list@tag.dd",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "id.content@html##<!--go--> |<!--over--> "
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.coverUrl用了 @js:"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🌐 鬼吹灯网",
        "bookSourceUrl": "http://www.gdbzkz.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "http://www.gdbzkz.com/s.php?ie=utf-8&q={{key}}",
        "ruleSearch": {
          "author": "class.author@text##作者：",
          "bookList": "class.bookbox@class.p10",
          "bookUrl": "class.bookname@tag.a@href",
          "coverUrl": "class.bookimg@img@src",
          "intro": "class.bookinfo@p@text",
          "kind": "class.cat@text##分类：",
          "lastChapter": "class.update@tag.a@text##百度搜索.*",
          "name": "class.bookname@tag.a@text##\\（.*|\\(.*|免费阅读|全文.*阅读|最新章节|笔趣阁|小说"
        },
        "ruleBookInfo": {
          "author": "class.small@tag.span.0@text##作 者：",
          "coverUrl": "class.cover@img@src",
          "init": "",
          "intro": "class.intro@textNodes##作者.*|无弹窗.*",
          "kind": "class.info@class.small@tag.span.4@text&&\nclass.info@class.small@tag.span.1@text&&\nclass.info@class.small@tag.span.2@text##分类：|状态：|更新时间：",
          "lastChapter": "class.small@tag.span.5@a@text##百度搜索.*",
          "name": "class.info@h2@text##\\（.*|\\(.*|免费阅读|全文.*阅读|最新章节|笔趣阁|小说",
          "wordCount": "class.info@class.small@tag.span.3@text##字数："
        },
        "ruleToc": {
          "chapterList": "class.listmain@dd!0:1:2:3:4:5:6:7:8:9:10:11",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "id.content@html##http.*html|天才一秒记住.*com|请记住本书首发域.*com"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🌐 爱笔楼网",
        "bookSourceUrl": "https://www.ibiquge.info/",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/search.html?name={{key}}",
        "ruleSearch": {
          "author": "class.s4@tag.a@text",
          "bookList": "class.novelslist2@tag.li!0",
          "bookUrl": "class.s2@tag.a@href",
          "coverUrl": "class.s2@tag.a@href<js>\nvar id = result.match(/(\\d+)\\/?$/)[1];\nvar iid = parseInt(id/1000);\n'https://www.ibiquge.net/files/article/image/'+iid+'/'+id+'/'+id+'s.jpg';\n</js>",
          "lastChapter": "class.s3@tag.a@text##免费章节 |正文卷 |正文 |VIP章节 ",
          "name": "class.s2@tag.a@text"
        },
        "ruleBookInfo": {
          "author": "id.info@tag.p.0@a@text",
          "coverUrl": "id.fmimg@tag.img@src",
          "intro": "id.intro@text",
          "kind": "id.info@tag.p.2@text##最后更新：",
          "lastChapter": "id.info@tag.p.3@a@text##免费章节 |正文卷 |正文 |VIP章节 ",
          "name": "id.info@h1@text"
        },
        "ruleToc": {
          "chapterList": "id.list@tag.dd",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "id.content@html##天才一秒记住.*无广告！|断更反馈|章节错误.*请耐心等待。"
        }
      },
      "check": {
        "ok": false,
        "unsupported": [
          "搜索规则.coverUrl用了 <js>"
        ]
      }
    },
    {
      "source": {
        "bookSourceName": "🌐 猪猪书网",
        "bookSourceUrl": "http://www.zzs5.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/index.php?m=search&c=index&a=init&typeid=2&siteid=1&q={{key}}",
        "ruleSearch": {
          "author": "",
          "bookList": "tbody@tr",
          "bookUrl": "a.1@href",
          "coverUrl": "img@src",
          "kind": "p.0@text##.*：|\\s",
          "name": "a.1@text"
        },
        "ruleBookInfo": {
          "author": "tbody.1@tr.3@td.1@text||.bookd-title@dd@ownText##.*作者.|\\s.*",
          "intro": ".show_content!1@html",
          "kind": ".catpos@a.1@text&&tbody.1@tr.3@td.0@text&&.bookd-title@dd@ownText##.*：|小说|\\s.*",
          "lastChapter": "tbody.1@a@text||.list@a.-1@text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "name": "tbody.0@h1@text||.bookd-title@h1@text##下载",
          "tocUrl": "id.downlink@a.0@href",
          "wordCount": "tbody.1@tr.2@td.1@text##.*："
        },
        "ruleToc": {
          "chapterList": ".list@dd@a",
          "chapterName": "text##正文卷.|正文.|VIP卷.|默认卷.|卷_|VIP章节.|免费章节.|章节目录.|最新章节.|[\\(（【].*?[求更票谢乐发订合补加架字修Kk].*?[】）\\)]",
          "chapterUrl": "href",
          "formatJs": ""
        },
        "ruleContent": {
          "content": ".content!0@html"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "🌐 玄幻阁网",
        "bookSourceUrl": "http://www.xuankuks.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "/modules/article/search.php?s=7673184438602983814&s={{key}}&searchtype=articlename",
        "ruleSearch": {
          "author": "tag.span.1@text",
          "bookList": "id.sitebox@tag.dl",
          "bookUrl": "tag.a.1@href",
          "coverUrl": "tag.img@src",
          "intro": "tag.dd.3@text",
          "kind": "tag.span.2@text&&tag.span.0@text",
          "lastChapter": "tag.a.2@text",
          "name": "tag.a.1@text",
          "wordCount": "tag.span.3@text"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "[property=\"og:image\"]@content",
          "intro": "[property=\"og:description\"]@content",
          "kind": "[property=\"og:novel:category\"]@content&&[property=\"og:novel:status\"]@content&&[property=\"og:novel:update_time\"]@content##\\s.*",
          "lastChapter": "[property=\"og:novel:latest_chapter_name\"]@content##正文卷\\s",
          "name": "[property=\"og:novel:book_name\"]@content",
          "tocUrl": ""
        },
        "ruleToc": {
          "chapterList": "id.readerlist@tag.li",
          "chapterName": "tag.a@text",
          "chapterUrl": "tag.a@href"
        },
        "ruleContent": {
          "content": "id.content@html##随机推荐.*",
          "imageStyle": "0"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "渣渣小说",
        "bookSourceUrl": "https://www.zztxt.net/",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "https://www.zztxt.net/home/search,{\n  \"method\": \"POST\",\n  \"body\": \"action=search&q={{key}}\"\n}",
        "header": "{\n  \"User-Agent\": \"Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Safari/537.36 Core/1.70.3732.400 QQBrowser/10.5.3819.400\"\n}",
        "ruleSearch": {
          "author": "span@text",
          "bookList": "class.fengtui_top@tag.dl",
          "bookUrl": "h3@a@href",
          "coverUrl": "img@src",
          "intro": "p@text",
          "name": "h3@text"
        },
        "ruleBookInfo": {
          "author": ".jieshao@.msg.0@a.0@text",
          "coverUrl": ".jieshao@.lf.0@img@src",
          "intro": ".jieshao@.intro@textNodes##简介：|关键词：|、",
          "kind": ".place@a.1@text&&.msg@em.1@text&&.jieshao@.msg.0@em.2@text##.*：",
          "lastChapter": "class.msg@tag.em.3@text##最新章节：",
          "name": ".jieshao@.rt.0@h1@text",
          "wordCount": ""
        },
        "ruleToc": {
          "chapterList": "class.mulu.1@li",
          "chapterName": "a@text",
          "chapterUrl": "a@href"
        },
        "ruleContent": {
          "content": "id.content@html",
          "replaceRegex": "##https://www.*|请记住本书首发.*"
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    },
    {
      "source": {
        "bookSourceName": "夜书库",
        "bookSourceUrl": "https://m.yeshuku.com",
        "bookSourceGroup": "💫通用源",
        "searchUrl": "https://m.yeshuku.com/modules/article/search.php,{\n  \"body\": \"searchtype=all&searchkey={{key}}\",\n  \"method\": \"POST\"\n}",
        "header": "{\"User-Agent\":\"Mozilla/5.0 (Linux; U; Android 13; zh-Hans-CN; PFJM10 Build/TP1A.220905.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.58 Quark/6.13.6.581 Mobile Safari/537.36\",\"Accept-Language\":\"zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7\"}",
        "ruleSearch": {
          "author": "dd.1@ownText",
          "bookList": "#sitebox@dl",
          "bookUrl": "a.0@href",
          "coverUrl": "img@_src",
          "intro": "a.2@text",
          "kind": "span.0:1@text",
          "name": "a.1@text"
        },
        "ruleBookInfo": {
          "author": "[property=\"og:novel:author\"]@content",
          "coverUrl": "[property=\"og:image\"]@content",
          "intro": "[property=\"og:description\"]@content",
          "kind": "[property~=category|status|update_time]@content",
          "lastChapter": "[property~=las?test_chapter_name]@content",
          "name": "[property=\"og:novel:book_name\"]@content",
          "tocUrl": "text.目录@href"
        },
        "ruleToc": {
          "chapterList": "#readerlist@ul@li@a",
          "chapterName": "text##(.*)\\s\\-\\s.*##$1",
          "chapterUrl": "href",
          "nextTocUrl": "option@value",
          "updateTime": "text##.*\\s\\-\\s(.*)##$1"
        },
        "ruleContent": {
          "content": "#YiJianZhan@html",
          "nextContentUrl": ""
        }
      },
      "check": {
        "ok": true,
        "unsupported": []
      }
    }
  ]
};
