// 后台线程：画生成封面（jacket-art.js 的 Canvas 画法），压成 JPEG 交回主线程。
// 画只要零点几毫秒，时间都在压缩上：JPEG 0.95 和 SVG 原样比肉眼分不出，压得比 WebP 快五六倍（600 宽约 4ms 对 25ms）
// 主线程只拿到一张普通图片：解码也在后台，不再每本书在主线程上建一份 SVG 文档（见 jacket.js）
import { jacketCanvas } from './jacket-art.js';

self.onmessage = async ({ data: { id, book, scale } }) => {
  try {
    const canvas = new OffscreenCanvas(Math.round(300 * scale), Math.round(420 * scale));
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    jacketCanvas(ctx, book);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: .95 });
    self.postMessage({ id, blob });
  } catch (e) {
    self.postMessage({ id, error: String(e?.message || e) });
  }
};
