import UIKit
import WebKit

/**
 * EBOOK 自带的网页页面（iOS 版，对应安卓的 WebActivity、Windows 的 open_lanzou / open_web），两种用法：
 *   蓝奏云：提取码自动填好，用户自己点下载；下完的文件交给 EbookNativePlugin，走「用 EBOOK 打开」同一条入架路，然后自动关掉回到 EBOOK。
 *           不绕过蓝奏云的任何校验：页面、验证、点击都是用户在真实网页里完成的，这里只接住最后那个下载。
 *   网页：  订阅源里只给了网址、或规则要执行脚本的，在这里看它的网页。下载到的 EPUB / TXT / ZIP 同样进书架，
 *           别的文件交给 Safari 去下。订阅源里的 injectJs 不注入（不执行源里的脚本）。
 * 顶上是系统导航栏（iOS 26 起是液态玻璃）：左边关闭，右边在 Safari 里打开；标题下面一行小字是提示 / 下载进度。
 */
final class WebPageViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {

    static func isWeb(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased(), url.host != nil else { return false }
        return scheme == "https" || scheme == "http"
    }

    static func isLanzou(_ url: URL) -> Bool {
        guard url.scheme?.lowercased() == "https", let host = url.host?.lowercased() else { return false }
        return host.contains("lanzo") || host.hasSuffix("lanzn.com")
    }

    /// 蓝奏云的文件链接、下载按钮（在 iframe 里）常用 target=_blank / window.open：统统改成在本页打开，下载才接得住（和安卓同一段）
    private static let sameWindow = "(function(){if(window.__ebookSame)return;window.__ebookSame=1;document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[target]');if(a&&a.target!=='_self'&&a.target!=='_top')a.target='_top';},true);window.open=function(u){if(u){var h=new URL(u,location.href).href;try{window.top.location.href=h;}catch(_){location.href=h;}}return null;};})();"

    private let startURL: URL
    private let lanzou: Bool
    private let pwd: String
    private let pageTitle: String
    private var webView: WKWebView!
    private let progress = UIProgressView(progressViewStyle: .bar)
    private let titleLabel = UILabel()
    private let statusLabel = UILabel()
    private var loadObservation: NSKeyValueObservation?
    private var downloadObservation: NSKeyValueObservation?
    private var downloading = false
    private var downloadName = "book"
    private var downloadDir: URL?

    init(url: URL, lanzou: Bool, pwd: String, title: String) {
        self.startURL = url
        self.lanzou = lanzou
        self.pwd = pwd
        self.pageTitle = title.isEmpty ? (lanzou ? "蓝奏云" : "网页") : title
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        // 标题两行：书名 / 提示（下载进度也写在这一行）
        titleLabel.text = pageTitle
        titleLabel.font = .preferredFont(forTextStyle: .headline)
        titleLabel.lineBreakMode = .byTruncatingTail
        statusLabel.font = .preferredFont(forTextStyle: .caption1)
        statusLabel.textColor = .secondaryLabel
        statusLabel.lineBreakMode = .byTruncatingTail
        let titles = UIStackView(arrangedSubviews: [titleLabel, statusLabel])
        titles.axis = .vertical
        titles.alignment = .center
        navigationItem.titleView = titles
        say(lanzou ? (pwd.isEmpty ? "点下载，下完自动放进书架" : "提取码已自动填好 · 点下载，下完自动放进书架") : (startURL.host ?? ""))

        navigationItem.leftBarButtonItem = UIBarButtonItem(barButtonSystemItem: .close, target: self, action: #selector(close))
        navigationItem.rightBarButtonItem = UIBarButtonItem(image: UIImage(systemName: "safari"), style: .plain, target: self, action: #selector(openInSafari))

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.websiteDataStore = .default()
        let scripts = config.userContentController
        // 注入到所有 frame（下载按钮在 iframe 里）
        scripts.addUserScript(WKUserScript(source: WebPageViewController.sameWindow, injectionTime: .atDocumentStart, forMainFrameOnly: false))
        if lanzou && !pwd.isEmpty, let quoted = try? String(data: JSONSerialization.data(withJSONObject: [pwd]), encoding: .utf8) {
            let fill = "(function(){var P=\(quoted)[0];if(!P||window.top!==window)return;var n=0;var t=setInterval(function(){n++;var i=document.querySelector('#pwd,input[name=\"pwd\"]');if(i&&!i.dataset.ebook){i.dataset.ebook='1';i.value=P;i.dispatchEvent(new Event('input',{bubbles:true}));var b=document.querySelector('#sub,.passwddiv-btn,#passwddiv .btn,input[type=\"submit\"]');if(b)b.click();clearInterval(t);}if(n>40)clearInterval(t);},250);})();"
            scripts.addUserScript(WKUserScript(source: fill, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.translatesAutoresizingMaskIntoConstraints = false
        progress.translatesAutoresizingMaskIntoConstraints = false
        progress.isHidden = true
        view.addSubview(webView)
        view.addSubview(progress)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progress.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            progress.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progress.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        loadObservation = webView.observe(\.estimatedProgress, options: [.new]) { [weak self] web, _ in
            guard let self = self, !self.downloading else { return }
            self.progress.isHidden = web.estimatedProgress >= 1
            self.progress.progress = Float(web.estimatedProgress)
        }
        webView.load(URLRequest(url: startURL))
    }

    @objc private func close() {
        dismiss(animated: true)
    }

    @objc private func openInSafari() {
        UIApplication.shared.open(webView.url ?? startURL)
    }

    private func say(_ text: String, color: UIColor = .secondaryLabel) {
        statusLabel.text = text
        statusLabel.textColor = color
    }

    // MARK: - 导航：只在本页走 http(s)；页面想拉起别的 App 一律不理；新窗口留在本页

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url, let scheme = url.scheme?.lowercased() else { decisionHandler(.cancel); return }
        if scheme == "about" || scheme == "blob" || scheme == "data" { decisionHandler(.allow); return }
        guard scheme == "https" || scheme == "http" else { decisionHandler(.cancel); return }
        decisionHandler(navigationAction.shouldPerformDownload ? .download : .allow)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let disposition = (navigationResponse.response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition") ?? ""
        let attachment = disposition.lowercased().contains("attachment")
        guard navigationResponse.isForMainFrame || attachment, attachment || !navigationResponse.canShowMIMEType else {
            decisionHandler(.allow); return
        }
        // 网页模式：只收书；别的文件（安装包、视频、图片…）交给 Safari 去下
        let name = navigationResponse.response.suggestedFilename ?? ""
        if !lanzou && !WebPageViewController.looksLikeBook(name, navigationResponse.response.mimeType), let url = navigationResponse.response.url {
            UIApplication.shared.open(url)
            decisionHandler(.cancel); return
        }
        decisionHandler(.download)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url, WebPageViewController.isWeb(url) {
            webView.load(navigationAction.request)
        }
        return nil
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    // MARK: - 下载：存到临时目录，确认不是网页（蓝奏云的人机验证页也会走到这里），补上扩展名，交给书架

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        if downloading { completionHandler(nil); return }
        downloading = true
        let bad = CharacterSet(charactersIn: "\\/:*?\"<>|").union(.controlCharacters)
        let cleaned = suggestedFilename.components(separatedBy: bad).joined(separator: "_")
        downloadName = cleaned.isEmpty ? "book" : cleaned
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("lanzou-" + UUID().uuidString, isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        downloadDir = dir
        say("正在下载…")
        progress.isHidden = false
        progress.progress = 0
        downloadObservation = download.progress.observe(\.fractionCompleted, options: [.new]) { [weak self] p, _ in
            DispatchQueue.main.async {
                guard let self = self else { return }
                let got = Double(p.completedUnitCount) / 1_048_576, total = Double(p.totalUnitCount) / 1_048_576
                self.progress.progress = Float(p.fractionCompleted)
                self.say(total > 0 ? String(format: "正在下载… %.1f / %.1f MB", got, total) : String(format: "正在下载… %.1f MB", got))
            }
        }
        completionHandler(dir.appendingPathComponent(downloadName))
    }

    func downloadDidFinish(_ download: WKDownload) {
        downloadObservation = nil
        guard let dir = downloadDir else { return }
        let file = dir.appendingPathComponent(downloadName)
        do {
            let size = try file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            if size > EbookNativePlugin.maxFile { throw Failure("文件太大") }
            let handle = try FileHandle(forReadingFrom: file)
            let head = (try handle.read(upToCount: 64)) ?? Data()
            try? handle.close()
            let start = String(decoding: head, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if start.hasPrefix("<") { throw Failure("拿到的是网页") }
            let final = WebPageViewController.fixExtension(file, head: head)
            EbookNativePlugin.offer(file: final, move: true)
            try? FileManager.default.removeItem(at: dir)
            downloading = false
            progress.isHidden = true
            if lanzou {
                say("下好了，正在放进书架…")
                dismiss(animated: true)
            } else {
                // 网页模式留在页面上，可以接着看
                say("\(final.lastPathComponent) 已放进书架", color: .systemGreen)
            }
        } catch {
            fail(error)
        }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        fail(error)
    }

    private func fail(_ error: Error) {
        downloadObservation = nil
        if let dir = downloadDir { try? FileManager.default.removeItem(at: dir) }
        downloading = false
        progress.isHidden = true
        let reason = (error as? Failure)?.reason ?? error.localizedDescription
        say("没下成（\(reason)），再点一次下载试试", color: .systemRed)
    }

    private struct Failure: Error {
        let reason: String
        init(_ reason: String) { self.reason = reason }
    }

    /// 名字里没有 .epub / .txt / .zip 的，按内容补上（EPUB 是 zip，开头紧跟 mimetype）
    private static func fixExtension(_ file: URL, head: Data) -> URL {
        let ext = file.pathExtension.lowercased()
        if ext == "epub" || ext == "txt" || ext == "zip" { return file }
        let text = String(decoding: head, as: UTF8.self)
        let add = text.hasPrefix("PK") ? (text.contains("epub") ? "epub" : "zip") : "txt"
        let to = file.appendingPathExtension(add)
        return (try? FileManager.default.moveItem(at: file, to: to)) != nil ? to : file
    }

    private static func looksLikeBook(_ name: String, _ mime: String?) -> Bool {
        let lower = name.lowercased()
        if lower.hasSuffix(".epub") || lower.hasSuffix(".txt") || lower.hasSuffix(".zip") { return true }
        let m = (mime ?? "").lowercased()
        return m.contains("epub") || m.contains("zip") || m == "text/plain"
    }
}
