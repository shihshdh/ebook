// 默认源包升级只补本轮新站点；用户删掉的旧站点和自己安装的版本优先。
export const DEFAULTS_VERSION = 2;
const newer = (a, b) => {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0;
  }
  return false;
};
export async function migrateComicDefaults(list, installed, bundle, { get, set, now = Date.now() }) {
  const next = [...list];
  for (const s of bundle.sources) {
    const id = `${bundle.repo}:${s.fileName.replace(/\.js$/, '')}`;
    const at = next.findIndex(e => e.id === id), old = next[at];
    const update = old?.builtin && s.replaces && newer(s.version, old.version);
    if (old && !update) continue;
    // 替换源沿用旧 id：即使标 since:2，也不能把用户删除的旧源装回来。
    if (!old && installed && (s.replaces || (s.since || 1) <= installed)) continue;
    const entry = { id, repo: bundle.repo, key: s.key, name: s.name, version: s.version,
      fileName: s.fileName, className: s.className, code: s.code,
      enabled: s.enabled, autoOff: s.autoOff, addedAt: now, updatedAt: now, builtin: bundle.version,
      ...(s.from ? { from: s.from } : {}) };
    if (old) {
      next[at] = { ...old, ...entry, enabled: old.enabled, autoOff: old.autoOff, addedAt: old.addedAt };
      delete next[at].test; // 换了脚本，旧测试不再有效。
    } else next.push(entry);
    if (s.settings) {
      const key = `comic:data:${id}`, saved = await get('kv', key);
      if (!saved) await set('kv', key, { settings: s.settings });
      else if (update && s.key === 'baozi') {
        const settings = { ...saved.settings };
        if (!settings.cdn_domains || settings.cdn_domains === 'as.baozimh.com') settings.cdn_domains = s.settings.cdn_domains;
        if (settings.domains === 'bzmgcn.com') settings.domains = s.settings.domains;
        await set('kv', key, { ...saved, settings });
      }
    }
  }
  const key = `comic:runtime:${bundle.repo}`, runtime = await get('kv', key);
  if (!runtime?.code || (runtime.builtin && runtime.builtin < bundle.version)) {
    await set('kv', key, { code: bundle.runtime, at: now, builtin: bundle.version });
  }
  // 最后才写版本标记：中断后按 id 重试，不会重复插入，也不会跳过未保存的列表。
  await set('kv', 'comic:sources', next);
  await set('kv', 'comic:defaults', bundle.version);
  return next;
}
