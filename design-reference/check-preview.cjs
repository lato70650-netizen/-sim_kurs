const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const root = process.env.SIM_TEST_ORIGIN || 'http://127.0.0.1:8125/';
const out = process.env.PREVIEW_OUT || 'design-reference/screenshots';
(async () => {
  fs.mkdirSync(out, {recursive:true});
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
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

    const visibleControl=await page.locator('.hero .primary').evaluate(button=>{
      const r=button.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      return hit===button||button.contains(hit);
    });
    assert.ok(visibleControl,'hero start button must not be covered by overlay at '+width);
    const noCollision=await page.locator('.module-three').evaluate(card=>{
      const a=card.querySelector('.module-task').getBoundingClientRect();
      const b=card.querySelector('.coming').getBoundingClientRect();
      return a.bottom <= b.top+1;
    });
    assert.ok(noCollision,'module 3 task and coming notice must not overlap at '+width);
    if(width>700){
      const gap=await page.evaluate(()=>{
        const foot=document.querySelector('.hero-foot').getBoundingClientRect();
        const heading=document.querySelector('.section-heading').getBoundingClientRect();
        return heading.top-foot.bottom;
      });
      assert.ok(gap>=2,'hero status and section title overlap at '+width+': '+gap);
    }

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

    // Separate, non-published module overview previews retain real lesson destinations.
    for(const [preview,selector,destination] of [
      ['preview-introduction.html','#continue-intro','lesson-1.html'],
      ['preview-rules.html','.intro-cover .button','rules-lesson-1.html']
    ]) {
      await page.goto(root+preview,{waitUntil:'load'});
      await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.locator('link[href^="preview-learning.css"]').count(),1,'shared preview style loaded');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no overview overflow '+preview+' '+width);
      assert.ok(await page.locator('.intro-cover h1').isVisible(),'title exists '+preview);
      if(width===390||width===1440) {
        await page.evaluate(()=>scrollTo(0,0));
        await page.screenshot({path:out+'/'+preview.replace('.html','')+'-'+width+'.png',fullPage:true});
      }
      await page.locator(selector).click();
      assert.ok(page.url().endsWith('/'+destination),'real lesson routing '+preview);
    }

    // Isolated lesson and assessment previews must preserve the real learning flow.
    for(const preview of ['preview-lesson-1.html','preview-rules-lesson-1.html']){
      await page.goto(root+preview,{waitUntil:'load'});
      await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.locator('link[href^="preview-lesson.css"]').count(),1,'preview lesson style loaded '+preview);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'lesson overflow '+preview+' '+width);
      assert.ok(await page.locator('#lesson-article h1').isVisible(),'lesson title '+preview);
      if(width===390||width===1440){
        await page.evaluate(()=>scrollTo(0,0));
        await page.screenshot({path:out+'/'+preview.replace('.html','')+'-'+width+'.png',fullPage:true});
      }
    }
    await page.goto(root+'preview-introduction-quiz.html',{waitUntil:'load'});
    await page.evaluate(()=>localStorage.setItem('sim-introduction-progress-v1',JSON.stringify({completed:5,quizComplete:false})));
    await page.reload();
    assert.equal(await page.locator('link[href^="preview-lesson.css"]').count(),1,'quiz style applied');
    assert.ok(await page.locator('#quiz-panel').isVisible(),'unlocked quiz visible');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'quiz overflow '+width);
    if(width===390||width===1440){
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:out+'/preview-introduction-quiz-'+width+'.png',fullPage:true});
    }
    await page.locator('.quiz-choices button[data-answer=true]').click();
    assert.ok(await page.locator('#quiz-feedback').isVisible(),'feedback visible after answer');
    if(width===390||width===1440){
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:out+'/preview-quiz-feedback-'+width+'.png',fullPage:true});
    }
    assert.deepEqual(errors,[],'JS and asset errors');
    console.log('PASS preview '+width+'px: image, cards, no overflow, disclosure, real links, no JS/404');
    await ctx.close();
  }
  await browser.close();
})().catch(e=>{console.error(e); process.exit(1)});
