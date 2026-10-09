import SafariServices
import SwiftUI
import UIKit
import WebKit

let homeURL = URL(string: "https://postcogs.com")!
private let inAppHosts: Set<String> = ["postcogs.com", "www.postcogs.com"]
private let systemHosts: Set<String> = ["wa.me", "api.whatsapp.com"]
private let systemSchemes: Set<String> = ["whatsapp", "sms", "mailto", "tel"]

// The site's Share button calls navigator.share / navigator.clipboard.writeText after an
// await, which WKWebView rejects without a fresh user gesture. Route both to native code.
private let bridgeScript = """
(function () {
  var h = window.webkit && window.webkit.messageHandlers;
  if (!h || !h.postcogsShare || !h.postcogsCopy) return;
  var share = function (data) {
    data = data || {};
    var url = "";
    try { url = data.url ? new URL(data.url, location.href).href : ""; } catch (e) {}
    return h.postcogsShare.postMessage({ title: String(data.title || ""), text: String(data.text || ""), url: url })
      .then(function (ok) { if (!ok) throw new DOMException("Share canceled", "AbortError"); });
  };
  var writeText = function (t) { return h.postcogsCopy.postMessage(String(t)).then(function () {}); };
  try { Object.defineProperty(Navigator.prototype, "share", { value: share, configurable: true, writable: true }); } catch (e) {}
  try { Object.defineProperty(Navigator.prototype, "canShare", { value: function () { return true; }, configurable: true, writable: true }); } catch (e) {}
  if (navigator.clipboard) {
    try { Object.defineProperty(navigator.clipboard, "writeText", { value: writeText, configurable: true, writable: true }); } catch (e) {}
  } else {
    try { Object.defineProperty(Navigator.prototype, "clipboard", { value: { writeText: writeText }, configurable: true }); } catch (e) {}
  }
})();
"""

final class WebViewModel: ObservableObject {
    @Published var isOffline = false
    weak var webView: WKWebView?
    var lastURL: URL?

    func retry() {
        webView?.load(URLRequest(url: lastURL ?? homeURL))
    }
}

struct WebView: UIViewRepresentable {
    @ObservedObject var model: WebViewModel

    func makeCoordinator() -> Coordinator { Coordinator(model: model) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.applicationNameForUserAgent = "PostCogsApp/1.0"
        let content = config.userContentController
        content.addUserScript(WKUserScript(source: bridgeScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        content.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "postcogsShare")
        content.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "postcogsCopy")

        let webView = WKWebView(frame: .zero, configuration: config)
        let background = UIColor(named: "Background") ?? .systemBackground
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.underPageBackgroundColor = background
        webView.allowsBackForwardNavigationGestures = true
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator

        let refresh = UIRefreshControl()
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.pullToRefresh(_:)), for: .valueChanged)
        webView.scrollView.alwaysBounceVertical = true
        webView.scrollView.refreshControl = refresh

        model.webView = webView
        model.lastURL = homeURL
        webView.load(URLRequest(url: homeURL))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandlerWithReply {
        let model: WebViewModel

        init(model: WebViewModel) { self.model = model }

        private enum Route { case inApp, safari, system, block }

        private func route(_ url: URL) -> Route {
            let scheme = url.scheme?.lowercased() ?? ""
            let host = url.host?.lowercased() ?? ""
            switch scheme {
            case "http", "https":
                if inAppHosts.contains(host) { return .inApp }
                if systemHosts.contains(host) { return .system }
                return .safari
            case "about", "blob", "data":
                return .inApp
            default:
                return systemSchemes.contains(scheme) ? .system : .block
            }
        }

        private func openOutside(_ url: URL, route: Route, from webView: WKWebView) {
            switch route {
            case .safari:
                guard let top = topViewController(webView) else { return UIApplication.shared.open(url) }
                top.present(SFSafariViewController(url: url), animated: true)
            case .system:
                UIApplication.shared.open(url)
            default:
                break
            }
        }

        private func topViewController(_ view: UIView) -> UIViewController? {
            var top = view.window?.rootViewController
            while let presented = top?.presentedViewController { top = presented }
            return top
        }

        @objc func pullToRefresh(_ sender: UIRefreshControl) {
            guard let webView = model.webView else { return sender.endRefreshing() }
            if webView.url == nil || model.isOffline { model.retry() } else { webView.reload() }
        }

        // MARK: Navigation

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url, action.targetFrame?.isMainFrame ?? true else {
                return decisionHandler(.allow)
            }
            let r = route(url)
            if r == .inApp {
                if url.scheme?.hasPrefix("http") == true { model.lastURL = url }
                return decisionHandler(.allow)
            }
            decisionHandler(.cancel)
            openOutside(url, route: r, from: webView)
        }

        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = action.request.url {
                let r = route(url)
                if r == .inApp { webView.load(action.request) } else { openOutside(url, route: r, from: webView) }
            }
            return nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            model.isOffline = false
            webView.scrollView.refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            handle(error, webView)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            handle(error, webView)
        }

        private func handle(_ error: Error, _ webView: WKWebView) {
            webView.scrollView.refreshControl?.endRefreshing()
            let e = error as NSError
            guard e.domain == NSURLErrorDomain else { return }
            let offlineCodes: Set<Int> = [
                NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost, NSURLErrorCannotFindHost,
                NSURLErrorCannotConnectToHost, NSURLErrorTimedOut, NSURLErrorDNSLookupFailed,
                NSURLErrorDataNotAllowed, NSURLErrorInternationalRoamingOff,
            ]
            if offlineCodes.contains(e.code) { model.isOffline = true }
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            webView.reload()
        }

        // MARK: JS dialogs

        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            guard let top = topViewController(webView) else { return completionHandler() }
            top.present(alert, animated: true)
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
            guard let top = topViewController(webView) else { return completionHandler(false) }
            top.present(alert, animated: true)
        }

        // MARK: Share / clipboard bridge

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
            switch message.name {
            case "postcogsCopy":
                UIPasteboard.general.string = message.body as? String ?? ""
                replyHandler(true, nil)
            case "postcogsShare":
                let body = message.body as? [String: Any] ?? [:]
                var items: [Any] = []
                if let text = body["text"] as? String, !text.isEmpty { items.append(ShareText(text)) }
                if let s = body["url"] as? String, let url = URL(string: s) { items.append(url) }
                guard !items.isEmpty, let webView = model.webView, let top = topViewController(webView) else {
                    return replyHandler(false, nil)
                }
                let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
                sheet.popoverPresentationController?.sourceView = webView
                sheet.popoverPresentationController?.sourceRect = CGRect(x: webView.bounds.midX, y: webView.bounds.minY + 60, width: 1, height: 1)
                var replied = false
                sheet.completionWithItemsHandler = { _, completed, _, _ in
                    guard !replied else { return }
                    replied = true
                    replyHandler(completed, nil)
                }
                top.present(sheet, animated: true)
            default:
                replyHandler(nil, "Unknown handler")
            }
        }
    }
}

// Messages/WhatsApp get "text + link"; Copy gets just the link.
private final class ShareText: NSObject, UIActivityItemSource {
    let text: String

    init(_ text: String) { self.text = text }

    func activityViewControllerPlaceholderItem(_ controller: UIActivityViewController) -> Any { text }

    func activityViewController(_ controller: UIActivityViewController, itemForActivityType type: UIActivity.ActivityType?) -> Any? {
        type == .copyToPasteboard ? nil : text
    }
}
