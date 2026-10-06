// 从 public/app-icon.svg（完整图标）和 public/app-icon-fg.svg（安卓自适应图标前景）生成各端图标。
//   node scripts/make-icons.mjs      然后桌面端再跑一次 npx tauri icon src-tauri/app-icon.png
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const full = join(root, 'public/app-icon.svg');
const fg = join(root, 'public/app-icon-fg.svg');
const BG = '#0d0b09';   // 自适应图标的底色 = 图标暖黑底
const png = (svg, size) => sharp(svg, { density: 384 }).resize(size, size).png({ compressionLevel: 9 });

// 桌面：1024 源图，交给 tauri icon 出 ico / 各尺寸 png
await png(full, 1024).toFile(join(root, 'src-tauri/app-icon.png'));

// 安卓：旧式图标 48dp、圆形图标 48dp、自适应前景 108dp
const res = join(root, 'android/app/src/main/res');
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DENS)) {
  const dir = join(res, `mipmap-${d}`);
  mkdirSync(dir, { recursive: true });
  const s = Math.round(48 * k), f = Math.round(108 * k);
  await png(full, s).toFile(join(dir, 'ic_launcher.png'));
  const mask = Buffer.from(`<svg width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" fill="#fff"/></svg>`);
  await png(full, s).composite([{ input: mask, blend: 'dest-in' }]).toFile(join(dir, 'ic_launcher_round.png'));
  await png(fg, f).toFile(join(dir, 'ic_launcher_foreground.png'));
}
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
mkdirSync(join(res, 'mipmap-anydpi-v26'), { recursive: true });
writeFileSync(join(res, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
writeFileSync(join(res, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);
writeFileSync(join(res, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);
console.log('图标已生成：src-tauri/app-icon.png + android mipmap-*');
