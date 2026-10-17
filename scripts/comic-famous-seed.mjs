// 生成 src/comic/famous-seed.js：名作、高分神作在各源里找到的结果，随包附带——新装的人第一次打开漫画页不用等现找（几十秒）。
//
// 用法：开着桌面客户端（npm run desktop:dev，WebView2 调试端口 9223），漫画页名作都找齐以后（本机缓存 comic:famous），
//       node scripts/comic-famous-seed.mjs
// 只收找到了的、名单写法签名（sig）对得上的；简介截短。名单（famous.js）改了要重新生成，否则对不上的那几条会被忽略、现找。
import { writeFileSync } from 'node:fs';
import { connect } from './perf/cdp.mjs';

const targets = await (await fetch('http://127.0.0.1:9223/json')).json();
const page = targets.find(t => t.type === 'page' && /localhost:5181|tauri/.test(t.url)) || targets.find(t => t.type === 'page');
const c = await connect(page.webSocketDebuggerUrl);
const r = await c.send('Runtime.evaluate', { expression: `localStorage.getItem('comic:famous')`, returnByValue: true });
c.close();
const cache = JSON.parse(r.result.value || '{}');
const hits = {};
for (const [title, v] of Object.entries(cache)) {
  if (!v?.sourceId || !v.sig) continue;
  const { id, title: t, subtitle, cover, tags } = v.comic;
  const slim = (c) => ({ id: c.id, title: c.title, subtitle: c.subtitle, cover: c.cover, tags: c.tags, description: String(c.description || '').slice(0, 120) });
  hits[title] = { sig: v.sig, sourceId: v.sourceId, sourceName: v.sourceName, comic: { id, title: t, subtitle, cover, tags, description: String(v.comic.description || '').slice(0, 120) },
    alts: (v.alts || []).map(a => ({ sourceId: a.sourceId, sourceName: a.sourceName, comic: slim(a.comic) })) };
}
const at = Date.now();
writeFileSync('src/comic/famous-seed.js', `// 自动生成（scripts/comic-famous-seed.mjs），别手改。名作、高分神作在各源里找到的结果，${new Date(at).toISOString().slice(0, 10)} 找的。
// 用法见 catalog.js 的 findFamous：本机没找过时先用这份，签名对不上、源关了、封面取不到的才现找
export default ${JSON.stringify({ at, hits }, null, 1)};
`);
console.log(`写了 ${Object.keys(hits).length} 条 → src/comic/famous-seed.js`);
