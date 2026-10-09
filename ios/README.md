# PostCogs iOS app

A thin native shell (SwiftUI + `WKWebView`) around https://postcogs.com. All UI lives on the website, so
website deploys show up in the app automatically — only rebuild when the native shell itself changes or a
TestFlight build is about to expire (builds expire **90 days** after upload).

- `PostCogs/WebView.swift` — web view, link routing (postcogs.com stays in-app, other links open in Safari,
  WhatsApp/SMS/mail/tel links go to the system), offline screen trigger, pull-to-refresh, and a
  `navigator.share` / `navigator.clipboard.writeText` bridge to the native share sheet and pasteboard.
- `PostCogs/PostCogsApp.swift` — app entry and the offline screen.
- `project.yml` — [XcodeGen](https://github.com/yonaskolb/XcodeGen) spec; `PostCogs.xcodeproj` is generated
  from it (`brew install xcodegen && xcodegen generate` after editing).
- The app never calls `/api/*` itself; only questions the user asks on the site do.

## Ship a new TestFlight build

Requires a Mac with Xcode, the App Store Connect API key (`AuthKey_<KEY_ID>.p8`, never commit it), and the
"Apple Distribution" certificate + "PostCogs App Store" provisioning profile installed (create both through
the App Store Connect API or developer.apple.com if they're missing — team `LD574DHGV9`, bundle id
`com.postcogs.app`).

1. Bump the build number: in `project.yml` increase `CURRENT_PROJECT_VERSION` (e.g. `"1"` → `"2"`). Every
   upload needs a higher build number. Change `MARKETING_VERSION` only for a new public version.
2. Regenerate and archive:
   ```sh
   cd ios
   xcodegen generate
   xcodebuild -project PostCogs.xcodeproj -scheme PostCogs -configuration Release \
     -destination 'generic/platform=iOS' -archivePath build/PostCogs.xcarchive archive \
     CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="Apple Distribution" \
     PROVISIONING_PROFILE_SPECIFIER="PostCogs App Store"
   ```
3. Upload:
   ```sh
   xcodebuild -exportArchive -archivePath build/PostCogs.xcarchive -exportPath build/export \
     -exportOptionsPlist ExportOptions.plist \
     -authenticationKeyPath ~/private_keys/AuthKey_$ASC_KEY_ID.p8 \
     -authenticationKeyID $ASC_KEY_ID -authenticationKeyIssuerID $ASC_ISSUER_ID
   ```
4. Wait ~10–30 min for processing in App Store Connect → TestFlight. Internal testers ("Owner") get it
   automatically; for external testers ("Friends" / the public link), add the build to the group — new
   builds of an already-approved version usually skip a full Beta App Review.
