'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),catalog=require('../catalog.js'),cards=require('../tuning-cards.js'),shop=require('../shop.js'),loot=require('../loot.js'),progress=require('../progress.js'),audio=require('../audio.js'),{Engine}=require('../engine.js');
const ids=shop.italy.carIds,seq=(...v)=>()=>v.shift()??0;
assert.equal(shop.italy.casePrice,1500);assert.equal(shop.italy.carChance,.02);
for(const [i,id] of ids.entries()){
 const car=catalog.cars.find(c=>c.id===id),motor=catalog.engines.find(e=>e.id===car.stockEngineId),s=progress.defaults();
 assert.equal(car.tuningLocked,false);assert.equal(car.swapLocked,true);assert.equal(motor.swapAllowed,false);
 assert.equal(cards.computeBuild(id,{},'k20a').engineId,motor.id);assert.equal(cards.computeBuild('ae85',{},motor.id).engineId,'3au');assert.ok(cards.computeBuild(id,{turbo:1}).powerHp>car.stockPowerHp);
 for(const file of [car.sprite,car.raceSprite,...shop.italy.photos[id]])assert.ok(fs.existsSync(file));
 s.credits=100000;assert.ok(shop.purchaseExclusiveCar(s,id).ok);assert.equal(s.credits,100000-car.price);assert.ok(!shop.purchaseExclusiveCar(s,id).ok);
 const v=progress.defaults();v.inventory.cases.italy=1;assert.equal(loot.openCase(v,seq(0,.9801+i*.005),'italy').rewards[0].carId,id);
 const g=progress.defaults();g.inventory.cases.italy=1;g.pity.italy=29;const reward=loot.openCase(g,seq(0,(i+.1)/4),'italy').rewards[0];assert.equal(reward.carId,id);assert.ok(reward.guaranteed);
 const e=new Engine({carId:id,trackId:'wangan-east',seed:42});assert.equal(e.performance.stockZeroToHundred,[6.3,7,6.7,5.7][i]);let frame=0;while(e.state!=='finished'&&frame++<36000)e.update(1/60,e.getAutopilotInput());assert.equal(e.state,'finished');
 assert.equal(audio.getEngineProfile({engineId:motor.id}).pulses.length,[5,4,6,4][i]);
}
for(const [chance,type] of [[.78999,'blue'],[.79,'yellow'],[.88999,'yellow'],[.89,'currency'],[.97999,'currency'],[.98,'car']]){const s=progress.defaults();s.inventory.cases.italy=1;const r=loot.openCase(s,seq(0,chance,0),'italy').rewards[0];assert.equal(r.type==='card'?cards.getCard(r.cardId).rarity:r.type,type);}
const old=progress.defaults();delete old.inventory.cases.italy;delete old.pity.italy;old.credits=12345;const clean=progress.sanitize(old);assert.equal(clean.inventory.cases.italy,0);assert.equal(clean.pity.italy,0);assert.equal(clean.credits,12345);
const dup=progress.defaults();dup.owned.push(ids[0]);dup.inventory.cases.italy=1;const r=loot.openCase(dup,seq(0,.98,0),'italy').rewards[0];assert.ok(r.duplicate);assert.equal(cards.getCard(r.cardId).rarity,'red');
console.log('PASS Italy: four specifications, private engines, tuning, purchases, probability boundaries, all banner guarantee cars, duplicates, save migration, audio and four full Wangan races');
