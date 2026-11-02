'use strict';
const {chromium}=require('C:/Users/admin.AN-12BK/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),{spawn}=require('child_process'),assert=require('assert/strict');
(async()=>{const server=spawn(process.execPath,['tests/qa-server.cjs'],{stdio:'ignore'});let browser;try{
 await new Promise(r=>setTimeout(r,1000));browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 for(const width of [2560,360,320]){
  const page=await browser.newPage({viewport:{width,height:width===2560?1440:800}}),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4181/',{waitUntil:'networkidle'});
  await page.evaluate(()=>{const s=NDProgress.defaults();s.credits=500000;s.settings.reducedMotion=true;localStorage.setItem('neon-drift.garage.v1',JSON.stringify(s));});await page.reload({waitUntil:'networkidle'});
  await page.locator('[data-nav="shop"]:visible').first().click();await page.locator('#shop-section').selectOption('bmw');
  assert.equal(await page.evaluate(()=>NeonDrift.version),'4.4.3');
  for(const id of ['m3-e30','m3-e36','m3-e46']){
   await page.locator(`.bm-models [data-bmw-model="${id}"]`).click();assert.equal(await page.locator(`.bm-models [data-bmw-model="${id}"]`).getAttribute('aria-pressed'),'true');
   for(const img of await page.locator('#bmw-showcase img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Overflow '+width+' '+id);
   assert.equal(await page.locator('.bm-case [data-pity-case=bmw]').count(),1);
   assert.equal(await page.locator('[data-bmw-photo]').count(),6);assert.equal(await page.locator('.bm-chapters article').count(),3);assert.equal(await page.locator('.bm-timeline article').count(),3);
   for(const photo of await page.locator('[data-bmw-photo]').all()){const caption=await photo.getAttribute('data-bmw-caption');await photo.click();await page.locator('#modal-photo').waitFor({state:'visible'});await page.locator('#photo-image').evaluate(el=>el.decode());assert.ok((await page.locator('#photo-title').innerText()).includes(caption));await page.keyboard.press('Escape');}
   if(width===2560||width===320){await page.locator('.bm-gallery').screenshot({path:`artifacts/bmw-gallery-${id}-${width}.png`});await page.locator('.bm-dossier').screenshot({path:`artifacts/bmw-dossier-${id}-${width}.png`});}
   await page.locator('.bm-purchase [data-car-card]').click();await page.locator('#modal-car-card').waitFor({state:'visible'});assert.ok((await page.locator('#car-card-content').innerText()).includes('BMW'));await page.keyboard.press('Escape');
   await page.locator('.bm-purchase details summary').click();assert.ok(await page.locator('.bm-purchase details').evaluate(e=>e.open));
   if(width===2560){await page.locator('.bm-display').screenshot({path:`artifacts/bmw-model-${id}.png`});await page.locator('.bm-purchase [data-exclusive-car]').click();}
  }
  await page.locator('.bm-models [data-bmw-model="m3-e30"]').click();await page.locator('#shop-tabs').scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/bmw-${width}.png`,fullPage:true});
  await page.locator('.bm-case [data-action="buy-case"]').click();const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('neon-drift.garage.v1')));assert.equal((await saved()).inventory.cases.bmw,1);
  await page.locator('.bm-case [data-action="open-case"]').click();await page.locator('#loot-open-case').waitFor({state:'visible'});await page.screenshot({path:`artifacts/bmw-case-sealed-${width}.png`});await page.locator('#loot-open-case').click();await page.waitForTimeout(900);assert.equal((await saved()).inventory.cases.bmw,0);await page.screenshot({path:`artifacts/bmw-case-open-${width}.png`});await page.keyboard.press('Escape');
  if(width===2560){
   await page.locator('.bm-case [data-action="buy-case"]').click();await page.locator('[data-nav="garage"]:visible').first().click();await page.locator('[data-garage-tab="inventory"]:visible').first().click();assert.ok(await page.locator('#bmw-owned-case [data-case="bmw"]').count());assert.ok(await page.locator('#inventory-car-cards [data-car-card^="m3-"]').count());
   await page.locator('[data-nav="shop"]:visible').first().click();await page.locator('#shop-section').selectOption('bmw');
   // Complete the actual ten-case reveal, including the 30th-case guarantee.
   await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('neon-drift.garage.v1'));s.inventory.cases.bmw=10;s.pity.bmw=25;localStorage.setItem('neon-drift.garage.v1',JSON.stringify(s));});await page.reload({waitUntil:'networkidle'});await page.locator('[data-nav="shop"]:visible').first().click();await page.locator('#shop-section').selectOption('bmw');await page.locator('.bm-case [data-action="open-ten-cases"]').click();
   let unsealed=0;for(let steps=0;steps<65;steps++){if(await page.locator('#loot-open-case').isVisible()){await page.locator('#loot-open-case').click();unsealed++;await page.waitForTimeout(850);}else if(await page.locator('#loot-next').isVisible()){await page.locator('#loot-next').click();await page.waitForTimeout(100);}else break;}
   assert.equal(unsealed,10);assert.equal((await saved()).inventory.cases.bmw,0);assert.ok(await page.locator('.batch-summary').isVisible());await page.screenshot({path:'artifacts/bmw-ten-summary.png'});await page.keyboard.press('Escape');
   await page.locator('.bm-models [data-bmw-model="m3-e46"]').click();await page.locator('.bm-purchase [data-exclusive-car]').click();
   await page.locator('[data-garage-tab="engines"]:visible').first().click();assert.equal(await page.locator('#engine-grid [data-engine]').count(),0);await page.locator('[data-garage-tab="workshop"]:visible').first().click();assert.ok(await page.locator('#upgrade-grid .card-slot').count());
   await page.locator('[data-nav="home"]:visible').first().click();await page.locator('#start-race').click();await page.waitForFunction(()=>NeonDrift.getState().racing);assert.equal(await page.evaluate(()=>NeonDrift.getState().car),'m3-e46');await page.waitForTimeout(500);await page.screenshot({path:'artifacts/bmw-race.png'});
  }
  assert.deepEqual(errors,[]);console.log('PASS BMW browser',width,'models, eighteen photos, cards, passport, case and layout'+(width===2560?', three purchases, inventory, ten reveals, tuning and race':''));await page.close();
 }
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
