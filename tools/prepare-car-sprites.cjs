'use strict';
// Offline asset preparation. Original JPEGs stay untouched; the game needs no
// packages and never reads source pixels at runtime when using these PNGs.
const fs = require('node:fs');
const path = require('node:path');
const canvasPackage = process.env.ND_CANVAS_PACKAGE || '@napi-rs/canvas';
const { createCanvas, loadImage } = require(canvasPackage);
const { cars } = require('../catalog.js');
const root = path.resolve(__dirname, '..');

async function prepare(car) {
  const image = await loadImage(path.join(root, car.sprite));
  const scale = Math.min(1, 720 / Math.max(image.width, image.height));
  const w = Math.round(image.width * scale), h = Math.round(image.height * scale);
  const source = createCanvas(w,h), ctx = source.getContext('2d');
  ctx.drawImage(image,0,0,w,h);
  const pixels = ctx.getImageData(0,0,w,h), data = pixels.data;
  let white = 0, black = 0;
  function inspect(p) {
    const i=p*4, lo=Math.min(data[i],data[i+1],data[i+2]), hi=Math.max(data[i],data[i+1],data[i+2]);
    if(lo>235)white++; else if(hi<23)black++;
  }
  for(let x=0;x<w;x+=Math.max(1,Math.floor(w/35))){inspect(x);inspect((h-1)*w+x);}
  for(let y=0;y<h;y+=Math.max(1,Math.floor(h/35))){inspect(y*w);inspect(y*w+w-1);}
  const light=white>=black, seen=new Uint8Array(w*h), queue=new Int32Array(w*h);
  let head=0,tail=0;
  function enqueue(p) {
    if(seen[p])return;seen[p]=1;
    const i=p*4, lo=Math.min(data[i],data[i+1],data[i+2]), hi=Math.max(data[i],data[i+1],data[i+2]);
    if(data[i+3]===0||(light?lo>=235&&hi-lo<=25:hi<=23))queue[tail++]=p;
  }
  for(let x=0;x<w;x++){enqueue(x);enqueue((h-1)*w+x);}
  for(let y=0;y<h;y++){enqueue(y*w);enqueue(y*w+w-1);}
  while(head<tail){
    const p=queue[head++],x=p%w;data[p*4+3]=0;
    if(x>0)enqueue(p-1);if(x+1<w)enqueue(p+1);
    if(p>=w)enqueue(p-w);if(p+w<w*h)enqueue(p+w);
  }
  let x0=w,y0=h,x1=-1,y1=-1,opaque=0;
  for(let p=0;p<w*h;p++)if(data[p*4+3]){
    opaque++;const x=p%w,y=Math.floor(p/w);
    x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
  }
  if(opaque<500||tail<100)throw new Error('Invalid sprite mask: '+car.id);
  ctx.putImageData(pixels,0,0);
  const cw=x1-x0+1,ch=y1-y0+1,vertical=Math.abs(Math.sin(car.spriteAngle))>.5;
  const length=256,width=Math.round(length*(vertical?cw/ch:ch/cw));
  const output=createCanvas(length+4,width+4), out=output.getContext('2d');
  out.translate(output.width/2,output.height/2);out.rotate(-car.spriteAngle);
  const dw=vertical?width:length,dh=vertical?length:width;
  out.drawImage(source,x0,y0,cw,ch,-dw/2,-dh/2,dw,dh);
  const target=path.join(root,car.raceSprite);
  fs.writeFileSync(target,output.toBuffer('image/png'));
  return {id:car.id,width:output.width,height:output.height,bytes:fs.statSync(target).size};
}

(async()=>{
  fs.mkdirSync(path.join(root,'assets','cars'),{recursive:true});
  const results=[];
  const selected = process.argv.slice(2);
  for(const car of cars.filter(car => car.sprite!==car.raceSprite && (!selected.length || selected.includes(car.id))))results.push(await prepare(car));
  console.log(JSON.stringify({count:results.length,bytes:results.reduce((n,c)=>n+c.bytes,0),cars:results},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
