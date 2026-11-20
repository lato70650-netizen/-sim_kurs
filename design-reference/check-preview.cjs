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
    // The published preview landing page must have equal-height launch CTA baselines.
    await page.goto(root+'index.html',{waitUntil:'load'});
    await page.evaluate(()=>document.fonts.ready);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'live landing page has no horizontal overflow '+width);
    const launch=await page.locator('.module-grid .module-entry').evaluateAll(elements=>elements.map(el=>{
      const r=el.getBoundingClientRect();
      return {top:r.top,bottom:r.bottom,height:r.height};
    }));
    assert.equal(launch.length,2,'two landing module launch CTAs');
    if(width>=701){
      assert.ok(Math.abs(launch[0].top-launch[1].top)<=2,'landing launch buttons share a top baseline at '+width+': '+JSON.stringify(launch));
      assert.ok(Math.abs(launch[0].bottom-launch[1].bottom)<=2,'landing launch buttons share bottom baseline at '+width);
    }
    await page.goto(root+'preview-homepage.html',{waitUntil:'load'});


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

    // Semantic editorial formatting across ALL ten lessons: real HTML, not Markdown runtime.
    for(const chapter of [
      'lesson-1.html','lesson-2.html','lesson-3.html','lesson-4.html','lesson-5.html',
      'rules-lesson-1.html','rules-lesson-2.html','rules-lesson-3.html',
      'rules-lesson-4.html','rules-lesson-5.html'
    ]) {
      await page.goto(root+chapter,{waitUntil:'load'});
      const accent=page.locator('.lesson-copy strong');
      assert.ok(await accent.count()>=(chapter==='rules-lesson-2.html'?1:2),'meaningful emphasis available in '+chapter);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no overflow after editorial formatting '+chapter+' '+width);
    }
    // Revisions must highlight whole actionable sentences, not arbitrary slices.
    await page.goto(root+'lesson-2.html',{waitUntil:'load'});
    assert.ok(await page.locator('.m1-device-card').nth(1).locator('.visible-copy strong').first()
      .evaluate(el=>el.textContent.trim().endsWith('падениям.')),
      'gyroboard warning is an entire thought, including its full stop');
    await page.goto(root+'lesson-3.html',{waitUntil:'load'});
    assert.equal(await page.locator('.lesson-copy strong').filter({hasText:'Различия становятся заметны'}).count(),0,
      'generic introductory wording no longer highlighted');
    assert.ok(await page.locator('.lesson-copy strong').filter({hasText:'Не переносите приёмы управления'}).count()===1,
      'real safety takeaway is highlighted instead');
    if(width===1440){
      await page.goto(root+'lesson-3.html',{waitUntil:'load'});
      const emphasis=await page.locator('.lesson-copy .visible-copy strong').first().evaluate(el=>({
        color:getComputedStyle(el).color,weight:getComputedStyle(el).fontWeight
      }));
      assert.equal(emphasis.color,'rgb(189, 234, 247)','emphasis renders in accessible subtle cyan');
      assert.ok(Number(emphasis.weight)>=700,'strong markup visually differentiates learning points');
    }
    await page.goto(root+'preview-homepage.html',{waitUntil:'load'});
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

    // Live introduction overview: three existing device images, vector HUD, no fog.
    await page.goto(root+'introduction.html',{waitUntil:'load'});
    const hero=page.locator('.intro-cover-photo');
    const artwork=hero.locator('.m1-device-group');
    assert.equal(await artwork.locator('img').count(),3,'introduction still has three device images');
    assert.equal(await artwork.locator('svg.overview-hud').count(),1,'tech accents on introduction image panel');
    assert.equal(await artwork.locator('.overview-hud-corners path').count(),4,'all four HUD corners');
    assert.equal(await artwork.locator('.overview-hud-status rect').count(),3,'small HUD status indicators');
    assert.ok(await artwork.evaluate(el=>el.getBoundingClientRect().width>100),'introduction artwork is visible');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'introduction no horizontal overflow '+width);
    if(width===1440){
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.waitForTimeout(120); // allow matchMedia change/reset to finish before moving the cursor
      await page.mouse.move(0,0);
      const rect=await artwork.boundingBox();
      await page.mouse.move(rect.x+rect.width*.25,rect.y+rect.height*.32);
      await page.waitForTimeout(280);
      const first=await artwork.evaluate(el=>({
        position:el.style.getPropertyValue('--holo-x'),
        opacity:getComputedStyle(el,'::after').opacity,
        active:el.classList.contains('is-holo-active')
      }));
      await page.mouse.move(rect.x+rect.width*.74,rect.y+rect.height*.60);
      await page.waitForTimeout(280);
      const second=await artwork.evaluate(el=>({
        position:el.style.getPropertyValue('--holo-x'),
        opacity:getComputedStyle(el,'::after').opacity
      }));
      assert.ok(first.active && first.position && first.position!==second.position,'introduction spotlight follows cursor');
      assert.ok(parseFloat(second.opacity)>.55,'introduction pointer highlight visible');
      const hoverShadow=await hero.evaluate(el=>getComputedStyle(el).boxShadow);
      assert.ok(hoverShadow.includes('135, 255, 96'),'introduction border glowing over artwork');
      await page.mouse.move(0,0);
      await page.waitForTimeout(310);
      const off=await artwork.evaluate(el=>({active:el.classList.contains('is-holo-active'),opacity:getComputedStyle(el,'::after').opacity}));
      assert.ok(!off.active && parseFloat(off.opacity)<.05,'introduction effect fades off outside image');
      await page.emulateMedia({reducedMotion:'reduce'});
    }
    if(width===390||width===1440){
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:out+'/introduction-tech-hud-'+width+'.png',fullPage:true});
    }
    // First lesson: the SAME three object images and tech HUD, no content edits.
    await page.goto(root+'lesson-1.html',{waitUntil:'load'});
    const firstLessonFrame=page.locator('.lesson-copy > .reading-section:first-child .lesson-scene');
    const firstLessonArt=firstLessonFrame.locator('> .m1-device-group');
    assert.equal(await firstLessonArt.locator('img').count(),3,'lesson one still has three devices');
    assert.equal(await firstLessonArt.locator('svg.overview-hud').count(),1,'lesson one approved tech overlay');
    assert.equal(await firstLessonArt.locator('.overview-hud-corners path').count(),4,'lesson one HUD has four corners');
    assert.equal(await firstLessonArt.locator('.overview-hud-status rect').count(),3,'lesson one HUD has indicators');
    assert.equal(await page.locator('.lesson-copy > .reading-section:first-child .visible-copy p').count(),4,'lesson one introduction paragraphs preserved');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'lesson one no horizontal overflow '+width);
    if(width===1440){
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.waitForTimeout(120);
      await page.mouse.move(0,0);
      const r=await firstLessonArt.boundingBox();
      await page.mouse.move(r.x+r.width*.22,r.y+r.height*.31);
      await page.waitForTimeout(285);
      const posA=await firstLessonArt.evaluate(el=>el.style.getPropertyValue('--holo-x'));
      await page.mouse.move(r.x+r.width*.72,r.y+r.height*.57);
      await page.waitForTimeout(285);
      const highlight=await firstLessonArt.evaluate(el=>({pos:el.style.getPropertyValue('--holo-x'),opacity:getComputedStyle(el,'::after').opacity}));
      assert.ok(posA && highlight.pos && posA!==highlight.pos,'lesson one highlight follows the pointer');
      assert.ok(parseFloat(highlight.opacity)>.55,'lesson one pointer reflection visible');
      const neon=await firstLessonFrame.evaluate(el=>getComputedStyle(el).boxShadow);
      assert.ok(neon.includes('135, 255, 96'),'lesson one image frame hover glows');
      await page.mouse.move(0,0);
      await page.waitForTimeout(330);
      const idle=await firstLessonArt.evaluate(el=>({active:el.classList.contains('is-holo-active'),opacity:getComputedStyle(el,'::after').opacity}));
      assert.ok(!idle.active && parseFloat(idle.opacity)<.05,'lesson one stops glowing off the picture');
      await page.emulateMedia({reducedMotion:'reduce'});
    }
    if(width===390 || width===1440){
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:out+'/lesson-1-tech-hud-'+width+'.png',fullPage:true});
    }
    // Lesson 3: approved three-device style, no edits to the actual learning text.
    await page.goto(root+'lesson-3.html',{waitUntil:'load'});
    const lesson3Frame=page.locator('.lesson-copy > .reading-section:first-child .lesson-scene');
    const lesson3Image=lesson3Frame.locator('> .m1-device-group');
    assert.equal(await lesson3Image.locator('img').count(),3,'lesson three retains three source device images');
    assert.equal(await lesson3Image.locator('svg.overview-hud').count(),1,'lesson three HUD present');
    assert.equal(await lesson3Image.locator('.overview-hud-corners path').count(),4,'lesson three has 4 HUD corners');
    assert.equal(await lesson3Image.locator('.overview-hud-status rect').count(),3,'lesson three HUD indicators');
    assert.equal((await lesson3Image.locator('svg.overview-hud text').textContent()).trim(),'SIM / 03');
    assert.equal(await page.locator('.lesson-copy > .reading-section:first-child .visible-copy p').count(),2,'lesson three text paragraphs intact');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'lesson three no overflow '+width);
    if(width===1440){
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.waitForTimeout(120);
      await page.mouse.move(0,0);
      const area=await lesson3Image.boundingBox();
      await page.mouse.move(area.x+area.width*.24,area.y+area.height*.31);
      await page.waitForTimeout(285);
      const oldX=await lesson3Image.evaluate(el=>el.style.getPropertyValue('--holo-x'));
      await page.mouse.move(area.x+area.width*.72,area.y+area.height*.59);
      await page.waitForTimeout(285);
      const moving=await lesson3Image.evaluate(el=>({x:el.style.getPropertyValue('--holo-x'),opacity:getComputedStyle(el,'::after').opacity}));
      assert.ok(oldX && moving.x && oldX!==moving.x,'lesson three spotlight follows the mouse');
      assert.ok(parseFloat(moving.opacity)>.55,'lesson three light reflection appears only over image');
      const frameGlow=await lesson3Frame.evaluate(el=>getComputedStyle(el).boxShadow);
      assert.ok(frameGlow.includes('135, 255, 96'),'lesson three image frame glows on hover');
      await page.locator('.lesson-copy > .reading-section:first-child .visible-copy p').first().hover();
      await page.waitForTimeout(330);
      const reset=await lesson3Image.evaluate(el=>({active:el.classList.contains('is-holo-active'),opacity:getComputedStyle(el,'::after').opacity}));
      assert.ok(!reset.active && parseFloat(reset.opacity)<.05,'lesson three image light disappears when reading text');
      await page.emulateMedia({reducedMotion:'reduce'});
    }
    if(width===390||width===1440){
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:out+'/lesson-3-tech-hud-'+width+'.png',fullPage:true});
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
    // The "Главные части" supplementary panel uses the same quiet technical
    // card and hover-only green frame, without modifying its content.
    const partsCard=page.locator('.m1-scooter-extra > .reading-followup > .followup-copy').first();
    assert.ok(await partsCard.isVisible(),'scooter parts card visible');
    const partsStyle=await partsCard.evaluate(el=>({
      border:getComputedStyle(el).borderTopColor,
      background:getComputedStyle(el).backgroundImage,
      shadow:getComputedStyle(el).boxShadow,
      grid:getComputedStyle(el,'::before').backgroundImage
    }));
    assert.ok(partsStyle.grid.includes('linear-gradient'),'parts card technical grid');
    assert.ok(partsStyle.shadow.includes('rgb'),'parts card depth');
    if(width===1440){
      const before=await partsCard.evaluate(el=>({shadow:getComputedStyle(el).boxShadow,border:getComputedStyle(el).borderColor}));
      await partsCard.hover();
      await page.waitForTimeout(300);
      const after=await partsCard.evaluate(el=>({shadow:getComputedStyle(el).boxShadow,border:getComputedStyle(el).borderColor}));
      assert.equal(after.shadow,before.shadow,'supplementary card must not glow on hover');
      assert.equal(after.border,before.border,'supplementary card border must remain calm on hover');
      await page.mouse.move(0,0);
    }


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
      assert.ok(!geom.shadow.includes('106, 255, 117') && !geom.shadow.includes('135, 255, 96'),'neon border glow is off at rest');
    }
    // All other checks use reduced motion. Enable normal motion explicitly for
    // the fine-pointer tracking test, which is intentionally disabled otherwise.
    if(width===1440)await page.emulateMedia({reducedMotion:'no-preference'});
    // Image frame ONLY triggers neon: reading the text in the larger card stays calm.
    for(const [deviceIndex,card] of (await page.locator('.m1-device-card').all()).entries()){
      const frame=card.locator(':scope > .lesson-scene');
      const frameIdle=await frame.evaluate(el=>getComputedStyle(el).boxShadow);
      assert.ok(!frameIdle.includes('135, 255, 96'),'frame calm without hover');
      const wash=await card.locator('.scene-photo').evaluate(el=>{
        const x=getComputedStyle(el,'::after');
        return {background:x.backgroundImage,filter:x.filter,content:x.content};
      });
      assert.equal(wash.content,'none','no CSS fog or wash on device photo');
      {
        const hud=frame.locator('svg.scooter-hud');
        assert.equal(await hud.count(),1,'vector HUD present on device '+deviceIndex);
        assert.equal(await hud.locator('.scooter-wheel-light').count(),0,'no wheel glow on device '+deviceIndex);
        const plainBackground=await frame.evaluate(el=>getComputedStyle(el).backgroundImage);
        assert.ok(!plainBackground.includes('radial-gradient'),'no green fog on device '+deviceIndex);
        assert.ok(await hud.locator('.scooter-hud-corners path').count()>=3,'technical corner marks on device '+deviceIndex);
        assert.equal(await hud.locator('.scooter-hud-top-status rect').count(),3,'top indicators on device '+deviceIndex);
        assert.equal(await hud.locator('text').textContent(),`SIM / 0${deviceIndex+1}`,'individual device label');
        const geometry=await hud.evaluate(el=>{
          const rect=el.getBoundingClientRect();
          const photo=el.previousElementSibling.getBoundingClientRect();
          return {width:rect.width,height:rect.height,photoWidth:photo.width,photoHeight:photo.height};
        });
        assert.ok(Math.abs(geometry.width-geometry.photoWidth)<2,'HUD fits image width '+deviceIndex);
        assert.ok(Math.abs(geometry.height-geometry.photoHeight)<2,'HUD fits image height '+deviceIndex);
      }
      if(width===1440){
        await frame.hover();
        await page.waitForTimeout(330);
        const active=await frame.evaluate(el=>getComputedStyle(el).boxShadow);
        assert.ok(active.includes('135, 255, 96') || (deviceIndex===0 && active.includes('119, 255, 108')),'border glows when pointing directly at image frame');
        {
          const rect=await frame.boundingBox();
          await page.mouse.move(rect.x+rect.width*.23,rect.y+rect.height*.34);
          await page.waitForTimeout(265);
          const first=await frame.evaluate(el=>({
            x:el.style.getPropertyValue('--holo-x'),opacity:getComputedStyle(el,'::after').opacity,
            content:getComputedStyle(el,'::after').content
          }));
          await page.mouse.move(rect.x+rect.width*.72,rect.y+rect.height*.47);
          await page.waitForTimeout(265);
          const second=await frame.evaluate(el=>({
            x:el.style.getPropertyValue('--holo-x'),opacity:getComputedStyle(el,'::after').opacity
          }));
          assert.ok(first.x && second.x && first.x!==second.x,'scooter reflection follows cursor position');
          assert.ok(parseFloat(second.opacity)>.55 && first.content!=='none','scooter shows original cursor reflection');
        }
        await card.locator('.visible-copy p').first().hover();
        await page.waitForTimeout(330);
        const reading=await frame.evaluate(el=>getComputedStyle(el).boxShadow);
        assert.ok(!reading.includes('135, 255, 96'),'border turns off when reading text in same card');
        {
          const inactive=await frame.evaluate(el=>getComputedStyle(el,'::after').opacity);
          assert.ok(parseFloat(inactive)<.05,'scooter cursor reflection disappears when reading text');
        }
      }
    }
    if(width===1440)await page.emulateMedia({reducedMotion:'reduce'});
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
