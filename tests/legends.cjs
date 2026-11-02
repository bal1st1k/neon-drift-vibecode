'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const cat=require('../catalog.js'), shop=require('../shop.js'), loot=require('../loot.js'), progress=require('../progress.js');
const specs=[['fd2',225,1260,31000,false],['nb8c',160,1040,15000,false],['s30',150,1050,39000,false],['z33',280,1440,29000,true]];
for(const [id,hp,kg,price,locked] of specs){const car=cat.cars.find(x=>x.id===id); assert.deepEqual([car.stockPowerHp,car.weightKg,car.price,car.tuningLocked],[hp,kg,price,locked]); for(const f of [car.sprite,car.raceSprite,...shop.legends.photos[id]])assert.ok(fs.existsSync(path.join(__dirname,'..',f)),f); const save=progress.defaults();save.credits=100000;assert.ok(shop.purchaseExclusiveCar(save,id).ok);assert.equal(save.credits,100000-price);assert.equal(cat.computeBuild(id,{turbo:3},'2jzgte').engineId,locked?car.stockEngineId:'2jzgte');}
for(let i=0;i<4;i++){const save=progress.defaults(); save.inventory.cases.legends=1;const seq=[0,.985+(i+.5)*.00375]; const result=loot.openCase(save,()=>seq.shift(),'legends');assert.equal(result.rewards[0].carId,specs[i][0]);assert.ok(save.owned.includes(specs[i][0])); assert.equal(progress.sanitize(save).lastReward.carId,specs[i][0]);}
{const save=progress.defaults();save.inventory.cases.legends=1;const seq=[.99,.986,.986,0,.1,0];const result=loot.openCase(save,()=>seq.shift(),'legends');assert.equal(result.count,3);assert.equal(result.rewards[0].type,'car');assert.equal(result.rewards[1].duplicate,true);assert.equal(result.rewards[2].type,'card');assert.equal(save.owned.filter(x=>x==='fd2').length,1);assert.equal(progress.sanitize(save).inventory.cases.legends,0);}
console.log('PASS legends specs, assets, purchases, tuning, four car drops, duplicates, multiple rewards and save round trip');

const vm=require('node:vm'), core=require('../engine.js'), cards=require('../tuning-cards.js');
const elements=new Map(),element=()=>({innerHTML:'',textContent:'',hidden:false,src:'',classList:{toggle(){}},setAttribute(){}});
const sandbox={NDCore:core,NDCards:cards,NDShop:shop,NDLoot:loot,document:{querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);},querySelectorAll(){return [];}}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','garage.js'),'utf8'),sandbox);
const ui=Object.create(sandbox.NDUX.Interface.prototype), save=progress.defaults();save.owned.push('nb8c','s2000');Object.assign(ui,{getSave:()=>save,inventoryRarity:'all',inventorySlot:'all'});
ui.renderInventory();const ownedHtml=elements.get('#inventory-car-cards').innerHTML;
assert.match(ownedHtml,/data-car-card="nb8c"/);assert.match(ownedHtml,/data-car-card="s2000"/);assert.doesNotMatch(ownedHtml,/data-car-card="z33"/);
assert.match(ui.rewardMarkup({type:'car',carId:'nb8c'}),/class="edition-badge">\[Legends of the Internet\]/);
assert.match(ui.rewardMarkup({type:'car',carId:'nb8c'},true),/class="edition-badge">\[Legends of the Internet\]/);
console.log('PASS owned special-car cards appear in inventory and rewards show their edition badges');
for(const [id,hp,kg] of [['k20a',225,143],['bp-ve',160,130],['l24',150,165]]){
 const engine=cat.engines.find(e=>e.id===id);assert.equal(engine.swapAllowed,true);assert.ok(cat.getSwapPrice('ae85',id)>0);
 const build=cat.computeBuild('ae85',{},id);assert.equal(build.engineId,id);assert.equal(build.powerHp,hp);assert.equal(build.weightKg,900-189+kg);
 assert.ok(cat.computeBuild('ae85',{turbo:1},id).powerHp>hp);
 const imported=progress.defaults();imported.ownedEngines.ae85.push(id);imported.selectedEngines.ae85=id;const restored=progress.sanitize(imported);assert.equal(restored.selectedEngines.ae85,id);assert.ok(restored.ownedEngines.ae85.includes(id));
 ui.renderEngines();assert.ok(elements.get('#engine-grid').innerHTML.includes('data-engine="'+id+'"'));
 for(const locked of ['s2000','z33'])assert.equal(cat.computeBuild(locked,{},id).engineId,cat.cars.find(car=>car.id===locked).stockEngineId);
}
console.log('PASS K20A, BP-VE and L24 swaps change real power and mass, allow tuning, survive reload, and appear in the engine shop');
