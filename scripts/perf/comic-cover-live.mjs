// Real production UI + isolated browser; only the native HTTP transport is emulated.
import {createRequire} from 'node:module';
import http from 'node:http';import https from 'node:https';import zlib from 'node:zlib';
const require=createRequire('C:/Users/ys221/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--remote-debugging-port=9336']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36'});
const page=await context.newPage();
async function request(options,hops=0){
 if(hops>5)throw Error('Redirect loop');const u=new URL(options.url);
 if(!['http:','https:'].includes(u.protocol))throw Error('Unsupported protocol');
 if(['localhost','127.0.0.1'].includes(u.hostname)&&u.port!=='9461')throw Error('Unexpected local request');
 return new Promise((resolve,reject)=>{const req=(u.protocol==='https:'?https:http).request(u,{method:options.method||'GET',headers:{'Accept-Encoding':'gzip, deflate, br',...options.headers},timeout:20000},res=>{
 if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){res.resume();resolve(request({...options,url:new URL(res.headers.location,u).href},hops+1));return}
 const chunks=[];res.on('error',reject);res.on('data',c=>chunks.push(c));res.on('end',()=>{let body=Buffer.concat(chunks);try{const e=res.headers['content-encoding'];if(e==='gzip')body=zlib.gunzipSync(body);if(e==='br')body=zlib.brotliDecompressSync(body);if(e==='deflate')body=zlib.inflateSync(body)}catch{}
 let data=body.toString('base64');if(/application\/(?:[\w.-]+\+)?json/i.test(res.headers['content-type']||'')){try{data=JSON.parse(body.toString())}catch{data=body.toString()}}
 resolve({status:res.statusCode,headers:res.headers,data,url:options.url});});});req.on('error',reject);req.on('timeout',()=>req.destroy(Error('Request timeout')));if(options.data!=null)req.write(typeof options.data==='string'?options.data:JSON.stringify(options.data));req.end();});
}
await page.exposeBinding('__acceptHTTP',async(source,options)=>{if(source.frame!==page.mainFrame())throw Error('Main frame only');return request(options)});
await page.addInitScript(()=>{
 if(self!==top)return;
 const names={CapacitorHttp:['request'],EbookNative:['ready','setBars','setImmersive','consumeFile','addListener','removeListener','haptic','prepareHaptics','getAccessibility','setBackground'],App:['addListener','removeListener','getState']};
 window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'android',platform:'android',PluginHeaders:Object.entries(names).map(([name,methods])=>({name,methods:methods.map(name=>({name,rtype:name==='addListener'?'callback':'promise'}))})),nativePromise:async(plugin,method,options)=>plugin==='CapacitorHttp'?window.__acceptHTTP(options):{},nativeCallback:()=> 'test-listener'};
});
const report={started:new Date().toISOString(),transport:'production UI; native HTTP emulated by Node',check:'only .cover.is-real counts, generated jackets excluded'};
try{
 const t=Date.now();await page.goto('http://127.0.0.1:5194/#/explore?kind=comic');
 await page.waitForFunction(()=>document.querySelector('.route.is-active .mw-tile'),null,{timeout:60000});report.firstCardsMs=Date.now()-t;
 await page.waitForFunction(()=>[...document.querySelectorAll('.route.is-active .mw-tile .cover.is-real img')].some(i=>i.complete&&i.naturalWidth>60),null,{timeout:60000});report.firstRealWallCoverMs=Date.now()-t;
 await page.waitForFunction(()=>document.querySelector('.route.is-active .discshelf'),null,{timeout:90000});
 await page.locator('.route.is-active .discshelf').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>[...document.querySelectorAll('.route.is-active .disc-face .cover.is-real img')].filter(i=>i.complete&&i.naturalWidth>60).length>=2,null,{timeout:60000});report.twoRealDiscCoversMs=Date.now()-t;
 report.coverCounts=await page.evaluate(()=>({wallReal:document.querySelectorAll('.route.is-active .mw-tile .cover.is-real').length,wallAll:document.querySelectorAll('.route.is-active .mw-tile').length,discsReal:document.querySelectorAll('.route.is-active .disc-face .cover.is-real').length}));
 await page.screenshot({path:'release/verification/0.4.2/live-comic-discs.png'});
 // Persisted catalog and cover bytes should be usable on a full app restart.
 const again=Date.now();await page.reload();await page.waitForFunction(()=>[...document.querySelectorAll('.route.is-active .mw-tile .cover.is-real img')].some(i=>i.complete&&i.naturalWidth>60),null,{timeout:30000});report.restartRealWallCoverMs=Date.now()-again;
 console.log(JSON.stringify(report,null,2));
} catch(error){report.error=String(error.stack||error);throw error}
finally{const {writeFileSync}=await import('node:fs');writeFileSync('release/verification/0.4.2/live-comic-covers.json',JSON.stringify(report,null,2));await browser.close()}
