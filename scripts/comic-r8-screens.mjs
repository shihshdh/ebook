import { openPage, sleep } from './perf/cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const mobile = process.argv.includes('--mobile');
const p = await openPage(9223);
let injection;
const out = 'docs/screenshots/comic'; mkdirSync(out, { recursive: true });
const mode = mobile ? 'mobile' : 'desktop';
const width = mobile ? 390 : 1440, height = mobile ? 844 : 1000;
async function wait(expr) { for (let i = 0; i < 100; i++) { if (await p.eval(expr)) return; await sleep(200); } throw new Error('Timed out: ' + expr); }
async function click(text) { await p.eval(`(()=>{const b=[...document.querySelectorAll('.reader2 button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Missing button');b.click()})()`); await sleep(500); }
async function shot(name) {
  await sleep(600);
  const r = await p.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } });
  writeFileSync(`${out}/r8-${name}-${mode}.png`, Buffer.from(r.data, 'base64'));
}
try {
  await p.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await p.send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
  await p.send('Network.setUserAgentOverride', { userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36' });
  if (mobile) injection = (await p.send('Page.addScriptToEvaluateOnNewDocument', { source: "if(self === top) window.__EBOOK_BRIDGE_GUARD__ = 'main-frame';" })).identifier;
  await p.eval("location.hash = '/read/comic/venera%3Akomga/observatory/0'");
  await wait("location.hash.includes('/read/comic/')"); await sleep(300);
  await p.send('Page.reload'); await sleep(700);
  await wait("!!document.querySelector('.cr-stage img')?.naturalWidth");
  if (mobile) await p.eval("document.documentElement.style.setProperty('--native-safe-top','47px'); document.documentElement.style.setProperty('--native-safe-bottom','34px')");
  await shot('comic-toolbar');
  await click('目录'); await shot('comic-toc');
  await p.eval("document.querySelector('[aria-label=关闭面板]').click()");
  await click('书签'); await shot('comic-marks');
  await click('阅读方式'); await shot('comic-mode');
  await click('纸张'); await shot('comic-theme');
  await p.eval("document.querySelector('[aria-label=关闭面板]').click()");
  console.log(mode, await p.eval("({width:innerWidth,height:innerHeight,mobile:document.documentElement.className,content:document.querySelector('.cr-scroll').getBoundingClientRect().toJSON(),shelf:document.querySelector('.rd-title').innerText})"));
  await p.eval(`(async()=>{const {addToShelf}=await import('/src/lib/shelf.js'); const text=Array.from({length:15},(_,i)=>'第'+(i+1)+'章 星光\\n'+('夜色沉静，山间的观测站点亮了一盏灯。我们沿着石阶走向远处，听见风穿过松林。\\n'.repeat(40))).join('\\n'); await addToShelf({id:'local:r8-novel',bookId:'local:r8-novel',source:'local',title:'静夜观测站 · 小说对照',author:'本地验收',ext:'txt',size:text.length},new Blob([text],{type:'text/plain'})); location.hash='/read/local%3Ar8-novel';})()`);
  await wait("!!document.querySelector('.rd-content.is-ready')");
  await p.eval("document.dispatchEvent(new KeyboardEvent('keydown',{key:'t',bubbles:true}))");
  await shot('novel-toc');
  await p.eval("document.querySelector('.rd-panel [aria-label=关闭]')?.click()");
  await shot('novel-toolbar');
  await click('笔记'); await shot('novel-marks');
  await click('字体'); await shot('novel-mode');
  await click('纸张'); await shot('novel-theme');
  console.log('Console exceptions:', p.logs.filter(l => l.startsWith('[exception]')));
} finally {
  await p.eval("document.documentElement.style.removeProperty('--native-safe-top');document.documentElement.style.removeProperty('--native-safe-bottom')").catch(()=>{});
  if (injection) await p.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection });
  await p.send('Emulation.clearDeviceMetricsOverride');
  await p.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await p.send('Network.setUserAgentOverride', { userAgent: '' });
  p.close();
}
