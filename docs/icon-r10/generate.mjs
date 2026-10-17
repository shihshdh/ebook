import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const dir=new URL('./',import.meta.url); const root=new URL('../../',dir);
const out=(p,s)=>writeFile(new URL(p,root),s);
await mkdir(dir,{recursive:true});
const concepts=[
 {id:'a',name:'01 / FOLIO',bg:'#246B60',fg:'#FFF8EB',shape:'<path d="M212 274Q212 250 236 254L452 298Q488 306 488 342V758L236 706Q212 702 212 678Z M536 342Q536 306 572 298L788 254Q812 250 812 274V678Q812 702 788 706L536 758Z"/>'},
 {id:'b',name:'02 / BOOKMARK',bg:'#B64E38',fg:'#FFF7ED',shape:'<path d="M276 230H748Q772 230 772 254V770Q772 794 748 794H276Q252 794 252 770V254Q252 230 276 230Z M438 230V568L512 514L586 568V230Z" fill-rule="evenodd"/>'},
 {id:'c',name:'03 / PANELS',bg:'#5256AE',fg:'#FFFFFF',shape:'<rect x="212" y="212" width="268" height="600" rx="28"/><rect x="528" y="212" width="284" height="276" rx="28"/><rect x="528" y="536" width="284" height="276" rx="28"/>'}
];
const svg=(c,foreground=false)=>`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${foreground?'':`<rect width="1024" height="1024" fill="${c.bg}"/>`}<g fill="${c.fg}"${foreground?' transform="translate(512 512) scale(.72) translate(-512 -512)"':''}>${c.shape}</g></svg>\n`;
for(const c of concepts){await writeFile(new URL(`${c.id}.svg`,dir),svg(c));await sharp(Buffer.from(svg(c))).png().toFile(fileURLToPath(new URL(`${c.id}-1024.png`,dir)));}
const c=concepts.find(x=>x.id==='b');   // 用户选了 B 书签（2026-10-17）
await out('public/app-icon.svg',svg(c));await out('public/favicon.svg',svg(c));await out('public/app-icon-fg.svg',svg(c,true));
for(const file of ['scripts/make-icons.mjs','scripts/ios-assets.mjs']){let s=await readFile(new URL(file,root),'utf8');s=s.replaceAll('#0d0b09',c.bg).replaceAll('#246B60',c.bg).replace('图标暖黑底','图标纯色底').replace('图标纯色松绿底','图标纯色底');await out(file,s);}
// Real Android adaptive viewport: 108dp foreground cropped by a 72dp launcher mask.
const adaptive=c=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="170.6667 170.6667 682.6666 682.6666" width="1024" height="1024"><rect x="170" y="170" width="684" height="684" fill="${c.bg}"/><g fill="${c.fg}" transform="translate(512 512) scale(.72) translate(-512 -512)">${c.shape}</g></svg>`;
let body='<rect width="1600" height="1060" fill="#F3F1EB"/><text x="48" y="55" font-size="28" fill="#202622">EBOOK / ICON STUDY R10</text><g font-size="17" fill="#626760"><text x="310" y="101">1024 source</text><text x="589" y="101">iOS mask</text><text x="851" y="101">Android circle</text><text x="1111" y="101">Android rounded</text><text x="1390" y="101">Windows 32 / 16</text></g>';
for(let i=0;i<concepts.length;i++){const c=concepts[i],y=140+i*300;body+=`<text x="48" y="${y+112}" font-size="21" fill="#202622">${c.name}</text>`;
for(let j=0;j<4;j++){const x=290+j*265,size=224; const src=Buffer.from(j>1?adaptive(c):svg(c)).toString('base64'); const id=`m${i}${j}`;body+=`<defs><clipPath id="${id}">${j===2?`<circle cx="${x+112}" cy="${y+112}" r="112"/>`:`<rect x="${x}" y="${y}" width="224" height="224" rx="${j===0?0:j===1?50:40}"/>`}</clipPath></defs><image x="${x}" y="${y}" width="${size}" height="${size}" href="data:image/svg+xml;base64,${src}" clip-path="url(#${id})"/>`;}
for(const [k,size] of [32,16].entries()){const png=await sharp(Buffer.from(svg(c))).resize(size,size).png().toBuffer();await writeFile(new URL(`${c.id}-${size}.png`,dir),png);body+=`<rect x="1380" y="${y+k*100}" width="170" height="80" rx="10" fill="${k?'#25282C':'#FFFFFF'}"/><image x="1400" y="${y+k*100+24}" width="${size}" height="${size}" href="data:image/png;base64,${png.toString('base64')}"/><text x="1450" y="${y+k*100+46}" font-size="16" fill="${k?'#FFFFFF':'#25282C'}">${size}px</text>`;}
}
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1060" font-family="Segoe UI, sans-serif">${body}</svg>`)).png().toFile(fileURLToPath(new URL('comparison.png',dir)));
console.log('Three concepts, platform comparison, selected SVGs generated.');
