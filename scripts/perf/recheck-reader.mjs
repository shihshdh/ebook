import {readFileSync,writeFileSync,openSync,closeSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
// Default ref is the untouched reader branch before this performance work.
const baselineRef=process.argv[2] || '776eb27';
const files=['src/pages/ComicReader.jsx','src/comic/images.js','src/comic/library.js'];
const final=new Map(files.map(f=>[f,readFileSync(f)]));
for(const [f,bytes] of final)writeFileSync('scripts/perf/.candidate-'+f.split('/').at(-1),bytes);
const env={...process.env,JAVA_HOME:'C:/Program Files/Android/Android Studio/jbr',ANDROID_HOME:process.env.LOCALAPPDATA+'/Android/Sdk'};
const build=label=>{const fd=openSync(`scripts/perf/results/build-${label}.log`,'w');try{execFileSync('cmd.exe',['/d','/s','/c','npm run android:build'],{env,stdio:['ignore',fd,fd]})}finally{closeSync(fd)}};
const measure=label=>execFileSync(process.execPath,['scripts/perf/comic-reader-android.mjs',label,'3'],{env,stdio:'inherit'});
const hashes={};
try {
 for(const f of files){const b=execFileSync('git',['show',baselineRef+':'+f]);writeFileSync(f,b);hashes[f]={baseline:createHash('sha256').update(b).digest('hex'),final:createHash('sha256').update(final.get(f)).digest('hex')}}
 build('baseline-confirm');measure('baseline-confirm');
}finally{for(const [f,b] of final)writeFileSync(f,b)}
build('final');measure('final');
writeFileSync('scripts/perf/results/source-hashes.json',JSON.stringify(hashes,null,2));
