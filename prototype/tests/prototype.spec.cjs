const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname,'../..');
const baseline = JSON.parse(fs.readFileSync(path.join(root,'prototype/baseline-sha256.json')));
for(const [file,hash] of Object.entries(baseline.files)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),hash,`Existing file changed: ${file}`);
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});const p=await context.newPage();const errors=[],requests=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});p.on('request',r=>requests.push(r.url()));
 await p.goto('http://127.0.0.1:8123/prototype/');await p.evaluate(()=>document.fonts.ready);await p.locator('.hero-image').evaluate(i=>i.decode());
 assert.equal(await p.locator('.module-card').count(),3);assert.equal(await p.locator('.course-link').count(),2);assert.equal(await p.locator('.module-3 .coming').textContent(),'Итоговая игра готовится');
 assert.equal(await p.locator('.module-1 .course-link').getAttribute('href'),'../introduction.html');assert.equal(await p.locator('.module-2 .course-link').getAttribute('href'),'../rules.html');
 assert.equal(await p.locator('#device-description').getAttribute('open'),null);
 await p.screenshot({path:`/workspace/shared/night-prototype-${width}.png`,fullPage:true});
 const devices=await p.evaluate(()=>window.SIM_DEVICE_PREVIEW);
 for(let i=0;i<devices.length;i++){
  await p.locator(`[data-device="${i}"]`).click();assert.equal(await p.locator('#device-title').textContent(),devices[i].name);assert.equal(await p.locator('#device-lead').textContent(),devices[i].paragraphs[0]);
  if(!await p.locator('#device-description').evaluate(x=>x.open))await p.locator('#device-description summary').click();
  assert.deepEqual(await p.locator('#device-full p').allTextContents(),devices[i].paragraphs.slice(1));assert.equal(await p.locator(`[data-device="${i}"]`).getAttribute('aria-pressed'),'true');
 }
 await p.locator('[data-device="0"]').click();await p.locator('#device-description').evaluate(x=>x.scrollIntoView({block:'center',behavior:'instant'}));await p.screenshot({path:`/workspace/shared/night-prototype-open-${width}.png`});
 await p.locator('#device-description summary').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#device-description').evaluate(x=>x.open),false);await p.keyboard.press('Enter');assert.equal(await p.locator('#device-description').evaluate(x=>x.open),true);
 await p.locator('.module-1 .module-program summary').click();assert.equal(await p.locator('.module-1 details').evaluate(x=>x.open),true);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
 assert.equal(await p.evaluate(()=>localStorage.length),0);assert.equal(await p.evaluate(()=>sessionStorage.length),0);assert.ok(!requests.some(x=>/supabase|auth\/v1/.test(x)));assert.deepEqual(errors,[]);
 // Confirm actual existing destinations and heading, without running course completion or auth.
 await p.locator('.module-1 .course-link').click();assert.ok(p.url().endsWith('/introduction.html'));await p.goBack();await p.locator('.module-2 .course-link').click();assert.ok(p.url().endsWith('/rules.html'));
 await context.close();console.log(`PASS ${width}: 3 modules, 5 exact descriptions, pointer/keyboard disclosure, course routes, no storage/auth requests, no overflow or errors`);
}
const c=await browser.newContext({javaScriptEnabled:false});const p=await c.newPage();await p.goto('http://127.0.0.1:8123/prototype/');await p.locator('#device-description summary').click();assert.equal(await p.locator('#device-description').evaluate(x=>x.open),true);assert.equal(await p.locator('.device-picker').isVisible(),false);await c.close();await browser.close();console.log(`PASS no-JS native disclosure; ${Object.keys(baseline.files).length} existing files unchanged`);
})();
