#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
SMOKE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ebook-ios-smoke.XXXXXX")"
DEVICE=''
cleanup() {
  if [[ -n "$DEVICE" ]]; then
    xcrun simctl shutdown "$DEVICE" || true
    xcrun simctl delete "$DEVICE" || true
  fi
  rm -rf "$SMOKE_DIR"
}
trap cleanup EXIT
RUNTIME="$(xcrun simctl list runtimes -j | node -e '
let s=""; process.stdin.on("data", c=>s+=c); process.stdin.on("end",()=>{
const r=JSON.parse(s).runtimes.filter(r=>r.isAvailable && r.identifier.includes(".iOS-"))
.sort((a,b)=>b.version.localeCompare(a.version,undefined,{numeric:true}))[0];
if(!r) process.exit(1); console.log(r.identifier);
});')"
DEVICE="$(xcrun simctl create EBOOK-Smoke com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro "$RUNTIME")"
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug \
  -sdk iphonesimulator -destination "id=$DEVICE" -derivedDataPath "$SMOKE_DIR/DerivedData" \
  CODE_SIGNING_ALLOWED=NO build > "$SMOKE_DIR/build.log" 2>&1 || { cat "$SMOKE_DIR/build.log"; exit 1; }
xcrun simctl boot "$DEVICE"
xcrun simctl bootstatus "$DEVICE" -b
xcrun simctl status_bar "$DEVICE" override --time '9:41' --batteryState charged --batteryLevel 100
xcrun simctl install "$DEVICE" "$SMOKE_DIR/DerivedData/Build/Products/Debug-iphonesimulator/App.app"
xcrun simctl launch "$DEVICE" app.librarium.reader
sleep 15
mkdir -p release
xcrun simctl io "$DEVICE" screenshot release/ios-first-launch.png
xcrun simctl spawn "$DEVICE" launchctl list > release/ios-processes.txt
node --input-type=module -e '
import {readFileSync} from "node:fs";
const running=readFileSync("release/ios-processes.txt","utf8").split("\n")
.some(line=>/^\d+\s/.test(line) && line.includes("app.librarium.reader"));
if(!running) throw new Error("EBOOK exited after launch");
console.log("EBOOK is running on the iPhone simulator");'
