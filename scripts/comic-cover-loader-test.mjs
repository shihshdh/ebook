import assert from 'node:assert/strict';
import {test} from 'node:test';
import {coverLoader,firstCover} from '../src/comic/cover-loader.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('visible disc bypasses queued background artwork and a blocked host',async()=>{
 const jobs=[],gates=new Map();
 const get=coverLoader({max:3,perHost:1,timeout:1000,load:async()=>null,save:()=>{},fetch:async(s,u)=>{jobs.push(u);const g=deferred();gates.set(u,g);return g.promise;}});
 const bg=get('s','https://slow/1',()=>false);const queued=get('s','https://slow/2',()=>false);await pause(5);
 const disc=get('x','https://fast/disc',()=>true);await pause(5);
 assert.deepEqual(jobs,['https://slow/1','https://fast/disc']);gates.get('https://fast/disc').resolve(new Blob(['disc']));await disc;
 gates.get('https://slow/1').resolve(new Blob(['bg']));await bg;await pause(5);gates.get('https://slow/2').resolve(new Blob(['queued']));await queued;
});
test('cache hit bypasses saturated queue; duplicate requests share one download',async()=>{
 let downloads=0;const gate=deferred();const get=coverLoader({max:1,load:async k=>k.includes('saved')?new Blob(['cached']):null,save:()=>{},fetch:()=>{downloads++;return gate.promise;}});
 const first=get('a','https://site/1');const second=get('a','https://site/1');assert.equal(first,second);await pause(5);
 assert.equal(await (await get('b','https://site/saved')).text(),'cached');gate.resolve(new Blob(['fresh']));await first;assert.equal(downloads,1);
});
test('timed-out source releases slot and retry works',async()=>{
 let count=0;const get=coverLoader({timeout:25,failedFor:10,load:async()=>null,save:()=>{},fetch:async()=>++count===1?new Promise(()=>{}):new Blob(['ok'])});
 await assert.rejects(get('a','https://site/1'),/超时/);await pause(15);assert.equal(await (await get('a','https://site/1')).text(),'ok');
});
test('LRU eviction does not revoke an image URL still held by a mounted disc',async()=>{
 const get=coverLoader({keep:1,load:async()=>null,save:()=>{},fetch:async(s,u)=>new Blob([u])});const url=URL.createObjectURL(await get('a','https://site/1'));
 await get('b','https://site/2');assert.equal(await (await fetch(url)).text(),'https://site/1');URL.revokeObjectURL(url);
});
test('fast alternate cover wins without waiting for slow primary',async()=>{
 const t=Date.now();const out=await firstCover(['slow','fast'],async c=>{if(c==='slow')return new Promise(()=>{});return new Blob(['fast']);},{stagger:15});assert.equal(await out.text(),'fast');assert.ok(Date.now()-t<100);
});
test('alternate candidates remain bounded and all failures settle',async()=>{
 let running=0,peak=0;await assert.rejects(firstCover([1,2,3,4],async()=>{running++;peak=Math.max(peak,running);await pause(15);running--;throw Error('bad');},{stagger:2}));assert.ok(peak<=2);
});
test('scrolling a queued cover into view wakes free slots immediately',async()=>{
 const started=[],gates=new Map();let near=false;const get=coverLoader({max:3,load:async()=>null,save:()=>{},fetch:async(s,u)=>{started.push(u);const gate=deferred();gates.set(u,gate);return gate.promise;}});
 const bg=get('a','https://slow/1',()=>false);const front=get('b','https://fast/2',()=>near);await pause(5);assert.equal(started.length,1);near=true;get.refresh();await pause(5);assert.equal(started.length,2);for(const g of gates.values())g.resolve(new Blob(['ok']));await Promise.all([bg,front]);
});
