'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const manifest=JSON.parse(fs.readFileSync('docs/source-asset-renames.json','utf8'));
for(const item of manifest){assert.ok(!fs.existsSync(item.old),item.old);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(item.new)).digest('hex'),item.sha256,item.new);}
const catalog=require('../catalog.js'),cards=require('../tuning-cards.js'),shop=require('../shop.js'),tracks=require('../tracks.js'),traffic=require('../traffic.js');
const refs=new Set();const walk=x=>{if(typeof x==='string'&&/^(for promt|assets)\//.test(x))refs.add(x);else if(x&&typeof x==='object')Object.values(x).forEach(walk);};
walk(catalog.cars);walk(cards.cards);walk(shop);walk(tracks);walk(traffic.vehicles);
for(const ref of refs){assert.ok(fs.existsSync(ref),ref);assert.doesNotMatch(path.basename(ref),/generated|gemini|lucid-origin/i);}
console.log(`PASS ${manifest.length} renamed files retain their SHA-256 and ${refs.size} runtime asset paths exist without generator filenames`);
