'use strict';
const {chromium}=require(process.env.ND_PLAYWRIGHT_PACKAGE||'C:/Users/admin.AN-12BK/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {spawn}=require('node:child_process');
(async()=>{
 const server=spawn(process.execPath,['tests/qa-server.cjs'],{stdio:'ignore'});
 let browser;
 try{
  await new Promise(r=>setTimeout(r,1500));
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  if(process.argv.includes('--blackbird')){
   for(const width of [2560,360,320]){
    const page=await browser.newPage({viewport:{width,height:width===2560?1440:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4181/',{waitUntil:'networkidle'});await page.evaluate(()=>{const s=NDProgress.defaults();s.credits=100000;localStorage.setItem('neon-drift.garage.v1',JSON.stringify(s));});await page.reload({waitUntil:'networkidle'});await page.locator('[data-nav="shop"]').first().click();await page.locator('#shop-section').selectOption('blackbird');
    for(const img of await page.locator('#blackbird-showcase img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());}await page.locator('#shop-tabs').scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/blackbird-${width}.png`,fullPage:true});
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Blackbird horizontal overflow '+width);
    if(width===2560){
     await page.locator('.bb-details summary').click();if(!await page.locator('.bb-details details').evaluate(el=>el.open))throw Error('Technical data did not expand');await page.locator('.bb-hero-photo').click();if(!await page.locator('#modal-photo').isVisible())throw Error('Hero photo failed');await page.keyboard.press('Escape');await page.locator('.bb-model [data-car-card]').click();if(!await page.locator('#modal-car-card').isVisible())throw Error('Car card failed');await page.keyboard.press('Escape');
     await page.locator('.bb-model [data-exclusive-car]').click();await page.locator('.bb-case-controls [data-action="buy-case"]').click();await page.locator('.bb-case-controls [data-action="open-case"]').click();await page.locator('#loot-open-case').waitFor();await page.waitForTimeout(250);await page.screenshot({path:'artifacts/blackbird-case-sealed.png'});await page.locator('#loot-open-case').click();await page.waitForTimeout(1100);await page.screenshot({path:'artifacts/blackbird-case-open.png'});
     const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('neon-drift.garage.v1')));if(!save.owned.includes('930-blackbird')||save.inventory.cases.blackbird!==0)throw Error('Blackbird acquisition failed');
     await page.keyboard.press('Escape');await page.locator('.bb-model [data-exclusive-car]').click();await page.locator('[data-garage-tab="engines"]:visible').first().click();if(await page.locator('#engine-grid [data-engine]').count())throw Error('Blackbird swap controls should be absent');await page.locator('[data-garage-tab="workshop"]:visible').first().click();if(!await page.locator('#upgrade-grid .card-slot').count())throw Error('Blackbird tuning is locked');await page.locator('[data-nav="home"]').first().click();await page.locator('#start-race').click();await page.waitForFunction(()=>NeonDrift.getState().racing);await page.waitForTimeout(500);if(await page.evaluate(()=>NeonDrift.getState().car)!=='930-blackbird')throw Error('Incorrect car in race');await page.screenshot({path:'artifacts/blackbird-race.png'});

    }
    if(errors.length)throw Error(errors.join('; '));console.log('PASS Blackbird browser',width,'images, layout, photo/card/technical controls and acquisition');await page.close();
   }return;
  }
  if(process.argv.includes('--shop-picker')){
   for(const width of [2560,360,320]){
    const page=await browser.newPage({viewport:{width,height:width===2560?1440:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4181/',{waitUntil:'networkidle'});await page.locator('[data-nav="shop"]').first().click();
    const options=await page.locator('#shop-section option').evaluateAll(items=>items.map(item=>item.value));
    for(const value of options){await page.locator('#shop-section').selectOption(value);const active=await page.locator('[data-shop-panel]:visible').evaluateAll(items=>items.map(item=>item.dataset.shopPanel));if(active.length!==1||active[0]!==value)throw Error('Incorrect selected panel '+value);}
    await page.locator('#shop-section').selectOption('mercedes');await page.locator('#shop-tabs').scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/shop-picker-${width}.png`});
    const before=await page.locator('#shop-tabs').boundingBox();await page.evaluate(()=>{for(let i=0;i<30;i++){document.querySelector('#shop-section').add(new Option('Новая коллекция автомобилей '+i,'future-'+i));const panel=document.createElement('section');panel.dataset.shopPanel='future-'+i;panel.hidden=true;document.querySelector('#view-shop').append(panel);}});await page.locator('#shop-section').selectOption('future-29');const after=await page.locator('#shop-tabs').boundingBox();
    if(Math.abs(before.width-after.width)>1||Math.abs(before.height-after.height)>1)throw Error('Picker grew with more collections');if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow');if(errors.length)throw Error(errors.join('; '));console.log('PASS shop picker',width,'all sections, 30 extra collections, stable size',after.width,after.height);await page.close();
   }return;
  }
  if(process.argv.includes('--assets-only')){
   const refs=new Set(),walk=x=>{if(typeof x==='string'&&/^(for promt|assets)\//.test(x))refs.add(x);else if(x&&typeof x==='object')Object.values(x).forEach(walk);};
   walk(require('../catalog.js').cars);walk(require('../tuning-cards.js').cards);walk(require('../shop.js'));walk(require('../tracks.js'));walk(require('../traffic.js').vehicles);
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4181/',{waitUntil:'networkidle'});
   const missing=await page.evaluate(async urls=>{const failures=[];for(let i=0;i<urls.length;i+=8)await Promise.all(urls.slice(i,i+8).map(async url=>{const r=await fetch('/'+encodeURI(url));if(!r.ok)failures.push({url,status:r.status});else await r.arrayBuffer();}));return failures;},[...refs]);
   if(missing.length||errors.length)throw Error(JSON.stringify({missing,errors}));console.log('PASS',refs.size,'asset URLs load over HTTP in the QA browser; no page errors');await page.close();return;
  }
  for(const [width,height,label] of [[2560,1440,'desktop'],[360,800,'mobile'],[320,800,'narrow']]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:4181/',{waitUntil:'networkidle'});
   await page.locator('[data-nav="shop"]').first().click();await page.locator('#shop-section').selectOption('mercedes');
   for(const img of await page.locator('#mercedes-showcase .mb-image img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());}
   await page.locator('#mercedes-showcase').scrollIntoViewIfNeeded();
   await page.screenshot({path:`artifacts/mercedes-${label}.png`,fullPage:true});
   console.log(label,JSON.stringify({title:await page.locator('#mercedes-showcase h2').innerText(),scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth),width,errors}));
   if(errors.length)throw Error(errors.join('; '));
   if(label==='desktop'){
    await page.locator('[data-mercedes-photo="2"]').click();if(!await page.locator('#modal-photo').isVisible())throw Error('Photo modal did not open');await page.keyboard.press('Escape');
    await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('neon-drift.garage.v1'))||NDProgress.defaults();s.credits=100000;localStorage.setItem('neon-drift.garage.v1',JSON.stringify(s));});await page.reload({waitUntil:'networkidle'});
    await page.locator('[data-nav="shop"]').first().click();await page.locator('#shop-section').selectOption('mercedes');await page.locator('[data-exclusive-car="w201-evo2"]').first().click();
    await page.locator('[data-action="buy-case"][data-case="mercedes"]').click();await page.locator('[data-action="open-case"][data-case="mercedes"]').first().click();await page.locator('#loot-open-case').click();
    console.log('purchase/open',JSON.stringify(await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('neon-drift.garage.v1'));return {owned:s.owned.includes('w201-evo2'),cases:s.inventory.cases.mercedes,pity:s.pity.mercedes};})));
    if(errors.length)throw Error(errors.join('; '));
   }
   await page.close();
  }
  for(const [id,width,height] of [['akagi',2560,1440],['enna-skyline',360,800]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:4181/',{waitUntil:'networkidle'});
   await page.evaluate(id=>{const s=NDProgress.defaults();s.selectedTrack=id;localStorage.setItem('neon-drift.garage.v1',JSON.stringify(s));},id);await page.reload({waitUntil:'networkidle'});
   await page.locator('#start-race').click();await page.waitForFunction(()=>window.NeonDrift.getState().racing);await page.waitForTimeout(3000);
   await page.screenshot({path:`artifacts/${id}-major-night.png`});console.log('race',id,JSON.stringify({state:await page.evaluate(()=>window.NeonDrift.getState()),errors}));if(errors.length)throw Error(errors.join('; '));await page.close();
  }
  for(const id of ['akagi','enna-skyline']){
   const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:4181/tests/roadside-preview.html?track=${id}`,{waitUntil:'networkidle'});
   for(const fraction of ['.25','.50','.75']){await page.locator(`[data-position="${fraction}"]`).click();await page.waitForTimeout(1000);await page.screenshot({path:`artifacts/${id}-${fraction.slice(1)}-night.png`});}
   if(errors.length)throw Error(errors.join('; '));console.log('preview',id,'three sectors, errors:',errors.length);await page.close();
  }
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
