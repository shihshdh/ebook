// comic-test.mjs 用的假漫画源：照 Venera 源的写法，把沙箱实现的宿主接口都用一遍。
// 网络请求由测试脚本按网址回固定内容（见 comic-test.mjs 的 FIXTURE_HTTP）。
class FixtureSource extends ComicSource {
  name = "测试源"
  key = "fixture"
  version = "1.0.0"
  minAppVersion = "1.0.0"
  url = ""

  settings = {
    domain: { title: "域名", type: "select", options: [{ value: "a.test" }, { value: "b.test" }], default: "a.test" },
    quality: { title: "画质", type: "input", default: "high" },
    reset: { title: "清除存档", type: "callback", buttonText: "清除", callback: () => { this.deleteData("visits") } },
  }

  get base() { return `https://${this.loadSetting("domain")}` }

  init() {
    // 同 copy_manga：运行时把设置改成字符串。Venera 的设置默认值在装载时就定了，这里不该生效
    this.settings.quality = "runtime-changed"
    this.saveData("visits", (this.loadData("visits") || 0) + 1)
  }

  search = {
    load: async (keyword, options, page) => {
      Network.setCookies(this.base, [new Cookie({ name: "sid", value: "abc", domain: this.loadSetting("domain") })])
      let res = await Network.get(`${this.base}/search?q=${encodeURIComponent(keyword)}&sort=${options[0]}&page=${page}`)
      if (res.status !== 200) throw `Invalid status code: ${res.status}`
      let doc = new HtmlDocument(res.body)
      let comics = doc.querySelectorAll("li.item").map(e => new Comic({
        id: e.attributes["data-id"],
        title: e.querySelector(".title").text.trim(),
        subTitle: e.querySelector(".author")?.text ?? "",
        cover: e.querySelector("img").attributes["src"],
        tags: e.querySelectorAll(".tag").map(t => t.text),
        description: e.children.length + " children; next=" + (e.nextElementSibling?.localName ?? "none"),
      }))
      doc.dispose()
      return { comics, maxPage: 3 }
    },
    optionList: [
      { label: "排序", type: "select", options: ["hot-最热", "new-最新"] },
      { label: "标签", type: "multi-select", options: ["a-甲", "b-乙"], default: ["b"] },
    ],
  }

  comic = {
    loadInfo: async (id) => {
      let res = await Network.post(`${this.base}/info`, { "Content-Type": "application/x-www-form-urlencoded" }, { id: id, n: 1 })
      let data = JSON.parse(res.body)
      let groups = new Map()
      for (let g of data.groups) {
        let chapters = new Map()
        for (let c of g.chapters) chapters.set(c.id, c.title)
        groups.set(g.name, chapters)
      }
      return new ComicDetails({
        title: data.title, subTitle: data.author, cover: data.cover, description: data.intro,
        tags: { "作者": [data.author], "题材": data.tags }, chapters: groups,
        recommend: [new Comic({ id: "r1", title: "推荐", cover: "" })],
      })
    },
    loadEp: async (comicId, epId) => {
      // 用 hmac 签名、AES 解密拿到图片列表（和 copy_manga、ccc 的写法一样）
      let ts = "1700000000"
      let sig = Convert.hmacString(Convert.encodeUtf8("secret"), Convert.encodeUtf8(`${comicId}:${epId}:${ts}`), "sha256")
      let res = await Network.get(`${this.base}/ep/${comicId}/${epId}?sig=${sig}`, { "user-agent": "FixtureUA/1.0" })
      let data = JSON.parse(res.body)
      let key = Convert.encodeUtf8(data.key), iv = Convert.encodeUtf8(data.iv)
      let plain = new Uint8Array(Convert.decryptAesCbc(Convert.decodeBase64(data.payload), key, iv))
      let pad = plain[plain.length - 1]
      let images = JSON.parse(Convert.decodeUtf8(plain.slice(0, plain.length - pad).buffer))
      return { images: images.map(p => `${this.base}${p}?q=${this.loadSetting("quality")}`) }
    },
    onImageLoad: (url, comicId, epId) => ({
      headers: { Referer: `${this.base}/ep/${comicId}/${epId}` },
      onResponse: (buffer) => {
        // 图片按字节异或 0x5a「加密」过
        let bytes = new Uint8Array(buffer)
        return bytes.map(b => b ^ 0x5a).buffer
      },
    }),
    onThumbnailLoad: (url) => ({ headers: { Referer: this.base + "/" } }),
  }
}
