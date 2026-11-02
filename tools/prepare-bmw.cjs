'use strict';
// Offline derivatives only; the four supplied JPEGs are never overwritten.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('C:/Users/admin.AN-12BK/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root='for promt/BMW Motorsport',out='assets/bmw';
const models=[['m3-e30','BMW M3 Sport Evolution (E30)'],['m3-e36','BMW M3 3.2 (E36)'],['m3-e46','BMW M3 (E46)']];
const base='https://www.bmw-m.com/content/dam/bmw/marketBMW_M/www_bmw-m_com/topics/magazine-article-pool/';
const photos=[
 ['m3-e30',1,'2018/bmw-m3-e30/bmw-m3-e30-sport-evolution-gallery-01.jpg','Sport Evolution'],
 ['m3-e30',2,'2018/bmw-m3-e30/bmw-m3-e30-sport-evolution-gallery-08.jpg','Sport Evolution'],
 ['m3-e36',1,'2020/bmw-m3-e36/bmw-e36-m3-double-image-foreground.jpg','M3 3.2, Estoril Blue'],
 ['m3-e36',2,'2020/bmw-m3-e36/bmw-e36-m3-standard-detail-01.jpg','M3 3.2, архив BMW M'],
 ['m3-e46',1,'2018/bmw-m3-e46/bmw-m3-e46-portraet-01-st-16x9.jpg','M3 Coupé'],
 ['m3-e46',2,'2018/bmw-m3-e46/bmw-e46-m3-coup%C3%A9-gallery-03.jpg','M3 Coupé']
];
(async()=>{
 fs.mkdirSync(out,{recursive:true});fs.mkdirSync('assets/source/bmw',{recursive:true});
 const sourceHashes=[];
 for(const [id,dir] of models){const name=fs.readdirSync(path.join(root,dir)).find(f=>f.endsWith('.jpg')),file=path.join(root,dir,name);fs.copyFileSync(file,path.join(out,id+'-sprite.jpg'));sourceHashes.push({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});}
 const chest=path.join(root,'Generated Image October 31, 2026 - 1_23PM.jpg');sourceHashes.push({file:chest,sha256:crypto.createHash('sha256').update(fs.readFileSync(chest)).digest('hex')});
 const manifest=[];
 for(const [id,index,urlPart,caption] of photos){const file=`assets/source/bmw/${id}-${index}-hq.jpg`,url=base+urlPart+'?imwidth=1920';if(!fs.existsSync(file)){const res=await fetch(url);if(!res.ok)throw Error(res.status+' '+url);fs.writeFileSync(file,Buffer.from(await res.arrayBuffer()));}const meta=await sharp(file).metadata();await sharp(file).resize({width:2400,withoutEnlargement:true}).webp({quality:93}).toFile(`${out}/${id}-photo-${index}.webp`);manifest.push({id,index,url,sourcePage:`https://www.bmw-m.com/en/topics/magazine-article-pool/bmw-m3-${id.slice(3)}-portraet.html`,file,width:meta.width,height:meta.height,caption});}
 fs.writeFileSync('docs/bmw-photo-sources.json',JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync('docs/bmw-originals.json',JSON.stringify(sourceHashes,null,2)+'\n');console.log('Prepared BMW sources and six offline photographs; original JPEGs preserved.');
})().catch(e=>{console.error(e);process.exitCode=1;});
