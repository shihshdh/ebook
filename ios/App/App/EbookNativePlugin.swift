import UIKit
import Capacitor
import UniformTypeIdentifiers

/**
 * EBOOK 自己的原生插件（iOS 版；前端在 src/lib/native.js 里调用，和安卓的 EbookNative.java 同名同参数）：
 *   ready()               页面画好第一帧了（iOS 的启动页由系统自己撤，这里只回个话）
 *   setBars({dark})       状态栏文字跟主题：深色主题用浅色字，反之用深色字；底色跟着换
 *   setImmersive({on})    阅读时藏起状态栏和底部横条，离开阅读器恢复
 *   consumeFile()         取走「用 EBOOK 打开 / 分享到 EBOOK」带进来、或蓝奏云 / 网页页面下好的文件：{ name, data(base64) }，没有就 {}
 *   事件 fileOpened         有新文件带进来了，前端收到后调 consumeFile
 *   openLanzou({url,pwd,title})  打开蓝奏云下载页（WebPageViewController）：提取码自动填，下完的文件经 consumeFile 进书架
 *   openWeb({url,title})  订阅源的网页（同一个页面的网页模式），下到的书同样进书架
 *   openExternal({url})   交给 Safari 打开（检查更新下安装包）
 *   beginSave / appendSave / endSave   导出：分块写临时文件，最后弹「存储到文件」让用户选文件夹
 *   installApk            iOS 不能在应用里装更新：直接报错（前端在 iOS 上不会调）
 */
@objc(EbookNativePlugin)
public class EbookNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EbookNativePlugin"
    public let jsName = "EbookNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "ready", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBars", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setImmersive", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consumeFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openLanzou", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openWeb", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openExternal", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "beginSave", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "appendSave", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endSave", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "installApk", returnType: CAPPluginReturnPromise),
    ]

    static let ivory = UIColor(red: 0xF4 / 255.0, green: 0xEF / 255.0, blue: 0xE6 / 255.0, alpha: 1)
    static let ink = UIColor(red: 0x08 / 255.0, green: 0x07 / 255.0, blue: 0x06 / 255.0, alpha: 1)
    static let maxFile = 120 * 1024 * 1024

    // 插件方法在 Capacitor 的后台队列里调，「用 EBOOK 打开」在主线程进来：共用的状态都拿锁护着
    private static let lock = NSLock()
    private static weak var instance: EbookNativePlugin?
    /// 等着前端取走的文件（已经拷进本应用的临时目录）
    private static var pending: [URL] = []
    private var saves: [String: URL] = [:]
    private var exporter: Exporter?

    override public func load() {
        EbookNativePlugin.lock.lock()
        EbookNativePlugin.instance = self
        let waiting = !EbookNativePlugin.pending.isEmpty
        EbookNativePlugin.lock.unlock()
        if waiting { notifyListeners("fileOpened", data: [:], retainUntilConsumed: true) }
    }

    // MARK: - 带进来的文件

    /// 「用 EBOOK 打开」：系统给的地址可能在别的应用的沙盒里（要申请访问）或本应用的 Inbox 里，先拷到自己的临时目录
    static func offer(file url: URL, move: Bool = false) {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("incoming-" + UUID().uuidString, isDirectory: true)
        let dest = dir.appendingPathComponent(url.lastPathComponent.isEmpty ? "book" : url.lastPathComponent)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            if move { try FileManager.default.moveItem(at: url, to: dest) } else { try FileManager.default.copyItem(at: url, to: dest) }
        } catch {
            CAPLog.print("[EbookNative] 拿不到带进来的文件：\(error.localizedDescription)")
            return
        }
        // 系统拷进 Documents/Inbox 的副本用完就删，不占地方
        if !move, url.path.contains("/Documents/Inbox/") { try? FileManager.default.removeItem(at: url) }
        lock.lock()
        pending.append(dest)
        let plugin = instance
        lock.unlock()
        plugin?.notifyListeners("fileOpened", data: [:], retainUntilConsumed: true)
    }

    @objc func consumeFile(_ call: CAPPluginCall) {
        EbookNativePlugin.lock.lock()
        let url = EbookNativePlugin.pending.isEmpty ? nil : EbookNativePlugin.pending.removeFirst()
        let more = !EbookNativePlugin.pending.isEmpty
        EbookNativePlugin.lock.unlock()
        guard let url = url else { call.resolve([:]); return }
        defer {
            try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
            if more { notifyListeners("fileOpened", data: [:], retainUntilConsumed: true) }
        }
        do {
            let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            if size > EbookNativePlugin.maxFile { call.reject("文件太大"); return }
            let data = try Data(contentsOf: url)
            call.resolve(["name": url.lastPathComponent, "data": data.base64EncodedString()])
        } catch {
            call.reject("读不到这个文件：\(error.localizedDescription)")
        }
    }

    // MARK: - 界面

    @objc func ready(_ call: CAPPluginCall) {
        call.resolve()
    }

    @objc func setBars(_ call: CAPPluginCall) {
        let dark = call.getBool("dark") ?? false
        DispatchQueue.main.async {
            guard let main = self.bridge?.viewController as? MainViewController else { return }
            main.setStatusBarStyle(dark ? .lightContent : .darkContent)
            main.paint(dark ? EbookNativePlugin.ink : EbookNativePlugin.ivory)
        }
        call.resolve()
    }

    @objc func setImmersive(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        DispatchQueue.main.async {
            guard let main = self.bridge?.viewController as? MainViewController else { return }
            main.setStatusBarVisible(!on)
            main.immersive = on
        }
        call.resolve()
    }

    // MARK: - 网页（蓝奏云 / 订阅源）

    @objc func openLanzou(_ call: CAPPluginCall) {
        guard let url = URL(string: call.getString("url") ?? ""), WebPageViewController.isLanzou(url) else {
            call.reject("只支持蓝奏云链接"); return
        }
        present(WebPageViewController(url: url, lanzou: true, pwd: call.getString("pwd") ?? "", title: call.getString("title") ?? ""), call)
    }

    @objc func openWeb(_ call: CAPPluginCall) {
        guard let url = URL(string: call.getString("url") ?? ""), WebPageViewController.isWeb(url) else {
            call.reject("只能打开网页地址"); return
        }
        present(WebPageViewController(url: url, lanzou: false, pwd: "", title: call.getString("title") ?? ""), call)
    }

    private func present(_ page: @autoclosure @escaping () -> WebPageViewController, _ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let host = self.bridge?.viewController else { call.reject("界面还没准备好"); return }
            let nav = UINavigationController(rootViewController: page())
            nav.modalPresentationStyle = .fullScreen
            host.present(nav, animated: true)
            call.resolve()
        }
    }

    @objc func openExternal(_ call: CAPPluginCall) {
        guard let url = URL(string: call.getString("url") ?? ""), WebPageViewController.isWeb(url) else {
            call.reject("只能打开网页地址"); return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { ok in
                if ok { call.resolve() } else { call.reject("打不开 Safari") }
            }
        }
    }

    // MARK: - 导出

    @objc func beginSave(_ call: CAPPluginCall) {
        let token = UUID().uuidString
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("export-\(token).part")
        guard FileManager.default.createFile(atPath: url.path, contents: nil) else { call.reject("没法创建临时文件"); return }
        EbookNativePlugin.lock.lock()
        saves[token] = url
        EbookNativePlugin.lock.unlock()
        call.resolve(["token": token])
    }

    @objc func appendSave(_ call: CAPPluginCall) {
        EbookNativePlugin.lock.lock()
        let url = saves[call.getString("token") ?? ""]
        EbookNativePlugin.lock.unlock()
        guard let url = url else { call.reject("导出已失效"); return }
        guard let data = Data(base64Encoded: call.getString("data") ?? "") else { call.reject("数据不对"); return }
        do {
            let handle = try FileHandle(forWritingTo: url)
            defer { try? handle.close() }
            try handle.seekToEnd()
            try handle.write(contentsOf: data)
            call.resolve()
        } catch {
            call.reject("写入失败：\(error.localizedDescription)")
        }
    }

    /// 写好的临时文件改成正式文件名，弹「存储到文件」：用户选好文件夹才算导出成功，取消就报「没有保存」
    @objc func endSave(_ call: CAPPluginCall) {
        EbookNativePlugin.lock.lock()
        let part = saves.removeValue(forKey: call.getString("token") ?? "")
        EbookNativePlugin.lock.unlock()
        guard let part = part else { call.reject("导出已失效"); return }
        let bad = CharacterSet(charactersIn: "\\/:*?\"<>|")
        let name = (call.getString("name") ?? "EBOOK账户.zip").components(separatedBy: bad).joined(separator: "_")
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("export-" + UUID().uuidString, isDirectory: true)
        let file = dir.appendingPathComponent(name)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try FileManager.default.moveItem(at: part, to: file)
        } catch {
            try? FileManager.default.removeItem(at: part)
            call.reject("保存失败：\(error.localizedDescription)"); return
        }
        DispatchQueue.main.async {
            guard let host = self.bridge?.viewController else { call.reject("界面还没准备好"); return }
            let exporter = Exporter(file: file) { [weak self] picked in
                try? FileManager.default.removeItem(at: dir)
                self?.exporter = nil
                if let picked = picked {
                    call.resolve(["path": "「文件」里的 \(picked.deletingLastPathComponent().lastPathComponent)/\(picked.lastPathComponent)"])
                } else {
                    call.reject("没有保存")
                }
            }
            self.exporter = exporter
            host.present(exporter.picker, animated: true)
        }
    }

    @objc func installApk(_ call: CAPPluginCall) {
        call.reject("iOS 上不能在应用里安装更新")
    }
}

/// 「存储到文件」面板：选好文件夹回调存到的位置，取消回调 nil
final class Exporter: NSObject, UIDocumentPickerDelegate {
    let picker: UIDocumentPickerViewController
    private let done: (URL?) -> Void
    private var finished = false

    init(file: URL, done: @escaping (URL?) -> Void) {
        self.picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
        self.done = done
        super.init()
        picker.delegate = self
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        finish(urls.first)
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        finish(nil)
    }

    private func finish(_ url: URL?) {
        if finished { return }
        finished = true
        done(url)
    }
}
