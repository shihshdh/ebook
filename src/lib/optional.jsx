// 按需加载一个"可能还不存在"的模块（并行开发时 ASTRA 的文件可能还没写完）。
// import.meta.glob 在文件不存在时返回空对象，不会让构建失败。
import { lazy } from 'react';

export function lazyOptional(globbed, Fallback) {
  const loader = Object.values(globbed)[0];
  if (!loader) return Fallback;
  return lazy(() => loader().then(m => (m?.default ? m : { default: Fallback })).catch(() => ({ default: Fallback })));
}
