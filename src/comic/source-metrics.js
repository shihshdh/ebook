// Learn list-request latency, without storing URLs, titles or account data.
const KEY='librarium.comic.source-speed:v1';
let stats={};try{stats=JSON.parse(globalThis.localStorage?.getItem(KEY)||'{}')||{};}catch{}
let timer;
const key=s=>`${s.id}:${s.version||''}`;
export function sourcePriority(source, now=Date.now()) {
  const entry=stats[key(source)];
  if(entry && now-entry.at<6*3600e3) return entry.ms+(entry.failed && now-entry.at<5*60000?30000:0);
  const fast=['Komiic','ykmh','ccc','ManHuaGui','copy_manga'];const index=fast.indexOf(source.key);
  return index<0?2600:700+index*300;
}
export async function measureSource(source, job) {
  const started=Date.now();let ok=false;
  try{const value=await job();ok=true;return value;}
  finally{
    const name=key(source),ms=Math.max(1,Date.now()-started),old=stats[name];
    stats[name]={ms:ok&&old&&!old.failed?Math.round(old.ms*.5+ms*.5):ms,at:Date.now(),failed:!ok};
    if(typeof window!=='undefined'){clearTimeout(timer);timer=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(stats));}catch{}},700);}
  }
}
