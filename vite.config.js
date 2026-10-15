import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build as esbuild } from 'esbuild';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// `import code from './x.js?inline-script'`：把 x.js 连同依赖打成一段压缩过的 IIFE 文本。
// 漫画源沙箱用（src/comic/runtime/sandbox.js）：沙箱 iframe 和 App 不同源，没法用 <script src> 加载包里的 ES 模块，只能整段写进 srcdoc
function inlineScript() {
  const SUFFIX = '?inline-script';
  return {
    name: 'inline-script',
    async load(id) {
      if (!id.endsWith(SUFFIX)) return null;
      const out = await esbuild({ entryPoints: [id.slice(0, -SUFFIX.length)], bundle: true, minify: true, format: 'iife',
        target: ['es2020', 'safari15'], legalComments: 'none', write: false, metafile: true });
      // 只盯自己的源码：esbuild 的输入里还有 node_modules 和 "(disabled):crypto" 这种占位，开发服务器会把它们当 import 去解析
      for (const input of Object.keys(out.metafile.inputs)) if (input.startsWith('src/')) this.addWatchFile(resolve(input));
      return `export default ${JSON.stringify(out.outputFiles[0].text)};`;
    },
  };
}

export default defineConfig({
  plugins: [react(), inlineScript()],
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
