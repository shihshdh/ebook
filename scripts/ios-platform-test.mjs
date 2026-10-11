import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';

// Fresh processes prevent module caching from hiding differences between platforms.
for (const [os, platform, canUpdate] of [
  ['ios', 'capacitor', false], ['android', 'capacitor', true],
  ['web', 'web', false], ['windows', 'tauri', true],
]) {
  test(`${os}: native routing and package update eligibility`, () => {
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      globalThis.window = ${os === 'windows' ? '{ __TAURI_INTERNALS__: {} }' : `{
        Capacitor: { isNativePlatform: () => ${platform === 'capacitor'}, getPlatform: () => '${os}' }
      }`};
      globalThis.__APP_VERSION__ = '0.3.16';
      const native = await import('./src/lib/native.js');
      assert.equal(native.platform, '${platform}');
      assert.equal(native.supportsPackageUpdate, ${canUpdate});
      ${!canUpdate ? `
        globalThis.fetch = () => { throw new Error('unsupported platforms must not fetch APK updates'); };
        const update = await import('./src/lib/update.js');
        assert.equal(await update.checkUpdate({ force: true }), null);
        await assert.rejects(update.installUpdate({ file: 'test.apk' }), /SideStore/);
        await assert.rejects(native.installApk('test.apk', new Uint8Array()), /APK/);
        const off = native.onBackButton(() => true);
        off();
      ` : ''}
    `], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.stdout);
  });
}
