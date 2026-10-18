// Real reader/sheet/tab components with deterministic slow native-image transport.
// node scripts/perf/comic-reader-turns.mjs [baseline|optimized] [chromium|webkit]
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import bundled from '../../src/comic/default-sources.js';
const [label='optimized',engine='chromium',os='ios']=process.argv.slice(2);
const suffix=engine+(os==='ios'?'':'-'+os);
const require=createRequire('C:/Users/ys221/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const pw=require('playwright');
const baseline='src/pages/ComicReader.baseline.jsx';
if(label==='baseline')writeFileSync(baseline,execFileSync('git',['show','HEAD:src/pages/ComicReader.jsx']));
const output='release/verification/reader-turns';mkdirSync(output,{recursive:true});
const browser=await pw[engine].launch({headless:true,executablePath:engine==='webkit'?'C:/Users/ys221/AppData/Local/ms-playwright/webkit-2359/Playwright.exe':'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:402,height:874},deviceScaleFactor:3,isMobile:true,hasTouch:true,userAgent:os==='ios'?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1':'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36'});
const jpg=await sharp('public/covers/featured/1779.webp').resize(1600,2260).jpeg({quality:85}).toBuffer();
const requests=[],errors=[];let failure=true;
page.on('pageerror',e=>errors.push(e.message));
await page.exposeBinding('__fixtureHTTP',async(_,o)=>{
 if(!o.url.startsWith('https://reader.fixture/'))throw Error('fixture blocked '+o.url);
 const [,ep,index]=new URL(o.url).pathname.split('/');const i=Number(index.split('.')[0]);
 requests.push({ep,i,at:Date.now()});await new Promise(r=>setTimeout(r,i===12?1400:350));
 if(i===17&&failure){failure=false;return {status:503,headers:{},data:''};}
 return {status:200,headers:{'Content-Type':'image/jpeg'},data:jpg.toString('base64'),url:o.url};
});
await page.addInitScript(os=>{
 if(self!==top)return;
 sessionStorage.setItem('librarium.splash','1');localStorage.setItem('librarium.comic.reader',JSON.stringify({mode:'page'}));
 const names={CapacitorHttp:['request'],EbookNative:['ready','setBars','setImmersive','consumeFile','addListener','removeListener','haptic','prepareHaptics','accessibility','setBackground'],App:['addListener','removeListener','getState']};
 window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>os,platform:os,PluginHeaders:Object.entries(names).map(([name,methods])=>({name,methods:methods.map(name=>({name,rtype:name==='addListener'?'callback':'promise'}))})),nativePromise:async(plugin,method,options)=>plugin==='CapacitorHttp'?window.__fixtureHTTP(options):{},nativeCallback:()=> 'fixture'};
},os);
const report={label,engine,os,viewport:'iPhone 16 Pro: 402x874 @3, safe 62/34',image:{width:1600,height:2260,bytes:jpg.length,networkDelay:350},requests,errors};
try{
 console.log('Starting',label,engine);await page.goto('http://127.0.0.1:5196');await page.waitForSelector('.hero-title');
 const code=`class ReaderFixture extends ComicSource{name='翻页测试源';key='komga';version='1';comic={loadInfo:async()=>new ComicDetails({title:'翻页测试漫画',chapters:new Map(Array.from({length:40},(_,i)=>[String(i+1),'第'+(i+1)+'话']))}),loadEp:async(c,ep)=>{await new Promise(r=>setTimeout(r,160));return {images:Array.from({length:24},(_,i)=>'https://reader.fixture/'+ep+'/'+i+'.jpg')}}}}`;
 await page.evaluate(async({code,runtime})=>{
  const {idbSet}=await import('/src/lib/idb.js');await idbSet('kv','comic:sources',[{id:'turn:fixture',repo:'turn',key:'komga',name:'翻页测试源',className:'ReaderFixture',enabled:true,code}]);await idbSet('kv','comic:defaults',999);await idbSet('kv','comic:runtime:turn',{code:runtime});await idbSet('kv','comic:progress',[]);
 },{code,runtime:bundled.runtime});
 await page.evaluate(async({label})=>{
  document.getElementById('root').style.display='none';
  const html=document.documentElement;html.style.setProperty('--native-safe-top','62px');html.style.setProperty('--native-safe-bottom','34px');
  const {default:React}=await import('/node_modules/.vite/deps/react.js');const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');
  const transformed=await(await fetch('/src/pages/ComicReader.jsx')).text();
  const routerPath=transformed.match(/from ["']([^"']*react-router-dom[^"']*)/)[1];
  const {MemoryRouter,Routes,Route}=await import(routerPath);
  const {default:Reader}=await import(label==='baseline'?'/src/pages/ComicReader.baseline.jsx':'/src/pages/ComicReader.jsx');
  const {default:Sheet}=await import('/src/components/BookSheet.jsx');const {UIProvider,useUIActions}=await import('/src/lib/ui.jsx');const {default:Tabs}=await import('/src/components/GlassTabBar.jsx');
  const host=document.createElement('div');host.id='verification';document.body.append(host);const root=createRoot(host);const h=React.createElement;
  const book={id:'comic:turn:fixture:book',source:'comic',title:'四月是你的谎言',author:'新川直司',description:'曾连载于日本讲谈社杂志。'.repeat(12),tags:['讲谈社','国漫','恋爱','校园'],downloads:[],comics:[{sourceId:'turn:fixture',sourceName:'翻页测试源',comicId:'book',title:'四月是你的谎言'}]};
  function Open(){const{openBook}=useUIActions();React.useEffect(()=>openBook(book),[]);return h(Sheet);}
  const tabs=[{to:'/',label:'首页',icon:'home'},{to:'/explore',label:'探索',icon:'explore'},{to:'/shelf',label:'书架',icon:'shelf'},{to:'/rss',label:'订阅',icon:'rss'},{to:'/plugins',label:'插件',icon:'plug'}];
  window.renderFixture=kind=>root.render(h(MemoryRouter,{key:kind,initialEntries:[kind==='reader'?'/read/comic/turn%3Afixture/book/0':'/']},h(UIProvider,null,kind==='reader'?h(Routes,null,h(Route,{path:'/read/comic/:sourceId/:comicId/:index',element:h(Reader)})):kind==='sheet'?h(Open):h(Tabs,{tabs,searchTab:{to:'/search',label:'搜索'}}))));
  window.__urls=new Set();const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=b=>{const u=create(b);__urls.add(u);return u};URL.revokeObjectURL=u=>{__urls.delete(u);revoke(u)};
  window.renderFixture('reader');
 },{label});
 const ready=()=>page.waitForFunction(()=>[...document.querySelectorAll('#verification .cr-stage img')].some(i=>i.complete&&i.naturalWidth&&getComputedStyle(i.closest('.cr-frame')||i).visibility!=='hidden'),{timeout:15000});
 await ready();console.log('First page ready');await page.waitForTimeout(1200);
 await page.evaluate(()=>{window.__black=[];window.__record=true;function sample(t){if(__record){const stage=document.querySelector('#verification .cr-stage');const visible=[...(stage?.querySelectorAll('img')||[])].filter(i=>i.complete&&i.naturalWidth&&getComputedStyle(i.closest('.cr-frame')||i).visibility!=='hidden');__black.push({at:t,blank:!!stage&&!visible.length,...(stage&&!visible.length?{html:stage.outerHTML}: {})});}requestAnimationFrame(sample)}requestAnimationFrame(sample);});
 const turns=[];
 for(let i=1;i<=10;i++){
  const t=Date.now();await page.keyboard.press('ArrowRight');
  await page.waitForFunction(n=>{const stage=document.querySelector('#verification .cr-stage');return [...stage.querySelectorAll('img')].some(i=>i.alt===`第 ${n+1} 张`&&i.complete&&i.naturalWidth&&getComputedStyle(i.closest('.cr-frame')||i).visibility!=='hidden');},i,{timeout:6000});
  turns.push(Date.now()-t);await page.waitForTimeout(140);
 }
 report.turns=turns;console.log('Ten turns',turns);
 // A slow target must retain the previous painted image; then catch up to newest input.
 await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.waitForTimeout(50);
 report.slowTarget=await page.evaluate(()=>({visible:[...document.querySelectorAll('#verification .cr-stage img')].filter(i=>i.complete&&i.naturalWidth&&getComputedStyle(i.closest('.cr-frame')||i).visibility!=='hidden').map(i=>i.alt),status:document.querySelector('#verification [role=status]')?.textContent}));
 await page.waitForTimeout(1700);
 const frames=await page.evaluate(()=>{__record=false;return __black});report.blackFrames=frames.filter(f=>f.blank).length;report.sampledFrames=frames.length;
 report.prefetchedIndices=[...new Set(requests.filter(r=>r.ep==='1').map(r=>r.i))];
 // Jump into a failed page and explicitly retry.
 for(let i=12;i<17;i++)await page.keyboard.press('ArrowRight');
 await page.waitForSelector('#verification .cr-ph.is-error',{timeout:6000});
 await page.locator('#verification .cr-ph.is-error').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('#verification .cr-stage img')].some(i=>i.alt==='第 18 张'&&i.complete&&i.naturalWidth&&getComputedStyle(i.closest('.cr-frame')||i).visibility!=='hidden'),{timeout:6000});
 report.retry=true;console.log('Slow page and retry checked');
 report.maxResidentURLs=await page.evaluate(()=>__urls.size);
 if(label!=='baseline'){
  // Warm next chapter while still reading its predecessor.
  for(let i=17;i<21;i++)await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>document.querySelector('#verification [data-image="21"]')?.complete);
  await page.waitForTimeout(1300);
  const warmed=requests.some(r=>r.ep==='2'&&r.i===0);assert(warmed,'next chapter did not warm');
  await page.evaluate(()=>{__black=[];__record=true});
  for(let i=21;i<24;i++)await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>document.querySelector('#verification .rd-title small')?.textContent==='第2话'&&[...document.querySelectorAll('#verification .cr-stage img')].some(i=>i.alt==='第 1 张'&&i.complete&&i.naturalWidth&&getComputedStyle(i.closest('.cr-frame')||i).visibility!=='hidden'));
  report.chapterTransition=await page.evaluate(()=>{__record=false;return {blackFrames:__black.filter(f=>f.blank).length,frames:__black.length,blank:__black.filter(f=>f.blank).slice(0,6)}});
  assert.equal(report.chapterTransition.blackFrames,0);report.chapterTransition.warmed=warmed;
  report.chapterJumps=[];
  for(let chapter=3;chapter<=5;chapter++){
    const previousURL=await page.locator('#verification .cr-frame.is-visible img').first().getAttribute('src');
    await page.evaluate(()=>{__black=[];__record=true});await page.keyboard.press(']');
    await page.waitForFunction(({chapter,previousURL})=>document.querySelector('#verification .rd-title small')?.textContent===`第${chapter}话`&&[...document.querySelectorAll('#verification .cr-stage img')].some(i=>i.src!==previousURL&&i.alt==='第 1 张'&&i.complete&&i.naturalWidth&&getComputedStyle(i.closest('.cr-frame')||i).visibility!=='hidden'),{chapter,previousURL});
    const frames=await page.evaluate(()=>{__record=false;return {blackFrames:__black.filter(f=>f.blank).length,frames:__black.length}});report.chapterJumps.push(frames);assert.equal(frames.blackFrames,0);
  }

 }

 await page.screenshot({path:`${output}/${label}-${suffix}-reader.png`});
 if(label!=='baseline'){
  await page.evaluate(()=>renderFixture('tabs'));await page.waitForTimeout(100);
  await page.evaluate(async()=>{localStorage.setItem('librarium.comic.reader',JSON.stringify({mode:'scroll'}));const{idbSet}=await import('/src/lib/idb.js');await idbSet('kv','comic:progress',[]);renderFixture('reader');});
  await page.waitForFunction(()=>document.querySelector('#verification [data-page="0"] img')?.naturalWidth>0);
  await page.locator('#verification [data-page="6"]').evaluate(e=>e.scrollIntoView({block:'start'}));
  await page.waitForFunction(()=>document.querySelector('#verification [data-page="6"] img')?.naturalWidth>0);
  await page.locator('#verification [data-page="0"]').evaluate(e=>e.scrollIntoView({block:'start'}));
  await page.waitForFunction(()=>document.querySelector('#verification [data-page="0"] img')?.naturalWidth>0);
  report.scroll={forward:true,back:true};
  await page.evaluate(()=>renderFixture('tabs'));await page.waitForTimeout(100);await page.setViewportSize({width:1200,height:800});
  await page.evaluate(async()=>{localStorage.setItem('librarium.comic.reader',JSON.stringify({mode:'page',spread:true,rtl:true}));const{idbSet}=await import('/src/lib/idb.js');await idbSet('kv','comic:progress',[]);renderFixture('reader');});
  await page.waitForFunction(()=>document.querySelectorAll('#verification .cr-frame.is-visible img').length===2&&[...document.querySelectorAll('#verification .cr-frame.is-visible img')].every(i=>i.complete&&i.naturalWidth>0));
  await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>[...document.querySelectorAll('#verification .cr-frame.is-visible img')].map(i=>i.alt).sort().join('|')==='第 3 张|第 4 张');
  report.spread={twoDecodedImages:true,rtlForward:true};await page.setViewportSize({width:402,height:874});
 }
 await page.evaluate(()=>renderFixture('sheet'));await page.waitForSelector('#verification .cx-chapter-list li');await page.waitForTimeout(800);
 report.sheet=[];
 for(const [name,w,h,top,bottom]of [['16pro',402,874,62,34],['se',375,667,20,0],['16promax',440,956,62,34],['landscape',874,402,0,21]]){
  await page.setViewportSize({width:w,height:h});await page.evaluate(({top,bottom})=>{const s=document.documentElement.style;s.setProperty('--native-safe-top',top+'px');s.setProperty('--native-safe-bottom',bottom+'px');}, {top,bottom});await page.waitForTimeout(180);
  await page.locator('#verification .sheet-body').evaluate(e=>e.scrollTop=e.scrollHeight);await page.waitForTimeout(120);
  const m=await page.evaluate(()=>{const s=document.querySelector('#verification .sheet'),b=s.querySelector('.sheet-body'),q=s.getBoundingClientRect(),last=s.querySelector('.cx-chapter-list li:last-child').getBoundingClientRect();return {left:q.left,right:q.right,top:q.top,bottom:q.bottom,radius:getComputedStyle(s).borderBottomLeftRadius,lastBottom:last.bottom,bodyBottom:b.getBoundingClientRect().bottom,overflow:document.documentElement.scrollWidth>innerWidth}});
  report.sheet.push({name,...m});assert(m.left>=0&&m.right<=w+1&&!m.overflow);assert(m.bottom<=h-Math.max(8,bottom)+1);assert(m.lastBottom<m.bodyBottom-8);await page.screenshot({path:`${output}/${label}-${suffix}-sheet-${name}.png`});
 }
 await page.setViewportSize({width:402,height:874});await page.evaluate(()=>{document.documentElement.style.setProperty('--native-safe-top','62px');document.documentElement.style.setProperty('--native-safe-bottom','34px');renderFixture('tabs');});await page.waitForSelector('#verification .lg-pill');await page.waitForTimeout(500);
 const tab=page.locator('#verification .lg-tabbar');const items=tab.locator('.lg-tabs > a');const first=await items.nth(0).boundingBox(),last=await items.nth(4).boundingBox();
 await page.mouse.move(first.x+first.width/2,first.y+first.height/2);await page.mouse.down();await page.mouse.move(last.x+last.width/2,last.y+last.height/2,{steps:20});await page.waitForTimeout(100);
 report.glassPressed=await tab.evaluate(e=>{const a=e.querySelector('.lg-lens'),b=a.getBoundingClientRect();return {visible:getComputedStyle(a).visibility,width:b.width,height:b.height,background:getComputedStyle(a).backgroundColor,filter:getComputedStyle(a).backdropFilter||getComputedStyle(a).webkitBackdropFilter}});
 await page.screenshot({path:`${output}/${label}-${suffix}-glass-held.png`});await page.mouse.up();await page.waitForTimeout(950);
 report.glassRest=await tab.evaluate(e=>{const p=e.querySelector('.lg-pill').getBoundingClientRect(),a=e.querySelector('a.active').getBoundingClientRect();return {delta:p.x+p.width/2-(a.x+a.width/2),width:p.width,height:p.height,lifted:e.hasAttribute('data-lifted')}});
 assert(Math.abs(report.glassRest.delta)<1);assert(!report.glassRest.lifted);assert(report.glassPressed.visible==='visible'&&/blur/.test(report.glassPressed.filter));
 await page.screenshot({path:`${output}/${label}-${suffix}-glass-rest.png`});
 // Cancelled drags keep selection; rapid changes and keyboard activation settle correctly.
 await page.mouse.move(last.x+last.width/2,last.y+last.height/2);await page.mouse.down();await page.mouse.move(first.x+first.width/2,first.y+first.height/2,{steps:5});
 await tab.dispatchEvent('pointercancel',{pointerId:1,isPrimary:true,pointerType:'mouse'});await page.mouse.up();await page.waitForTimeout(850);
 assert.equal(await tab.locator('a.active').getAttribute('href'),'/plugins');
 await page.evaluate(()=>{window.__animate=Element.prototype.animate;Element.prototype.animate=function(...args){const a=__animate.apply(this,args);Object.defineProperty(a,'finished',{get:()=>new Promise(()=>{})});return a;};});
 for(const n of [0,4,1,3]){const box=await items.nth(n).boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);}
 await page.waitForTimeout(900);await items.nth(2).focus();await page.keyboard.press('Enter');await page.waitForTimeout(900);
 assert.equal(await tab.locator('a.active').getAttribute('href'),'/shelf');assert.equal(await tab.getAttribute('data-lifted'),null);await page.evaluate(()=>Element.prototype.animate=__animate);
 await page.emulateMedia({reducedMotion:'reduce'});await items.nth(1).click();await page.waitForTimeout(500);assert.equal(await tab.getAttribute('data-lifted'),null);await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.waitForTimeout(100);await page.screenshot({path:`${output}/${label}-${suffix}-glass-dark.png`});
 report.glassInteractions={cancelledDrag:true,rapidSwitch:true,missingFinishedCallback:true,keyboard:true,reducedMotion:true,dark:true};

 if(label!=='baseline'){assert.equal(report.blackFrames,0);assert(report.slowTarget.visible.length>0);assert(report.maxResidentURLs<=10);}
 assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({...report,requests:requests.length,prefetchedIndices:report.prefetchedIndices.length},null,2));
}finally{writeFileSync(`${output}/${label}-${suffix}.json`,JSON.stringify(report,null,2));await browser.close();if(label==='baseline')unlinkSync(baseline);}
