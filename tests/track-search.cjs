'use strict';
const {chromium}=require('C:/Users/admin.AN-12BK/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
(async()=>{
  const server=spawn(process.execPath,['tests/qa-server.cjs'],{stdio:'ignore'});let browser;
  try{
    await new Promise(resolve=>setTimeout(resolve,1000));
    browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
    const page=await browser.newPage({viewport:{width:360,height:800}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:4181/',{waitUntil:'networkidle'});
    const search=page.locator('#track-search');
    await page.locator('[data-track-family="wangan"]').click();
    await search.fill('Акина');
    assert.equal(await page.locator('.track-card').count(),1);
    assert.equal(await page.locator('.track-card').getAttribute('data-track'),'akina');
    assert.equal(await page.locator('#track-format-note').innerText(),'ПОИСК ПО ВСЕМ МАРШРУТАМ');
    assert.equal(await page.locator('[data-track-family="wangan"]').getAttribute('aria-pressed'),'false');
    await search.fill('Usui');
    assert.equal(await page.locator('.track-card').getAttribute('data-track'),'usui');
    await search.fill('');
    assert.equal(await page.locator('.track-card').count(),2);
    assert.equal(await page.locator('[data-track-family="wangan"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-track-family="city"]').click();
    await search.fill('акаги');
    assert.equal(await page.locator('.track-card').getAttribute('data-track'),'akagi');
    assert.deepEqual(errors,[]);
    console.log('PASS Russian and English route search across categories; clearing search restores the selected category');
  }finally{await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
