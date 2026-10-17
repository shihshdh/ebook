// Android-only fixed-input reader benchmark. Never launches a desktop client.
// node scripts/perf/comic-reader-android.mjs <label> [rounds=3]
// Prerequisite: EBOOK_API34 running, debug APK built. Native HTTP uses adb reverse.
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
import bundled from '../../src/comic/default-sources.js';
import { connect, sleep } from './cdp.mjs';
const [label = 'baseline', rounds = '3'] = process.argv.slice(2);
const adb = `${process.env.LOCALAPPDATA}/Android/Sdk/platform-tools/adb.exe`;
const run = (...args) => execFileSync(adb, ['-s', 'emulator-5554', ...args], {encoding:'utf8'}).trim();
run('install','-r','android/app/build/outputs/apk/debug/app-debug.apk');
run('reverse','tcp:9461','tcp:9461');
run('shell','am','force-stop','app.librarium.reader');
run('shell','am','start','-n','app.librarium.reader/.MainActivity');
await sleep(2500);
const pid = run('shell','pidof','app.librarium.reader');
run('forward','tcp:9333',`localabstract:webview_devtools_remote_${pid}`);
let seed=42; const pixels=Buffer.alloc(150*213*3);
for(let i=0;i<pixels.length;i++){ seed=(Math.imul(seed,1664525)+1013904223)>>>0; pixels[i]=(seed>>>24); }
const jpg=await sharp(pixels,{raw:{width:150,height:213,channels:3}}).resize(2400,3400).jpeg({quality:70}).toBuffer();
let requests=[];
const server=createServer((req,res)=>{ requests.push({url:req.url,at:Date.now()}); setTimeout(()=>{res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'no-store'});res.end(jpg);},80); });
await new Promise(r=>server.listen(9461,'127.0.0.1',r));
const targets=await(await fetch('http://127.0.0.1:9333/json')).json();
const p=await connect(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
p.eval=async expression=>{const r=await p.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const until=async(expr,ms=30000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await p.eval(expr))return;await sleep(40);}throw Error('Timed out: '+expr+' '+await p.eval('document.body.innerText.slice(-1500)'));};
const sourceCode=`class PerfSource extends ComicSource { name='Reader performance fixture';key='komga';version='1'; comic={loadInfo:async()=>new ComicDetails({title:'性能固定图',cover:'',chapters:new Map([['1','第一话'],['2','第二话']])}),loadEp:async(c,e)=>{await new Promise(r=>setTimeout(r,160));return {images:Array.from({length:40},(_,i)=>'http://127.0.0.1:9461/'+e+'/'+i+'.jpg')}}}; }`;
const output={label,at:new Date().toISOString(),input:{width:2400,height:3400,bytes:jpg.length,latency:80,listLatency:160,pages:40,cpu:4,viewport:'390x844@3'},runs:[]};
try {
await p.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true});
await p.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
await p.send('Emulation.setCPUThrottlingRate',{rate:4});
await p.eval(`(async()=>{const q=indexedDB.open('librarium',1);const db=await new Promise((r,j)=>{q.onupgradeneeded=()=>{for(const s of ['shelf','blob','bookmarks','kv'])if(!q.result.objectStoreNames.contains(s))q.result.createObjectStore(s)};q.onsuccess=()=>r(q.result);q.onerror=j});await new Promise((r,j)=>{const t=db.transaction('kv','readwrite'),s=t.objectStore('kv');s.put([{id:'perf:reader',repo:'perf',key:'komga',name:'性能固定源',className:'PerfSource',code:${JSON.stringify(sourceCode)},enabled:true}],'comic:sources');s.put({code:${JSON.stringify(bundled.runtime)}},'comic:runtime:perf');s.put('perf','comic:defaults');t.oncomplete=r;t.onerror=j});db.close();return true})()`);
for(const mode of ['scroll','page'])for(let round=1;round<=+rounds;round++){
  await p.eval(`localStorage.setItem('librarium.comic.reader',JSON.stringify({mode:${JSON.stringify(mode)}}));location.hash='#/search';location.reload();true`);
  await sleep(1800);
  await p.eval(`(async()=>{const q=indexedDB.open('librarium',1);const d=await new Promise(r=>q.onsuccess=()=>r(q.result));await new Promise(r=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').delete('comic:progress');t.oncomplete=r});d.close();return true})()`);
  await p.eval(`window.__frames=[];window.__long=[];window.__record=false;window.__urls=new Set();const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=b=>{const u=create(b);__urls.add(u);return u};URL.revokeObjectURL=u=>{__urls.delete(u);revoke(u)};new PerformanceObserver(l=>{if(__record)__long.push(...l.getEntries().map(e=>e.duration))}).observe({type:'longtask'});function frame(t){if(__record)__frames.push(t);requestAnimationFrame(frame)}requestAnimationFrame(frame);true`);
  const begin=Date.now();requests=[];
  await p.eval(`location.hash='#/read/comic/perf%3Areader/book/0';true`);
  await until(`!!document.querySelector('.cr-scroll img')?.naturalWidth`);
  const first=Date.now()-begin, firstRequestOffset=requests[0]?.at-begin;
  await sleep(500);
  const before=await p.send('Runtime.getHeapUsage');
  await p.send('Profiler.enable');await p.send('Profiler.start');
  await p.eval('__record=true;true');
  const checkpoints=[];
  for(let i=0;i<30;i++){
    if(mode==='page'){
      await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
      await p.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
      await sleep(360);
    }else{
      // A real compositor touch scroll, followed by the next page boundary so every run covers 30 distinct pages.
      await p.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:650}]});
      for(let k=1;k<=8;k++){await p.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195,y:650-k*45}]});await sleep(16);}
      await p.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await p.eval(`document.querySelector('[data-page="${i+1}"]')?.scrollIntoView({block:'start'});true`);
      await sleep(200);
    }
    if([9,19,29].includes(i))checkpoints.push({page:i+2,...await p.send('Runtime.getHeapUsage'),...await p.send('Memory.getDOMCounters'),urls:await p.eval('__urls.size')});
  }
  const raw=await p.eval('__record=false;({frames:__frames,long:__long})');
  const {profile}=await p.send('Profiler.stop');
  const sums=new Map(),byId=new Map(profile.nodes.map(n=>[n.id,n]));
  profile.samples.forEach((id,i)=>{const c=byId.get(id).callFrame,k=`${c.functionName||'(anonymous)'} ${c.url.split('/').pop()}:${c.lineNumber+1}`;sums.set(k,(sums.get(k)||0)+(profile.timeDeltas[i]||0)/1000)});
  const gaps=raw.frames.slice(1).map((t,i)=>t-raw.frames[i]).sort((a,b)=>a-b),q=x=>gaps[Math.floor(gaps.length*x)]||0;
  const after=await p.send('Runtime.getHeapUsage');
  const switchAt=Date.now();await p.eval(`document.dispatchEvent(new Event('noop'));window.dispatchEvent(new KeyboardEvent('keydown',{key:']'}));true`);
  await until(`location.hash.endsWith('/1')&&!!document.querySelector('.cr-scroll img')?.naturalWidth`);
  const row={mode,round,first,firstRequestOffset,next:Date.now()-switchAt,frames:gaps.length,p95:q(.95),p99:q(.99),max:gaps.at(-1),over33:gaps.filter(g=>g>33.4).length,longMax:Math.max(0,...raw.long),longBlocking:raw.long.reduce((s,d)=>s+Math.max(0,d-50),0),heapBefore:before.usedSize,heapAfter:after.usedSize,checkpoints,cpu:[...sums].sort((a,b)=>b[1]-a[1]).slice(0,16),requests:requests.length};
  output.runs.push(row);console.log(JSON.stringify(row));
  mkdirSync('scripts/perf/results',{recursive:true});writeFileSync(`scripts/perf/results/${label}.json`,JSON.stringify(output,null,2));
}
} finally {await p.send('Emulation.setCPUThrottlingRate',{rate:1}).catch(()=>{});p.close();server.close();}
