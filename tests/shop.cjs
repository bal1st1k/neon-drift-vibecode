'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const progress=require('../progress.js'),shop=require('../shop.js'),loot=require('../loot.js'),cards=require('../tuning-cards.js'),core=require('../engine.js');
let passed=0;
function check(name,work){work();passed++;console.log('PASS '+name);}
const fresh=()=>progress.defaults(),clone=value=>JSON.parse(JSON.stringify(value));
function atomic(save,work){const before=JSON.stringify(save);assert.equal(work().ok,false);assert.equal(JSON.stringify(save),before);}
check('all sprint grids spawn rivals on the actual road with distinct non-overlapping positions',()=>{
  for(const track of core.tracks){
    const engine=new core.Engine({trackId:track.id});
    if(engine.track.closed)continue;
    const points=[engine.player,...engine.rivals];
    for(const rival of engine.rivals){
      assert.ok(rival.raceDistance>=24&&rival.raceDistance<engine.track.checkpoints[1].distance,track.id);
      let near={separation:Infinity,distance:0};
      const points=engine.track.points;
      for(let i=0;i<points.length-1;i++){
        const a=points[i],b=points[i+1],dx=b.x-a.x,dy=b.y-a.y;
        const t=Math.max(0,Math.min(1,((rival.x-a.x)*dx+(rival.y-a.y)*dy)/(dx*dx+dy*dy)));
        const separation=Math.hypot(rival.x-a.x-t*dx,rival.y-a.y-t*dy);
        if(separation<near.separation)near={separation,distance:a.distance+engine.track.segmentLengths[i]*t};
      }
      assert.ok(near.separation<engine.track.width/2-12,track.id);
      assert.ok(near.distance>=24,track.id+' must not extrapolate behind the start');
    }
    for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)assert.ok(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>35,track.id);
    assert.equal(engine.position,4);
  }
});
check('each case grants exactly one, two or three independent cards at all count boundaries',()=>{
  for(const [value,count] of [[0,1],[1/3-Number.EPSILON,1],[1/3,2],[2/3-Number.EPSILON,2],[2/3,3],[1,3]]){
    const save=fresh();save.inventory.cases.street=1;let calls=0;
    const result=loot.openCase(save,()=>calls++===0?value:0);
    assert.equal(result.count,count);assert.equal(result.cards.length,count);
    assert.equal(Object.values(save.inventory.cards).reduce((a,b)=>a+b,0),count);
    assert.equal(save.inventory.cases.street,0);assert.equal(save.career.openedCases,1);
    assert.deepEqual(save.lastDrop.cardIds,result.cards.map(card=>card.id));
    assert.deepEqual(progress.sanitize(clone(save)).lastDrop,save.lastDrop);
  }
  const save=fresh();save.inventory.cases.street=1;const values=[.99,0,0,.88,0,.99,0];
  assert.deepEqual(loot.openCase(save,()=>values.shift()).cards.map(card=>card.rarity),['blue','yellow','red']);
});
check('case quantity is uniformly distributed and card odds remain independent of the count',()=>{
  const save=fresh();save.inventory.cases.street=300;const histogram={1:0,2:0,3:0};
  for(let i=0;i<300;i++){let calls=0;const result=loot.openCase(save,()=>calls++===0?(i+.5)/300:.99);histogram[result.count]++;assert.ok(result.cards.every(card=>card.rarity==='red'));}
  assert.deepEqual(histogram,{1:100,2:100,3:100});
});
check('five unique shop offers are stable through renders, reloads and failed purchases',()=>{
  const save=fresh(),stock=shop.getStock(save);
  assert.equal(stock.length,5);assert.equal(new Set(stock.map(item=>item.card.id)).size,5);
  assert.deepEqual(shop.getStock(save),stock);
  assert.deepEqual(shop.getStock(progress.sanitize(clone(save))),stock);
  save.credits=999;atomic(save,()=>shop.purchaseCard(save,stock[0].id));
  atomic(save,()=>shop.purchaseCard(save,'missing'));
  for(const asset of Object.values(shop.assets))assert.ok(fs.existsSync(path.join(__dirname,'..',asset)));
});
check('case purchases cost exactly 500 and never silently open or overfill a case',()=>{
  const save=fresh();save.credits=1000;
  assert.equal(shop.purchaseCase(save).ok,true);assert.equal(save.credits,500);assert.equal(save.inventory.cases.street,1);assert.equal(save.career.openedCases,0);
  assert.equal(shop.purchaseCase(save).ok,true);assert.equal(save.credits,0);assert.equal(save.inventory.cases.street,2);
  atomic(save,()=>shop.purchaseCase(save));save.credits=1000;save.inventory.cases.street=99999;atomic(save,()=>shop.purchaseCase(save));
});
check('each card costs 1000 and a sold offer cannot charge or grant again after a reload',()=>{
  let save=fresh();save.credits=5000;const offer=shop.getStock(save)[0];
  assert.equal(shop.purchaseCard(save,offer.id).ok,true);assert.equal(save.credits,4000);assert.equal(save.inventory.cards[offer.card.id],1);
  atomic(save,()=>shop.purchaseCard(save,offer.id));
  save=progress.sanitize(clone(save));assert.equal(shop.getStock(save)[0].purchased,true);
  atomic(save,()=>shop.purchaseCard(save,offer.id));
});
check('offers refresh only after five completed races and reject stale offer buttons',()=>{
  const save=fresh();save.credits=10000;const initial=shop.getStock(save);shop.purchaseCard(save,initial[0].id);
  for(let races=1;races<=4;races++){save.career.races=races;assert.deepEqual(shop.getStock(save).map(item=>item.card.id),initial.map(item=>item.card.id));assert.equal(shop.getStock(save)[0].purchased,true);assert.equal(shop.remainingRaces(save),5-races);}
  save.career.races=5;shop.ensureStock(save);const next=shop.getStock(save);
  assert.equal(shop.remainingRaces(save),5);assert.ok(next.every(item=>!item.purchased));
  assert.notDeepEqual(next.map(item=>item.card.id),initial.map(item=>item.card.id));
  atomic(save,()=>shop.purchaseCard(save,initial[1].id));
  assert.equal(shop.purchaseCard(save,next[0].id).ok,true);
});
check('old saves gain a valid current shop without losing money, cases, cards or paid parts',()=>{
  const save=fresh();delete save.shop;save.career.races=12;save.credits=9876;save.inventory.cases.street=7;save.inventory.cards['turbo-red']=2;save.upgrades.ae85.tires=3;
  const loaded=progress.sanitize(clone(save));assert.equal(loaded.shop.cycle,2);assert.deepEqual(loaded.shop.purchased,[]);
  assert.equal(loaded.credits,9876);assert.deepEqual(loaded.inventory,save.inventory);assert.equal(loaded.upgrades.ae85.tires,3);
  loaded.shop={cycle:2,purchased:[0,0,-1,5,4,'2']};assert.deepEqual(progress.sanitize(loaded).shop.purchased,[0,4]);
});
check('sealed cases wait for a click, ignore double taps, reveal in order and cancel stale timers',()=>{
  const elements=new Map();let scheduled=null,reveals=0;
  const element=()=>({hidden:false,disabled:false,textContent:'',dataset:{},contains(){return false;},focus(){},children:[],classList:{toggle(){},remove(){},add(){}},set innerHTML(html){this.html=html;this.children=Array.from({length:(html.match(/<span /g)||[]).length},()=>element());},get innerHTML(){return this.html||'';}});
  const sandbox={NDCore:core,NDCards:cards,NDLoot:loot,NDShop:shop,document:{querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);}},setTimeout(fn){scheduled=fn;return 1;},clearTimeout(){scheduled=null;}};
  vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','garage.js'),'utf8'),sandbox);
  const ui=Object.create(sandbox.NDUX.Interface.prototype),save=fresh();ui.getSave=()=>save;ui.onReveal=()=>reveals++;
  const output=['turbo-blue','tires-yellow','weight-red'].map(id=>cards.getCard(id));
  const before=JSON.stringify(save);
  ui.renderReveal(output,'case');assert.equal(elements.get('#loot-reveal-grid').innerHTML,'');assert.equal(scheduled,null);assert.equal(ui.reveal.phase,'sealed');assert.equal(elements.get('#modal-loot').dataset.rewardKind,'parts');
  ui.showNextReveal();assert.equal(ui.reveal.index,-1);
  ui.advanceReveal();const firstTimer=scheduled;assert.ok(firstTimer);assert.equal(ui.reveal.phase,'opening');assert.equal(elements.get('#loot-next').disabled,true);
  ui.advanceReveal();assert.equal(scheduled,firstTimer);assert.equal(reveals,0);
  firstTimer();assert.equal(reveals,1);assert.ok(elements.get('#loot-reveal-grid').innerHTML.includes(output[0].name));assert.ok(!elements.get('#loot-reveal-grid').innerHTML.includes(output[1].name));
  ui.showNextReveal();assert.equal(reveals,2);assert.ok(elements.get('#loot-reveal-grid').innerHTML.includes(output[1].name));
  ui.showNextReveal();assert.equal(reveals,3);assert.ok(elements.get('#loot-next').hidden);ui.showNextReveal();assert.equal(reveals,3);
  assert.equal(JSON.stringify(save),before,'Presentation never changes inventory or money');
  ui.renderReveal(output,'case');ui.advanceReveal();const abandoned=scheduled;ui.cancelReveal();assert.equal(scheduled,null);assert.equal(ui.reveal,null);abandoned();assert.equal(reveals,3);
  ui.renderReveal(output,'case');ui.advanceReveal();const oldTimer=scheduled;ui.renderReveal(output,'case');oldTimer();assert.equal(ui.reveal.index,-1);assert.equal(ui.reveal.phase,'sealed');assert.equal(scheduled,null);
  save.settings.reducedMotion=true;ui.renderReveal(output,'case');assert.equal(ui.reveal.index,-1);ui.advanceReveal();assert.equal(ui.reveal.index,0);assert.equal(scheduled,null);
  save.settings.reducedMotion=false;sandbox.matchMedia=()=>({matches:true});ui.renderReveal(output,'case');ui.advanceReveal();assert.equal(ui.reveal.index,0);assert.equal(scheduled,null);delete sandbox.matchMedia;
  ui.renderReveal(output,'craft');assert.equal(ui.reveal.index,0);assert.equal(elements.get('#loot-stage').hidden,true);
  for(const [rewards,signal] of [[[{type:'currency',amount:800}],'currency'],[[output[0],{type:'currency',amount:800}],'currency'],[[{type:'currency',amount:800},{type:'car',carId:'na6ce'}],'car'],[[{type:'card',cardId:'turbo-red',duplicate:true,carId:'na6ce'}],'car']]){
    ui.renderReveal(rewards,'case','roadster');assert.equal(elements.get('#modal-loot').dataset.rewardKind,signal);assert.equal(ui.reveal.phase,'sealed');assert.equal(scheduled,null);
  }
  const groups=Array.from({length:10},(_,i)=>i===0?[output[0],output[1]]:i===1?[{type:'currency',amount:800}]:i===2?[{type:'car',carId:'na6ce'}]:[output[i%output.length]]),batch=groups.flat(),beforeBatch=reveals;
  ui.renderReveal(batch,'case','roadster',10,groups);assert.equal(ui.reveal.index,-1);assert.equal(scheduled,null);assert.equal(elements.get('#modal-loot').dataset.rewardKind,'car','Keep the overall signal, even while the first case contains parts');assert.match(elements.get('#loot-stage').innerHTML,/ОБЩИЙ СИГНАЛ/);
  let oldCaseTimer;
  for(let caseIndex=0;caseIndex<10;caseIndex++){
    assert.equal(ui.reveal.caseIndex,caseIndex);assert.equal(ui.reveal.phase,'sealed');assert.equal(ui.reveal.index,-1);assert.equal(elements.get('#loot-reveal-grid').innerHTML,'');assert.equal(elements.get('#modal-loot').dataset.rewardKind,'car');
    ui.showBatchReveal();assert.equal(ui.reveal.phase,'sealed','Cannot skip to the summary before finishing the cases');
    ui.advanceReveal();const currentTimer=scheduled;assert.ok(currentTimer);ui.advanceReveal();assert.equal(scheduled,currentTimer);
    if(oldCaseTimer){oldCaseTimer();assert.equal(ui.reveal.index,-1,'A timer from another case cannot reveal this one');}
    currentTimer();oldCaseTimer=currentTimer;
    for(let rewardIndex=0;rewardIndex<groups[caseIndex].length;rewardIndex++){
      assert.equal(ui.reveal.index,rewardIndex);assert.equal(ui.reveal.phase,'revealed');assert.equal(elements.get('#loot-next').hidden,false);assert.match(elements.get('#loot-eyebrow').textContent,new RegExp('КЕЙС '+(caseIndex+1)+' / 10'));
      if(rewardIndex<groups[caseIndex].length-1)ui.advanceReveal();
    }
    assert.doesNotMatch(elements.get('#loot-reveal-grid').innerHTML,/batch-summary/);
    ui.advanceReveal();
  }
  assert.equal(ui.reveal.phase,'summary');assert.equal(reveals-beforeBatch,batch.length);assert.equal(elements.get('#loot-next').hidden,true);assert.equal((elements.get('#loot-reveal-grid').innerHTML.match(/class="batch-reward"/g)||[]).length,batch.length);assert.match(elements.get('#loot-reveal-grid').innerHTML,/batch-summary/);
  const afterBatch=reveals;ui.advanceReveal();assert.equal(reveals,afterBatch);
  save.settings.reducedMotion=true;ui.renderReveal(batch,'case','roadster',10,groups);ui.advanceReveal();assert.equal(ui.reveal.phase,'revealed');assert.equal(ui.reveal.caseIndex,0);ui.advanceReveal();ui.advanceReveal();assert.equal(ui.reveal.phase,'sealed');assert.equal(ui.reveal.caseIndex,1);assert.equal(scheduled,null);
});
console.log(`\n${passed} shop and reward checks passed.`);
