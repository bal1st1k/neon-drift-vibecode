'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),crypto=require('crypto');
const catalog=require('../catalog.js'),cards=require('../tuning-cards.js'),shop=require('../shop.js'),loot=require('../loot.js'),progress=require('../progress.js'),audio=require('../audio.js'),{Engine}=require('../engine.js');
const ids=shop.bmw.carIds,fresh=()=>progress.defaults(),seq=(...v)=>()=>v.shift()??0;
assert.equal(shop.bmw.casePrice,1500);assert.equal(shop.bmw.carChance,.015);assert.equal(shop.bmw.blueChance+shop.bmw.yellowChance+shop.bmw.currencyChance+shop.bmw.carChance,1);
for(const [i,id] of ids.entries()){
 const car=catalog.cars.find(c=>c.id===id),motor=catalog.engines.find(e=>e.id===car.stockEngineId),s=fresh();
 assert.deepEqual([car.stockPowerHp,car.weightKg,car.price],[[238,1200,46000],[321,1440,39000],[343,1495,49000]][i]);
 assert.deepEqual([motor.powerHp,motor.weightKg,motor.swapAllowed],[[238,152,false],[321,204,false],[343,212,false]][i]);
 assert.equal(car.tuningLocked,false);assert.equal(car.swapLocked,true);assert.equal(car.showcaseId,'bmw-showcase');assert.equal(car.shopExclusive,true);
 assert.equal(cards.computeBuild(id,{},'k20a').engineId,motor.id);assert.equal(cards.computeBuild('ae85',{},motor.id).engineId,'3au');assert.ok(cards.computeBuild(id,{turbo:1}).powerHp>car.stockPowerHp);
 for(const file of [car.sprite,car.raceSprite,...shop.bmw.photos[id],...Object.values(shop.bmw.assets)])assert.ok(fs.existsSync(file),file);
 s.credits=100000;s.pity.bmw=12;assert.ok(shop.purchaseExclusiveCar(s,id).ok);assert.equal(s.credits,100000-car.price);assert.equal(s.pity.bmw,12);assert.ok(!shop.purchaseExclusiveCar(s,id).ok);
 s.inventory.cards['turbo-blue']=1;assert.ok(loot.equipCard(s,id,'turbo-blue').ok);assert.ok(cards.computeBuild(id,{},motor.id,s.equippedCards[id]).powerHp>car.stockPowerHp);
 const v=fresh();v.inventory.cases.bmw=1;v.pity.bmw=9;assert.equal(loot.openCase(v,seq(0,.9851+i*.005),'bmw').rewards[0].carId,id);assert.equal(v.pity.bmw,0);
 const g=fresh();g.inventory.cases.bmw=1;g.pity.bmw=29;const reward=loot.openCase(g,seq(0,(i+.1)/3),'bmw').rewards[0];assert.equal(reward.carId,id);assert.ok(reward.guaranteed);
 const sound=audio.getEngineProfile({engineId:motor.id});assert.equal(sound.pulses.length,[4,6,6][i]);assert.equal(sound.redline,[7250,7600,8000][i]);assert.equal(sound.gears,[5,6,6][i]);
 const e=new Engine({carId:id,trackId:'wangan-east',seed:42});assert.equal(e.performance.stockZeroToHundred,[6.5,5.5,5.1][i]);let frame=0;while(e.state!=='finished'&&frame++<36000)e.update(1/60,e.getAutopilotInput());assert.equal(e.state,'finished');assert.ok(Number.isFinite(e.player.speed));
}
for(const [chance,type] of [[.794999,'blue'],[.795,'yellow'],[.894999,'yellow'],[.895,'currency'],[.984999,'currency'],[.985,'car']]){const s=fresh();s.inventory.cases.bmw=1;const r=loot.openCase(s,seq(0,chance,0),'bmw').rewards[0];assert.equal(r.type==='card'?cards.getCard(r.cardId).rarity:r.type,type);}
for(const [roll,count] of [[0,1],[.34,2],[.999,3]]){const s=fresh();s.inventory.cases.bmw=1;assert.equal(loot.openCase(s,seq(roll),'bmw').count,count);}
const poor=fresh();poor.credits=1499;assert.equal(shop.purchaseCase(poor,'bmw').ok,false);poor.credits=1500;assert.ok(shop.purchaseCase(poor,'bmw').ok);assert.equal(poor.credits,0);assert.equal(poor.inventory.cases.bmw,1);
const old=fresh();delete old.inventory.cases.bmw;delete old.pity.bmw;old.credits=12345;const clean=progress.sanitize(old);assert.equal(clean.inventory.cases.bmw,0);assert.equal(clean.pity.bmw,0);assert.equal(clean.credits,12345);assert.deepEqual(clean.owned,old.owned);
const dup=fresh();dup.owned.push(ids[0]);dup.inventory.cases.bmw=1;const r=loot.openCase(dup,seq(0,.985,0),'bmw').rewards[0];assert.ok(r.duplicate);assert.equal(cards.getCard(r.cardId).rarity,'red');
const bulk=fresh();bulk.inventory.cases.bmw=10;bulk.pity.bmw=25;const ten=loot.openCases(bulk,()=>0,'bmw',10);assert.ok(ten.ok);assert.equal(ten.caseRewards.length,10);assert.ok(ten.caseRewards[4][0].guaranteed);assert.equal(bulk.pity.bmw,5);assert.equal(bulk.inventory.cases.bmw,0);assert.deepEqual(progress.sanitize(bulk).owned,bulk.owned);
for(const x of require('../docs/bmw-originals.json'))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(x.file)).digest('hex'),x.sha256,x.file);
console.log('PASS BMW: specs, tuning/equipping, private engines, purchase limits, probability boundaries, 1–3 rewards, all banner cars, pity, duplicate, migration, ten cases, sound, three full Wangan races and four original hashes');
