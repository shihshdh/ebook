import UIKit
import Capacitor

// 应用入口。iOS 27 起，用新版 SDK（Xcode 27）编译的应用必须走「场景」生命周期，否则一启动就被系统结束：
// 窗口、「用 EBOOK 打开」带进来的文件都交给 SceneDelegate（Info.plist 的 UIApplicationSceneManifest 指过去）。
// Capacitor 6 的模板还是老写法，这里按 Apple TN3187 自己接上（Capacitor 8.5 才自带）。
@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }
}
