'use strict';
const fs=require('fs'),path=require('path'),base='C:/Users/admin.AN-12BK/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/',sharp=require(base+'sharp'),{createCanvas,loadImage}=require(base+'@napi-rs/canvas');
(async()=>{
 fs.copyFileSync('for promt/американская лошадка/Generated Image October 30, 2026 - 8_23PM.jpg','assets/mustang/mustang-gt-sprite.jpg');
 await sharp('assets/mustang/gt-2005-source.png').webp({quality:93}).toFile('assets/mustang/gt-2005.webp');
 for(const [name,state] of [['8_26PM','closed'],['8_27PM','open']]){
  const im=await loadImage('for promt/американская лошадка/Generated Image October 30, 2026 - '+name+'.jpg'),w=1000,h=Math.round(im.height*w/im.width),c=createCanvas(w,h),x=c.getContext('2d');x.drawImage(im,0,0,w,h);
  const p=x.getImageData(0,0,w,h),d=p.data,seen=new Uint8Array(w*h),q=new Int32Array(w*h);let head=0,tail=0;
  function add(i){if(seen[i])return;seen[i]=1;if(Math.min(d[i*4],d[i*4+1],d[i*4+2])>=220)q[tail++]=i;}
  for(let i=0;i<w;i++){add(i);add((h-1)*w+i);}for(let i=0;i<h;i++){add(i*w);add(i*w+w-1);}
  while(head<tail){const i=q[head++];d[i*4+3]=0;if(i%w)add(i-1);if(i%w<w-1)add(i+1);if(i>=w)add(i-w);if(i+w<w*h)add(i+w);}
  x.putImageData(p,0,0);fs.writeFileSync('assets/cases/mustang-'+state+'.png',c.toBuffer('image/png'));
 }
 console.log('Prepared Mustang photograph and transparent cases; originals preserved.');
})().catch(e=>{console.error(e);process.exitCode=1;});
