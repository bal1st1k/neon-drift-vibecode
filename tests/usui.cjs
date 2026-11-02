'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),core=require('../engine.js');
let canvases=0;
const gradient=()=>({addColorStop(){}}),context=()=>new Proxy({createLinearGradient:gradient,createRadialGradient:gradient,createPattern:()=>({})},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas=()=>{canvases++;return {width:1280,height:800,getContext:context,getBoundingClientRect:()=>({width:1280,height:800})};};
const sandbox={window:{devicePixelRatio:1,addEventListener(){},removeEventListener(){}},document:{createElement:canvas}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('renderer.js','utf8'),sandbox);
const track=core.createTrack('usui'),high=new sandbox.NDRenderer.Renderer(canvas()),low=new sandbox.NDRenderer.Renderer(canvas(),{quality:'low'});high._buildEnvironment(track);low._buildEnvironment(track);
assert.equal(track.sceneryTheme,'usui-gorge-night');assert.equal(track.reworked,true);assert.equal(track.width,110);assert.equal(track.closed,false);assert.equal(track.points.length,1365);assert.equal(track.checkpoints.length,31);assert.ok(Math.abs(track.length-32682.114611769593)<1e-6);assert.equal(track.start.x,-8415);assert.equal(track.finish.x,8415);
assert.deepEqual(JSON.parse(JSON.stringify(high.sceneryProps)),JSON.parse(JSON.stringify(low.sceneryProps)));
const count=type=>high.sceneryProps.filter(p=>p.type===type).length;assert.ok(count('usui-slope')>600);assert.ok(count('usui-cliff')>400);assert.ok(count('tree')>1000);assert.ok(count('guardrail')>800);assert.ok(count('mountain-sign')>20);assert.equal(count('building'),0);
console.log('PASS original Usui geometry, gorge faces, rock walls, forest, guardrails and deterministic placement in both quality modes');
function roadDistance(x,y){let best=Infinity;for(let i=1;i<track.points.length;i++){const a=track.points[i-1],b=track.points[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));best=Math.min(best,Math.hypot(x-a.x-t*dx,y-a.y-t*dy));}return best;}
for(const p of high.sceneryProps){
 if(p.type==='tree')assert.ok(roadDistance(p.x,p.y)>55+p.size*1.65+13.9);
 if(p.type==='usui-cliff')for(const t of [0,.25,.5,.75,1])for(const d of [0,p.depth/2,p.depth]){const x=p.a.x+(p.b.x-p.a.x)*t+p.nx*d,y=p.a.y+(p.b.y-p.a.y)*t+p.ny*d;assert.ok(roadDistance(x,y)>65,'cliff on road at '+JSON.stringify(p));}
 if(p.type==='guardrail')for(const q of [p.a,p.b,p])assert.ok(roadDistance(q.x,q.y)>62.9);
}
for(let sector=0;sector<10;sector++){const p=track.points[Math.floor((sector+.5)/10*(track.points.length-1))];for(const type of ['usui-slope','tree'])assert.ok(high.sceneryProps.some(q=>q.type===type&&Math.hypot(q.x-p.x,q.y-p.y)<600));}
console.log('PASS forest and cliff footprints clear neighboring hairpins and the gorge continues across all route sectors');
for(const renderer of [high,low]){
 const bridge=renderer.usuiBridge;assert.equal(bridge.progress,.575);assert.equal(bridge.arches,4);assert.ok(roadDistance(bridge.x,bridge.y)<1e-7);assert.ok(Math.abs(bridge.x-561.4)<2);assert.ok(renderer.usuiBridgeArt.width*renderer.usuiBridgeArt.height<650000);assert.ok(renderer.cache.canvas.width*renderer.cache.canvas.height<6510000);
 for(const fraction of [0,.2,.43,.575,.78,.98]){const p=track.points[Math.floor(fraction*(track.points.length-1))];renderer._paintHighwayTile(context(),Math.floor(p.x/512),Math.floor(p.y/512));}
 const engine=new core.Engine({trackId:'usui'});engine.track=track;engine.rivals=[];Object.assign(engine.player,{x:bridge.x,y:bridge.y});
 const layers=[],drawBridge=renderer._drawUsuiOverhead;renderer._car=()=>layers.push('car');renderer._drawUsuiOverhead=function(ctx,camera){layers.push('bridge');drawBridge.call(this,ctx,camera);};
 let heavyCalls=0;renderer._drawSceneryVector=renderer._road=()=>heavyCalls++;const before=canvases,art=renderer.usuiBridgeArt;
 renderer.render(engine,0,{reducedMotion:true});const pattern=renderer.usuiBridgePattern;renderer.render(engine,0,{reducedMotion:true});assert.ok(pattern);assert.equal(renderer.usuiBridgePattern,pattern);assert.equal(heavyCalls,0);assert.equal(canvases,before);assert.equal(renderer.usuiBridgeArt,art);assert.deepEqual(layers,['car','bridge','car','bridge']);
 const rects=[],probe=context();probe.fillRect=(...rect)=>rects.push(rect);
 for(const [width,height,zoom] of [[1280,800,1.4],[360,800,1.4],[2560,1440,.7]]){renderer.width=width;renderer.height=height;rects.length=0;drawBridge.call(renderer,probe,{x:bridge.x,y:bridge.y,zoom});assert.equal(rects.length,1);const scale=art.width/192,projected=(Math.abs(Math.cos(bridge.angle))*width+Math.abs(Math.sin(bridge.angle))*height)/zoom;assert.ok(rects[0][2]/scale>projected,'bridge must extend beyond both viewport edges');}
 rects.length=0;drawBridge.call(renderer,probe,{x:bridge.x-Math.sin(bridge.angle)*20000,y:bridge.y+Math.cos(bridge.angle)*20000,zoom:1});assert.equal(rects.length,0);
 renderer.destroy();assert.equal(art.width,1);assert.equal(renderer.usuiBridgeArt,null);assert.equal(renderer.sceneryTiles.size,0);
}
console.log('PASS top-down bridge at 57.5%, extends past both screen edges in portrait and landscape, reuses texture pattern above cars, culls off-screen, bounded cache and cleanup');
