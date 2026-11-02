/*! NEON DRIFT | Made by bal1st1k */
/* Rasterize static highway and mountain scenery off the animation thread. */
'use strict';
self.document={createElement(){return new OffscreenCanvas(1,1);}};
importScripts('renderer.js?v=4.0.2');
let painter=null,generation=0;
self.onmessage=event=>{
  const data=event.data;
  if(data.type==='init'){
    generation=data.generation;
    painter=Object.create(NDRenderer.Renderer.prototype);
    Object.assign(painter,{quality:data.quality,cachedTrack:data.track,roadPath:null,sceneryProps:[],sceneryGrid:new Map(),sceneryReach:190,roadTexture:data.texture,width:514,height:514,_bakingEnvironment:false});
    painter.usuiBridge=painter._usuiBridgeAt(data.track);
    for(const prop of data.props)painter._rememberProp(prop);
    self.postMessage({type:'ready',generation});
  }else if(data.type==='tile'&&painter&&data.generation===generation){
    const canvas=new OffscreenCanvas(514,514),ctx=canvas.getContext('2d');
    ctx.translate(1-data.gx*512,1-data.gy*512);
    painter._paintHighwayTile(ctx,data.gx,data.gy);
    const bitmap=canvas.transferToImageBitmap();
    self.postMessage({type:'tile',generation,key:data.key,bitmap},[bitmap]);
  }
};
