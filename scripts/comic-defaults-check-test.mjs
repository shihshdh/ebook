import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compare, parseLive, versionStatus } from './comic-defaults-check.mjs';
const source = { key: 'copy', fileName: 'copy.js', name: '拷贝漫画', version: '1.2.0' };
test('same-key variants do not hide removed or updated sources; unbundled old sources are not new', () => {
  const variant = { ...source, fileName: 'multi.js', name: '多账号' };
  const oldUnbundled = { key: 'old', fileName: 'old.js', name: '已存在未内置', version: '1' };
  const added = { key: 'new', fileName: 'new.js', name: '新源', version: '1' };
  const c = compare([source], [variant, oldUnbundled, added], [source, variant, oldUnbundled]);
  assert.equal(c.rows[0].latest, undefined);
  assert.deepEqual(c.added, [added]);
  assert.deepEqual(c.removed, [source]);
});
test('live parser preserves failures and ignores fixture success rows', () => {
  const second = { key: 'b', fileName: 'b.js', name: '包子漫画' };
  const r = parseLive('✓ fixture\n  ✓ 拷贝漫画         搜到 2，1 话，第一话 3 张，图 4KB  (2.0s)\n  ✗ 包子漫画         图片：HTTP 403，不是图片  (3.1s)\n  能用 1 / 2', [source, second]);
  assert.equal(r.size, 2);
  assert.equal(r.get('copy\0copy.js').ok, true);
  assert.deepEqual(r.get('b\0b.js'), { ok: false, detail: '图片：HTTP 403，不是图片', seconds: '3.1' });
});
test('version ordering is numeric, with rollback and nonnumeric differences explicit', () => {
  assert.equal(versionStatus('1.9', '1.10'), '1.10（有新版）');
  assert.equal(versionStatus('2.0', '1.10'), '1.10（上游版本回退）');
  assert.equal(versionStatus('1', '1.0'), '1.0（版本号等值）');
  assert.equal(versionStatus('1-beta', '1'), '1（版本变化，需复核）');
});
test('multiline JSON parse errors remain failures, not missing source results', () => {
  const r = parseLive('  ✗ 拷贝漫画         搜索：Unexpected token\n<html> is not JSON  (4.2s)\n  能用 0 / 1', [source]);
  assert.equal(r.get('copy\0copy.js').ok, false);
  assert.equal(r.get('copy\0copy.js').detail, '搜索：Unexpected token <html> is not JSON');
});
