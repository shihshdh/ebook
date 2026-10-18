import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
const target=new URL('../src/comic/image-bytes.worker.js',import.meta.url).href;
const script=`import{parentPort}from'node:worker_threads';globalThis.self={postMessage:(d,t)=>parentPort.postMessage(d,t)};await import(${JSON.stringify(target)});parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});`;
async function decode(data){const w=new Worker(new URL('data:text/javascript,'+encodeURIComponent(script)));try{return await new Promise((r,j)=>{w.on('error',j);w.on('message',v=>v.ready?w.postMessage({id:1,data}):r(v))})}finally{await w.terminate()}}
test('image worker decodes large binary, padding, whitespace and data URLs without corruption',async()=>{
 for(const size of [1,2,65535,65536,960066]){const bytes=Buffer.alloc(size);for(let i=0;i<size;i++)bytes[i]=i%251;const b64='data:image/jpeg;base64,\n'+bytes.toString('base64')+'\n';const result=await decode(b64);assert.deepEqual(Buffer.from(result.bytes),bytes)}
});
test('invalid binary returns a handled error',async()=>{assert.ok((await decode('not!base64')).error)});
