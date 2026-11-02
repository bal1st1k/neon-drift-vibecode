'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let jobs=[],pathBuilds=0,draws=0;
const gradient=()=>({addColorStop(){}});
const ctx=()=>new Proxy({createLinearGradient:gradient,createRadialGradient:gradient,drawImage(){draws++;}},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
const canvas=()=>({width:800,height:600,getContext:ctx,getBoundingClientRect:()=>({width:800,height:600})});
class Path {constructor(){pathBuilds++} moveTo(){} lineTo(){} closePath(){}}
const sandbox={Path2D:Path,window:{devicePixelRatio:1,addEventListener(){},removeEventListener(){}},document:{createElement:canvas},requestIdleCallback(fn){jobs.push(fn);return jobs.length},cancelIdleCallback(){}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..','renderer.js'),'utf8'),sandbox);
const renderer=new sandbox.NDRenderer.Renderer(canvas()), camera={x:0,y:0,zoom:1};
let vectors=0;renderer._drawSceneryVector=()=>{vectors++};renderer._drawScenery(ctx(),camera);assert.equal(vectors,1);assert.ok(jobs.length);
while(jobs.length) jobs.shift()();assert.ok(renderer.sceneryTiles.size>0);assert.ok(renderer.sceneryTiles.size<=64);
vectors=0;draws=0;renderer._drawScenery(ctx(),camera);assert.equal(vectors,0);assert.equal(draws,renderer.sceneryTiles.size);
renderer._clearSceneryTiles();assert.equal(renderer.sceneryTiles.size,0);assert.equal(renderer.sceneryTilePending.size,0);
renderer.width=9000;renderer.height=9000;renderer._drawScenery(ctx(),camera);assert.equal(renderer.sceneryTileQueue.length,0);assert.equal(vectors,1);
const track={points:[{x:0,y:0},{x:100,y:100}],bounds:{minX:0,minY:0,maxX:100,maxY:100},closed:false};
sandbox.NDRenderer.drawMiniMap(canvas(),track,null);sandbox.NDRenderer.drawMiniMap(canvas(),track,null);assert.equal(pathBuilds,1);
renderer.destroy();assert.equal(renderer.sceneryTiles.size,0);
console.log('PASS scenery tiles are built incrementally, reused, bounded, cleared, and fall back for large views');
console.log('PASS minimap reuses track geometry');
// A highway cache miss must not call the vector scenery or road renderer on the animation thread.
const highway=new sandbox.NDRenderer.Renderer(canvas());highway.cachedTrack={family:'wangan'};
let heavyCalls=0;highway._road=highway._drawRoadTexture=highway._drawWanganOverhead=highway._drawSceneryVector=()=>{heavyCalls++};
highway._drawHighwayTiles(ctx(),{x:0,y:0,zoom:1},{vx:650,vy:0});assert.equal(heavyCalls,0);assert.ok(highway.sceneryTileQueue.some(tile=>tile.gx>=2));
while(jobs.length)jobs.shift()();heavyCalls=0;highway._drawHighwayTiles(ctx(),{x:0,y:0,zoom:1},{vx:650,vy:0});assert.equal(heavyCalls,0);assert.ok(highway.sceneryTiles.size<=96);
highway._drawHighwayTiles(ctx(),{x:520,y:0,zoom:1},{vx:650,vy:0});assert.equal(heavyCalls,0);assert.ok(highway.sceneryTileQueue.length<=96);highway.destroy();while(jobs.length)jobs.shift()();assert.equal(highway.sceneryTiles.size,0);
console.log('PASS highway cache misses keep heavy drawing out of the animation frame, prefetch ahead, and respect memory limits');
// Worker delivery, stale messages, and transferable-image lifetime.
let posted=[];
class MockWorker{constructor(){this.terminated=false;}postMessage(data){posted.push(data);}terminate(){this.terminated=true;}}
sandbox.Worker=MockWorker;sandbox.OffscreenCanvas=function(){};
const asyncRenderer=new sandbox.NDRenderer.Renderer(canvas());asyncRenderer.cachedTrack={family:'wangan'};asyncRenderer._startHighwayWorker();
const worker=asyncRenderer.highwayWorker;assert.equal(posted[0].type,'init');worker.onmessage({data:{type:'ready'}});
asyncRenderer._drawHighwayTiles(ctx(),{x:0,y:0,zoom:1},{vx:800,vy:0});const message=posted.find(item=>item.type==='tile');assert.ok(message);
let closed=0;worker.onmessage({data:{type:'tile',key:message.key,bitmap:{close(){closed++}}}});assert.ok(asyncRenderer.sceneryTiles.has(message.key));
asyncRenderer.destroy();assert.ok(worker.terminated);assert.equal(closed,1);worker.onmessage({data:{type:'tile',key:'old',bitmap:{close(){closed++}}}});assert.equal(closed,2);assert.equal(asyncRenderer.sceneryTiles.size,0);
console.log('PASS worker results are cached, workers stop on destroy, and stale images release their resources');
// Run the worker entry point in a deterministic worker-like environment.
const workerMessages=[];const workerCanvas=function(w,h){this.width=w;this.height=h;this.getContext=ctx;this.transferToImageBitmap=()=>({close(){}});};
const workerScope={OffscreenCanvas:workerCanvas,postMessage:(data,transfer)=>workerMessages.push({data,transfer}),Path2D:Path};workerScope.self=workerScope;
vm.createContext(workerScope);workerScope.importScripts=()=>vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..','renderer.js'),'utf8'),workerScope);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..','highway-cache-worker.js'),'utf8'),workerScope);
const route={family:'wangan',width:210,closed:false,points:[{x:0,y:0,angle:0,normalX:0,normalY:1},{x:1000,y:0,angle:0,normalX:0,normalY:1}]};
workerScope.onmessage({data:{type:'init',generation:7,track:route,quality:'high',props:[],texture:[]}});workerScope.onmessage({data:{type:'tile',generation:6,gx:0,gy:0,key:'stale'}});assert.equal(workerMessages.length,1);
workerScope.onmessage({data:{type:'tile',generation:7,gx:0,gy:0,key:'0:0'}});assert.equal(workerMessages[1].data.type,'tile');assert.equal(workerMessages[1].transfer[0],workerMessages[1].data.bitmap);
console.log('PASS worker paints full static highway tiles and transfers the bitmap only for the active route');
