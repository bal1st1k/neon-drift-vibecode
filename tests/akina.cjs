'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../engine.js');
const gradient=()=>({addColorStop(){}});
const context=()=>new Proxy({createLinearGradient:gradient,createRadialGradient:gradient},{get(target,key){return key in target?target[key]:()=>{};}});
const canvas=()=>({width:1280,height:800,getContext:context,getBoundingClientRect:()=>({width:1280,height:800})});
const sandbox={window:{devicePixelRatio:1,addEventListener(){},removeEventListener(){}},document:{createElement:canvas}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','renderer.js'),'utf8'),sandbox);
const track=core.createTrack('akina'),Renderer=sandbox.NDRenderer.Renderer;
const high=new Renderer(canvas()),low=new Renderer(canvas(),{quality:'low'});
high._buildEnvironment(track);low._buildEnvironment(track);
let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
function distanceToRoad(x,y){
  let result=Infinity;
  for(let i=1;i<track.points.length;i++){
    const a=track.points[i-1],b=track.points[i],dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));
    result=Math.min(result,Math.hypot(x-a.x-t*dx,y-a.y-t*dy));
  }
  return result;
}
check('only Akina uses its mountain theme and the original sprint geometry remains intact',()=>{
  assert.equal(track.reworked,true);assert.equal(track.sceneryTheme,'akina-rework');
  assert.equal(track.closed,false);assert.equal(track.width,110);assert.equal(track.lengthMeters,7552);
  assert.equal(track.points.length,1600);assert.ok(Math.abs(track.length-45656.76688130946)<.001);
  assert.ok(core.tracks.filter(t=>t.id!=='akina').every(t=>t.sceneryTheme!=='akina-rework'));
  assert.ok(!high.sceneryProps.some(p=>p.type==='building'));
});
check('cliffs, forest, rails and warnings cover the route and stay identical across quality settings',()=>{
  assert.deepEqual(JSON.parse(JSON.stringify(high.sceneryProps)),JSON.parse(JSON.stringify(low.sceneryProps)));
  const count=type=>high.sceneryProps.filter(p=>p.type===type).length;
  assert.ok(count('massif')>200);assert.ok(count('tree')>1500);assert.ok(count('guardrail')>2000);assert.ok(count('mountain-sign')>20);
  for(let sector=0;sector<10;sector++){
    const p=track.points[Math.round((sector+.5)/10*(track.points.length-1))];
    assert.ok(high.sceneryProps.some(q=>q.type==='massif'&&Math.hypot(p.x-q.x,p.y-q.y)<900),'Mountain scenery missing in sector '+sector);
  }
});
check('full rock and tree footprints clear every road segment, including adjacent hairpins',()=>{
  for(const p of high.sceneryProps){
    assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
    if(p.type==='massif'||p.type==='tree'||p.type==='mountain-sign'){
      const radius=p.radius||p.size*1.65+5;
      assert.ok(distanceToRoad(p.x,p.y)>track.width/2+radius+7.9,`${p.type} intrudes onto the road`);
    }
    if(p.type==='guardrail')for(const q of [p.a,p.b,p])assert.ok(distanceToRoad(q.x,q.y)>=track.width/2+7.9,'Guardrail crosses a hairpin');
  }
});
check('terrain cache stays bounded and scenery can redraw at racing zoom in both quality modes',()=>{
  for(const renderer of [high,low]){
    assert.ok(renderer.cache.canvas.width*renderer.cache.canvas.height<6510000);
    assert.ok(renderer.sceneryReach>=350);
    for(const fraction of [0,.1025,.44375,.6925,.98]){
      const p=track.points[Math.floor(fraction*(track.points.length-1))];
      renderer._drawScenery(context(),{...p,zoom:1.2});
      renderer._road(context(),track,null,true);
    }
    renderer.destroy();assert.equal(renderer.sceneryProps.length,0);assert.equal(renderer.sceneryGrid.size,0);
  }
});
console.log(`\n${passed} Akina scenery checks passed.`);

