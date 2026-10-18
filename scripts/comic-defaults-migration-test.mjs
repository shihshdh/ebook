import assert from 'node:assert/strict';
import { test } from 'node:test';
import bundle from '../src/comic/default-sources.js';
import { DEFAULTS_VERSION, migrateComicDefaults } from '../src/comic/defaults-migration.js';
const idOf = s => `${bundle.repo}:${s.fileName.replace(/\.js$/, '')}`;
const oldEntry = s => ({ ...s, id: idOf(s), repo: bundle.repo, builtin: 1, version: '0.0.1', addedAt: 10, enabled: false, test: { ok: true } });
function db(seed = []) {
  const data = new Map(seed);
  return { data, get: async (store, key) => structuredClone(data.get(key)),
    set: async (store, key, value) => data.set(key, structuredClone(value)), now: 20 };
}
test('new accounts receive bundle exactly once, with pinned provenance and settings', async () => {
  assert.equal(DEFAULTS_VERSION, bundle.version);
  const store = db(), result = await migrateComicDefaults([], 0, bundle, store);
  assert.equal(result.length, 38); assert.equal(result.filter(s => s.enabled).length, 24);
  assert.equal(new Set(result.map(s => s.id)).size, 38);
  assert.equal(result.find(s => s.key === 'banana').from, bundle.sources.find(s => s.key === 'banana').from);
  assert.equal(store.data.get('comic:defaults'), 2);
  assert.equal(store.data.get('comic:data:venera:baozi').settings.cdn_domains, 's1.bzcdn.net');
});
test('upgrade adds new stations, preserves deleted old stations and deleted replacements', async () => {
  const old = bundle.sources.filter(s => !s.from).map(oldEntry);
  const result = await migrateComicDefaults(old, 1, bundle, db());
  assert.equal(result.filter(s => s.from && !bundle.sources.find(b => b.key === s.key).replaces).length, 17);
  assert(!result.some(s => s.key === 'baozi'));
  assert(!result.some(s => s.key === 'mh1234'));
  const removed = old.filter(s => s.key !== 'Komiic');
  const again = await migrateComicDefaults(removed, 1, bundle, db());
  assert(!again.some(s => s.key === 'Komiic'));
});
test('replacement keeps switches, timestamps and cookies; migrates only old default settings', async () => {
  const source = bundle.sources.find(s => s.key === 'baozi'), old = oldEntry(source);
  const saved = { settings: { domains: 'bzmgcn.com', cdn_domains: 'as.baozimh.com', other: 7 }, cookies: ['keep'] };
  const store = db([['comic:data:'+old.id, saved]]);
  const result = await migrateComicDefaults([old], 1, bundle, store), upgraded = result.find(s => s.id === old.id);
  assert.equal(upgraded.code, source.code); assert.equal(upgraded.enabled, false);
  assert.equal(upgraded.addedAt, 10); assert(!('test' in upgraded));
  assert.deepEqual(store.data.get('comic:data:'+old.id), { settings: { ...saved.settings, ...source.settings }, cookies: ['keep'] });
});
test('custom domains, custom script versions and manually installed sources remain intact', async () => {
  const source = bundle.sources.find(s => s.key === 'baozi');
  for (const manual of [false, true]) {
    const old = oldEntry(source); if (manual) delete old.builtin; else old.version = '999.0.0';
    const saved = { settings: { domains: 'custom.example', cdn_domains: 'image.example' }, token: 'keep' };
    const store = db([['comic:data:'+old.id, saved]]);
    const result = await migrateComicDefaults([old], 1, bundle, store);
    assert.deepEqual(result.find(s => s.id === old.id), old);
    assert.deepEqual(store.data.get('comic:data:'+old.id), saved);
  }
});
test('replacement respects custom domains even when upgrading an old builtin script', async () => {
  const old = oldEntry(bundle.sources.find(s => s.key === 'baozi'));
  const saved = { settings: { domains: 'custom.example', cdn_domains: 'image.example' }, cookies: ['keep'] };
  const store = db([['comic:data:'+old.id, saved]]);
  await migrateComicDefaults([old], 1, bundle, store);
  assert.deepEqual(store.data.get('comic:data:'+old.id), saved);
});
test('a failed final marker is retryable, without duplicate additions or lost settings', async () => {
  const store = db(); let fail = true; const write = store.set;
  store.set = async (s,k,v) => { if(k === 'comic:defaults' && fail) throw Error('disk'); return write(s,k,v); };
  await assert.rejects(migrateComicDefaults([], 1, bundle, store), /disk/);
  assert(!store.data.has('comic:defaults')); fail = false;
  const result = await migrateComicDefaults(store.data.get('comic:sources'), 1, bundle, store);
  assert.equal(result.length, 17); assert.equal(new Set(result.map(s => s.id)).size, 17);
});
test('custom runtime is preserved, older builtin runtime is upgraded', async () => {
  for (const custom of [false,true]) {
    const runtime = { code: 'custom-runtime', ...(custom ? {} : { builtin: 1 }) };
    const store = db([['comic:runtime:venera',runtime]]);
    await migrateComicDefaults([],1,bundle,store);
    assert.equal(store.data.get('comic:runtime:venera').code,custom?'custom-runtime':bundle.runtime);
  }
});
