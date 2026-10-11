import UIKit
import WebKit
import Capacitor

// 场景：窗口和根视图由 Info.plist 的 UISceneStoryboardFile（Main.storyboard → MainViewController）建好，
// 这里只管「用 EBOOK 打开 / 分享到 EBOOK」带进来的文件：冷启动时在 connectionOptions 里，已经在运行时走 openURLContexts。
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        open(connectionOptions.urlContexts)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        open(URLContexts)
    }

    private func open(_ contexts: Set<UIOpenURLContext>) {
        for context in contexts {
            if context.url.isFileURL {
                EbookNativePlugin.offer(file: context.url)
            } else {
                // 别的链接照旧交给 Capacitor（App 插件的 appUrlOpen）
                _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: [:])
            }
        }
    }
}

// 主界面：Capacitor 的网页视图。注册 EBOOK 自己的原生插件；底色先给「象牙纸」，切深色时插件再改，
// 网页第一帧出来之前、上下回弹时露出来的都是它
class MainViewController: CAPBridgeViewController {

    /// 阅读时（沉浸）连底部的横条也自动藏起来
    var immersive = false {
        didSet { setNeedsUpdateOfHomeIndicatorAutoHidden() }
    }

    override var prefersHomeIndicatorAutoHidden: Bool { immersive }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(EbookNativePlugin())
        paint(EbookNativePlugin.ivory)
        webView?.allowsLinkPreview = false   // 长按书卡有自己的按下反馈，不要系统的链接预览
    }

    func paint(_ color: UIColor) {
        view.backgroundColor = color
        webView?.isOpaque = false
        webView?.backgroundColor = color
        webView?.scrollView.backgroundColor = color
    }
}
