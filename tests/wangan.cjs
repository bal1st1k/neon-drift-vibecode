'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const core=require('../engine.js'),traffic=require('../traffic.js'),progress=require('../progress.js');
for(const id of ['wangan-east','wangan-west']){
 const e=new core.Engine({trackId:id,seed:42}); assert.equal(e.track.family,'wangan');assert.equal(e.track.closed,false);assert.equal(e.track.width,210);assert.equal(e.track.lengthMeters,21600);assert.equal(e.traffic.length,12);
 assert.ok(fs.existsSync(e.track.sourceImage));for(const photo of e.track.referencePhotos)assert.ok(fs.existsSync(photo));
 assert.equal(new Set(e.traffic.map(t=>t.lane)).size,3);assert.ok(e.traffic.every(t=>Number.isFinite(t.x)&&fs.existsSync(t.sprite)));
 e.state='running';const x=e.traffic[0].x;e.update(.5,{});assert.notEqual(e.traffic[0].x,x);
 // A car placed into a traffic rectangle must be separated on the next physics step.
 e.state='running';const civil=e.traffic[3],contactDistance=civil.halfLength+23-12;Object.assign(e.player,{x:civil.x-Math.cos(civil.angle)*contactDistance,y:civil.y-Math.sin(civil.angle)*contactDistance,angle:civil.angle,vx:Math.cos(civil.angle)*350,vy:Math.sin(civil.angle)*350,speed:350});e._nearest={index:0,distance:civil.routeDistance};e._updateTraffic(1/120);assert.equal(e.player.collision,true);assert.equal(traffic.overlap(e.player,civil),null);assert.ok(e.player.integrity<1);
 const count=e.traffic.length;e._nearest.distance=e.track.length*.7;e._updateTraffic(.1);assert.equal(e.traffic.length,count);assert.ok(e.traffic.every(t=>Number.isFinite(t.x)&&Number.isFinite(t.y)));
 const save=progress.defaults();save.selectedTrack=id;assert.equal(progress.sanitize(save).selectedTrack,id);
}
for(const model of traffic.vehicles){assert.ok(fs.existsSync(model.sprite));assert.ok(fs.existsSync(model.raceSprite));assert.ok(!core.cars.some(c=>c.id===model.id));}
assert.equal(new core.Engine({trackId:'akina'}).traffic.length,0);
assert.equal(traffic.overlap({x:0,y:0,angle:Math.PI/4},{x:200,y:0,angle:0}),null);
assert.ok(traffic.overlap({x:0,y:0,angle:Math.PI/4},{x:10,y:2,angle:Math.PI/2}));
console.log('PASS Wangan routes, three traffic lanes, motion, oriented collisions, recycling, resources and saved selection');

for(const id of ['wangan-east','wangan-west']){
 const e=new core.Engine({trackId:id,carId:'s15',seed:81});let frame=0;
 while(e.state!=='finished'&&frame++<24000)e.update(1/60,e.getAutopilotInput());
 assert.equal(e.state,'finished',id+' finish');assert.equal(e.getHUD().progress,1);assert.equal(e.credits,1500);assert.equal(e.result.credits,1500);assert.equal(e.traffic.length,12);assert.ok(Number.isFinite(e.player.x)&&Number.isFinite(e.player.y));
 assert.ok(e.splits.length===e.track.checkpoints.length-1);console.log('PASS '+id+' complete race with traffic: '+e.time.toFixed(1)+' seconds');
}

for(let place=1;place<=4;place++){const e=new core.Engine({trackId:'wangan-east'});e.rivals.forEach((r,i)=>r.finished=i<place-1);e.driftScore=90000;e._finish();assert.equal(e.credits,1500);}
console.log('PASS every Wangan finish pays exactly 1500 regardless of position or drift');
const vm=require('node:vm');
const gradient=()=>({addColorStop(){}}),ctx=()=>new Proxy({createLinearGradient:gradient,createRadialGradient:gradient},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas=()=>({width:1000,height:650,getContext:ctx,getBoundingClientRect:()=>({width:1000,height:650})});
const sandbox={window:{devicePixelRatio:1,addEventListener(){},removeEventListener(){}},document:{createElement:canvas}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','renderer.js'),'utf8'),sandbox);
for(const id of ['wangan-east','wangan-west'])for(const quality of ['high','low']){const renderer=new sandbox.NDRenderer.Renderer(canvas(),{quality}),engine=new core.Engine({trackId:id});renderer.render(engine,.016);assert.ok(renderer.sceneryProps.filter(p=>p.type==='highway-detail').length>100);assert.ok(renderer.cache.canvas.width*renderer.cache.canvas.height<6510000);renderer.destroy();}
console.log('PASS both detailed highways render in high and low quality with bounded terrain cache');
