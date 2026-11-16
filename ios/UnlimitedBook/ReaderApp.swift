import UIKit
import WebKit

/// 正式阅读器入口；每次安装独立识别，连接线上书架和点数账户。
@main
final class ReaderApp: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = ReaderController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}

/// 全屏横向阅读，所有业务页面沿用正式网页版。
final class ReaderController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private let readerURL = URL(string: "https://www.wenyi-tech.cn/app/")!
    private var browser: WKWebView!
    private let retryButton = UIButton(type: .system)
    private let indicator = UIActivityIndicatorView(style: .large)
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation { .landscapeLeft }
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 7 / 255, green: 8 / 255, blue: 15 / 255, alpha: 1)
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = .default()
        config.userContentController.addUserScript(identityScript())
        browser = WKWebView(frame: .zero, configuration: config)
        browser.navigationDelegate = self
        browser.uiDelegate = self
        browser.translatesAutoresizingMaskIntoConstraints = false
        browser.isOpaque = false
        browser.backgroundColor = view.backgroundColor
        browser.scrollView.backgroundColor = view.backgroundColor
        browser.scrollView.contentInsetAdjustmentBehavior = .never
        browser.scrollView.bounces = false
        browser.scrollView.isScrollEnabled = false
        view.addSubview(browser)
        NSLayoutConstraint.activate([
            browser.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            browser.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            browser.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            browser.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
        ])
        indicator.color = .white
        indicator.translatesAutoresizingMaskIntoConstraints = false
        indicator.hidesWhenStopped = true
        view.addSubview(indicator)
        retryButton.setTitle("连接失败，点此重新加载", for: .normal)
        retryButton.setTitleColor(.white, for: .normal)
        retryButton.translatesAutoresizingMaskIntoConstraints = false
        retryButton.addTarget(self, action: #selector(reloadReader), for: .touchUpInside)
        retryButton.isHidden = true
        view.addSubview(retryButton)
        NSLayoutConstraint.activate([
            indicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            indicator.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            retryButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            retryButton.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
        reloadReader()
    }

    /// 安装标识保留于本应用沙盒，只注入正式站点的主页面，不包含密钥。
    private func identityScript() -> WKUserScript {
        let key = "reader.installationID"
        let installation = UserDefaults.standard.string(forKey: key) ?? UUID().uuidString.lowercased()
        UserDefaults.standard.set(installation, forKey: key)
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        let device: [String: String] = [
            "platform": "ios", "fingerprint": "ios-\(installation)",
            "appVersion": "ios-\(version)(\(build))", "osVersion": "iOS \(UIDevice.current.systemVersion)",
        ]
        let json = String(data: try! JSONSerialization.data(withJSONObject: device), encoding: .utf8)!
        let source = "if(location.origin==='https://www.wenyi-tech.cn'){Object.defineProperty(window,'unlimitedBookNative',{value:Object.freeze(\(json)),writable:false,configurable:false});}"
        return WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    }

    @objc private func reloadReader() {
        retryButton.isHidden = true
        indicator.startAnimating()
        browser.load(URLRequest(url: readerURL))
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        indicator.stopAnimating()
        retryButton.isHidden = true
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleFailure(error)
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleFailure(error)
    }
    private func handleFailure(_ error: Error) {
        if (error as NSError).code == NSURLErrorCancelled { return }
        indicator.stopAnimating()
        retryButton.isHidden = false
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { reloadReader() }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "https" && url.host == readerURL.host {
            decisionHandler(.allow)
        } else if navigationAction.navigationType == .linkActivated {
            decisionHandler(.cancel)
            UIApplication.shared.open(url)
        } else {
            decisionHandler(.cancel)
        }
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, navigationAction.targetFrame == nil {
            UIApplication.shared.open(url)
        }
        return nil
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: "无限之书", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "确定", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: "无限之书", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "确定", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }
}
