'use strict';
const assert=require('node:assert/strict'),{Engine}=require('../engine.js');

// Inflate every traffic car longitudinally by 100 units. At no point may
// these conservative occupied intervals cover all three lanes together.
function checkCorridor(engine){
 const cars=engine.traffic.filter(car=>car.active);
 for(const car of cars){
  const point=car.routeDistance-car.halfLength-100;
  const lanes=new Set(cars.filter(other=>point>=other.routeDistance-other.halfLength-100-1e-6&&point<=other.routeDistance+other.halfLength+100).map(other=>other.laneIndex));
  assert.ok(lanes.size<3,'All three lanes blocked near '+point);
 }
 const sorted=engine.traffic.slice().sort((a,b)=>a.routeDistance-b.routeDistance);
 for(let i=1;i<sorted.length;i++)if(sorted[i].wave!==sorted[i-1].wave)assert.ok(sorted[i].routeDistance-sorted[i-1].routeDistance>=380-1e-6,'Lane-change gap closed');
}
let recycled=0,arrangements=new Set();
for(const trackId of ['wangan-east','wangan-west'])for(let seed=1;seed<=64;seed++){
 const engine=new Engine({trackId,seed});engine.rivals=[];engine.player.x=engine.player.y=1e9;
 const fingerprint=()=>JSON.stringify(engine.traffic.map(car=>[car.laneIndex,car.routeDistance,car.speed,car.sprite]));
 const replay=new Engine({trackId,seed});assert.equal(fingerprint(),JSON.stringify(replay.traffic.map(car=>[car.laneIndex,car.routeDistance,car.speed,car.sprite])));
 arrangements.add(fingerprint());checkCorridor(engine);
 for(let step=0;step<240;step++){
  engine._nearest.distance=Math.min(engine.track.length-200,step*200);
  const before=engine.traffic.map(car=>car.routeDistance);
  engine._updateTraffic(.5);
  recycled+=engine.traffic.filter((car,i)=>car.routeDistance-before[i]>car.speed*.5+1).length;
  assert.equal(engine.traffic.length,12);checkCorridor(engine);
 }
}
assert.ok(arrangements.size>=64,'Different seeds must vary the flow');assert.ok(recycled>100,'Exercise repeated recycling');
console.log('PASS 128 seeded Wangan flows, 30720 moving snapshots: a free lane with safety margin, 380-unit lane-change gaps, deterministic randomness, 12 cars and '+recycled+' recycled vehicles');
