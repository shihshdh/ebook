// 鼠标划过封面时冒出像素故障：马赛克块（先缩小再放大、关平滑）+ 横向错位条（带一层偏青色差）。
// 参数沿用 Pixel Reconstruction 场景墙里调好的那一套；触屏和减少动态效果时不启用。
import { useEffect } from 'react';
import { isTouch, prefersReduced } from '../lib/motion.js';

export function usePixelGlitch(tileRef, canvasRef) {
  useEffect(() => {
    const tile = tileRef.current, cv = canvasRef.current;
    if (!tile || !cv || prefersReduced() || isTouch()) return;
    const ctx = cv.getContext('2d');
    const tiny = document.createElement('canvas'), tctx = tiny.getContext('2d');
    let blocks = [], raf = 0, lastSpawn = 0, sized = false;
    const img = () => tile.querySelector('img');
    const fit = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = Math.round(tile.clientWidth * dpr); cv.height = Math.round(tile.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sized = true;
    };
    // 显示坐标 → 原图坐标（object-fit: cover，再叠上悬停时的 1.04 放大）
    const source = (im, x, y, w, h) => {
      const W = tile.clientWidth, H = tile.clientHeight;
      const iw = im.naturalWidth || 300, ih = im.naturalHeight || 420;
      const s = Math.max(W / iw, H / ih) * 1.04;
      const ox = (W - iw * s) / 2, oy = (H - ih * s) / 2;
      return [(x - ox) / s, (y - oy) / s, w / s, h / s];
    };
    const draw = (now) => {
      const im = img();
      ctx.clearRect(0, 0, tile.clientWidth, tile.clientHeight);
      blocks = blocks.filter(b => now - b.born < b.life);
      if (im?.complete && im.naturalWidth) for (const b of blocks) {
        const t = (now - b.born) / b.life;
        if (t > .65 && Math.floor(now / 45) % 2) continue; // 最后 35% 断续闪烁，像信号不稳
        ctx.globalAlpha = t < .15 ? t / .15 : 1;
        try {
          if (b.kind === 'mosaic') {
            const cols = Math.max(1, Math.round(b.w / b.cell)), rows = Math.max(1, Math.round(b.h / b.cell));
            tiny.width = cols; tiny.height = rows;
            tctx.drawImage(im, ...source(im, b.x, b.y, b.w, b.h), 0, 0, cols, rows);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(tiny, b.x, b.y, b.w, b.h);
          } else {
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(im, ...source(im, b.x - b.shift, b.y, b.w, b.h), b.x, b.y, b.w, b.h);
            ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(233,203,139,.18)';
            ctx.fillRect(b.x + 3, b.y, b.w, b.h); ctx.globalCompositeOperation = 'source-over';
          }
        } catch { /* SVG 封面在个别浏览器里画不进 canvas，跳过这一块 */ }
      }
      ctx.globalAlpha = 1;
      raf = blocks.length ? requestAnimationFrame(draw) : 0;
    };
    const move = (e) => {
      if (e.pointerType === 'touch') return;
      const now = performance.now();
      if (now - lastSpawn < 55 || blocks.length > 20) return;
      if (!sized) fit();
      lastSpawn = now;
      const r = tile.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top;
      for (let k = 0; k < 3; k++) {
        const kind = Math.random() < .62 ? 'mosaic' : 'shift';
        const w = kind === 'mosaic' ? 12 + Math.random() * 30 : 34 + Math.random() * 80;
        const h = kind === 'mosaic' ? 8 + Math.random() * 20 : 3 + Math.random() * 8;
        blocks.push({ kind, w, h, x: cx - w / 2 + (Math.random() - .5) * 70, y: cy - h / 2 + (Math.random() - .5) * 60,
          born: now, life: 260 + Math.random() * 300, cell: 3 + Math.round(Math.random() * 4), shift: (Math.random() < .5 ? -1 : 1) * (8 + Math.random() * 22) });
      }
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const ro = new ResizeObserver(() => { sized = false; });
    ro.observe(tile);
    tile.addEventListener('pointermove', move);
    return () => { tile.removeEventListener('pointermove', move); ro.disconnect(); cancelAnimationFrame(raf); };
  }, []);
}
