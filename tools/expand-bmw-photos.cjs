'use strict';
// Additional original gallery files. Existing photos and user originals stay intact.
const fs=require('fs'),sharp=require('C:/Users/admin.AN-12BK/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
require('../bmw-archive.js');
const nor='https://www.norclassics.com/wp-content/uploads/2023/04/',bat='https://bringatrailer.com/wp-content/uploads/2023/03/',bmw='https://www.bmw-m.com/content/dam/bmw/marketBMW_M/www_bmw-m_com/topics/magazine-article-pool/2018/bmw-m3-e46/';
const pages={
 'm3-e30':'https://www.norclassics.com/en/product/bmw-e30-m3-sport-evolution-1990-3/',
 'm3-e36':'https://bringatrailer.com/listing/1997-bmw-m3-euro-spec/',
 'm3-e46':'https://www.bmw-m.com/en/topics/magazine-article-pool/bmw-m3-e46-portraet.html'
};
const images=[
 ['m3-e30',3,nor+'MG_4951.jpg'],['m3-e30',4,nor+'IMG_20230320_093138.jpg'],['m3-e30',5,nor+'IMG_20230320_093225.jpg'],['m3-e30',6,nor+'MG_4958.jpg'],
 ['m3-e36',3,bat+'3.-MCS_9820-Large.jpg'],['m3-e36',4,bat+'25.-IMG_4951-Large.jpg'],['m3-e36',5,bat+'41.-IMG_4987-Large.jpg'],['m3-e36',6,bat+'22.-IMG_4956-Large.jpg'],
 ['m3-e46',3,bmw+'bmw-e46-m3-coup%C3%A9-gallery-01.jpg'],['m3-e46',4,bmw+'bmw-e46-m3-coup%C3%A9-micro-story-02.jpg'],['m3-e46',5,bmw+'bmw-e46-m3-coup%C3%A9-gallery-08.jpg'],['m3-e46',6,bmw+'bmw-e46-m3-coup%C3%A9-gallery-10.jpg']
];
(async()=>{
 const items=await Promise.all(images.map(async([id,index,url])=>{const file=`assets/source/bmw/${id}-gallery-${index}.jpg`;if(!fs.existsSync(file)){const r=await fetch(url);if(!r.ok)throw Error(r.status+' '+url);fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));}const m=await sharp(file).metadata();await sharp(file).resize({width:2000,withoutEnlargement:true}).webp({quality:92}).toFile(`assets/bmw/${id}-photo-${index}.webp`);return{id,index,url,sourcePage:pages[id],file,width:m.width,height:m.height};}));
 const manifest=JSON.parse(fs.readFileSync('docs/bmw-photo-sources.json','utf8'));for(const x of items){const i=manifest.findIndex(y=>y.id===x.id&&y.index===x.index);if(i<0)manifest.push(x);else manifest[i]=x;}for(const x of manifest)x.caption=globalThis.NDBMWArchive[x.id].photos[x.index-1].join(' · ');manifest.sort((a,b)=>a.id.localeCompare(b.id)||a.index-b.index);fs.writeFileSync('docs/bmw-photo-sources.json',JSON.stringify(manifest,null,2)+'\n');console.log(items.map(x=>`${x.id} #${x.index}: ${x.width}×${x.height}`).join('\n'));
 // Contact sheets for source selection; these are previews, not edited runtime assets.
 for(const id of Object.keys(pages)){const parts=[];for(let i=3;i<=6;i++)parts.push({input:await sharp(`assets/bmw/${id}-photo-${i}.webp`).resize(550,360,{fit:'contain',background:'#cdd2d9'}).toBuffer(),left:(i-3)%2*550,top:Math.floor((i-3)/2)*360});await sharp({create:{width:1100,height:720,channels:3,background:'#cdd2d9'}}).composite(parts).jpeg({quality:90}).toFile(`artifacts/bmw-extra-${id}.jpg`);}
})().catch(e=>{console.error(e);process.exitCode=1;});
