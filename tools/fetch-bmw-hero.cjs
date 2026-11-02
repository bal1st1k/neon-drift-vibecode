'use strict';
const fs=require('fs'),sharp=require('C:/Users/admin.AN-12BK/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const choices=[
 {id:'m3-e30',url:'https://www.norclassics.com/wp-content/uploads/2023/04/MG_4956.jpg',sourcePage:'https://www.norclassics.com/en/product/bmw-e30-m3-sport-evolution-1990-3/',caption:'BMW M3 Sport Evolution, Jet Black · NOR Classics'},
 {id:'m3-e36',url:'https://bringatrailer.com/wp-content/uploads/2023/03/14.-MCS_9780-Large.jpg',sourcePage:'https://bringatrailer.com/listing/1997-bmw-m3-euro-spec/',caption:'BMW M3 3.2 Euro, Dakar Yellow II · Motorcar Studio / Bring a Trailer'}
];
(async()=>{
 const manifest=JSON.parse(fs.readFileSync('docs/bmw-photo-sources.json','utf8'));
 for(const item of choices){const file='assets/source/bmw/'+item.id+'-dealer.jpg';if(!fs.existsSync(file)){const r=await fetch(item.url);if(!r.ok)throw Error(r.status+' '+item.url);fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));}const meta=await sharp(file).metadata();console.log(item.id,meta.width,meta.height);if(meta.width<1400)throw Error('Hero too small: '+item.id);await sharp(file).resize({width:2400,withoutEnlargement:true}).webp({quality:93}).toFile('assets/bmw/'+item.id+'-photo-1.webp');const entry={...item,index:1,file,width:meta.width,height:meta.height};manifest.splice(manifest.findIndex(x=>x.id===item.id&&x.index===1),1,entry);}
 fs.writeFileSync('docs/bmw-photo-sources.json',JSON.stringify(manifest,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
