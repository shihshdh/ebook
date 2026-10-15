// Static integration checks only. Actual WKScriptMessage/frameInfo requires iOS.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const app = read('ios/App/App/EbookNative.swift');
const cap = p => read('node_modules/@capacitor/ios/Capacitor/Capacitor/' + p);
test('storyboard instantiates the secured controller already included in the Xcode target', () => {
  assert.match(read('ios/App/App/Base.lproj/Main.storyboard'), /customClass="EbookViewController" customModule="App"/);
  assert.match(read('ios/App/App.xcodeproj/project.pbxproj'), /EbookNative.swift in Sources/);
  assert.match(app, /class EbookViewController: CAPBridgeViewController/);
});
test('Capacitor 6 exposes the concrete delegate and installs its handler before the hook', () => {
  assert.match(cap('CapacitorBridge.swift'), /public private\(set\) var webViewDelegationHandler: WebViewDelegationHandler/);
  const vc = cap('CAPBridgeViewController.swift');
  assert.ok(vc.indexOf('capacitorBridge = CapacitorBridge(') < vc.indexOf('capacitorDidLoad()'));
  assert.match(cap('WebViewDelegationHandler.swift'), /open func userContentController\(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage\)/);
});
test('all subframe message types are rejected before dispatch; wrapper does not retain the delegate', () => {
  assert.match(app, /private weak var delegate: WebViewDelegationHandler\?/);
  assert.match(app, /guard message\.frameInfo\.isMainFrame else \{ return \}\s+delegate\?\.userContentController\(userContentController, didReceive: message\)/);
  assert.match(app, /bridge as\? CapacitorBridge/);
  assert.match(app, /removeScriptMessageHandler\(forName: "bridge"\)\s+controller\.add\(MainFrameBridgeHandler\(delegate: capacitorBridge\.webViewDelegationHandler\), name: "bridge"\)/);
});

test('guard capability is injected at document start in the main frame only, after native protection', () => {
  assert.match(app, /source: "window\.__EBOOK_BRIDGE_GUARD__ = 'main-frame';",\s+injectionTime: \.atDocumentStart,\s+forMainFrameOnly: true/);
  assert.ok(app.indexOf('controller.add(MainFrameBridgeHandler') < app.indexOf('controller.addUserScript(WKUserScript'));
});
