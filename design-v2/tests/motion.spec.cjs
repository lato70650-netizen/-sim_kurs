const{chromium}=require('playwright'),assert=require('node:assert/strict');
require('node:fs').mkdirSync('/workspace/shared/holo-review',{recursive:true});
const root=process.env.SIM_TEST_ORIGIN||'http://127.0.0.1:8125/';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
for(const kind of ['mouse','reduced','touch']){
 const touch=kind==='touch',c=await b.newContext({viewport:{width:touch?390:1440,height:1000},isMobile:touch,hasTouch:touch,reducedMotion:kind==='reduced'?'reduce':'no-preference'}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(root+'introduction.html');await p.evaluate(()=>localStorage.setItem('sim-introduction-progress-v1',JSON.stringify({completed:1,quizComplete:false})));await p.goto(root+'lesson-2.html');await p.evaluate(()=>document.fonts.ready);
 const card=p.locator('.m1-device-card').first(),surface=card.locator('.lesson-scene'),photo=surface.locator('.scene-photo'),summary=card.locator('summary');await surface.scrollIntoViewIfNeeded();const bounds=await surface.boundingBox(),fixed=await summary.boundingBox();
 await p.mouse.move(bounds.x+bounds.width*.86,bounds.y+bounds.height*.28);await p.waitForTimeout(350);
 if(kind==='mouse'){
  assert.ok(await surface.evaluate(x=>x.classList.contains('is-holo-active')));assert.notEqual(await photo.evaluate(x=>getComputedStyle(x).transform),'none');
  assert.ok(Number(await surface.evaluate(x=>getComputedStyle(x,'::after').opacity))>0);
  const after=await summary.boundingBox();assert.deepEqual(after,fixed,'button must not tilt or shift');
  await p.screenshot({path:'/workspace/shared/holo-review/desktop-active.png'});
  await p.mouse.move(8,8);await p.waitForTimeout(320);assert.equal(await surface.evaluate(x=>x.classList.contains('is-holo-active')),false);
  await p.mouse.move(bounds.x+bounds.width*.2,bounds.y+bounds.height*.6);await p.waitForTimeout(180);await p.emulateMedia({reducedMotion:'reduce'});await p.waitForFunction(()=>!document.querySelector('.is-holo-active'));assert.equal(await surface.evaluate(x=>x.classList.contains('is-holo-active')),false);assert.equal(await photo.evaluate(x=>getComputedStyle(x).transform),'none');
 }else{assert.equal(await surface.evaluate(x=>x.classList.contains('is-holo-active')),false);assert.equal(await photo.evaluate(x=>getComputedStyle(x).transform),'none');await p.screenshot({path:`/workspace/shared/holo-review/${kind}.png`})}
 await summary.focus();await p.keyboard.press('Enter');assert.ok(await card.locator('details').evaluate(x=>x.open));assert.ok(await card.locator('.m1-device-text').isVisible());assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);console.log('PASS',kind,': bounded artwork-only effect, reset/reduced-motion, stationary control, keyboard disclosure, no errors/overflow');await c.close();
}
await b.close();})().catch(e=>{console.error(e);process.exit(1)});
