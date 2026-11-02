'use strict';
const fs=require('node:fs'),path=require('node:path'),{createCanvas,loadImage}=require(process.env.ND_CANVAS_PACKAGE||'@napi-rs/canvas');
(async()=>{
 const root=path.join(__dirname,'..','for promt','blackbird');
 for(const [source,target] of [['case-closed.jpg','blackbird-closed.png'],['case-open.jpg','blackbird-open.png']]){
  const image=await loadImage(path.join(root,source)),scale=Math.min(1,1000/Math.max(image.width,image.height)),w=Math.round(image.width*scale),h=Math.round(image.height*scale),canvas=createCanvas(w,h),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,w,h);
  const pixels=ctx.getImageData(0,0,w,h),data=pixels.data,seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
  function add(p){if(seen[p])return;seen[p]=1;const i=p*4;if(Math.min(data[i],data[i+1],data[i+2])>=220)queue[tail++]=p;}
  for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
  while(head<tail){const p=queue[head++],x=p%w;data[p*4+3]=0;if(x)add(p-1);if(x<w-1)add(p+1);if(p>=w)add(p-w);if(p+w<w*h)add(p+w);}
  ctx.putImageData(pixels,0,0);fs.writeFileSync(path.join(__dirname,'..','assets','cases',target),canvas.toBuffer('image/png'));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
