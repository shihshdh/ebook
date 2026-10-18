import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { Worker } from 'node:worker_threads';
import { build } from '../src/plugins/mojimoon/build.js';
import { parseCSV } from '../src/plugins/mojimoon/csv.js';
import { repoFileUrls, releaseAssetUrls } from '../src/lib/github-urls.js';
const raw = {
  catalog: JSON.stringify({ pages: { 1: [{ aid: 1, title: '测试书', author: '作者', status: '完结 动画', update: '2026-10-18', tags: '校园 奇幻', description: '简介' }, { aid: 2, title: '下架书' }] } }),
  csv: '\ufeffnovel_link,main,author,alt,download_url,update,dl_label,dl_remark,volume,dl_pwd\nhttps://www.wenku8.net/book/1.htm,测试书,作者,别名,https://raw.githubusercontent.com/a/b/main/目录/书 名.epub,2026-10-17,,,,\nhttps://www.wenku8.net/book/3.htm,台版书,作者,,,2026-10-18,abc,台版,第一卷,1234',
  index: JSON.stringify({ 1: { title: '测试书', repo: 'mojimoon/wenku8-epub', tag: 'release', volumes: [{ file: '第一卷.epub', title: '第一卷', images: 4, chapters: 2 }] }, 2: { title: '下架书', blocked: 'copyright' } }),
};
const fn = readFileSync(new URL('./fixtures/catalog-before-worker.txt',import.meta.url),'utf8').replace('export function build','function build');
for (const native of [false,true]) test(`catalog matches pre-worker implementation, native=${native}`, () => {
  const expected = vm.runInNewContext(fn+'\nbuild(raw)', { id:'mojimoon', OWNER:'mojimoon', REPO:'wenku8', LANZOU:'https://wenku8.lanzov.com/', parseCSV, repoFileUrls, releaseAssetUrls:(...args)=>releaseAssetUrls(...args,{native}), raw });
  assert.equal(JSON.stringify(build(raw,{native})),JSON.stringify(expected));
});
async function runWorker(raw,native) {
  const target = new URL('../src/plugins/mojimoon/build.worker.js',import.meta.url).href;
  const script = `import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:d=>parentPort.postMessage(d)};await import(${JSON.stringify(target)});parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});`;
  const worker = new Worker(new URL('data:text/javascript,'+encodeURIComponent(script)));
  try { return await new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',data=>data.ready?worker.postMessage({raw,native}):resolve(data));}); }
  finally {await worker.terminate();}
}
test('actual worker returns the same full catalog on web and native paths', async () => {
  for(const native of [false,true]) assert.deepEqual((await runWorker(raw,native)).books,build(raw,{native}));
});
test('malformed catalog reports an error rather than hanging',async()=>{
  assert.match((await runWorker({...raw,catalog:'broken'},false)).error,/JSON|Unexpected/);
});
