import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';

test('real Capacitor proxy: native open, immersive mode and file import do not hang on then()', () => {
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    globalThis.window = globalThis;
    globalThis.webkit = {messageHandlers:{bridge:{}}};
    const calls = [];
    const methods = ['ready','openLanzou','openWeb','setImmersive','setBars','consumeFile'];
    globalThis.Capacitor = {
      isNativePlatform:()=>true, getPlatform:()=> 'ios',
      PluginHeaders:[{name:'EbookNative',methods:[...methods.map(name=>({name,rtype:'promise'})),{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}]}],
      nativePromise: async (plugin,method,options)=>{ calls.push({plugin,method,options}); return method === 'consumeFile' ? {name:'book.txt',data:btoa('book text')} : {}; },
      nativeCallback: (plugin,method)=>{calls.push({plugin,method});return 'listener';}
    };
    const native = await import('./src/lib/native.js');
    let timer;
    await Promise.race([
      (async()=>{
        await native.appReady();
        await native.lanzou.open({url:'https://example.com/book',pwd:'test',title:'Book'});
        await native.browser.open({url:'https://example.com'});
        native.setImmersive(true);
        native.setSystemBars({dark:true});
        let imported;
        const off = native.onOpenedFile(file=>{imported=file;});
        await new Promise(r=>setTimeout(r,30)); off();
        assert.equal(imported.name,'book.txt');
        assert.equal(new TextDecoder().decode(imported.bytes),'book text');
      })(),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('native bridge hung')),1000);})
    ]).finally(()=>clearTimeout(timer));
    for (const method of methods) assert.ok(calls.some(c=>c.method===method),method+' never reached native bridge');
    assert.ok(!calls.some(c=>c.method==='then'));
    assert.equal(calls.find(c=>c.method==='openLanzou').options.pwd,'test');
  `], {cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:5000});
  assert.equal(run.status,0,run.stderr||run.stdout);
});

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

test('iOS haptics and accessibility reach the native plugin', () => {
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    globalThis.window = globalThis;
    globalThis.webkit = {messageHandlers:{bridge:{}}};
    const calls = [];
    const methods = ['haptic','prepareHaptics','accessibility'];
    globalThis.Capacitor = {
      isNativePlatform:()=>true, getPlatform:()=> 'ios',
      PluginHeaders:[{name:'EbookNative',methods:[...methods.map(name=>({name,rtype:'promise'})),{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}]}],
      nativePromise: async (plugin,method,options)=>{ calls.push({plugin,method,options}); return method === 'accessibility' ? {reduceTransparency:true,increaseContrast:false} : {}; },
      nativeCallback: (plugin,method)=>{calls.push({plugin,method});return 'listener';}
    };
    const native = await import('./src/lib/native.js');
    await new Promise(r=>setTimeout(r,50));   // 插件对象在模块加载后异步建好
    native.prepareHaptic('selection');
    native.haptic('selection');
    native.haptic('soft', .6);
    native.haptic('success');
    let state;
    const off = native.watchAccessibility(s=>{state=s;});
    await new Promise(r=>setTimeout(r,50)); off();
    const h = calls.filter(c=>c.method==='haptic').map(c=>c.options);
    assert.deepEqual(h.map(o=>o.kind), ['selection','soft','success']);
    assert.equal(h[1].intensity, .6);
    assert.ok(calls.some(c=>c.method==='prepareHaptics'));
    assert.equal(state.reduceTransparency, true);
  `], {cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:5000});
  assert.equal(run.status,0,run.stderr||run.stdout);
});
