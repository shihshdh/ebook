// 检查更新：仓库根目录的 latest.json 写着最新版本号和安装包文件名（发版时一起改）。
// 只在客户端里查（网页版本来就是最新的）；走 GitHub 加速代理，国内不开代理也能查。
//   安卓：在 EBOOK 里下好 APK，直接拉起系统安装器（系统会核对签名，别人改过的包装不上）
//   Windows：下好安装包放进「下载」文件夹并在资源管理器里选中，双击安装
import { getBinary, getJSON, releaseAssetUrls, repoFileUrls } from './net.js';
import { platform, saveExport } from './native.js';

const OWNER = 'shihshdh', REPO = 'ebook';
// 「以后再说」只管这一次打开（sessionStorage）：下次打开还提示。以前存在 localStorage 里是永久跳过这个版本，读到就清掉
const SKIP_KEY = 'librarium.update.skip';
try { localStorage.removeItem(SKIP_KEY); } catch {}
export const current = __APP_VERSION__;

/** '0.3.10' > '0.3.9' */
export function newer(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

/**
 * @param {{force?: boolean}} opts force=true 时忽略「以后再说」
 * @returns {Promise<null | {version, notes, file, sha256}>} 有新版且适用于本平台时返回
 */
export async function checkUpdate({ force = false } = {}) {
  if (platform === 'web') return null;
  // 不走 jsDelivr 的分支缓存（会晚 12 小时），代理 / raw 优先
  const info = await getJSON(repoFileUrls(OWNER, REPO, 'main', 'latest.json', { big: true }));
  if (!info?.version || !newer(info.version, current)) return null;
  if (!force) { try { if (sessionStorage.getItem(SKIP_KEY) === info.version) return null; } catch {} }
  const asset = platform === 'capacitor' ? info.android : info.windows;
  if (!asset?.file) return null;
  return { version: info.version, notes: info.notes || '', file: asset.file, sha256: asset.sha256 || '' };
}

export function skipUpdate(version) { try { sessionStorage.setItem(SKIP_KEY, version); } catch {} }

async function sha256Hex(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const assetUrls = (u) => releaseAssetUrls(OWNER, REPO, `v${u.version}`, u.file);
/** 在系统浏览器里下安装包用的地址（国内加速线路）：应用里下不动的时候给用户一个退路 */
export const browserDownloadUrl = (u) => assetUrls(u)[0];

/**
 * 下载并安装。onProgress(0..1)；onPhase('download' | 'verify' | 'install') 告诉界面现在在哪一步；signal 中止下载（点「取消」）。
 * 返回给用户看的提示
 */
export async function installUpdate(u, onProgress, { onPhase, signal } = {}) {
  onPhase?.('download');
  const blob = await getBinary(assetUrls(u),
    (loaded, total) => onProgress?.(total ? loaded / total : 0), { expectZip: platform === 'capacitor', signal });
  onPhase?.('verify');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (u.sha256 && (await sha256Hex(bytes)) !== u.sha256.toLowerCase()) throw new Error('安装包校验没通过，换个网络再试');
  onPhase?.('install');
  if (platform === 'capacitor') {
    const { installApk } = await import('./native.js');
    await installApk(u.file, bytes);
    return '安装器已打开，按提示安装即可（第一次需要允许 EBOOK 安装应用）';
  }
  const where = await saveExport(u.file, bytes);
  return `安装包已存到 ${where}，关掉 EBOOK 后双击安装`;
}
