'use strict';
// Usage: node tools/prepare-vw.cjs <five studio sheets in catalog order>
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.ND_SHARP || 'sharp');
const { vwModels, vwPaints, vwPhoto } = require('../catalog.js');
const source = 'for promt/Народный калибр';
const spriteSources = [
  ['Volkswagen Golf GTI 16V (Mk2, Big Bumper Spec).jpg', 0, true, 220],
  ['Volkswagen Golf Rallye G60 (Mk2, 1989).jpg', 0, true, 220],
  ['Volkswagen Corrado VR6 (1992).jpg', 313, true, 120],
  ['Volkswagen Golf R32 (Mk4).jpg', 224, true, 180],
  ['Volkswagen Golf GTI (Mk5, 2005).jpg', 207, false, 220]
];
const paints = Object.entries(vwPaints).map(([code,[,hex]]) => [code,hex.slice(1).match(/../g).map(pair=>parseInt(pair,16))]);
const clamp = (value, min=0, max=1) => Math.min(max,Math.max(min,value));
const smooth = value => { const t=clamp(value); return t*t*(3-2*t); };

function tint(pixels, color, keyHue, spriteMidtone) {
  const result = Buffer.from(pixels);
  for(let i=0;i<pixels.length;i+=4){
    const [r,g,b]=pixels.subarray(i,i+3);
    const hi=Math.max(r,g,b), lo=Math.min(r,g,b), chroma=hi-lo;
    if(chroma<5 || !pixels[i+3])continue;
    const hue=60*(hi===r?(g-b)/chroma:hi===g?2+(b-r)/chroma:4+(r-g)/chroma);
    const distance=Math.abs((hue-keyHue+540)%360-180);
    const mask=smooth((27-distance)/12)*smooth((chroma-6)/24);
    if(!mask)continue;
    const shade=spriteMidtone?Math.pow(hi/spriteMidtone,.8):0.38+hi/255*.74;
    const reflection=spriteMidtone?Math.max(0,lo-30)/255*.45:clamp(lo/255*.68+Math.max(0,hi-205)/255*.30,0,.72);
    for(let channel=0;channel<3;channel++){
      const lit=clamp(color[channel]*shade,0,255);
      const value=lit+(255-lit)*reflection;
      result[i+channel]=Math.round(pixels[i+channel]*(1-mask)+value*mask);
    }
  }
  return result;
}

async function cutout(file) {
  const {data,info:{width,height}}=await sharp(file).trim({background:'#ffffff',threshold:22}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const visited=new Uint8Array(width*height), queue=[];
  function seed(x,y){
    if(x<0||x>=width||y<0||y>=height)return;
    const point=y*width+x;
    if(visited[point])return;
    visited[point]=1;
    const offset=point*4, r=data[offset], g=data[offset+1], b=data[offset+2];
    if(Math.min(r,g,b)<165||Math.max(r,g,b)-Math.min(r,g,b)>25)return;
    data[offset+3]=0;
    queue.push(point);
  }
  for(let x=0;x<width;x++){seed(x,0);seed(x,height-1);}
  for(let y=0;y<height;y++){seed(0,y);seed(width-1,y);}
  for(let i=0;i<queue.length;i++){
    const x=queue[i]%width, y=Math.floor(queue[i]/width);
    seed(x-1,y);seed(x+1,y);seed(x,y-1);seed(x,y+1);
  }
  return {data,raw:{width,height,channels:4}};
}

async function prepare(id,sheet,index){
  const [file,hue,flip,midtone]=spriteSources[index];
  const sprite=await cutout(path.join(source,file));
  for(const [code,color] of paints){
    const pixels=tint(sprite.data,color,hue,midtone);
    await sharp(pixels,{raw:sprite.raw}).rotate(flip?180:0).resize({width:384}).png().toFile(`assets/cars/${id}-${code}.png`);
  }
  fs.mkdirSync(path.dirname(vwPhoto(id,paints[0][0])),{recursive:true});
  const {width,height}=await sharp(sheet).metadata();
  for(let view=0;view<6;view++){
    const col=view%2, row=Math.floor(view/2);
    const {data,info}=await sharp(sheet).extract({
      left:Math.round(col*width/2)+2, top:Math.round(row*height/3)+2,
      width:Math.floor(width/2)-4,height:Math.floor(height/3)-4
    }).extend({top:2,bottom:2,left:2,right:2,extendWith:'copy'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(const [code,color] of paints){
      await sharp(tint(data,color,329),{raw:{width:info.width,height:info.height,channels:4}})
        .removeAlpha().webp({quality:89}).toFile(vwPhoto(id,code,view));
    }
  }
}

async function main(){
  const ids=Object.keys(vwModels), sheets=process.argv.slice(2);
  if(sheets.length!==ids.length)throw Error('Provide one studio sheet per model in catalog order.');
  await Promise.all(ids.map((id,index)=>prepare(id,sheets[index],index)));
  for(const [time,state] of [['51','closed'],['52','open']]){
    const box=await cutout(path.join(source,`Generated Image November 04, 2026 - 2_${time}PM.jpg`));
    await sharp(box.data,{raw:box.raw}).resize({width:840}).png().toFile(`assets/cases/vw-${state}.png`);
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
