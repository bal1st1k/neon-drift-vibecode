'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),core=require('../engine.js');
const gradient=()=>({addColorStop(){}}),context=()=>new Proxy({createLinearGradient:gradient,createRadialGradient:gradient},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas=()=>({width:1280,height:800,getContext:context,getBoundingClientRect:()=>({width:1280,height:800})});
const sandbox={window:{devicePixelRatio:1,addEventListener(){},removeEventListener(){}},document:{createElement:canvas}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('renderer.js','utf8'),sandbox);
for(const id of ['akagi','enna-skyline']){
 const track=core.createTrack(id),race=new core.Engine({trackId:id,carId:'s15',seed:42});let frames=0;while(race.state!=='finished'&&frames++<36000)race.update(1/60,race.getAutopilotInput());assert.equal(race.state,'finished');assert.equal(race.getHUD().progress,1);
 const painter=new sandbox.NDRenderer.Renderer(canvas(),{quality:'high'});painter._buildEnvironment(track);const props=painter.sceneryProps;
 assert.ok(props.some(p=>p.type==='roadside-tree'));assert.ok(props.some(p=>p.type==='guardrail'));assert.ok(!props.some(p=>p.type==='iroha-tree'||p.type==='iroha-wall'));
 const relief=props.filter(p=>p.type==='roadside-relief');assert.ok(relief.filter(p=>p.uphill).length>100);assert.ok(relief.filter(p=>!p.uphill).length>100);
 const distance=(x,y)=>{let best=Infinity;for(let i=1;i<track.points.length;i++){const a=track.points[i-1],b=track.points[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));best=Math.min(best,Math.hypot(x-a.x-t*dx,y-a.y-t*dy));}return best;};
 for(const p of relief)for(const t of [0,.5,1])for(const f of [.1,.5,1]){const x=p.a.x+(p.b.x-p.a.x)*t+(p.naX+(p.nbX-p.naX)*t)*p.depth*f,y=p.a.y+(p.b.y-p.a.y)*t+(p.naY+(p.nbY-p.naY)*t)*p.depth*f;assert.ok(distance(x,y)>track.width/2+4,'relief overlaps road');}
 if(id==='enna-skyline')assert.ok(props.some(p=>p.type==='roadside-slope'));assert.ok(props.some(p=>p.type==='roadside-feature'));
 const messages=[],worker={postMessage:(data,transfer)=>messages.push({data,transfer})};worker.self=worker;worker.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h}getContext(){return context()}transferToImageBitmap(){return {close(){}}}};vm.createContext(worker);worker.importScripts=()=>vm.runInContext(fs.readFileSync('renderer.js','utf8'),worker);vm.runInContext(fs.readFileSync('highway-cache-worker.js','utf8'),worker);
 worker.onmessage({data:{type:'init',generation:9,track,quality:'high',props,texture:[]}});for(const fraction of [.05,.35,.65,.95]){const p=track.points[Math.floor(fraction*(track.points.length-1))],gx=Math.floor(p.x/512),gy=Math.floor(p.y/512);worker.onmessage({data:{type:'tile',generation:9,gx,gy,key:gx+':'+gy}});}assert.equal(messages.length,5);assert.ok(messages.slice(1).every(m=>m.data.type==='tile'));
 console.log('PASS',id,'complete race, distinct roadside props and four Worker sectors');painter.destroy();
}
