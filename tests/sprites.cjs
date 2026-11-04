'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),catalog=require('../catalog.js'),{Engine}=require('../engine.js');
let pixelReads=0;
class LocalImage {
  set src(value){
    this._src=value;
    const data=fs.readFileSync(path.join(base,value));
    assert.equal(data.subarray(1,4).toString(),'PNG');
    assert.equal(data[25],6,'Prepared cars must have an RGBA transparency channel');
    this.width=this.naturalWidth=data.readUInt32BE(16);this.height=this.naturalHeight=data.readUInt32BE(20);
    queueMicrotask(()=>this.onload());
  }
  get src(){return this._src;}
}
const sandbox={Image:LocalImage,document:{createElement(){pixelReads++;throw Error('file origin forbids source pixel processing');}},console};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(base,'renderer.js'),'utf8'),sandbox);
(async()=>{
  const sprites=await sandbox.NDRenderer.preloadSprites(catalog.cars);
  assert.equal(sprites.length,54);assert.ok(sprites.every(sprite=>sprite.status==='ready'));
  const drawn=[];
  const ctx=new Proxy({drawImage(image){drawn.push(image.src);}}, {get(target,key){if(key in target)return target[key];return()=>{};},set(target,key,value){target[key]=value;return true;}});
  for(const car of catalog.cars){
    const engine=new Engine({carId:car.id});
    assert.equal(engine.player.sprite,car.raceSprite);assert.equal(engine.player.spriteAngle,0);
    assert.ok(engine.rivals.every(rival=>/^assets\/cars\/[^/]+\.png$/.test(rival.sprite)&&rival.spriteAngle===0));
    sandbox.NDRenderer.Renderer.prototype._car.call({quality:'low',elapsed:0},ctx,engine.player,true,false,false);
  }
  assert.equal(pixelReads,0,'PNG rendering must not use a canvas pixel-processing path');
  assert.equal(drawn.length,54);assert.equal(new Set(drawn).size,54);
  console.log('PASS all 54 prepared RGBA cars load and draw with pixel processing forbidden');
  console.log('PASS player and rivals select prepared PNGs with the correct orientation');
})().catch(error=>{console.error(error);process.exitCode=1;});
