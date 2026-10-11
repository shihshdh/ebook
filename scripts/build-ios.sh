#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'iOS 编译需要 macOS / Xcode；Windows 请运行 GitHub Actions 的 iOS personal build。' >&2
  exit 1
fi
npm run ios:sync
VERSION="$(node -p 'JSON.parse(require("fs").readFileSync("package.json", "utf8")).version')"
BUILD_NUMBER="${GITHUB_RUN_NUMBER:-1}"
BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ebook-ios.XXXXXX")"
trap 'rm -rf "$BUILD_DIR"' EXIT
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath "$BUILD_DIR/DerivedData" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" MARKETING_VERSION="$VERSION" build
APP="$BUILD_DIR/DerivedData/Build/Products/Release-iphoneos/App.app"
test -f "$APP/App"
test -f "$APP/public/index.html"
test -d "$APP/Frameworks/Capacitor.framework"
test "$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$APP/Info.plist")" = "$VERSION"
mkdir -p "$BUILD_DIR/Payload" release
cp -R "$APP" "$BUILD_DIR/Payload/App.app"
IPA="$PWD/release/EBOOK_${VERSION}_ios-unsigned.ipa"
(cd "$BUILD_DIR" && /usr/bin/zip -qry package.ipa Payload)
mv "$BUILD_DIR/package.ipa" "$IPA"
(cd release && shasum -a 256 "$(basename "$IPA")" > "$(basename "$IPA").sha256")
echo "已生成未签名 IPA：$IPA（需使用 SideStore 签名安装）"
