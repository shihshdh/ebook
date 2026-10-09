// 内置源按站点地址去重；自定义源、开关和测试记录始终由用户自己的列表优先。
// 内置包每审一次加一：2 = 2026-10-09 严格审过（去掉成人、漫画、听书、影视、非书站和来路不明的站）。
export const DEFAULTS_VERSION = 2;

export function defaultKeyOf(source) {
  const url = new URL(source.bookSourceUrl);
  url.hash = '';
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.href;
}

export function mergeDefaults(existing, bundled, sourceIdOf, now = Date.now()) {
  const list = [...existing];
  const ids = new Set(list.map(entry => entry.id));
  const sites = new Set();
  for (const entry of list) {
    try { sites.add(defaultKeyOf(entry.source)); } catch { /* 保留用户的旧条目 */ }
  }
  for (const item of bundled.sources) {
    const site = defaultKeyOf(item.source), id = sourceIdOf(item.source);
    if (sites.has(site) || ids.has(id)) continue;
    sites.add(site); ids.add(id);
    list.push({ id, source: structuredClone(item.source), check: structuredClone(item.check), enabled: true, addedAt: now, builtin: bundled.version });
  }
  return list;
}
