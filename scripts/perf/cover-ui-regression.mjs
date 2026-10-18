import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const require=createRequire('C:/Users/ys221/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium,webkit}=require('playwright');
const sharp=(await import('sharp')).default;const png=await sharp('public/covers/featured/1779.webp').png().toBuffer();
mkdirSync('release/verification/0.4.2',{recursive:true});
const book={id:'comic:fixture:one',source:'comic',title:'漫画封面验收',author:'作者',tags:['恋爱'],description:'隔离网络测试',comics:[{sourceId:'fixture',comicId:'one',cover:'https://comic.fixture/one.webp'}]};
const books=Array.from({length:8},(_,i)=>({...book,id:`comic:fixture:${i}`,title:`漫画封面 ${i}`,comics:[{sourceId:'fixture',comicId:String(i),cover:`https://comic.fixture/${i}.webp`}]}));
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,...(name==='chromium'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{executablePath:'C:/Users/ys221/AppData/Local/ms-playwright/webkit-2359/Playwright.exe'})});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1'});
 await page.route('**/fixture-cover.png',route=>route.fulfill({contentType:'image/png',body:png}));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(!['http:','https:'].includes(u.protocol))return route.continue();if(u.pathname==='/fixture-cover.png')return route.fulfill({contentType:'image/png',body:png});if(u.hostname==='127.0.0.1')return route.continue();return route.abort();});
 if(name==='webkit') await page.route('**/src/comic/cover-cache.js*',async route=>{const res=await route.fetch();const code=(await res.text()).replace("const covers = makeStore('librarium-comic-covers', 400);","const testBlobs = globalThis.__testCoverBlobs ||= new Map(); const covers = {load: async k => testBlobs.has(k) ? {v:testBlobs.get(k)} : null, save: (k,v) => testBlobs.set(k,v)};");await route.fulfill({response:res,body:code});});
 await page.addInitScript(()=>{sessionStorage.setItem('librarium.splash','1');localStorage.setItem('librarium.plugins',JSON.stringify(['mojimoon','public']));});
 await page.goto('http://127.0.0.1:5196');await page.waitForLoadState('networkidle');
 const result=await page.evaluate(async books=>{
  const {default:React}=await import('/node_modules/.vite/deps/react.js');const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');
  const {default:Cover}=await import('/src/components/Cover.jsx');const {default:DiscShelf}=await import('/src/effects/DiscShelf.jsx');const {default:WorldSwitch}=await import('/src/effects/WorldSwitch.jsx');const {WORLDS}=await import('/src/lib/library.js');
  const covers=await import('/src/comic/cover-cache.js');const blob=await(await fetch('/fixture-cover.png')).blob();
  for(const b of books)covers.saveCover(`fixture|${b.comics[0].cover}`,blob);
  await new Promise(r=>setTimeout(r,150));
  document.getElementById('root').style.display='none';document.documentElement.style.setProperty('--native-safe-top','59px');document.documentElement.style.setProperty('--native-safe-bottom','34px');
  const host=document.createElement('main');host.className='pages';document.body.append(host);window.fixRoot=createRoot(host);
  window.fixRoot.render(React.createElement('div',{className:'route is-active'},
   React.createElement('div',{className:'page explore-comic',hidden:true},React.createElement('div',{style:{height:400}},'隐藏的漫画页')),
   React.createElement('div',{className:'page explore'},React.createElement(WorldSwitch,{worlds:WORLDS,active:'romance',collage:{romance:books},onChange:()=>{}}),
    React.createElement(DiscShelf,{books,onOpen:()=>{}}),
    React.createElement('section',{className:'comicsources'},React.createElement('div',{className:'bs-row'},React.createElement('button',{className:'switch on',role:'switch','aria-checked':true,onClick:e=>e.currentTarget.classList.toggle('on')},React.createElement('i')))),
    React.createElement('section',{className:'plugin'},React.createElement('button',{className:'switch on',role:'switch','aria-checked':true},React.createElement('i'))))));
  return true;
 },books);
 await page.waitForTimeout(1800);


 await page.waitForFunction(()=>document.querySelectorAll('.disc-face img').length>0&&[...document.querySelectorAll('.disc-face img')].every(i=>i.complete&&i.naturalWidth>60&&i.src.startsWith('blob:')&&i.closest('.cover').classList.contains('is-real')),{timeout:10000});
 const metrics=await page.evaluate(()=>({worldTop:document.querySelector('.ws').getBoundingClientRect().top,hiddenHeight:document.querySelector('.page[hidden]').getBoundingClientRect().height,discs:[...document.querySelectorAll('.disc-face img')].map(i=>({width:i.naturalWidth,src:i.src.slice(0,5),real:i.closest('.cover').classList.contains('is-real')})),switches:[...document.querySelectorAll('[role=switch]')].map(i=>({width:i.getBoundingClientRect().width,height:i.getBoundingClientRect().height})),overflow:document.documentElement.scrollWidth>innerWidth}));
 if(metrics.hiddenHeight!==0||metrics.worldTop>80||metrics.switches.some(s=>s.width!==51||s.height!==31)||metrics.discs.some(i=>i.src!=='blob:'||!i.real)||metrics.overflow)throw Error(JSON.stringify(metrics));
 await page.screenshot({path:`release/verification/0.4.2/${name}-layout.png`,fullPage:true});
 // Evict the entire shared cache while the first disc remains mounted.
 await page.evaluate(async()=>{const {coverURL}=await import('/src/comic/library.js');const {saveCover}=await import('/src/comic/cover-cache.js');const blob=await(await fetch('/fixture-cover.png')).blob();for(let i=0;i<130;i++)saveCover(`evict|https://fixture/${i}`,blob);await new Promise(r=>setTimeout(r,200));for(let i=0;i<130;i++){const url=await coverURL('evict',`https://fixture/${i}`);URL.revokeObjectURL(url);}});
 const discAlive=await page.evaluate(async()=>{const img=document.querySelector('.disc-face img');const blob=await(await fetch(img.src)).blob();return blob.size>0;});if(!discAlive)throw Error('mounted disc URL revoked');
 // Source results can replace the disc books without changing the list length.
 await page.evaluate(async books=>{const {default:React}=await import('/node_modules/.vite/deps/react.js');const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');const {default:DiscShelf}=await import('/src/effects/DiscShelf.jsx');const box=document.createElement('div');box.id='replacement-discs';document.body.append(box);const root=createRoot(box);const render=items=>root.render(React.createElement(DiscShelf,{books:items,onOpen:()=>{}}));render(books);await new Promise(r=>setTimeout(r,1600));render(books.map(b=>({...b,id:b.id+'-replacement'})));await new Promise(r=>setTimeout(r,400));},books);
 const replacementWidths=await page.evaluate(()=>[...document.querySelectorAll('#replacement-discs .disc')].map(e=>e.offsetWidth));
 if(replacementWidths.length<2||replacementWidths.some(w=>w<80))throw Error('replacement discs lost geometry: '+JSON.stringify(replacementWidths));
 writeFileSync(`release/verification/0.4.2/${name}-ui.json`,JSON.stringify({metrics,discAlive,replacementWidths,errors},null,2));console.log(name,JSON.stringify(metrics));
 }finally{await browser.close()}
}
