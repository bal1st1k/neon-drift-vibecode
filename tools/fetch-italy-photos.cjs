'use strict';
// Optional network download; game uses only the prepared local files.
const fs=require('fs'),path=require('path'),sources=require('../docs/italy-photo-sources.json');
(async()=>{fs.mkdirSync('assets/source/italy-hq',{recursive:true});for(const item of sources){if(fs.existsSync(item.file))continue;const r=await fetch(item.imageUrl,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error(item.id+': '+r.status);fs.writeFileSync(path.resolve(item.file),Buffer.from(await r.arrayBuffer()));console.log(item.id);}})().catch(e=>{console.error(e);process.exitCode=1;});
