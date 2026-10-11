import Capacitor
import UIKit
import WebKit

// Only the bundled app has a Capacitor bridge. Remote pages use a separate WKWebView.
class EbookViewController: CAPBridgeViewController {
    var immersive = false
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(EbookNative())
    }
    override var prefersHomeIndicatorAutoHidden: Bool { immersive }
}

enum EbookFiles {
    static let limit = 120 * 1024 * 1024
    static let changed = Notification.Name("EbookFileAvailable")
    static let queue = DispatchQueue(label: "app.librarium.reader.files")
    static var pending: [URL] = [] // accessed only on queue; includes cold-start files

    static func safeName(_ value: String) -> String {
        let name = value.components(separatedBy: CharacterSet(charactersIn: "/\\:*?\"<>|").union(.controlCharacters)).joined(separator: "_")
        return name.isEmpty || name == "." || name == ".." ? "book.zip" : String(name.prefix(180))
    }

    static func offer(_ url: URL, completion: ((Error?) -> Void)? = nil) {
        queue.async {
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            do {
                let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size > 0, size <= limit else { throw NSError(domain: "EBOOK", code: 1, userInfo: [NSLocalizedDescriptionKey: "文件为空或超过 120 MB"]) }
                let dir = FileManager.default.temporaryDirectory.appendingPathComponent("ebook-import-" + UUID().uuidString)
                try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
                let copy = dir.appendingPathComponent(safeName(url.lastPathComponent))
                try FileManager.default.copyItem(at: url, to: copy)
                pending.append(copy)
                DispatchQueue.main.async {
                    NotificationCenter.default.post(name: changed, object: nil)
                    completion?(nil)
                }
            } catch { DispatchQueue.main.async { completion?(error) } }
        }
    }
}

@objc(EbookNative)
public class EbookNative: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "EbookNative"
    public let jsName = "EbookNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "ready", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBars", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setImmersive", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consumeFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "beginSave", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "appendSave", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endSave", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openWeb", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openLanzou", returnType: CAPPluginReturnPromise)
    ]
    private var observer: NSObjectProtocol?
    private var saves: [String: URL] = [:] // file queue only
    private var exportCall: CAPPluginCall?
    private var exportURL: URL?

    public override func load() {
        observer = NotificationCenter.default.addObserver(forName: EbookFiles.changed, object: nil, queue: .main) { [weak self] _ in
            self?.notifyListeners("fileOpened", data: [:])
        }
    }
    deinit { if let observer = observer { NotificationCenter.default.removeObserver(observer) } }

    @objc func ready(_ call: CAPPluginCall) { call.resolve() }
    @objc func setBars(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            (self.bridge?.viewController as? EbookViewController)?.setStatusBarStyle(call.getBool("dark") == true ? .lightContent : .darkContent)
            call.resolve()
        }
    }
    @objc func setImmersive(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let view = self.bridge?.viewController as? EbookViewController {
                view.immersive = call.getBool("on") ?? false
                view.setStatusBarVisible(!view.immersive)
                view.setNeedsUpdateOfHomeIndicatorAutoHidden()
            }
            call.resolve()
        }
    }
    @objc func consumeFile(_ call: CAPPluginCall) {
        EbookFiles.queue.async {
            guard !EbookFiles.pending.isEmpty else { call.resolve(); return }
            let url = EbookFiles.pending.removeFirst()
            defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
            do {
                let data = try Data(contentsOf: url)
                call.resolve(["name": url.lastPathComponent, "data": data.base64EncodedString()])
            } catch { call.reject("读取文件失败", nil, error) }
            if !EbookFiles.pending.isEmpty {
                DispatchQueue.main.async { self.notifyListeners("fileOpened", data: [:]) }
            }
        }
    }
    @objc func beginSave(_ call: CAPPluginCall) {
        EbookFiles.queue.async {
            do {
                let token = UUID().uuidString
                let dir = FileManager.default.temporaryDirectory.appendingPathComponent("ebook-export-" + token)
                try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
                let url = dir.appendingPathComponent(EbookFiles.safeName(call.getString("name") ?? "EBOOK.zip"))
                try Data().write(to: url)
                self.saves[token] = url
                call.resolve(["token": token])
            } catch { call.reject("无法创建导出文件", nil, error) }
        }
    }
    @objc func appendSave(_ call: CAPPluginCall) {
        EbookFiles.queue.async {
            guard let url = self.saves[call.getString("token") ?? ""],
                  let data = Data(base64Encoded: call.getString("data") ?? "") else { call.reject("导出数据无效"); return }
            do {
                let file = try FileHandle(forWritingTo: url)
                defer { try? file.close() }
                try file.seekToEnd()
                try file.write(contentsOf: data)
                call.resolve()
            } catch { call.reject("写入导出文件失败", nil, error) }
        }
    }
    @objc func endSave(_ call: CAPPluginCall) {
        EbookFiles.queue.async {
            guard let url = self.saves.removeValue(forKey: call.getString("token") ?? "") else { call.reject("导出已失效"); return }
            DispatchQueue.main.async {
                guard let view = self.bridge?.viewController, view.presentedViewController == nil, self.exportCall == nil else {
                    try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
                    call.reject("请先关闭当前窗口，再导出"); return
                }
                self.exportCall = call
                self.exportURL = url
                let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
                picker.delegate = self
                picker.isModalInPresentation = true
                view.present(picker, animated: true)
            }
        }
    }
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        exportCall?.resolve(["path": "文件 App 中所选的位置"])
        finishExport()
    }
    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        exportCall?.reject("已取消导出")
        finishExport()
    }
    private func finishExport() {
        if let url = exportURL { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        exportURL = nil; exportCall = nil
    }
    @objc func openWeb(_ call: CAPPluginCall) { open(call, lanzou: false) }
    @objc func openLanzou(_ call: CAPPluginCall) { open(call, lanzou: true) }
    private func open(_ call: CAPPluginCall, lanzou: Bool) {
        guard let url = URL(string: call.getString("url") ?? ""),
              ["https", "http"].contains(url.scheme?.lowercased() ?? ""), url.host != nil else {
            call.reject("只能打开网页地址"); return
        }
        DispatchQueue.main.async {
            guard let view = self.bridge?.viewController, view.presentedViewController == nil else {
                call.reject("请先关闭当前窗口"); return
            }
            let browser = EbookBrowser(url: url, title: call.getString("title") ?? "网页", password: lanzou ? call.getString("pwd") : nil)
            let nav = UINavigationController(rootViewController: browser)
            nav.modalPresentationStyle = .fullScreen
            view.present(nav, animated: true)
            call.resolve()
        }
    }
}

final class EbookBrowser: UIViewController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private let initialURL: URL
    private let password: String?
    private var web: WKWebView!
    private var download: WKDownload?
    private var destination: URL?
    private var progress: NSKeyValueObservation?

    init(url: URL, title: String, password: String?) {
        initialURL = url; self.password = password
        super.init(nibName: nil, bundle: nil)
        self.title = title.isEmpty ? "网页" : title
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        navigationItem.leftBarButtonItem = UIBarButtonItem(title: "完成", style: .done, target: self, action: #selector(close))
        navigationItem.rightBarButtonItem = UIBarButtonItem(title: "后退", style: .plain, target: self, action: #selector(goBack))
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        // No message handlers or Capacitor objects are registered on this view.
        if let password = password, !password.isEmpty,
           let data = try? JSONSerialization.data(withJSONObject: [password]), let json = String(data: data, encoding: .utf8) {
            let script = """
            (()=>{if(!/(^|\\.)[a-z0-9-]*lanz[a-z0-9-]*\\.(com|net|cn)$/i.test(location.hostname))return;
            const p=\(json)[0];let n=0;const t=setInterval(()=>{const i=document.querySelector('#pwd,input[name="pwd"]');
            if(i){i.value=p;i.dispatchEvent(new Event('input',{bubbles:true}));clearInterval(t);}if(++n>40)clearInterval(t);},250);})();
            """
            config.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: false))
        }
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self; web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            web.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        web.load(URLRequest(url: initialURL))
    }
    @objc private func goBack() { if web.canGoBack { web.goBack() } }
    @objc private func close() {
        download?.cancel { _ in }
        progress = nil
        web.stopLoading()
        cleanup()
        dismiss(animated: true)
    }
    private func cleanup() {
        if let destination = destination { try? FileManager.default.removeItem(at: destination.deletingLastPathComponent()) }
        destination = nil
    }
    private func showError(_ message: String) {
        let alert = UIAlertController(title: "下载失败", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "好", style: .default))
        if presentedViewController == nil { present(alert, animated: true) }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let scheme = navigationAction.request.url?.scheme?.lowercased(), ["http", "https", "blob", "about"].contains(scheme) else { decisionHandler(.cancel); return }
        decisionHandler(navigationAction.shouldPerformDownload ? .download : .allow)
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let response = navigationResponse.response
        let ext = response.url?.pathExtension.lowercased() ?? ""
        let mime = response.mimeType ?? ""
        let attachment = (response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition")?.lowercased().contains("attachment") == true
        let book = ["epub", "txt", "zip"].contains(ext) || ["application/epub+zip", "application/zip"].contains(mime)
        if attachment || book || !navigationResponse.canShowMIMEType {
            guard response.expectedContentLength <= EbookFiles.limit else { decisionHandler(.cancel); showError("文件超过 120 MB"); return }
            decisionHandler(.download)
        } else { decisionHandler(.allow) }
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, let scheme = navigationAction.request.url?.scheme, ["http", "https"].contains(scheme) { webView.load(navigationAction.request) }
        return nil
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { receive(download) }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { receive(download) }
    private func receive(_ newDownload: WKDownload) {
        guard download == nil else { newDownload.cancel { _ in }; return }
        download = newDownload; newDownload.delegate = self
        navigationItem.prompt = "正在下载…"
        progress = newDownload.progress.observe(\.completedUnitCount) { [weak self] value, _ in
            DispatchQueue.main.async {
                guard let self = self, self.download != nil else { return }
                if value.completedUnitCount > EbookFiles.limit {
                    self.download?.cancel { _ in }
                    self.download = nil; self.progress = nil; self.cleanup()
                    self.showError("文件超过 120 MB")
                } else { self.navigationItem.prompt = String(format: "正在下载 %.1f MB", Double(value.completedUnitCount) / 1048576) }
            }
        }
    }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        do {
            let dir = FileManager.default.temporaryDirectory.appendingPathComponent("ebook-download-" + UUID().uuidString)
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let url = dir.appendingPathComponent(EbookFiles.safeName(suggestedFilename))
            destination = url; completionHandler(url)
        } catch { completionHandler(nil); showError(error.localizedDescription) }
    }
    func downloadDidFinish(_ download: WKDownload) {
        self.download = nil; progress = nil
        guard var url = destination else { return }
        do {
            let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            guard size > 0, size <= EbookFiles.limit else { throw NSError(domain: "EBOOK", code: 1, userInfo: [NSLocalizedDescriptionKey: "文件为空或超过 120 MB"]) }
            let file = try FileHandle(forReadingFrom: url)
            let head = try file.read(upToCount: 512) ?? Data()
            try file.close()
            let start = String(decoding: head, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard !start.hasPrefix("<") else { throw NSError(domain: "EBOOK", code: 2, userInfo: [NSLocalizedDescriptionKey: "下载到的是网页，请完成验证后重试"]) }
            if !["epub", "txt", "zip"].contains(url.pathExtension.lowercased()) {
                guard url.pathExtension.isEmpty || ["bin", "download"].contains(url.pathExtension.lowercased()) else {
                    throw NSError(domain: "EBOOK", code: 3, userInfo: [NSLocalizedDescriptionKey: "只支持 EPUB、TXT 和 ZIP 书籍"])
                }
                let ext = head.starts(with: [0x50, 0x4b]) ? (start.contains("application/epub+zip") ? "epub" : "zip") : "txt"
                let renamed = url.appendingPathExtension(ext)
                try FileManager.default.moveItem(at: url, to: renamed)
                url = renamed; destination = renamed
            }
            EbookFiles.offer(url) { [weak self] error in
                guard let self = self else { return }
                self.cleanup()
                if let error = error { self.showError(error.localizedDescription) }
                else { self.dismiss(animated: true) }
            }
        } catch { cleanup(); showError(error.localizedDescription) }
    }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        self.download = nil; progress = nil; cleanup()
        navigationItem.prompt = nil
        if (error as NSError).code != NSURLErrorCancelled { showError(error.localizedDescription) }
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: webView.url?.host, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "好", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: webView.url?.host, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "好", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }
}
