import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  plugins: [react()],
  // 版本号只在 package.json 维护一处，界面上的「版本」从这里来
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // 相对路径：Capacitor（https://localhost）和 Tauri（tauri://）都从包内加载
  base: './',
  server: {
    port: 5180, host: true,
    // 只盯源码：src-tauri/target（Rust 编译产物，几万个文件）、android 构建、打包产物都不看。
    // 不排除的话，每次编译都让监视器狂转，开着开发服务器就一直占一两个核、机器发烫
    watch: { ignored: ['**/src-tauri/target/**', '**/src-tauri/gen/**', '**/android/**', '**/release/**', '**/dist/**', '**/docs/**', '**/scripts/**'] },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200 },
});
