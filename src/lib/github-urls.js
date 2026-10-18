// 纯 URL 构造器：主线程与书目 Worker 共用，候选顺序保持一致。
const JSD = ['testingcf.jsdelivr.net', 'gcore.jsdelivr.net', 'originfastly.jsdelivr.net', 'quantil.jsdelivr.net', 'fastly.jsdelivr.net', 'cdn.jsdelivr.net'];
// GitHub 加速代理（前缀式：代理地址 + 原始地址），都带 CORS 头
const GH_PROXIES = ['https://gh-proxy.org/', 'https://edgeone.gh-proxy.org/', 'https://ghfast.top/', 'https://gh.llkk.cc/'];

/**
 * GitHub 仓库里的文件。小文件 jsDelivr 优先（有 CDN、带 CORS）；
 * 大仓库里的大文件（ixinzhi 的 EPUB 仓库好几个 G）jsDelivr 会超时，改成代理 / raw 优先、jsDelivr 垫底
 */
export function repoFileUrls(owner, repo, branch, path, { big = false } = {}) {
  const enc = path.split('/').map(encodeURIComponent).join('/');
  const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${enc}`;
  const cdn = JSD.map(h => `https://${h}/gh/${owner}/${repo}@${branch}/${enc}`);
  const proxied = GH_PROXIES.map(p => p + raw);
  return big ? [...proxied, raw, ...cdn.slice(0, 2)] : [...cdn.slice(0, 3), ...proxied, raw, ...cdn.slice(3)];
}

/**
 * GitHub Releases 附件：原生端可直连 github.com；网页端只能走带 CORS 的代理
 * （ghfast 下 Releases 时跳转后的响应没有 CORS 头，网页端用不了，客户端里照用）
 */
export function releaseAssetUrls(owner, repo, tag, file, { native = false } = {}) {
  const direct = `https://github.com/${owner}/${repo}/releases/download/${tag}/${encodeURIComponent(file)}`;
  const proxied = GH_PROXIES.map(p => p + direct);
  return native ? [...proxied, direct] : proxied.filter(u => !u.startsWith('https://ghfast.top/'));
}
