'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../engine.js'),catalog=require('../catalog.js'),cards=require('../tuning-cards.js'),shop=require('../shop.js'),loot=require('../loot.js'),progress=require('../progress.js');
const fresh=()=>progress.defaults(),clone=value=>JSON.parse(JSON.stringify(value));
const roll=(chance,detail=0)=>{let first=true;return()=>first?(first=false,chance):detail;};
let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const atomic=(save,fn)=>{const before=JSON.stringify(save);assert.equal(fn().ok,false);assert.equal(JSON.stringify(save),before);};
check('both editions have the supplied specs, individual prices and real assets',()=>{
  for(const [id,power,weight,engine,price] of [['ae86-akina',150,925,'4ageu',23000],['ae86-project-d',240,890,'trd-4age',54000]]){
    const car=catalog.cars.find(car=>car.id===id);
    assert.equal(car.stockPowerHp,power);assert.equal(car.weightKg,weight);assert.equal(car.stockEngineId,engine);assert.equal(car.price,price);
    assert.equal(car.shopExclusive,true);assert.equal(car.tuningLocked,true);assert.ok(car.edition);
    for(const asset of [car.sprite,car.raceSprite,...Object.values(shop.specialCases[id].assets)])assert.ok(fs.existsSync(path.join(__dirname,'..',asset)),asset);
  }
  assert.equal(catalog.engines.find(e=>e.id==='4ageu').weightKg,123);assert.equal(catalog.engines.find(e=>e.id==='trd-4age').weightKg,100);
});
check('direct purchases charge the confirmed price once and reject invalid or unaffordable cars atomically',()=>{
  for(const offer of shop.takumi){
    const save=fresh();save.credits=offer.carPrice-1;atomic(save,()=>shop.purchaseExclusiveCar(save,offer.carId));
    save.credits=offer.carPrice+123;assert.equal(shop.purchaseExclusiveCar(save,offer.carId).ok,true);assert.equal(save.credits,123);
    atomic(save,()=>shop.purchaseExclusiveCar(save,offer.carId));assert.equal(save.owned.filter(id=>id===offer.carId).length,1);
    atomic(save,()=>shop.purchaseExclusiveCar(save,'ae85'));
  }
});
check('locked editions ignore every engine, upgrade and card in the actual race build',()=>{
  const tune=Object.fromEntries(catalog.upgrades.map(u=>[u.id,3])),equipment=Object.fromEntries(cards.slots.map(s=>[s.id,s.id+'-red']));
  for(const offer of shop.takumi)for(const engine of catalog.engines){
    const stock=catalog.computeBuild(offer.carId),race=new core.Engine({carId:offer.carId,engineId:engine.id,upgrades:tune,cards:equipment});
    assert.deepEqual(cards.computeBuild(offer.carId,tune,engine.id,equipment),stock);
    assert.equal(race.build.powerHp,stock.powerHp);assert.equal(race.build.weightKg,stock.weightKg);assert.equal(race.engineId,stock.engineId);
    assert.ok(Object.values(race.effectiveUpgrades).every(value=>value===0));
  }
  const save=fresh();save.owned.push('ae86-akina','ae86-project-d');save.inventory.cards['turbo-red']=2;
  for(const offer of shop.takumi)atomic(save,()=>loot.equipCard(save,offer.carId,'turbo-red'));
});
check('4A-GEU stays private while the TRD swap costs exactly 12000 and changes mass and power',()=>{
  assert.equal(catalog.engines.find(e=>e.id==='4ageu').swapAllowed,false);
  assert.deepEqual(catalog.computeBuild('ae85',{},'4ageu'),catalog.computeBuild('ae85'));
  const trd=catalog.computeBuild('ae85',{},'trd-4age');assert.equal(trd.powerHp,240);assert.equal(trd.weightKg,900-189+100);
  assert.equal(catalog.getSwapPrice('ae85','trd-4age'),12000);assert.ok(catalog.computeBuild('ae85',{turbo:3},'trd-4age').powerHp>240);
  const save=fresh();save.ownedEngines.ae85.push('4ageu');save.selectedEngines.ae85='4ageu';
  const clean=progress.sanitize(save);assert.ok(!clean.ownedEngines.ae85.includes('4ageu'));assert.equal(clean.selectedEngines.ae85,'3au');
});
check('the two cases use independent inventories and their confirmed prices',()=>{
  const save=fresh();save.credits=3000;
  for(const offer of shop.takumi){assert.equal(shop.purchaseCase(save,offer.caseId).ok,true);assert.equal(save.inventory.cases[offer.caseId],1);}
  assert.equal(save.credits,0);assert.equal(save.inventory.cases.street,0);assert.equal(save.inventory.cases.s2000,0);
  for(const offer of shop.takumi)atomic(save,()=>shop.purchaseCase(save,offer.caseId));
  assert.deepEqual(progress.sanitize(clone(save)).inventory,save.inventory);
});
check('base Akina and Project D odds outside guarantees match 90/8/2 and 91/8/1',()=>{
  for(const offer of shop.takumi){
    const boundary=(offer.blueChance*100+8)/100;
    for(const [chance,type] of [[0,'card'],[offer.blueChance-Number.EPSILON,'card'],[offer.blueChance,'currency'],[boundary-Number.EPSILON,'currency'],[boundary,'car'],[1,'car']]){
      const save=fresh();save.inventory.cases[offer.caseId]=1;const drop=loot.openCase(save,roll(chance),offer.caseId);
      assert.equal(drop.reward.type,type);assert.equal(drop.count,1);assert.deepEqual(progress.sanitize(clone(save)).lastReward,save.lastReward);
    }
    const save=fresh(),counts={card:0,currency:0,car:0};save.inventory.cases[offer.caseId]=10000;
    for(let i=0;i<10000;i++){save.pity[offer.caseId]=0;const reward=loot.openCase(save,roll((i+.5)/10000),offer.caseId).reward;counts[reward.duplicate?'car':reward.type]++;}
    assert.deepEqual(counts,{card:offer.caseId==='ae86-akina'?9000:9100,currency:800,car:offer.caseId==='ae86-akina'?200:100});
    assert.equal(save.owned.filter(id=>id===offer.carId).length,1);assert.equal(save.career.openedCases,10000);
  }
});
check('winning one edition never substitutes the other, and duplicates can grant all red parts',()=>{
  const pool=cards.cards.filter(card=>card.rarity==='red');
  for(const offer of shop.takumi){
    const save=fresh();save.owned.push(shop.takumi.find(other=>other!==offer).carId);save.inventory.cases[offer.caseId]=1;
    assert.equal(loot.openCase(save,roll(.999),offer.caseId).reward.type,'car');
    for(let i=0;i<pool.length;i++){
      save.inventory.cases[offer.caseId]=1;const balance=save.credits;
      const drop=loot.openCase(save,roll(.999,(i+.5)/pool.length),offer.caseId);assert.equal(drop.reward.cardId,pool[i].id);assert.equal(drop.cards.length,1);assert.equal(save.credits,balance);
      assert.deepEqual(progress.sanitize(clone(save)).lastReward,save.lastReward);
    }
  }
});
check('all sixteen money amounts persist without granting cards or a car',()=>{
  for(const offer of shop.takumi)for(let i=0;i<16;i++){
    const save=fresh();save.inventory.cases[offer.caseId]=1;const balance=save.credits;
    const reward=loot.openCase(save,roll(.95,(i+.5)/16),offer.caseId).reward;
    assert.equal(reward.amount,500+i*100);assert.equal(save.credits,balance+reward.amount);assert.deepEqual(save.inventory.cards,{});assert.ok(!save.owned.includes(offer.carId));
    assert.deepEqual(progress.sanitize(clone(save)).lastReward,save.lastReward);
  }
});
check('imports preserve previous progress and both editions while removing forbidden tuning',()=>{
  const save=fresh();save.credits=54321;save.owned.push('ae86','ae86-akina','ae86-project-d');save.inventory.cases={street:4,s2000:3,'ae86-akina':2,'ae86-project-d':1,legends:0,brothers:0,roadster:0};
  for(const offer of shop.takumi){save.upgrades[offer.carId].turbo=3;save.selectedEngines[offer.carId]='2jzgte';save.equippedCards[offer.carId]={turbo:'turbo-red'};}
  const clean=progress.sanitize(clone(save));assert.deepEqual(clean.inventory,{...save.inventory,cases:{...save.inventory.cases,mercedes:0,blackbird:0,italy:0}});assert.equal(clean.credits,54321);assert.deepEqual(clean.owned,save.owned);
  for(const offer of shop.takumi){assert.ok(Object.values(clean.upgrades[offer.carId]).every(v=>v===0));assert.deepEqual(clean.equippedCards[offer.carId],{});assert.equal(clean.selectedEngines[offer.carId],catalog.cars.find(c=>c.id===offer.carId).stockEngineId);}
});
check('shop shows both editions and the dealership exposes them only after ownership',()=>{
  const elements=new Map(),element=()=>({innerHTML:'',textContent:'',hidden:false,classList:{toggle(){}},setAttribute(){}});
  const sandbox={NDCore:core,NDCards:cards,NDShop:shop,NDLoot:loot,document:{querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);}}};
  vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','garage.js'),'utf8'),sandbox);
  const ui=Object.create(sandbox.NDUX.Interface.prototype),save=fresh();Object.assign(ui,{getSave:()=>save,query:'ae86',brand:'all',onlyOwned:false,sort:'ratio',carPage:0});
  ui.renderTakumiShop();const html=elements.get('#takumi-showcase').innerHTML;assert.match(html,/23[\s\u00a0]000/);assert.match(html,/54[\s\u00a0]000/);assert.match(html,/91%/);assert.match(html,/2%/);assert.doesNotMatch(html,/undefined|NaN/);
  ui.renderCars();assert.doesNotMatch(elements.get('#car-grid').innerHTML,/edition-badge/);
  save.owned.push('ae86-akina','ae86-project-d');ui.renderCars();assert.match(elements.get('#car-grid').innerHTML,/edition-badge/);assert.match(elements.get('#car-grid').innerHTML,/Project D Spec/);
  for(const offer of shop.takumi){const reward=ui.rewardMarkup({type:'car',carId:offer.carId});assert.match(reward,new RegExp(offer.label));assert.doesNotMatch(reward,/undefined|NaN/);}
});
check('a win pays 1000 plus at most 150 drift bonus and other places retain their amounts',()=>{
  for(let position=1;position<=4;position++)for(const drift of [0,1e8]){
    const race=new core.Engine();race.rivals.forEach((r,i)=>r.finished=i<position-1);race.driftScore=drift;race._finish();
    assert.equal(race.credits,[1000,250,175,120][position-1]+(drift?150:0));
  }
});
console.log(`\n${passed} Takumi checks passed.`);
