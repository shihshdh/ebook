import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readerBuffer } from '../src/comic/reader-buffer.js';
const tick = () => new Promise(r => setTimeout(r, 0));
function setup(options = {}) {
  const tasks = [], disposed = [], snapshots = [];
  const pool = readerBuffer({ length: 100, load: (i, {signal,front}) => new Promise((resolve,reject) => {
    tasks.push({i,signal,front,resolve,reject}); signal.addEventListener('abort', () => reject(new DOMException('cancelled','AbortError')), {once:true});
  }), change: pages => snapshots.push(pages), dispose: p => disposed.push(p), ...options });
  return {pool,tasks,disposed,snapshots};
}
test('current and two forward pages start together, with a four-page runway', async () => {
 const {pool,tasks,snapshots}=setup();pool.window(0);await tick();assert.deepEqual(tasks.map(t=>t.i),[0,1,2]);assert(tasks[0].front);
 for(let n=0;n<5;n++){const t=tasks[n];t.resolve({url:'page'+t.i});await tick();}
 assert.deepEqual(Object.keys(snapshots.at(-1)),['0','1','2','3','4']);pool.destroy();
});
test('jump cancels obsolete jobs and immediately starts the visible page',async()=>{
 const {pool,tasks}=setup();pool.window(0);await tick();pool.window(40);await tick();assert(tasks.slice(0,3).every(t=>t.signal.aborted));assert.deepEqual(tasks.slice(3,6).map(t=>t.i),[40,41,42]);pool.destroy();
});
test('new visible page preempts speculative work even inside the retained window',async()=>{
 const {pool,tasks}=setup();pool.window(0);await tick();pool.window(3);await tick();assert(tasks.some(t=>t.i===3&&t.front));assert(tasks.filter(t=>!t.signal.aborted).length<=3);pool.destroy();
});
test('previous painted page stays alive while far-away page waits, then is freed',async()=>{
 const {pool,tasks,disposed,snapshots}=setup();pool.window(0);await tick();tasks[0].resolve({url:'old'});await tick();pool.window(50,{pin:[0]});await tick();assert.equal(disposed.filter(p=>p.url==='old').length,0);assert.equal(snapshots.at(-1)[0].url,'old');pool.window(50,{pin:[50]});assert.equal(disposed.filter(p=>p.url==='old').length,1);pool.destroy();
});
test('reverse turns prioritize previous pages, failures retry once on request',async()=>{
 const {pool,tasks,snapshots}=setup();pool.window(10,{reverse:true});await tick();assert.deepEqual(tasks.map(t=>t.i),[10,9,8]);tasks[0].reject(Error('offline'));await tick();assert.equal(snapshots.at(-1)[10].error,'offline');pool.retry(10);await tick();assert.equal(tasks.filter(t=>t.i===10).length,2);pool.destroy();
});
test('late success after disposal releases its URL without changing the new chapter',async()=>{
 let complete;const snapshots=[],disposed=[];const pool=readerBuffer({length:1,load:()=>new Promise(r=>complete=r),change:p=>snapshots.push(p),dispose:p=>disposed.push(p.url)});pool.window(0);await tick();pool.destroy();complete({url:'late'});await tick();assert.deepEqual(disposed,['late']);assert.equal(snapshots.length,0);
});

test('chapter handoff transfers URL ownership without revoking the painted image',async()=>{
 const {pool,tasks,disposed}=setup();pool.window(0);await tick();tasks[0].resolve({url:'last-page'});await tick();const page=pool.detach(0);pool.destroy();assert.equal(page.url,'last-page');assert(!disposed.some(p=>p.url==='last-page'));
});
