'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const catalog=require('../catalog.js'),core=require('../engine.js'),cards=require('../tuning-cards.js'),shop=require('../shop.js'),loot=require('../loot.js'),progress=require('../progress.js'),audio=require('../audio.js');
const fresh=()=>progress.defaults(),sequence=(...values)=>()=>values.shift()??0,clone=value=>JSON.parse(JSON.stringify(value));
const car=catalog.cars.find(c=>c.id==='na6ce'),motor=catalog.engines.find(e=>e.id==='b6-ze');
assert.deepEqual([car.stockPowerHp,car.weightKg,car.drivetrain,car.tuningLocked,car.shopExclusive,car.price],[116,960,'FR',false,true,12000]);
assert.deepEqual([motor.powerHp,motor.weightKg,motor.swapAllowed,motor.gamePrice],[116,120,true,1450]);
for(const file of [car.sprite,car.raceSprite,...Object.values(shop.roadster.assets)])assert.ok(fs.existsSync(file),file);
assert.equal(fs.readFileSync(car.raceSprite)[25],6);
assert.equal(cards.computeBuild('ae85',{},motor.id).weightKg,900-189+120);
assert.equal(cards.computeBuild('ae85',{},motor.id).powerHp,116);
assert.equal(cards.computeBuild(car.id,{},'k20a').powerHp,225);
assert.ok(cards.computeBuild(car.id,{turbo:1}).powerHp>116);
assert.equal(audio.getEngineProfile({engineId:'b6-ze'}).name,'B6-ZE · Roadster NA');
{
 const s=fresh();s.credits=11999;const before=clone(s);assert.equal(shop.purchaseExclusiveCar(s,car.id).ok,false);assert.deepEqual(s,before);
 s.credits=12000;assert.ok(shop.purchaseExclusiveCar(s,car.id).ok);assert.equal(s.credits,0);assert.ok(!shop.purchaseExclusiveCar(s,car.id).ok);
 s.selectedCar=car.id;s.selectedEngines.na6ce='b6-ze';s.inventory.cards['turbo-blue']=1;assert.ok(loot.equipCard(s,car.id,'turbo-blue').ok);
 const restored=progress.sanitize(clone(s));assert.equal(restored.selectedCar,car.id);assert.equal(restored.equippedCards.na6ce.turbo,'turbo-blue');
 const race=new core.Engine({carId:car.id,engineId:'b6-ze',cards:restored.equippedCards.na6ce});race.state='running';for(let i=0;i<180;i++)race.update(1/60,{throttle:1});assert.ok(race.player.speed>0&&Number.isFinite(race.player.speed));
}
console.log('PASS supplied NA6CE specs, atomic purchase, PNG sprite, B6-ZE audio, tuning, bidirectional swaps, save and driving');
function roll(chance,detail=0){const s=fresh();s.inventory.cases.roadster=1;return {s,r:loot.openCase(s,sequence(0,chance,detail),'roadster').rewards[0]};}
for(const [chance,type] of [[.799999,'blue'],[.8,'yellow'],[.899999,'yellow'],[.9,'currency'],[.989999,'currency'],[.99,'car'],[.999999,'car']]){
 const {s,r}=roll(chance);assert.equal(r.type==='card'?cards.getCard(r.cardId).rarity:r.type,type);assert.deepEqual(progress.sanitize(clone(s)).lastReward,{...s.lastReward,...(r.type==='car'?{duplicate:false,amount:0}:{})});
}
for(let i=0;i<16;i++)assert.equal(roll(.95,(i+.1)/16).r.amount,500+100*i);
{
 const s=fresh();s.inventory.cases.roadster=10000;const counts={blue:0,yellow:0,currency:0,car:0};
 for(let i=0;i<10000;i++){s.pity.roadster=0;s.owned=['ae85'];const r=loot.openCase(s,sequence(0,(i+.5)/10000,0),'roadster').rewards[0];counts[r.type==='card'?cards.getCard(r.cardId).rarity:r.type]++;}
 assert.deepEqual(counts,{blue:8000,yellow:1000,currency:900,car:100});
}
{
 const s=fresh();s.credits=1500;assert.ok(shop.purchaseCase(s,'roadster').ok);assert.equal(s.credits,0);
 const drop=loot.openCase(s,sequence(.999,.999,.999,0,.95,.5),'roadster');assert.equal(drop.count,3);assert.equal(drop.rewards[0].carId,'na6ce');assert.equal(drop.rewards[1].duplicate,true);assert.equal(cards.getCard(drop.rewards[1].cardId).rarity,'red');assert.equal(drop.rewards[2].amount,1300);assert.equal(s.owned.filter(id=>id==='na6ce').length,1);
 assert.deepEqual(progress.sanitize(clone(s)).inventory,s.inventory);
}
{
 const s=fresh();s.inventory.cases.roadster=30;for(let i=0;i<29;i++)loot.openCase(s,()=>0,'roadster');
 const r=loot.openCase(s,sequence(0,0),'roadster');assert.equal(r.count,1);assert.equal(r.rewards[0].guaranteed,true);assert.equal(r.rewards[0].carId,'na6ce');assert.equal(s.pity.roadster,0);
 const legacy=fresh();delete legacy.inventory.cases.roadster;delete legacy.pity.roadster;legacy.credits=98765;const clean=progress.sanitize(legacy);assert.equal(clean.inventory.cases.roadster,0);assert.equal(clean.pity.roadster,0);assert.equal(clean.credits,98765);
}
console.log('PASS exact 80/10/9/1 distribution, boundaries, 1–3 rewards, duplicates, money, independent guarantee and old-save migration');
{
 const elements=new Map(),el=()=>({innerHTML:'',textContent:'',hidden:false,classList:{toggle(){}},setAttribute(){}}),sandbox={NDCore:core,NDCards:cards,NDShop:shop,NDLoot:loot,document:{querySelector(s){if(!elements.has(s))elements.set(s,el());return elements.get(s);},querySelectorAll(){return [];}}};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync('garage.js','utf8'),sandbox);const ui=Object.create(sandbox.NDUX.Interface.prototype);ui.getSave=fresh;ui.renderRoadsterShop();const html=elements.get('#roadster-showcase').innerHTML;
 assert.match(html,/data-exclusive-car="na6ce"/);assert.match(html,/data-case="roadster"/);assert.match(html,/data-roadster-wink/);assert.doesNotMatch(html,/undefined|NaN/);
 const reward=ui.rewardMarkup({type:'car',carId:'na6ce'},true);assert.match(reward,/1%/);assert.match(reward,/rarity-gold/);assert.match(reward,/edition-badge/);
}
console.log('PASS new shop, acquisition controls and golden 1% collection card');
