import UIKit
import WebKit
import AVFoundation
import CoreLocation
import Network

/// 固定的本机 HTTP origin 使 WebKit 的 IndexedDB、认证和离线媒体跨启动持久化。
/// 监听地址仅为 loopback，资源只来自签名安装包内的 Reader 目录。
final class BundledReader {
    private let identity: String
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "reader.bundle.server")
    init(identity: String) { self.identity = identity }

    func start(ready: @escaping (Error?) -> Void) {
        do {
            let parameters = NWParameters.tcp
            parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: 18743)
            parameters.allowLocalEndpointReuse = true
            let server = try NWListener(using: parameters)
            listener = server
            server.stateUpdateHandler = { state in
                switch state {
                case .ready: DispatchQueue.main.async { ready(nil) }
                case .failed(let error): DispatchQueue.main.async { ready(error) }
                default: break
                }
            }
            server.newConnectionHandler = { [weak self] connection in
                connection.start(queue: self?.queue ?? .global())
                self?.receive(connection, buffer: Data())
            }
            server.start(queue: queue)
        } catch { ready(error) }
    }

    private func receive(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] data, _, ended, error in
            var input = buffer
            if let data = data { input.append(data) }
            guard input.count <= 16384, error == nil else { connection.cancel(); return }
            if let request = String(data: input, encoding: .utf8), request.contains("\r\n\r\n") {
                self?.respond(connection, request: request)
            } else if !ended { self?.receive(connection, buffer: input) }
            else { connection.cancel() }
        }
    }

    private func respond(_ connection: NWConnection, request: String) {
        let components = request.components(separatedBy: "\r\n").first?.split(separator: " ") ?? []
        guard components.count >= 2, components[0] == "GET",
              let root = Bundle.main.resourceURL?.appendingPathComponent("Reader", isDirectory: true) else { connection.cancel(); return }
        let rawPath = String(components[1]).components(separatedBy: "?")[0].removingPercentEncoding ?? ""
        let path = rawPath == "/" ? "index.html" : String(rawPath.dropFirst())
        let file = root.appendingPathComponent(path).standardizedFileURL
        var status = "200 OK"
        var data = Data()
        if file.path.hasPrefix(root.path + "/"), let content = try? Data(contentsOf: file) { data = content }
        else { status = "404 Not Found" }
        let types = ["html":"text/html", "js":"application/javascript", "css":"text/css", "svg":"image/svg+xml", "png":"image/png", "woff2":"font/woff2", "woff":"font/woff", "ttf":"font/ttf"]
        if path == "index.html", let html = String(data: data, encoding: .utf8) {
            data = Data(html.replacingOccurrences(of: "<head>", with: "<head><script>Object.defineProperty(window,'unlimitedBookNative',{value:Object.freeze(\(identity))});</script>").utf8)
        }
        let header = "HTTP/1.1 \(status)\r\nContent-Type: \(types[file.pathExtension] ?? "application/octet-stream")\r\nContent-Length: \(data.count)\r\nConnection: close\r\nCache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\n\r\n"
        connection.send(content: Data(header.utf8) + data, completion: .contentProcessed { _ in connection.cancel() })
    }
    deinit { listener?.cancel() }
}

/// 本机朗读、用户导出与一次性粗化位置；不接收任意原生命令。
final class ReaderNativeBridge: NSObject, WKScriptMessageHandler, CLLocationManagerDelegate {
    weak var controller: UIViewController?
    weak var webView: WKWebView?
    private let synthesizer = AVSpeechSynthesizer()
    private let location = CLLocationManager()
    private var locationPending = false

    override init() { super.init(); location.delegate = self; location.desiredAccuracy = kCLLocationAccuracyKilometer }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.host == "127.0.0.1", message.frameInfo.request.url?.port == 18743,
              let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        if action == "speak", let text = body["text"] as? String, text.count <= 20000 {
            synthesizer.stopSpeaking(at: .immediate)
            let utterance = AVSpeechUtterance(string: text)
            utterance.voice = AVSpeechSynthesisVoice(language: body["language"] as? String == "en" ? "en-US" : "zh-CN")
            synthesizer.speak(utterance)
        } else if action == "saveFile", let encoded = body["data"] as? String, encoded.count < 40_000_000,
                  let data = Data(base64Encoded: encoded), let filename = body["filename"] as? String {
            let safeName = String(filename.components(separatedBy: CharacterSet(charactersIn: "/\\:")).joined(separator: "_").prefix(120))
            let file = FileManager.default.temporaryDirectory.appendingPathComponent(safeName)
            do {
                try data.write(to: file, options: .atomic)
                let share = UIActivityViewController(activityItems: [file], applicationActivities: nil)
                share.popoverPresentationController?.sourceView = controller?.view
                share.popoverPresentationController?.sourceRect = CGRect(x: 20, y: 20, width: 1, height: 1)
                controller?.present(share, animated: true)
            } catch { showError("导出保存失败，请重试") }
        } else if action == "location" {
            locationPending = true
            if location.authorizationStatus == .notDetermined { location.requestWhenInUseAuthorization() }
            else { requestLocation() }
        }
    }

    private func showError(_ text: String) {
        let alert = UIAlertController(title: "无限之书", message: text, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "知道了", style: .default))
        controller?.present(alert, animated: true)
    }
    private func requestLocation() {
        guard locationPending else { return }
        if [.authorizedAlways, .authorizedWhenInUse].contains(location.authorizationStatus) { location.requestLocation() }
        else { deliverLocation(["error": "未允许位置权限"]) }
    }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) { if manager.authorizationStatus != .notDetermined { requestLocation() } }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let point = locations.last?.coordinate else { return }
        // 精确位置不传给网页；原生端直接粗化为约一公里网格。
        deliverLocation(["cell": ["x": Int((point.longitude * 100).rounded()), "y": Int((point.latitude * 100).rounded())]])
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) { deliverLocation(["error": "暂时无法取得位置"]) }
    private func deliverLocation(_ result: [String: Any]) {
        locationPending = false
        guard let data = try? JSONSerialization.data(withJSONObject: result), let json = String(data: data, encoding: .utf8) else { return }
        webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('knowledge-location',{detail:\(json)}));")
    }
}
