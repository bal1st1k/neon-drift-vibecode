'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../engine.js'),progress=require('../progress.js');
const track=core.createTrack('tsuchisaka');
assert.equal(track.id,'tsuchisaka');assert.equal(track.closed,false);assert.equal(track.raceType,'sprint');assert.equal(track.lengthMeters,6712);assert.equal(track.width,110);
assert.ok(track.start.x<track.finish.x&&track.start.y<track.finish.y);assert.ok(track.points.length>=360);
assert.ok(fs.existsSync(track.sourceImage));for(const photo of track.referencePhotos)assert.ok(fs.existsSync(photo));
const save=progress.defaults();save.selectedTrack=track.id;assert.equal(progress.sanitize(save).selectedTrack,track.id);
const engine=new core.Engine({trackId:track.id,carId:'s15',seed:42});let frame=0;
while(engine.state!=='finished'&&frame++<36000)engine.update(1/60,engine.getAutopilotInput());
assert.equal(engine.state,'finished');assert.equal(engine.getHUD().progress,1);assert.equal(engine.splits.length,track.checkpoints.length-1);assert.ok(Number.isFinite(engine.result.credits));
console.log('PASS Tsuchisaka selection, source assets, save migration and complete race with every checkpoint: '+engine.time.toFixed(1)+' seconds');
let canvases=0;const gradient=()=>({addColorStop(){}}),context=()=>new Proxy({createLinearGradient:gradient,createRadialGradient:gradient},{get:(o,k)=>k in o?o[k]:()=>{}});
const canvas=()=>{canvases++;return {width:1280,height:800,getContext:context,getBoundingClientRect:()=>({width:1280,height:800})};};
const sandbox={window:{devicePixelRatio:1,addEventListener(){},removeEventListener(){}},document:{createElement:canvas}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('renderer.js','utf8'),sandbox);
function roadDistance(x,y){let best=Infinity;for(let i=1;i<track.points.length;i++){const a=track.points[i-1],b=track.points[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));best=Math.min(best,Math.hypot(x-a.x-t*dx,y-a.y-t*dy));}return best;}
let props;
for(const quality of ['high','low']){
 const renderer=new sandbox.NDRenderer.Renderer(canvas(),{quality});renderer._buildEnvironment(track);
 const serialized=JSON.stringify(renderer.sceneryProps);if(props)assert.equal(serialized,props);props=serialized;
 const count=type=>renderer.sceneryProps.filter(p=>p.type===type).length;
 assert.ok(count('tsuchisaka-tree')>1000);assert.ok(count('tsuchisaka-wall')>300);assert.ok(count('guardrail')>600);assert.equal(count('building'),0);
 assert.ok(renderer.sceneryProps.some(p=>p.kind==='bridge'));assert.ok(renderer.sceneryProps.filter(p=>p.kind==='construction').length>=5);
 for(const p of renderer.sceneryProps){
  if(p.type==='tsuchisaka-tree')assert.ok(roadDistance(p.x,p.y)>55+p.size*1.65+12);
  if(p.type==='tsuchisaka-wall')for(const t of [0,.25,.5,.75,1])for(const d of [0,p.depth*.5,p.depth])assert.ok(roadDistance(p.a.x+(p.b.x-p.a.x)*t+p.nx*d,p.a.y+(p.b.y-p.a.y)*t+p.ny*d)>67);
  if(p.kind==='construction')assert.ok(roadDistance(p.x,p.y)>80);
 }
 for(const sector of [.05,.23,.5,.65,.9]){const p=track.points[Math.floor(sector*(track.points.length-1))];assert.ok(renderer.sceneryProps.some(q=>q.type==='tsuchisaka-tree'&&Math.hypot(q.x-p.x,q.y-p.y)<450));renderer._paintHighwayTile(context(),Math.floor(p.x/512),Math.floor(p.y/512));}
 assert.ok(renderer.cache.canvas.width*renderer.cache.canvas.height<6510000);
 let heavy=0;renderer._drawSceneryVector=renderer._road=renderer._drawTsuchisakaRoadDetail=()=>heavy++;
 engine.track=track;const before=canvases;
 for(const [width,height] of [[2560,1440],[360,800],[320,800]]){renderer.width=width;renderer.height=height;renderer.render(engine,0,{reducedMotion:true});renderer.render(engine,0,{reducedMotion:true});}
 assert.equal(heavy,0);assert.equal(canvases,before);
 renderer.destroy();assert.equal(renderer.sceneryTiles.size,0);
}
console.log('PASS day forest, clear wall/tree footprints, bridge, roadside construction, deterministic quality modes, bounded raster cache and no heavy painting during race frames');
const messages=[],workerScope={postMessage:(data,transfer)=>messages.push({data,transfer})};workerScope.self=workerScope;
workerScope.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h;}getContext(){return context();}transferToImageBitmap(){return {close(){}};}};
vm.createContext(workerScope);workerScope.importScripts=()=>vm.runInContext(fs.readFileSync('renderer.js','utf8'),workerScope);
vm.runInContext(fs.readFileSync('highway-cache-worker.js','utf8'),workerScope);
workerScope.onmessage({data:{type:'init',generation:9,track,quality:'high',props:JSON.parse(props),texture:[]}});
for(const progress of [0,.23,.65,.95]){const p=track.points[Math.floor(progress*(track.points.length-1))],gx=Math.floor(p.x/512),gy=Math.floor(p.y/512);workerScope.onmessage({data:{type:'tile',generation:9,gx,gy,key:gx+':'+gy}});}
assert.equal(messages[0].data.type,'ready');assert.equal(messages.length,5);for(const result of messages.slice(1)){assert.equal(result.data.type,'tile');assert.equal(result.transfer[0],result.data.bitmap);}
console.log('PASS Tsuchisaka forest, bridge and construction render through the actual Worker entry point and transfer four sector tiles');
