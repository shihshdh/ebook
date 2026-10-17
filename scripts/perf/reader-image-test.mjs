// Focused checks for the reader-only Android transport; run with android / ios.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
const os = process.argv[2] || 'android';
globalThis.window = { Capacitor: { isNativePlatform: () => true, getPlatform: () => os } };
registerHooks({resolve(s,c,next){if(s==='@capacitor/core')return {url:'data:text/javascript,export const CapacitorHttp={request:(r)=>globalThis.__request(r)}',shortCircuit:true};return next(s,c)}});
const { fetchImage } = await import('../../src/comic/images.js');
const bytes = Buffer.alloc(180003, 73);Buffer.from('89504e470d0a1a0a00000000','hex').copy(bytes);
let request, calls=0, transform=false;
globalThis.__request = async r => {request=r;calls++;return {status:200,headers:{'Content-Type':'image/png'},data:bytes.toString('base64')}};
const box={allowPrivate:false,inflight:0,call:async(fn,args)=>{if(fn==='imageResponse'){transform=true;return args[1]}return {url:'https://example.com/page',headers:{Referer:'https://example.com/','Accept-Encoding':'gzip'},onResponse:'hook'}},http:async()=>{calls++;return {status:200,body:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}}};
const blob=await fetchImage(box,'page');assert.equal(blob.type,'image/png');assert.deepEqual(Buffer.from(await blob.arrayBuffer()),bytes);assert.ok(transform);assert.equal(box.inflight,0);
if(os==='android'){
 assert.deepEqual(Buffer.from(await (await fetchImage(box,'page',{front:true})).arrayBuffer()),bytes);
 assert.equal(request.headers.Referer,'https://example.com/');assert.equal(request.headers['Accept-Encoding'],undefined);
 const ac=new AbortController();ac.abort();const before=calls;await assert.rejects(fetchImage(box,'page',{signal:ac.signal}),{name:'AbortError'});assert.equal(calls,before);
 globalThis.__request=async()=>({status:403,headers:{'CF-Mitigated':'challenge'},data:''});await assert.rejects(fetchImage(box,'page'),/403/);assert.equal(box.challenged,'example.com');assert.equal(box.inflight,0);
 globalThis.__request=async()=>({status:200,headers:{'Content-Type':'application/json'},data:{error:'denied'}});await assert.rejects(fetchImage(box,'page'),/不是图片/);
 box.call=async()=>({url:'http://127.0.0.1/private'});await assert.rejects(fetchImage(box,'page'),/局域网/);
 box.allowPrivate=true;globalThis.__request=async()=>({status:200,headers:{},data:new Uint8Array(bytes)});assert.equal((await fetchImage(box,'page')).size,bytes.length);
 // Abort while a large conversion is yielding; never deliver a partial image.
 globalThis.__request=async()=>({status:200,headers:{},data:bytes.toString('base64')});const cancel=new AbortController();setTimeout(()=>cancel.abort(),1);await assert.rejects(fetchImage(box,'page',{signal:cancel.signal}),{name:'AbortError'});assert.equal(box.inflight,0);
}
console.log(`${os}: image bytes, source callback and transport checks passed`);
