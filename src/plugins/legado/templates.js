// 只识别整段已知片段并返回常量；绝不调用 cookie/source 或执行表达式。
export function inertTemplate(expression, sourceUrl = '') {
  const rule = expression.trim();
  if (/^cookie\s*\.\s*removeCookie\s*\(\s*source\s*\.\s*(?:getKey\s*\(\s*\)|key)\s*\)\s*;?$/.test(rule)) return '';
  if (/^url\s*=\s*source\s*\.\s*getKey\s*\(\s*\)\s*(?:;\s*|\r?\n\s*)cookie\s*\.\s*removeCookie\s*\(\s*url\s*\)\s*(?:;\s*|\r?\n\s*)url\s*;?$/.test(rule)) return String(sourceUrl);
  return undefined;
}
