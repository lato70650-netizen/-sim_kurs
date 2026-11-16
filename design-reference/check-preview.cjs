const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const root = process.env.SIM_TEST_ORIGIN || 'http://127.0.0.1:8125/';
const out = process.env.PREVIEW_OUT || 'design-reference/screenshots';
(async () => {
  fs.mkdirSync(out, {recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
  for (const width of [360,390,768,1024,1440]) {
    const ctx=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'});
    const page=await ctx.newPage();
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    page.on('response', r=>{if(r.url().startsWith(root)&&r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});
    await page.goto(root+'preview-homepage.html',{waitUntil:'load'});
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('.module-card').count(),3,'3 module cards');
    assert.equal(await page.locator('main .module-art img.card-object').count(),3,'3 item images');
    assert.equal(await page.locator('.hero-image').count(),1,'hero exists');
    assert.ok(await page.locator('.hero-image').evaluate(x=>x.complete && x.naturalWidth>0),'hero loads');
    assert.ok(await page.locator('link[href^="preview-homepage.css"]').count(),'preview stylesheet is active');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth+1),'no horizontal overflow at '+width);
    assert.equal(await page.locator('.module-one .module-entry').getAttribute('href'),'introduction.html');
    assert.equal(await page.locator('.module-two .module-entry').getAttribute('href'),'rules.html');
    assert.equal(await page.locator('.module-three button[disabled]').count(),1,'game remains unavailable');
    await page.locator('.module-one .module-program summary').click();
    assert.ok(await page.locator('.module-one .module-program').evaluate(x=>x.open),'details opens');
    await page.locator('.module-one .module-program summary').click();
    if(width===390 || width===1440) {
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:out+'/preview-'+width+'.png',fullPage:true});
    }
    const nav=page.locator('.module-one .module-entry');
    await nav.click();
    assert.ok(page.url().endsWith('/introduction.html'),'module 1 link reaches real page');
    await page.goto(root+'preview-homepage.html');
    await page.locator('.module-two .module-entry').click();
    assert.ok(page.url().endsWith('/rules.html'),'module 2 link reaches real page');
    assert.deepEqual(errors,[],'JS and asset errors');
    console.log('PASS preview '+width+'px: image, cards, no overflow, disclosure, real links, no JS/404');
    await ctx.close();
  }
  await browser.close();
})().catch(e=>{console.error(e); process.exit(1)});
