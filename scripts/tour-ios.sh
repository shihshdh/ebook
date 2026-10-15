#!/usr/bin/env bash
# iPhone 界面巡检：编一次调试版，在小屏（SE，有 Home 键没刘海）、标准（16 Pro，灵动岛）、大屏（16 Pro Max）
# 三台模拟器上各走一遍 scripts/ios-tour.mjs，16 Pro 再用深色模式走一遍。截图和每屏的检查结果在 release/ios-tour/
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
WORK="$(mktemp -d "${TMPDIR:-/tmp}/ebook-ios-tour.XXXXXX")"
DEVICE=''
drop() {
  if [[ -n "$DEVICE" ]]; then
    timed 30 xcrun simctl shutdown "$DEVICE" || true
    timed 30 xcrun simctl delete "$DEVICE" || true
    DEVICE=''
  fi
}
trap 'drop; rm -rf "$WORK"' EXIT
export EBOOK_SIM_SDK="$(xcrun --sdk iphonesimulator --show-sdk-version)"
RUNTIME="$(xcrun simctl list runtimes -j | node -e '
let s=""; process.stdin.on("data", c=>s+=c); process.stdin.on("end",()=>{
const sdk=process.env.EBOOK_SIM_SDK.split(".").slice(0,2).join(".");
const r=JSON.parse(s).runtimes.filter(r=>r.isAvailable && r.identifier.includes(".iOS-") && r.version.split(".").slice(0,2).join(".")===sdk)
.sort((a,b)=>b.version.localeCompare(a.version,undefined,{numeric:true}))[0];
if(!r) {console.error("No installed simulator matches Xcode SDK " + sdk); process.exit(1);}
console.error("Using " + r.name); console.log(r.identifier);
});')"
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath "$WORK/DerivedData" \
  build > "$WORK/build.log" 2>&1 || { tail -80 "$WORK/build.log"; exit 1; }
APP="$WORK/DerivedData/Build/Products/Debug-iphonesimulator/App.app"
OUT=release/ios-tour
rm -rf "$OUT"; mkdir -p "$OUT"
FAILED=0
tour() {   # 名字 设备类型 外观
  local name="$1" type="$2" appearance="$3"
  if ! xcrun simctl list devicetypes | grep -q "($type)"; then echo "跳过 $name：没有 $type"; return; fi
  DEVICE="$(xcrun simctl create "EBOOK-$name" "$type" "$RUNTIME")"
  timed 60 xcrun simctl boot "$DEVICE"
  timed 240 xcrun simctl bootstatus "$DEVICE" -b
  timed 30 xcrun simctl ui "$DEVICE" appearance "$appearance" || true
  timed 30 xcrun simctl status_bar "$DEVICE" override --time 9:41 --dataNetwork wifi --wifiMode active --wifiBars 3 \
    --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100 || true
  timed 120 xcrun simctl install "$DEVICE" "$APP"
  timed 60 xcrun simctl launch "$DEVICE" app.librarium.reader -EBOOK_TOUR
  echo "== $name ($type, $appearance)"
  timed 900 node scripts/ios-tour.mjs "$DEVICE" "$OUT/$name" "$appearance" || FAILED=1
  drop
}
tour se com.apple.CoreSimulator.SimDeviceType.iPhone-SE-3rd-generation light
tour 16pro com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro light
tour 16promax com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro-Max light
tour 16pro-dark com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro dark
exit $FAILED
