'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const catalog=require('../catalog.js'),core=require('../engine.js'),cards=require('../tuning-cards.js'),progress=require('../progress.js'),shop=require('../shop.js'),loot=require('../loot.js');
let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const fresh=()=>progress.defaults(),clone=value=>JSON.parse(JSON.stringify(value));
function atomic(save,fn){const before=JSON.stringify(save);assert.equal(fn().ok,false);assert.equal(JSON.stringify(save),before);}
function roll(chance,detail=0){let first=true;return()=>{if(first){first=false;return chance;}return detail;};}
check('S2000 uses the exact supplied specs, exclusive price and real local assets',()=>{
  const car=catalog.cars.find(item=>item.id==='s2000'),engine=catalog.engines.find(item=>item.id==='f20c');
  assert.equal(car.stockPowerHp,250);assert.equal(car.weightKg,1240);assert.equal(car.stockEngineId,'f20c');
  assert.equal(car.price,43000);assert.equal(car.shopExclusive,true);assert.equal(car.tuningLocked,true);
  assert.equal(car.spriteAngle,Math.PI);assert.equal(engine.powerHp,250);assert.equal(engine.weightKg,148);
  for(const asset of [car.sprite,car.raceSprite,...Object.values(shop.s2000.assets)])assert.ok(fs.existsSync(path.join(__dirname,'..',asset)),asset);
});
check('S2000 purchase costs exactly 43000, respects ownership and never charges twice',()=>{
  const save=fresh();save.credits=42999;atomic(save,()=>shop.purchaseS2000(save));save.credits=50000;
  assert.equal(shop.purchaseS2000(save).ok,true);assert.equal(save.credits,7000);assert.ok(save.owned.includes('s2000'));
  atomic(save,()=>shop.purchaseS2000(save));assert.equal(save.owned.filter(id=>id==='s2000').length,1);
  assert.ok(progress.sanitize(clone(save)).owned.includes('s2000'));
});
check('every upgrade, card and foreign engine leaves S2000 in stock form',()=>{
  const stock=catalog.computeBuild('s2000');
  for(const engine of catalog.engines){
    const tune=Object.fromEntries(catalog.upgrades.map(item=>[item.id,3]));
    const equipment=Object.fromEntries(cards.slots.map(slot=>[slot.id,slot.id+'-red']));
    assert.deepEqual(cards.computeBuild('s2000',tune,engine.id,equipment),stock);
    const race=new core.Engine({carId:'s2000',upgrades:tune,engineId:engine.id,cards:equipment});
    assert.equal(race.build.powerHp,250);assert.equal(race.build.weightKg,1240);assert.equal(race.engineId,'f20c');
    assert.ok(Object.values(race.effectiveUpgrades).every(level=>level===0));
  }
  const save=fresh();save.owned.push('s2000');save.inventory.cards['turbo-red']=1;
  atomic(save,()=>loot.equipCard(save,'s2000','turbo-red'));
});
check('F20C can be swapped and tuned in the other cars',()=>{
  const stock=catalog.computeBuild('ae85'),swapped=catalog.computeBuild('ae85',{},'f20c'),tuned=catalog.computeBuild('ae85',{turbo:3},'f20c');
  assert.equal(swapped.engineId,'f20c');assert.equal(swapped.powerHp,250);assert.equal(swapped.weightKg,900-189+148);
  assert.ok(tuned.powerHp>swapped.powerHp);assert.notEqual(stock.powerHp,swapped.powerHp);assert.ok(catalog.getSwapPrice('ae85','f20c')>0);
});
check('import sanitizes forbidden S2000 tuning while preserving other cars and special cases',()=>{
  const save=fresh();save.owned.push('s2000');save.selectedCar='s2000';save.credits=12345;
  save.upgrades.s2000.turbo=3;save.upgrades.ae85.turbo=2;save.selectedEngines.s2000='rb26dett';save.ownedEngines.s2000.push('rb26dett');save.equippedCards.s2000={turbo:'turbo-red'};save.inventory.cases.s2000=3;
  const clean=progress.sanitize(clone(save));assert.equal(clean.credits,12345);assert.equal(clean.inventory.cases.s2000,3);
  assert.equal(clean.selectedEngines.s2000,'f20c');assert.deepEqual(clean.ownedEngines.s2000,['f20c']);assert.deepEqual(clean.equippedCards.s2000,{});
  assert.ok(Object.values(clean.upgrades.s2000).every(level=>level===0));assert.equal(clean.upgrades.ae85.turbo,2);
  assert.deepEqual(progress.sanitize(clone(clean)),clean);
});
check('special case costs 1000 and stays separate from earned Touge cases',()=>{
  const save=fresh();save.credits=1000;
  assert.equal(shop.purchaseCase(save,'s2000').ok,true);assert.equal(save.credits,0);assert.equal(save.inventory.cases.s2000,1);assert.equal(save.inventory.cases.street,0);
  loot.awardCase(save);assert.equal(save.inventory.cases.street,1);assert.equal(save.inventory.cases.s2000,1);
  atomic(save,()=>shop.purchaseCase(save,'s2000'));atomic(save,()=>shop.purchaseCase(save,'missing'));
  const empty=fresh();atomic(empty,()=>loot.openCase(empty,()=>{throw Error('must not roll an empty case');},'s2000'));
});
check('base case odds outside guarantees: boundaries and 10000 draws are exactly 90 / 8 / 2',()=>{
  for(const [chance,type] of [[0,'card'],[.90-Number.EPSILON,'card'],[.90,'currency'],[.98-Number.EPSILON,'currency'],[.98,'car'],[1,'car']]){
    const save=fresh();save.inventory.cases.s2000=1;const drop=loot.openCase(save,roll(chance),'s2000');
    assert.equal(drop.reward.type,type);assert.equal(drop.rewards.length,1);assert.equal(drop.count,1);assert.equal(save.inventory.cases.s2000,0);
    if(type==='card')assert.equal(cards.getCard(drop.reward.cardId).rarity,'blue');
    assert.deepEqual(progress.sanitize(clone(save)).lastReward,save.lastReward);
  }
  const save=fresh();save.inventory.cases.s2000=10000;const counts={card:0,currency:0,car:0};
  for(let i=0;i<10000;i++){save.pity.s2000=0;
    const reward=loot.openCase(save,roll((i+.5)/10000),'s2000').reward;
    counts[reward.duplicate?'car':reward.type]++;
    if(reward.duplicate)assert.equal(cards.getCard(reward.cardId).rarity,'red');
  }
  assert.deepEqual(counts,{card:9000,currency:800,car:200});assert.equal(save.owned.filter(id=>id==='s2000').length,1);assert.equal(save.career.openedCases,10000);
});
check('money drops cover every hundred from 500 through 2000 without adding cards',()=>{
  const amounts=[];
  for(let i=0;i<16;i++){
    const save=fresh();save.inventory.cases.s2000=1;const balance=save.credits;
    const drop=loot.openCase(save,roll(.94,(i+.5)/16),'s2000');amounts.push(drop.reward.amount);
    assert.equal(save.credits,balance+drop.reward.amount);assert.equal(drop.cards.length,0);assert.deepEqual(save.inventory.cards,{});
  }
  assert.deepEqual(amounts,Array.from({length:16},(_,i)=>500+i*100));
});
check('winning a new car unlocks it once; duplicates award one red part without money',()=>{
  let save=fresh();save.inventory.cases.s2000=2;const starting=save.credits;
  const first=loot.openCase(save,roll(.98),'s2000');assert.equal(first.reward.duplicate,false);assert.equal(save.credits,starting);
  save=progress.sanitize(clone(save));const next=loot.openCase(save,roll(.98),'s2000');
  assert.equal(next.reward.type,'card');assert.equal(next.reward.duplicate,true);assert.equal(next.reward.carId,'s2000');assert.equal(next.reward.amount,undefined);
  assert.equal(cards.getCard(next.reward.cardId).rarity,'red');assert.equal(next.cards.length,1);assert.equal(save.inventory.cards[next.reward.cardId],1);
  assert.equal(save.credits,starting);assert.equal(save.owned.filter(id=>id==='s2000').length,1);
  const loaded=progress.sanitize(clone(save));assert.equal(loaded.credits,save.credits);assert.deepEqual(loaded.lastReward,save.lastReward);
  atomic(loaded,()=>loot.openCase(loaded,roll(.98),'s2000'));
});
check('a purchased S2000 substitutes every red part uniformly and keeps rewards on reload',()=>{
  const pool=cards.cards.filter(card=>card.rarity==='red');
  for(let i=0;i<pool.length;i++){
    const save=fresh();save.credits=50000;shop.purchaseS2000(save);save.inventory.cases.s2000=1;
    save.inventory.cards[pool[i].id]=2;const balance=save.credits;
    const drop=loot.openCase(save,roll(.99,(i+.5)/pool.length),'s2000');
    assert.equal(drop.reward.cardId,pool[i].id);assert.equal(save.inventory.cards[pool[i].id],3);assert.equal(save.credits,balance);
    const loaded=progress.sanitize(clone(save));assert.deepEqual(loaded.lastReward,save.lastReward);assert.equal(loaded.inventory.cards[pool[i].id],3);
    assert.equal(loaded.inventory.cases.s2000,0);
  }
});
check('money and new-car rewards render the correct amounts and 2 percent chance',()=>{
  const sandbox={NDCore:core,NDCards:cards,NDLoot:loot,NDShop:shop};vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','garage.js'),'utf8'),sandbox);
  const render=sandbox.NDUX.Interface.prototype.rewardMarkup;
  const money=render({type:'currency',amount:1700});assert.match(money,/currency-reward-art/);assert.match(money,/1[\s\u00a0]700/);
  const car=render({type:'car',carId:'s2000',duplicate:false,amount:0});assert.match(car,/Honda S2000/);assert.match(car,/250 PS/);assert.match(car,/МАШИНА ДОБАВЛЕНА/);
  assert.match(car,/PURPLE SHADOW \/ 2%/);
  for(const html of [money,car])assert.doesNotMatch(html,/undefined|NaN/);
});
check('a duplicate reveal shows its red card and explains the S2000 replacement',()=>{
  const elements=new Map(),element=()=>({hidden:false,disabled:false,textContent:'',dataset:{},contains(){return false;},focus(){},children:[],classList:{toggle(){},remove(){}},innerHTML:''});
  const sandbox={NDCore:core,NDCards:cards,NDLoot:loot,NDShop:shop,document:{querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);}}};
  vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','garage.js'),'utf8'),sandbox);
  const ui=Object.create(sandbox.NDUX.Interface.prototype);ui.revealTimer=null;ui.onReveal=()=>{};ui.getSave=fresh;
  ui.reveal={cards:[{type:'card',cardId:'turbo-red',duplicate:true,carId:'s2000'}],index:-1,kind:'case',caseId:'s2000',phase:'opening',batchCount:1,caseIndex:0};
  ui.showNextReveal();assert.match(elements.get('#loot-reveal-grid').innerHTML,/rarity-red/);
  assert.match(elements.get('#loot-caption').textContent,/вместо повтора.*красная деталь/);assert.equal(elements.get('#loot-next').hidden,true);
});
console.log(`\n${passed} S2000 checks passed.`);
