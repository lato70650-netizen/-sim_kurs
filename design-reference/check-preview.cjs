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

    // Every real course page in the working branch now uses the approved design.
    // Traverse actual routes rather than just isolated visual copies.
    for(const name of [
      'introduction.html','lesson-1.html','lesson-2.html','lesson-3.html','lesson-4.html','lesson-5.html','introduction-quiz.html',
      'rules.html','rules-lesson-1.html','rules-lesson-2.html','rules-lesson-3.html','rules-lesson-4.html','rules-lesson-5.html'
    ]) {
      await page.goto(root+name,{waitUntil:'load'});
      const isOverview=name==='introduction.html'||name==='rules.html';
      const expected=isOverview?'preview-learning.css':'preview-lesson.css';
      assert.equal(await page.locator('link[href^="'+expected+'"]').count(),1,'theme applied '+name);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'real course overflow '+name+' '+width);
      assert.ok(await page.locator('main').count(),'main element '+name);
    }
    // Re-test real module-1 progression, including every answer and completion state.
    await page.goto(root+'introduction.html');
    await page.evaluate(()=>{localStorage.removeItem('sim-introduction-progress-v1')});
    for(let i=1;i<=5;i++){
      await page.goto(root+'lesson-'+i+'.html');
      assert.ok(await page.locator('#lesson-article').isVisible(),'lesson visible '+i);
      await page.locator('#complete-lesson').click();
    }
    await page.goto(root+'introduction-quiz.html');
    assert.ok(await page.locator('#quiz-panel').isVisible(),'quiz unlocked after real five lessons');
    for(const correct of [false,true,false,true,true,false,true,false,true,false]){
      await page.locator('[data-answer='+correct+']').click();
      await page.locator('#next-question').click();
    }
    assert.ok(await page.locator('#quiz-result').isVisible(),'real quiz completed');


    // Lesson 2: all five device explanations are visible without expanding anything.
    await page.goto(root+'lesson-2.html',{waitUntil:'load'});
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('.m1-device-card').count(),5,'five devices present');
    assert.equal(await page.locator('.m1-device-card details').count(),0,'no hidden device accordions');
    assert.equal(await page.locator('.m1-device-card > .m1-device-disclosure').count(),5,'five visible descriptions');
    const scooterCard=page.locator('.m1-device-card').first();
    assert.equal(await scooterCard.locator('.visible-copy p').count(),2,'scooter has the same two-paragraph presentation as peers');
    assert.equal(await scooterCard.locator('.reading-followup').count(),0,'long scooter supplement no longer stretches the first card');
    assert.equal(await page.locator('.m1-scooter-extra .followup-copy').count(),3,'all three scooter supplementary explanations remain in lesson');
    assert.ok(await page.locator('.m1-scooter-extra').isVisible(),'supplement stays visible without extra clicks');

    for(const card of await page.locator('.m1-device-card').all()){
      assert.ok(await card.locator('.visible-copy p').first().isVisible(),'device description is visible');
      const layout=await card.evaluate(el=>{
        const img=el.querySelector('.lesson-scene').getBoundingClientRect();
        const copy=el.querySelector('.m1-device-disclosure').getBoundingClientRect();
        return {imgX:img.x,imgRight:img.right,imgBottom:img.bottom,copyX:copy.x,copyY:copy.y};
      });
      if(width>760)assert.ok(layout.copyX>=layout.imgRight-2,'text beside image at '+width);
      else assert.ok(layout.copyY>=layout.imgBottom-2,'text below image at '+width);
    }

    // Approved layout: title above image+description on the same long card,
    // and green light visible at rest, without requiring mouse hover.
    for(const card of await page.locator('.m1-device-card').all()){
      const geom=await card.evaluate(el=>{
        const heading=el.querySelector(':scope > h2').getBoundingClientRect();
        const figure=el.querySelector(':scope > .lesson-scene').getBoundingClientRect();
        const description=el.querySelector(':scope > .m1-device-disclosure').getBoundingClientRect();
        const css=getComputedStyle(el.querySelector(':scope > .lesson-scene'));
        return {
          headingBottom:heading.bottom,figTop:figure.top,figRight:figure.right,
          figBottom:figure.bottom,textLeft:description.left,textTop:description.top,
          border:css.borderTopColor,shadow:css.boxShadow
        };
      });
      assert.ok(geom.headingBottom<=geom.figTop+2,'device title above picture');
      if(width>760)assert.ok(geom.figRight<=geom.textLeft+2,'long card image left, text right');
      else assert.ok(geom.textTop>=geom.figBottom-2,'mobile description below image');
      assert.ok(/rgb\(1(?:0[0-9]|[1-9][0-9]), 255, (?:9[0-9]|1[0-9][0-9])/.test(geom.shadow),'visible green glow at rest');
    }
    // Five distinct devices share the approved luminous panel treatment; no text hidden.
    const frames=await page.locator('.m1-device-card > .lesson-scene').evaluateAll(elements=>elements.map(el=>{
      const style=getComputedStyle(el);
      const bg=getComputedStyle(el,'::before');
      return {color:style.borderTopColor,width:parseFloat(style.borderTopWidth),
        glow:style.boxShadow,grid:bg.backgroundImage,rect:el.getBoundingClientRect().width};
    }));
    assert.equal(frames.length,5,'five technical image frames');
    for(const frame of frames){
      assert.ok(frame.width>=1 && frame.color!=='rgba(0, 0, 0, 0)','neon frame border is visible: '+JSON.stringify(frame));
      assert.ok(frame.glow.includes('rgb'),'image panel has luminous shadow');
      assert.ok(frame.grid.includes('linear-gradient'),'technical grid rendered within panel');
      assert.ok(frame.rect>100,'image panel visible on screen');
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),'lesson 2 fits screen '+width);
    if(width===390||width===1440){
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:out+'/lesson-2-visible-descriptions-'+width+'.png',fullPage:true});
    }

    // Text improvements must be present without collapsing the device grid.
    await page.goto(root+'lesson-2.html',{waitUntil:'load'});
    const typography=await page.evaluate(()=>{
      const p=document.querySelector('.m1-device-card .visible-copy p');
      const grid=document.querySelector('.m1-device-card');
      const next=p?.nextElementSibling;
      return {
        lineHeight:parseFloat(getComputedStyle(p).lineHeight),
        fontSize:parseFloat(getComputedStyle(p).fontSize),
        paraGap:next?parseFloat(getComputedStyle(next).marginTop):0,
        template:getComputedStyle(grid).gridTemplateColumns,
        count:document.querySelectorAll('.m1-device-card').length
      };
    });
    assert.equal(typography.count,5,'device catalog still has five entries');
    assert.ok(typography.lineHeight/typography.fontSize>=1.7,'comfortable reading line-height');
    assert.ok(typography.paraGap>0,'visible paragraph separation');
    if(width===1440)assert.ok(typography.template.split(' ').length>=2,'desktop retains image and text columns');
    if(width===390)assert.equal(typography.template.split(' ').length,1,'mobile stacks image and text');

    // Cross-course typography: not just lesson 1. Test both modules and the home page.
    for (const entry of [
      {path:'lesson-3.html',section:'.lesson-copy .reading-section:not(.m1-device-card) > h2'},
      {path:'rules-lesson-2.html',section:'.lesson-copy .reading-section:not(.m1-device-card) > h2'}
    ]) {
      await page.goto(root+entry.path,{waitUntil:'load'});
      const readable=await page.locator(entry.section).first().evaluate(el=>{
        const style=getComputedStyle(el);
        return {border:parseFloat(style.borderLeftWidth),color:style.borderLeftColor};
      });
      assert.ok(readable.border>=3,entry.path+' has visible section hierarchy');
      const prose=await page.locator('.lesson-copy .reading-section:not(.m1-device-card) p').first().evaluate(el=>{
        const st=getComputedStyle(el);
        return {font:parseFloat(st.fontSize),leading:parseFloat(st.lineHeight)};
      });
      assert.ok(prose.font>=16 && prose.leading/prose.font>=1.7,entry.path+' has spacious teaching prose');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),entry.path+' does not overflow');
    }
    await page.goto(root+'lesson-2.html',{waitUntil:'load'});
    assert.equal(await page.locator('.m1-device-card').count(),5,'five device cards remain unchanged');
    await page.goto(root+'index.html',{waitUntil:'load'});
    const heroLeading=await page.locator('.hero-content > p').evaluate(el=>{
      const s=getComputedStyle(el);return parseFloat(s.lineHeight)/parseFloat(s.fontSize);
    });
    assert.ok(heroLeading>=1.7,'homepage introductory text is comfortably spaced');
    assert.deepEqual(errors,[],'JS and asset errors');
    console.log('PASS preview '+width+'px: image, cards, no overflow, disclosure, real links, no JS/404');
    await ctx.close();
  }
  await browser.close();
})().catch(e=>{console.error(e); process.exit(1)});
