import {test} from 'node:test';
import assert from 'node:assert/strict';
import {firstPageCache} from '../src/comic/first-page-cache.js';
test('first image preloads once and is consumed once without shared blob URLs',async()=>{
 const cache=firstPageCache();let n=0;const b=new Blob(['image']);
 cache.warm('a',()=>{n++;return b});cache.warm('a',()=>{throw Error('duplicate')});
 assert.equal(await cache.take('a'),b);assert.equal(cache.take('a'),null);assert.equal(n,1);
});
test('pending and ready first pages are bounded and expire',async()=>{
 let time=0,n=0;const cache=firstPageCache({now:()=>time,ttl:10,limit:2,maxBytes:2});
 cache.warm('a',async()=>new Blob(['a']));cache.warm('b',async()=>new Blob(['b']));cache.warm('c',()=>{n++;return new Blob(['c'])});
 assert.equal(cache.take('c'),null);time=10;assert.equal(cache.take('a'),null);
 cache.warm('large',async()=>new Blob(['large']));await new Promise(r=>setTimeout(r,0));assert.equal(cache.take('large'),null);assert.equal(n,0);
});
test('failed preload is evicted and abort cancels consumer promptly',async()=>{
 const cache=firstPageCache();cache.warm('bad',()=>Promise.reject(Error('offline')));await new Promise(r=>setTimeout(r,0));assert.equal(cache.take('bad'),null);
 let complete;cache.warm('wait',()=>new Promise(r=>complete=r));const ctl=new AbortController();const p=cache.take('wait',ctl.signal);ctl.abort();await assert.rejects(p,{name:'AbortError'});complete(new Blob(['ok']));
});
