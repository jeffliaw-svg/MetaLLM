import SwiftUI

@main
struct PostCogsApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    @StateObject private var model = WebViewModel()

    var body: some View {
        ZStack {
            Color("Background").ignoresSafeArea()
            WebView(model: model)
            if model.isOffline {
                OfflineView { model.retry() }
            }
        }
    }
}

struct OfflineView: View {
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 44, weight: .regular))
                .foregroundColor(.secondary)
            Text("You're offline.")
                .font(.title2.weight(.semibold))
            Text("PostCogs needs a connection.")
                .foregroundColor(.secondary)
            Button(action: retry) {
                Text("Retry")
                    .fontWeight(.semibold)
                    .padding(.horizontal, 28)
                    .padding(.vertical, 10)
                    .background(Color(red: 0xC9 / 255, green: 0x64 / 255, blue: 0x42 / 255))
                    .foregroundColor(.white)
                    .clipShape(Capsule())
            }
            .padding(.top, 8)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color("Background").ignoresSafeArea())
    }
}
