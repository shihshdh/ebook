import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = globalThis;
globalThis.androidBridge = {};
globalThis.__APP_VERSION__ = '0.3.17';
const calls = [];
let failure;
globalThis.Capacitor = {
  isNativePlatform: () => true, getPlatform: () => 'android',
  PluginHeaders: [{ name: 'EbookNative', methods: [{ name: 'openExternal', rtype: 'promise' }] }],
  nativePromise: async (plugin, method, options) => {
    calls.push({ plugin, method, options });
    if (failure) throw failure;
    return {};
  },
};
globalThis.fetch = () => { throw new Error('APK must not download through WebView'); };
const { installUpdate, browserDownloadUrl, usesBrowserUpdate } = await import('../src/lib/update.js');
const { browser } = await import('../src/lib/native.js');
const update = { version: '0.3.18', file: 'EBOOK_0.3.18.apk', sha256: 'test' };

test('Android update opens native external browser without downloading or installing in app', async () => {
  assert.equal(usesBrowserUpdate, true);
  const phases = [];
  const message = await installUpdate(update, () => assert.fail('No in-app progress'), { onPhase: p => phases.push(p) });
  assert.deepEqual(phases, ['browser']);
  assert.deepEqual(calls, [{ plugin: 'EbookNative', method: 'openExternal', options: { url: browserDownloadUrl(update) } }]);
  assert.match(message, /下载 APK 后点击安装/);
});

test('browser launch failure is surfaced and retry succeeds', async () => {
  failure = new Error('No browser');
  await assert.rejects(installUpdate(update), /No browser/);
  failure = null;
  await installUpdate(update);
});

test('cancelled update and unsafe URL never launch another app', async () => {
  const before = calls.length;
  const ctl = new AbortController(); ctl.abort();
  await assert.rejects(installUpdate(update, null, { signal: ctl.signal }), { name: 'AbortError' });
  await assert.rejects(browser.openExternal({ url: 'javascript:alert(1)' }), /只能打开网页地址/);
  assert.equal(calls.length, before);
});
