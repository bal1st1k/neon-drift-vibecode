'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const catalog=require('../catalog.js'),cards=require('../tuning-cards.js'),shop=require('../shop.js'),loot=require('../loot.js'),progress=require('../progress.js');
const id='w201-evo2',car=catalog.cars.find(c=>c.id===id),motor=catalog.engines.find(e=>e.id===car.stockEngineId),fresh=()=>progress.defaults(),seq=(...a)=>()=>a.shift()??0;
assert.deepEqual([car.stockPowerHp,car.weightKg,car.drivetrain,car.tuningLocked,car.swapLocked],[235,1340,'FR',false,true]);
assert.deepEqual([motor.id,motor.weightKg,motor.swapAllowed],['m102-992',168,false]);
assert.equal(cards.computeBuild(id,{},'k20a').engineId,'m102-992');assert.ok(cards.computeBuild(id,{turbo:1}).powerHp>235);
for(const file of [car.sprite,car.raceSprite,...Object.values(shop.mercedes.assets)])assert.ok(fs.existsSync(file),file);
const s=fresh();s.credits=50000;assert.ok(shop.purchaseExclusiveCar(s,id).ok);assert.equal(s.credits,2000);assert.ok(shop.purchaseCase(s,'mercedes').ok);assert.equal(s.credits,500);
s.selectedCar=id;s.selectedEngines[id]='k20a';s.ownedEngines[id].push('k20a');s.inventory.cards['turbo-blue']=1;assert.ok(loot.equipCard(s,id,'turbo-blue').ok);
const clean=progress.sanitize(s);assert.equal(clean.selectedEngines[id],'m102-992');assert.equal(clean.equippedCards[id].turbo,'turbo-blue');
for(const [chance,type] of [[.79999,'blue'],[.8,'yellow'],[.9,'currency'],[.99,'car']]){const v=fresh();v.inventory.cases.mercedes=1;const r=loot.openCase(v,seq(0,chance,0),'mercedes').rewards[0];assert.equal(r.type==='card'?cards.getCard(r.cardId).rarity:r.type,type);}
const g=fresh();g.inventory.cases.mercedes=1;g.pity.mercedes=29;const result=loot.openCase(g,seq(0,0),'mercedes');assert.equal(result.rewards[0].carId,id);assert.equal(result.rewards[0].guaranteed,true);assert.equal(g.pity.mercedes,0);
console.log('PASS Mercedes specifications, tuning, swap lock, purchase, persistence, case boundaries and guarantee');
const core=require('../engine.js');
for(const id of ['akagi','enna-skyline']){
 const track=core.tracks.find(t=>t.id===id);assert.equal(track.sceneryTheme,id==='akagi'?'akagi-night':'enna-night');assert.equal(track.reworked,true);
 for(const photo of track.referencePhotos)assert.ok(fs.existsSync(photo),photo);
 const race=new core.Engine({carId:'w201-evo2',trackId:id});race.state='running';for(let i=0;i<300;i++)race.update(1/60,{throttle:1});assert.ok(Number.isFinite(race.player.speed));
}
console.log('PASS Akagi and Enna use cached night scenery, have source photos and run a finite driving simulation');
