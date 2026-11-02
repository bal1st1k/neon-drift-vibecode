'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const catalog=require('../catalog.js'),core=require('../engine.js'),shop=require('../shop.js'),loot=require('../loot.js'),progress=require('../progress.js'),cards=require('../tuning-cards.js');
const fresh=()=>progress.defaults(),clone=value=>JSON.parse(JSON.stringify(value)),sequence=(...values)=>()=>values.shift()??0;
for(const [id,weight] of [['jzz30',1560],['jzx90',1450],['jzx81',1470]]){
  const car=catalog.cars.find(c=>c.id===id);assert.deepEqual([car.stockEngineId,car.stockPowerHp,car.weightKg,car.tuningLocked,car.pityOnly],['1jz-gte',180,weight,false,true]);
  for(const file of [car.sprite,car.raceSprite,...shop.getCarOffer(id).photos[id]])assert.ok(fs.existsSync(file),file);
  assert.ok(cards.computeBuild(id,{turbo:1}).powerHp>180);assert.equal(cards.computeBuild(id,{},'k20a').engineId,'k20a');
  assert.equal(cards.computeBuild('ae85',{},'1jz-gte').weightKg,900-189+217);assert.equal(cards.computeBuild('ae85',{},'1jz-gte').powerHp,180);
  assert.ok(!shop.purchaseExclusiveCar(fresh(),id).ok);
  const race=new core.Engine({carId:id,trackId:'irohazaka'});race.state='running';for(let i=0;i<120;i++)race.update(1/60,{throttle:1});assert.ok(Number.isFinite(race.player.speed)&&race.player.speed>0);
}
const motor=catalog.engines.find(e=>e.id==='1jz-gte');assert.equal(motor.weightKg,217);assert.equal(motor.swapAllowed,true);assert.equal(motor.priceBasis,'offer');assert.equal(motor.gamePrice,3750);
console.log('PASS three Toyota specifications, prepared sprites, photos, tuning, swaps, exclusive acquisition and driving');
for(const caseId of Object.keys(shop.specialCases)){
  let save=fresh();save.inventory.cases[caseId]=31;
  for(let i=0;i<29;i++){const result=loot.openCase(save,()=>0,caseId);assert.ok(!result.rewards.some(r=>r.guaranteed));assert.equal(save.pity[caseId],i+1);save=progress.sanitize(clone(save));}
  assert.equal(shop.getPity(save,caseId).remaining,1);const count=save.career.openedCases;
  const other=Object.keys(shop.specialCases).find(id=>id!==caseId);save.pity[other]=17;
  const guarantee=loot.openCase(save,sequence(.499999,0),caseId);assert.equal(guarantee.count,1);assert.equal(guarantee.rewards[0].guaranteed,true);assert.equal(guarantee.rewards[0].pityOutcome,'banner');assert.equal(guarantee.rewards[0].carId,shop.specialCases[caseId].carId);assert.equal(save.pity[caseId],0);assert.equal(save.pity[other],17);assert.equal(save.inventory.cases[caseId],1);assert.equal(save.career.openedCases,count+1);assert.deepEqual(progress.sanitize(clone(save)).lastReward,save.lastReward);
  // The second half is uniform across all three Toyota; duplicates use red parts.
  for(let index=0;index<3;index++){
    const s=fresh();s.inventory.cases[caseId]=2;s.pity[caseId]=29;
    const result=loot.openCase(s,sequence(.5,(index+.5)/3),caseId),r=result.rewards[0];assert.equal(r.carId,shop.pityCars[index]);assert.equal(r.pityOutcome,'toyota');assert.ok(s.owned.includes(r.carId));assert.equal(s.pity[caseId],0);assert.deepEqual(progress.sanitize(clone(s)).lastReward,s.lastReward);
    s.pity[caseId]=29;const duplicate=loot.openCase(s,sequence(.99,(index+.5)/3,0),caseId).rewards[0];assert.equal(duplicate.duplicate,true);assert.equal(cards.getCard(duplicate.cardId).rarity,'red');assert.equal(s.inventory.cards[duplicate.cardId],1);assert.equal(s.owned.filter(id=>id===r.carId).length,1);assert.deepEqual(progress.sanitize(clone(s)).lastReward,s.lastReward);
  }
  const targets=shop.specialCases[caseId].carIds||[shop.specialCases[caseId].carId];
  for(let index=0;index<targets.length;index++){
    const s=fresh();s.inventory.cases[caseId]=1;s.pity[caseId]=29;s.owned.push(targets[index]);const r=loot.openCase(s,sequence(0,(index+.5)/targets.length,0),caseId).rewards[0];assert.equal(r.carId,targets[index]);assert.equal(r.duplicate,true);assert.equal(cards.getCard(r.cardId).rarity,'red');assert.equal(s.pity[caseId],0);
  }
  const early=fresh();early.inventory.cases[caseId]=2;early.pity[caseId]=12;
  const rng=shop.specialCases[caseId].carIds?sequence(0,.999,0):sequence(.999,0);loot.openCase(early,rng,caseId);assert.equal(early.pity[caseId],0);
  // Failed openings must not roll, advance counters or touch inventories.
  const empty=fresh();empty.pity[caseId]=29;const before=clone(empty);assert.equal(loot.openCase(empty,()=>{throw Error('empty case rolled');},caseId).ok,false);assert.deepEqual(empty,before);
}
console.log('PASS all eleven banners: 29 ordinary openings, 30th guarantee, both 50/50 outcomes, every pool car, duplicates, early reset, persistence and independent counters');
{
 const save=fresh();save.inventory.cases.street=90;for(let i=0;i<90;i++)assert.ok(!loot.openCase(save,()=>0,'street').rewards);assert.ok(Object.values(save.pity).every(value=>value===0));assert.equal(shop.getPity(save,'street'),null);
 const invalid=fresh();invalid.pity={s2000:Infinity,brothers:-5,legends:300,'ae86-akina':2.7,'ae86-project-d':'29',street:29};const clean=progress.sanitize(invalid);assert.deepEqual(clean.pity,{s2000:0,'ae86-akina':2,'ae86-project-d':0,legends:29,brothers:0,roadster:0,mercedes:0,blackbird:0,italy:0,mustang:0,bmw:0});
 const legacy=fresh();delete legacy.pity;legacy.credits=98765;legacy.owned.push('is300');const restored=progress.sanitize(legacy);assert.equal(restored.credits,98765);assert.ok(restored.owned.includes('is300'));assert.ok(Object.values(restored.pity).every(v=>v===0));
 const s=fresh();s.pity.s2000=29;s.inventory.cases.s2000=1;loot.openCase(s,sequence(.5,0),'s2000');s.lastReward.pityOutcome='banner';assert.equal(progress.sanitize(s).lastReward,null);
}
console.log('PASS ordinary cases have no pity, migration preserves earned progress, malformed counters are bounded and unrelated guaranteed cars are rejected');
{
 const elements=new Map(),element=()=>({innerHTML:'',textContent:'',hidden:false,classList:{toggle(){}},setAttribute(){}}),save=fresh();save.pity.s2000=29;
 const sandbox={NDCore:core,NDCards:cards,NDShop:shop,NDLoot:loot,document:{querySelector(s){if(!elements.has(s))elements.set(s,element());return elements.get(s);},querySelectorAll(){return [];}}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('garage.js','utf8'),sandbox);
 const ui=Object.create(sandbox.NDUX.Interface.prototype);ui.getSave=()=>save;ui.renderPityShop();const html=elements.get('#pity-showcase').innerHTML;assert.match(html,/Следующий кейс — гарант/);assert.match(html,/jzx81/);assert.doesNotMatch(html,/undefined|NaN/);
 for(const carId of shop.pityCars){const html=ui.rewardMarkup({type:'car',carId,guaranteed:true,pityOutcome:'toyota'});assert.match(html,/edition-badge/);assert.match(html,/ГАРАНТ \/ TOYOTA/);assert.doesNotMatch(html,/NaN|undefined|0,375%/);}
 assert.match(ui.rewardMarkup({type:'car',carId:'s2000',guaranteed:true,pityOutcome:'banner'}),/ГАРАНТ \/ МАШИНА БАННЕРА/);
}
console.log('PASS shop progress, guarantee rules, all Toyota cards, golden badges and banner reward labels render');
