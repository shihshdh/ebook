import assert from 'node:assert/strict';import {test} from 'node:test';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function setup({cached=false,slow=false}={}){
 const writes=[];let release;const gate=new Promise(r=>release=r);const sources=[{id:'fast',key:'fast',name:'fast',version:'1',enabled:true},{id:'slow',key:'slow',name:'slow',version:'1',enabled:true}];
 const context=vm.createContext({console,URL,Date,Map,Set,Promise,setTimeout,clearTimeout,localStorage:{getItem:()=>null,setItem:()=>{}},window:{addEventListener:()=>{}}});
 const stub={react:{useState:()=>[0,()=>{}],useEffect:()=>{}},'./sources.js':{listComicSources:async()=>sources,withSource:async(id,fn)=>fn({meta:{explore:[{type:'multiPageComicList'}],search:false,searchOptions:[]},call:async(type,args)=>{if(id==='slow'&&slow)await gate;return {parts:[{comics:[{id:`${id}-${args[1]}`,title:`${id}-${args[1]}`,cover:`https://${id}/cover`}]}],maxPage:3};}})},'./book.js':{comicBook:({sourceId,sourceName,comic})=>({id:`${sourceId}:${comic.id}`,source:'comic',title:comic.title,comics:[{sourceId,cover:comic.cover}],poolSources:[sourceName]})},'./famous.js':{FAMOUS:[],TOP_RATED:[]},'./famous-seed.js':{default:{at:Date.now(),hits:{}}},'./translate.js':{localizeComics:async x=>x},'./library.js':{chaptersOf:()=>[],comicDetails:async()=>({}),coversBlocked:()=>false},'../lib/calm.js':{calm:async()=>{}},'../lib/native.js':{mobileUI:true},'../lib/pool.js':{normTitle:s=>s},'../lib/idb.js':{idbGet:async()=>cached?{at:Date.now(),signature:'fast:1|slow:1',books:[{id:'cached',title:'cached',comics:[],poolSources:[]}]}:null,idbSet:async(k,v)=>writes.push(v)}};
 const module=new vm.SourceTextModule(readFileSync(new URL('../src/comic/catalog.js',import.meta.url),'utf8'),{context});
 await module.link(async spec=>{const values=stub[spec];assert(values,`unexpected ${spec}`);return new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context});});await module.evaluate();module.namespace.setComicPaneShown(true);return {entry:module.namespace.useComicList('all'),release,writes};
}
test('cached book list appears before slow sources; pagination works before final source',async()=>{
 const {entry,release}=await setup({cached:true,slow:true});await pause(20);assert(entry.books.some(b=>b.id==='cached'));assert(entry.books.some(b=>b.title==='fast-1'));assert.equal(entry.done,false);await entry.more();assert(entry.books.some(b=>b.title==='fast-2'));release();await pause(20);assert.equal(entry.done,true);assert(!entry.books.some(b=>b.id==='cached'));
});
test('pagination publishes a fast source without waiting for a slower one',async()=>{
 const {entry}=await setup();await pause(20);assert.equal(entry.done,true);await entry.more();assert(entry.books.some(b=>b.title==='fast-2'));assert(entry.books.some(b=>b.title==='slow-2'));
});
