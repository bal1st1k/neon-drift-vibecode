'use strict';
// Rebuild from the original JPEGs before applying the paint masks.
const sharp = require(process.env.ND_SHARP || 'sharp');
const { cars, getCarPaints, getCarSprite } = require('../catalog.js');
const prepareCarSprite = require('./prepare-car-sprites.cjs');

const sources = {
  jzz30: {
    midtone:238, maskHeight:116,
    lights:'M228 9 Q250 12 258 38 L251 42 Q246 29 228 12Z M228 103 Q244 91 251 73 L258 76 Q252 101 228 107Z'
  },
  jzx90: {
    midtone:235, maskHeight:128,
    lights:'M231 9 Q251 9 256 43 L249 45 Q245 18 231 12Z M231 115 Q248 106 249 81 L256 82 Q251 116 231 119Z'
  },
  jzx81: { midtone:99, hue:219 }
};
const clamp = (value, max=1) => Math.max(0,Math.min(max,value));
const smooth = value => {
  const amount = clamp(value);
  return amount * amount * (3 - 2 * amount);
};

function bodyMask(r,g,b,source) {
  const hi = Math.max(r,g,b), chroma = hi-Math.min(r,g,b);
  if (source.hue === undefined) return smooth((hi-90)/62)*smooth((46-chroma)/26);
  if (b!==hi || !chroma) return 0;
  const hue = 60*(4+(r-g)/chroma);
  return smooth((33-Math.abs(source.hue-hue))/17)*smooth((chroma-13)/22);
}

async function prepare(id,source) {
  const car = cars.find(item=>item.id===id);
  await prepareCarSprite(car);
  const { data, info:{width,height} } = await sharp(car.raceSprite).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const protectedLights = source.lights ? await sharp(Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 260 ${source.maskHeight}" preserveAspectRatio="none"><path fill="white" d="${source.lights}"/></svg>`
  )).ensureAlpha().raw().toBuffer() : null;
  const mask = new Float32Array(width*height);
  for (let i=0;i<mask.length;i++) {
    const offset = i*4;
    if (data[offset+3]) mask[i] = bodyMask(data[offset],data[offset+1],data[offset+2],source) * (1-(protectedLights?.[offset+3]??0)/255);
  }
  for (const [code,[,hex]] of Object.entries(getCarPaints(id))) {
    const color = hex.slice(1).match(/../g).map(pair=>parseInt(pair,16));
    const pixels = Buffer.from(data);
    for (let i=0;i<mask.length;i++) {
      if (!mask[i]) continue;
      const offset = i*4;
      const brightness = Math.max(data[offset],data[offset+1],data[offset+2]);
      const shade = Math.pow(brightness/source.midtone,1.55);
      const highlight = clamp((brightness-source.midtone)/Math.max(40,255-source.midtone))*.24;
      for (let channel=0;channel<3;channel++) {
        const tinted = clamp(color[channel]*shade,255);
        const value = tinted+(255-tinted)*highlight;
        pixels[offset+channel] = Math.round(data[offset+channel]*(1-mask[i])+value*mask[i]);
      }
    }
    await sharp(pixels,{raw:{width,height,channels:4}}).png().toFile(getCarSprite(car,code,true));
  }
}

Promise.all(Object.entries(sources).map(([id,source])=>prepare(id,source))).catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
