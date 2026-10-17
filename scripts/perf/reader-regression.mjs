// Android UI regression against the APK left by comic-reader-android.mjs.
import {createServer} from 'node:http';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {connect,sleep} from './cdp.mjs';
const jpg=await sharp({create:{width:1200,height:1700,channels:3,background:'#c9b58d'}}).jpeg().toBuffer();
const server=createServer((req,res)=>{res.writeHead(200,{'Content-Type':'image/jpeg'});res.end(jpg)});await new Promise(r=>server.listen(9461,'127.0.0.1',r));
const targets=await(await fetch('http://127.0.0.1:9333/json')).json();const p=await connect(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
p.eval=async expression=>{const r=await p.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
await p.send('Page.enable');await p.send('Runtime.enable');
const checks=[];
const originalUA=await p.eval('navigator.userAgent');
const injected=[];
injected.push((await p.send('Page.addScriptToEvaluateOnNewDocument',{source: `window.__urls=new Set();const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=b=>{const u=create(b);__urls.add(u);return u};URL.revokeObjectURL=u=>{__urls.delete(u);revoke(u)};`})).identifier);
const until=async(expr)=>{for(let i=0;i<150;i++){if(await p.eval(expr))return;await sleep(100)}throw Error('timeout '+expr)};
const click=async(sel)=>{assert.ok(await p.eval(`(()=>{const b=document.querySelector(${JSON.stringify(sel)});b?.click();return !!b})()`),sel);await sleep(150)};
const swipe=async()=>{await p.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:320,y:400}]});for(let i=1;i<=8;i++){await p.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:320-i*30,y:400}]});await sleep(20)}await p.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(700)};
try{
await p.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true});
await p.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
await p.send('Emulation.setCPUThrottlingRate',{rate:1});
await p.eval(`localStorage.setItem('librarium.comic.reader',JSON.stringify({mode:'page'}));location.hash='#/read/comic/perf%3Areader/book/0';location.reload();true`);
await until(`!!document.querySelector('.cr-stage img')?.naturalWidth`);
const before=await p.eval(`document.querySelector('.rd-ambient-bottom').innerText`);await swipe();const after=await p.eval(`document.querySelector('.rd-ambient-bottom').innerText`);assert.notEqual(after,before);checks.push('漫画触屏横划翻页');
for(const tab of ['toc','progress','marks','mode','theme']){assert.ok(await p.eval(`(()=>{const labels={toc:'目录',progress:'进度',marks:'书签',mode:'阅读方式',theme:'纸张'};const b=[...document.querySelectorAll('.rd-dock [data-seg]')].find(b=>b.textContent.trim()===labels[${JSON.stringify(tab)}]);b?.click();return !!b})()`));await until(`!!document.querySelector('.panel-${tab}')`);await click('[aria-label="关闭面板"]');checks.push('漫画面板 '+tab)}
const root=await p.send('Runtime.evaluate',{expression:"document.getElementById('root')"});
const listeners=(await p.send('DOMDebugger.getEventListeners',{objectId:root.result.objectId})).listeners.filter(l=>['wheel','touchstart','touchmove'].includes(l.type));
assert.ok(listeners.length);assert.ok(listeners.every(l=>l.passive));checks.push('漫画滚轮/触摸委托监听均 passive');
const marked=await p.eval(`document.querySelector('.rd-ribbon').getAttribute('aria-pressed')`);await click('.rd-ribbon');assert.notEqual(await p.eval(`document.querySelector('.rd-ribbon').getAttribute('aria-pressed')`),marked);checks.push('漫画书签');
const comicURLs=await p.eval('[...window.__urls]');assert.ok(comicURLs.length>0);
const novelText=['第一章 旅途',...Array(250).fill('这是一段用于翻页测试的小说正文。'),'第二章 归来',...Array(150).fill('远处的灯火亮了起来。')].join(String.fromCharCode(10));
// A local TXT opens the real EPUB rendering engine, rather than a fake DOM.
await p.eval(`(async()=>{const q=indexedDB.open('librarium',1),d=await new Promise(r=>q.onsuccess=()=>r(q.result));await new Promise(r=>{const t=d.transaction(['shelf','blob'],'readwrite');t.objectStore('shelf').put({id:'local:perf-novel',title:'小说回归',ext:'txt',source:'local',addedAt:Date.now()},'local:perf-novel');t.objectStore('blob').put(new Blob([${JSON.stringify(novelText)}],{type:'text/plain'}),'local:perf-novel');t.oncomplete=r});d.close();location.hash='#/read/local%3Aperf-novel';return true})()`);
await until(`!!document.querySelector('.epub-container iframe')?.contentDocument?.body?.textContent`);await until(`document.querySelector('.rd-ambient-bottom')?.innerText.includes(' / ')`);await sleep(500);
const novelBefore=await p.eval(`document.querySelector('.rd-ambient-bottom')?.innerText`);await swipe();const novelAfter=await p.eval(`document.querySelector('.rd-ambient-bottom')?.innerText`);assert.notEqual(novelAfter,novelBefore);checks.push('小说真实 EPUB 触屏翻页');assert.ok(await p.eval(`${JSON.stringify(comicURLs)}.every(u=>!window.__urls.has(u))`));checks.push('退出漫画后原有 Blob URL 全部释放');
await p.eval(`document.querySelector('.rd-menu-trigger')?.click();true`);
for(const title of ['目录','进度','笔记','字体','纸张']){assert.ok(await p.eval(`(()=>{const b=[...document.querySelectorAll('.rd-dock [data-seg]')].find(b=>b.textContent.trim()===${JSON.stringify(title)});b?.click();return !!b})()`));await until(`!!document.querySelector('.rd-panel')`);await click('.rd-scrim');checks.push('小说面板 '+title)}
// Exercise WKWebView policy branches under iPhone UA and a rejected decode().
await p.send('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'});
injected.push((await p.send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__decodeAttempts=0;HTMLImageElement.prototype.decode=function(){__decodeAttempts++;return Promise.reject(new Error('decode fixture'))}`})).identifier);
await p.eval(`localStorage.setItem('librarium.comic.reader',JSON.stringify({mode:'scroll'}));location.hash='#/read/comic/perf%3Areader/book/0';location.reload();true`);await until(`!!document.querySelector('.cr-scroll img')?.naturalWidth`);await until(`window.__decodeAttempts>0 && document.querySelectorAll('.cr-page img').length>1`);checks.push('iPhone UA + decode 拒绝仍出图（Android 模拟分支，非 WKWebView 真机）');for(let i=0;i<30;i++){await p.eval(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'}));true`);await sleep(80)}await sleep(800);assert.ok(await p.eval('window.__urls.size<=5'));checks.push('iOS 驻留窗口上限 5 张（模拟分支）');
writeFileSync('scripts/perf/results/regression.json',JSON.stringify({checks},null,2));console.log(checks.join('\n'));
}finally{for(const identifier of injected)await p.send('Page.removeScriptToEvaluateOnNewDocument',{identifier}).catch(()=>{});await p.send('Emulation.setUserAgentOverride',{userAgent:originalUA}).catch(()=>{});p.close();server.close()}
