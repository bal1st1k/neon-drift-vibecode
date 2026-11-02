'use strict';
const assert=require('node:assert/strict'),shop=require('../shop.js'),loot=require('../loot.js'),progress=require('../progress.js');
const clone=x=>JSON.parse(JSON.stringify(x)),fresh=()=>progress.defaults();
const rng=seed=>()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
function cleanTime(s){if(s.lastReward)s.lastReward.timestamp=0;if(s.lastDrop)s.lastDrop.timestamp=0;return s;}
for(const caseId of ['street',...Object.keys(shop.specialCases)]){
 const s=fresh();s.inventory.cases[caseId]=20;if(caseId!=='street')s.pity[caseId]=26;
 const sequential=clone(s),rollA=rng(7919),rollB=rng(7919),expected=[],expectedGroups=[];
 for(let i=0;i<10;i++){const r=loot.openCase(sequential,rollA,caseId);const group=r.rewards||r.cards;expected.push(...group);expectedGroups.push(group);}
 const result=loot.openCases(s,rollB,caseId);assert.equal(result.ok,true);assert.equal(result.openedCases,10);assert.equal(result.remaining,10);assert.equal(s.career.openedCases,10);assert.ok(result.count>=10&&result.count<=30);
 assert.deepEqual(result.rewards,expected);assert.deepEqual(cleanTime(s),cleanTime(sequential));
 assert.equal(result.caseRewards.length,10);assert.deepEqual(result.caseRewards,expectedGroups);assert.deepEqual(result.caseRewards.flat(),result.rewards);assert.ok(result.caseRewards.every(group=>group.length>=1&&group.length<=3));
 assert.deepEqual(progress.sanitize(clone(s)).inventory,s.inventory);assert.deepEqual(progress.sanitize(clone(s)).pity,s.pity);
 for(const other of ['street',...Object.keys(shop.specialCases)].filter(id=>id!==caseId))assert.equal(s.inventory.cases[other],0);
 const insufficient=fresh();insufficient.inventory.cases[caseId]=9;const before=clone(insufficient);assert.equal(loot.openCases(insufficient,()=>{throw Error('insufficient batch must not roll');},caseId).ok,false);assert.deepEqual(insufficient,before);
}
console.log('PASS every case opens exactly like ten sequential cases, including guarantees, duplicates, money, cards, saves and independent inventories');
{
 const s=fresh();s.inventory.cases.roadster=10;const before=clone(s);let rolls=0;
 assert.throws(()=>loot.openCases(s,()=>{if(++rolls===7)throw Error('interrupted draw');return .95;},'roadster'),/interrupted draw/);assert.deepEqual(s,before);
 assert.equal(loot.openCases(s,()=>0,'unknown').ok,false);assert.equal(loot.openCases(s,()=>0,'roadster',9).ok,false);assert.deepEqual(s,before);
}
console.log('PASS incomplete, unknown and interrupted batches do not consume cases or mutate the save');
