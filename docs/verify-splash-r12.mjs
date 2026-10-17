import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/ys221/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const sharp = require('sharp');
const dir = 'docs/screenshots/splash-r12'; mkdirSync(dir,{recursive:true});
const browser = await chromium.launch({channel:'msedge',headless:true});
const context = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
let page = await context.newPage();
await page.goto('http://localhost:5190'); await page.waitForTimeout(2400);
const results = [];
await page.addInitScript(() => { const timer=window.setTimeout;window.setTimeout=(fn,ms,...args)=>ms===1400?0:timer(fn,ms,...args); });
for (const direction of ['lift','unfold']) {
 await page.evaluate(()=>sessionStorage.removeItem('librarium.splash'));
 await page.reload(); await page.waitForSelector('.splash');
 await page.evaluate(direction=>{
  const el=document.querySelector('.splash');el.className='splash splash-'+direction;
  // Hold the actual component for deterministic CSS sampling, including its cleanup timer.
  window.__hold=setInterval(()=>{},1000);
  el.getAnimations({subtree:true}).forEach(a=>a.pause());
 },direction);
 // Sampling runs with the capture-only cleanup timer interception above.
 const cdp = await context.newCDPSession(page);

 const imgs=[];
 for(const ms of [0,180,420,720,1050,1300]) {
  await page.evaluate(ms=>document.querySelector('.splash').getAnimations({subtree:true}).forEach(a=>a.currentTime=ms),ms);
  const file=`${dir}/${direction}-${ms}.png`;await page.screenshot({path:file,timeout:10000});
  imgs.push({input:await sharp(file).resize(195,422).toBuffer(),left:imgs.length*195,top:24});
 }
 const label=Buffer.from(`<svg width="1170" height="24"><rect width="1170" height="24" fill="#FFF7ED"/><text x="8" y="17" font-size="12" fill="#B64E38">${direction}: 0 / 180 / 420 / 720 / 1050 / 1300 ms</text></svg>`);
 await sharp({create:{width:1170,height:446,channels:4,background:'#FFF7ED'}}).composite([{input:label,left:0,top:0},...imgs]).png().toFile(`${dir}/${direction}-strip.png`);
 await cdp.detach();await page.evaluate(()=>document.querySelector('.splash-skip')?.click());
}
// Fresh context without capture-only timer interception.
await context.close();
const testContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
page=await testContext.newPage();
await page.goto('http://localhost:5190');await page.waitForTimeout(2000);
for (const mode of ['light','dark','system','reduced','keyboard','click']) {
 await page.emulateMedia({reducedMotion:mode==='reduced'?'reduce':'no-preference',colorScheme:'dark'});
 await page.evaluate(mode=>{sessionStorage.removeItem('librarium.splash');localStorage.setItem('librarium.theme',mode==='system'?'system':mode==='light'?'light':'dark')},mode);
 await page.reload();await page.waitForSelector('.splash');
 const before=await page.evaluate(()=>({background:getComputedStyle(document.querySelector('.splash')).backgroundColor,theme:document.documentElement.dataset.theme,duration:getComputedStyle(document.querySelector('.splash')).animationDuration}));
 if(mode==='keyboard')await page.keyboard.press('a');
 if(mode==='click')await page.locator('.splash-skip').click();
 await page.waitForSelector('.splash',{state:'detached'});
 const stored=await page.evaluate(()=>sessionStorage.getItem('librarium.splash'));
 await page.reload();await page.waitForTimeout(250);
 results.push({mode,...before,stored,replay:await page.locator('.splash').count()});
}
// Measure startup separately from screenshots; frame sampling starts at actual splash insertion.
await page.emulateMedia({reducedMotion:'no-preference'});
const cdp=await testContext.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
await page.addInitScript(()=>{
 window.__frames=[];window.__splashTiming={};let running=false,last;
 new MutationObserver(()=>{const el=document.querySelector('.splash');if(el&&!running){running=true;window.__splashTiming.start=performance.now();requestAnimationFrame(function tick(t){if(last)window.__frames.push(t-last);last=t;if(document.querySelector('.splash'))requestAnimationFrame(tick);else window.__splashTiming.end=performance.now();});}}).observe(document,{childList:true,subtree:true});
});
const perf=[];
for(let i=0;i<3;i++){
 await page.evaluate(()=>sessionStorage.removeItem('librarium.splash'));await page.reload();await page.waitForTimeout(2600);
 perf.push(await page.evaluate(()=>({timing:window.__splashTiming,frames:window.__frames.length,maxMs:Math.max(...window.__frames),over33:window.__frames.filter(x=>x>33).length,intervals:window.__frames})));
}
await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
await page.screenshot({path:`${dir}/home-dark.png`});
writeFileSync(`${dir}/verification.json`,JSON.stringify({results,perf},null,2));
console.log(JSON.stringify({results,perf:perf.map(({intervals,...r})=>r)},null,2));
await browser.close();
