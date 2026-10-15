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
# 失败时（App 闪退、自检没出结果）把模拟器的崩溃报告和 App 最后几分钟的系统日志收进 release/ios-diag/，跟产物一起上传
diag() {
  mkdir -p release/ios-diag
  # 卡在启动（simctl launch 不返回、主线程堵住）时：抓 App 进程的调用栈（模拟器里的 App 就是宿主机上的一个进程）
  local pid
  pid="$(pgrep -f '/App.app/App$' | head -1 || true)"
  if [[ -n "$pid" ]]; then sample "$pid" 3 -file release/ios-diag/sample.txt > /dev/null 2>&1 || true; fi
  ps -axo pid,stat,etime,%cpu,command | grep -E 'App.app/App|SpringBoard|launchd_sim' | grep -v grep > release/ios-diag/ps.txt || true
  cp ~/Library/Logs/DiagnosticReports/App*.ips release/ios-diag/ 2>/dev/null || true
  if [[ -n "$DEVICE" ]]; then
    xcrun simctl spawn "$DEVICE" log show --last 5m --style compact       --predicate 'process == "App" OR (process == "runningboardd" AND eventMessage CONTAINS "librarium")' > release/ios-diag/app.log 2>&1 || true
  fi
  ls -la release/ios-diag
  grep -m5 -E '"exception"|"termination"|"type"' release/ios-diag/*.ips 2>/dev/null || true
  tail -40 release/ios-diag/app.log 2>/dev/null || true
  cat release/ios-diag/ps.txt 2>/dev/null || true
  tail -30 release/ios-diag/app-stdout.txt release/ios-diag/app-stderr.txt 2>/dev/null || true
  # 主线程栈的前几十行就够看出堵在哪
  grep -m1 -A60 'DispatchQueue_1' release/ios-diag/sample.txt 2>/dev/null | head -60 || true
}
cleanup() {
  local status=$?
  if [[ $status -ne 0 ]]; then diag; fi
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
mkdir -p release/ios-diag
timed 60 xcrun simctl launch --stdout="$PWD/release/ios-diag/app-stdout.txt" --stderr="$PWD/release/ios-diag/app-stderr.txt" \
  "$DEVICE" app.librarium.reader
sleep 15
mkdir -p release
timed 60 xcrun simctl io "$DEVICE" screenshot release/ios-first-launch.png
xcrun simctl spawn "$DEVICE" launchctl list > release/ios-processes.txt
node --input-type=module -e '
import {readFileSync} from "node:fs";
const running=readFileSync("release/ios-processes.txt","utf8").split("\n")
.some(line=>/^\d+\s/.test(line) && line.includes("app.librarium.reader"));
if(!running) throw new Error("EBOOK exited after launch");
console.log("EBOOK is running on the iPhone simulator");'

# 原生桥自检（调试版才有，见 ios/App/App/EbookNative.swift 的 scheduleBridgeSelfTest）：
# 主页面、sandbox iframe（同漫画源沙箱）、普通 iframe 各自直接调一次原生桥，原生侧记下真正调到几次。
# 主页面要调得到，子 frame 必须一次都调不到——漫画源的脚本跑在子 frame 里，这一条是 iPhone 开放漫画源的前提
timed 30 xcrun simctl terminate "$DEVICE" app.librarium.reader || true
timed 60 xcrun simctl launch "$DEVICE" app.librarium.reader -EBOOK_BRIDGE_SELFTEST
DATA="$(xcrun simctl get_app_container "$DEVICE" app.librarium.reader data)"
for _ in $(seq 1 30); do [[ -f "$DATA/Documents/bridge-selftest.json" ]] && break; sleep 2; done
cp "$DATA/Documents/bridge-selftest.json" release/ios-bridge-selftest.json
node --input-type=module -e '
import {readFileSync} from "node:fs";
const r=JSON.parse(readFileSync("release/ios-bridge-selftest.json","utf8"));
const hits=r.hits||{}, js=JSON.parse(r.js||"null")||{};
console.log(JSON.stringify({hits, js, error:r.error}, null, 1));
if(!(hits.main>=1)) throw new Error("self-test invalid: the main frame could not reach the native bridge");
if(!js.frames?.sandbox || !js.frames?.iframe) throw new Error("self-test invalid: child frames did not report back");
if(hits.sandbox || hits.iframe) throw new Error("a child frame reached the native bridge");
if(js.mainGuard!=="main-frame") throw new Error("the main frame has no bridge guard marker");
for(const k of ["sandbox","iframe"]) if(js.frames[k].guard==="main-frame") throw new Error(k+" frame sees the bridge guard marker");
console.log("Native bridge: main frame reachable, sandbox and iframe blocked (bridge visible to them: "+js.frames.sandbox.bridge+")");'
