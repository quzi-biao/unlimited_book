import UIKit
import WebKit

/// 仅用于本机模拟器的网页预览；业务代码及数据仍由本地服务提供。
@main
final class PreviewApp: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = ReaderPreviewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}

/// 横屏 WebKit 容器，不提供地址栏，阅读按钮使用网页自身的布局。
final class ReaderPreviewController: UIViewController {
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation { .landscapeLeft }
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 7 / 255, green: 8 / 255, blue: 15 / 255, alpha: 1)
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let browser = WKWebView(frame: .zero, configuration: config)
        browser.translatesAutoresizingMaskIntoConstraints = false
        browser.isOpaque = false
        browser.backgroundColor = view.backgroundColor
        browser.scrollView.backgroundColor = view.backgroundColor
        browser.scrollView.contentInsetAdjustmentBehavior = .never
        browser.scrollView.bounces = false
        browser.scrollView.isScrollEnabled = false
        view.addSubview(browser)
        // 避开灵动岛；网页头部按钮始终处于可点击的安全区域。
        NSLayoutConstraint.activate([
            browser.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            browser.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            browser.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            browser.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
        ])
        browser.load(URLRequest(url: URL(string: "http://localhost:5175/")!))
    }
}
