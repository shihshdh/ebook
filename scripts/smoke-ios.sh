#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
timed() {
  python3 - "$@" <<'PY'
import subprocess, sys
seconds = int(sys.argv[1])
command = sys.argv[2:]
print('+ ' + ' '.join(command), flush=True)
try:
    sys.exit(subprocess.run(command, timeout=seconds).returncode)
except subprocess.TimeoutExpired:
    print('Timed out after %s seconds: %s' % (seconds, ' '.join(command)), file=sys.stderr)
    sys.exit(124)
PY
}
SMOKE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ebook-ios-smoke.XXXXXX")"
DEVICE=''
cleanup() {
  if [[ -n "$DEVICE" ]]; then
    timed 30 xcrun simctl shutdown "$DEVICE" || true
    timed 30 xcrun simctl delete "$DEVICE" || true
  fi
  rm -rf "$SMOKE_DIR"
}
trap cleanup EXIT
export EBOOK_SIM_SDK="$(xcrun --sdk iphonesimulator --show-sdk-version)"
RUNTIME="$(xcrun simctl list runtimes -j | node -e '
let s=""; process.stdin.on("data", c=>s+=c); process.stdin.on("end",()=>{
const sdk=process.env.EBOOK_SIM_SDK.split(".").slice(0,2).join(".");
const r=JSON.parse(s).runtimes.filter(r=>r.isAvailable && r.identifier.includes(".iOS-") && r.version.split(".").slice(0,2).join(".")===sdk)
.sort((a,b)=>b.version.localeCompare(a.version,undefined,{numeric:true}))[0];
if(!r) {console.error("No installed simulator matches Xcode SDK " + sdk); process.exit(1);}
console.error("Using " + r.name + " with SDK " + sdk); console.log(r.identifier);
});')"
DEVICE="$(xcrun simctl create EBOOK-Smoke com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro "$RUNTIME")"
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug \
  -sdk iphonesimulator -destination "id=$DEVICE" -derivedDataPath "$SMOKE_DIR/DerivedData" \
  -destination-timeout 60 build > "$SMOKE_DIR/build.log" 2>&1 || { cat "$SMOKE_DIR/build.log"; exit 1; }
timed 60 xcrun simctl boot "$DEVICE"
timed 180 xcrun simctl bootstatus "$DEVICE" -b
timed 120 xcrun simctl install "$DEVICE" "$SMOKE_DIR/DerivedData/Build/Products/Debug-iphonesimulator/App.app"
timed 60 xcrun simctl launch "$DEVICE" app.librarium.reader
sleep 15
mkdir -p release
timed 30 xcrun simctl io "$DEVICE" screenshot release/ios-first-launch.png
xcrun simctl spawn "$DEVICE" launchctl list > release/ios-processes.txt
node --input-type=module -e '
import {readFileSync} from "node:fs";
const running=readFileSync("release/ios-processes.txt","utf8").split("\n")
.some(line=>/^\d+\s/.test(line) && line.includes("app.librarium.reader"));
if(!running) throw new Error("EBOOK exited after launch");
console.log("EBOOK is running on the iPhone simulator");'
