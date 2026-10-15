// 漫画图片：问源要请求配置（onImageLoad：防盗链的 Referer、签名这些），用原生 HTTP 取字节，必要时交回源解密，再变成 Blob。
// 网页上的 <img> 带不了 Referer，所以图都这样取，不直接把网址给 <img>。

/** 按文件头认图片格式；认不出就不是图片（网站常回一个 HTML 错误页，状态码却是 200） */
export function imageType(bytes) {
  const b = bytes, ascii = (from, to) => String.fromCharCode(...b.subarray(from, to));
  if (b.length < 12) return '';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 3) === 'GIF') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp' && /^avi[fs]$/.test(ascii(8, 12))) return 'image/avif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  return '';
}

/**
 * 取一张图。sandbox：host.js 的 Sandbox；thumb：封面 / 缩略图（走 onThumbnailLoad）
 * @returns {Promise<Blob>}
 */
export async function fetchImage(sandbox, url, { comicId, epId, thumb = false, signal } = {}) {
  const req = await sandbox.call(thumb ? 'thumb' : 'image', thumb ? [url] : [url, comicId, epId], { signal });
  if (req.modifyImage) throw new Error('这个源的图片要重新拼接，暂不支持');
  const res = await sandbox.http({ ...req, bytes: true }, { signal });
  if (res.status < 200 || res.status >= 300) throw new Error(`图片 HTTP ${res.status}`);
  let buffer = res.body;
  if (req.onResponse) buffer = await sandbox.call('imageResponse', [req.onResponse, buffer], { signal });
  const type = imageType(new Uint8Array(buffer));
  if (!type) throw new Error('取到的不是图片');
  return new Blob([buffer], { type });
}
