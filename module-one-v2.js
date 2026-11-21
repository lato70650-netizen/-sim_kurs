(() => {
 'use strict';
 // Presentation only: project the progress text supplied by introduction.js.
 // No learning-state writes, answer handling, route changes, or data changes.
 const text = document.getElementById('intro-progress');
 const bar = document.getElementById('m1-read-progress');
 if (!text || !bar) return;
 const update = () => {
  const match = text.textContent.match(/Завершено (\d+) из (\d+)/);
  if (match) { bar.max = Number(match[2]); bar.value = Number(match[1]); bar.setAttribute('aria-valuetext', text.textContent); }
 };
 new MutationObserver(update).observe(text, { childList: true, characterData: true, subtree: true });
 update();
})();

(() => {
 'use strict';
 // A bounded light/tilt response on artwork only. Reading and controls stay still.
 const media = [...document.querySelectorAll('.m1-device-card .lesson-scene')];
 if (!media.length) return;
 const enabled = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
 const resets = [];
 media.forEach(surface => {
  surface.classList.add('m1-holo-media');
  let frame = 0;
  const reset = () => {
   cancelAnimationFrame(frame); frame = 0;
   surface.classList.remove('is-holo-active');
   ['--holo-rx','--holo-ry','--holo-x','--holo-y'].forEach(name => surface.style.removeProperty(name));
  };
  const move = event => {
   if (!enabled.matches || event.pointerType !== 'mouse') return;
   const bounds = surface.getBoundingClientRect();
   if (!bounds.width || !bounds.height) return;
   const x = Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width));
   const y = Math.max(0,Math.min(1,(event.clientY-bounds.top)/bounds.height));
   cancelAnimationFrame(frame);
   frame = requestAnimationFrame(() => {
    frame = 0;
    if (!enabled.matches || document.hidden) { reset(); return; }
    surface.style.setProperty('--holo-rx',`${((.5-y)*5).toFixed(2)}deg`);
    surface.style.setProperty('--holo-ry',`${((x-.5)*7).toFixed(2)}deg`);
    surface.style.setProperty('--holo-x',`${(x*100).toFixed(1)}%`);
    surface.style.setProperty('--holo-y',`${(y*100).toFixed(1)}%`);
    surface.classList.add('is-holo-active');
   });
  };
  surface.addEventListener('pointerenter',move,{passive:true});
  surface.addEventListener('pointermove',move,{passive:true});
  surface.addEventListener('pointerleave',reset);
  surface.addEventListener('pointercancel',reset);
  resets.push(reset);
 });
 const resetAll = () => resets.forEach(reset => reset());
 enabled.addEventListener('change',resetAll);
 window.addEventListener('blur',resetAll);
 document.addEventListener('visibilitychange',() => { if (document.hidden) resetAll(); });
})();

(() => {
 'use strict';
 const artworkSelector = [
  '#quiz-panel .quiz-image',
  '.m1-device-card > .lesson-scene',
  '.intro-cover-photo > .m1-device-group',
  ':is([data-intro-page="0"], [data-intro-page="2"]) .lesson-copy > .reading-section:first-child .lesson-scene > .m1-device-group'
 ].join(', ');
 const artworkElements = document.querySelectorAll(artworkSelector);
 if (!artworkElements.length) return;
 artworkElements.forEach(artwork => artwork.classList.add('touch-holo-artwork'));
 const reflections = new WeakMap();
 let touch;

 function stopTouch(event) {
  if (!touch || (event && event.pointerId !== touch.id)) return;
  touch.frame.classList.remove('is-touch-lit');
  touch = undefined;
 }

 function moveTouch(event) {
  if (!touch || event.pointerId !== touch.id) return;
  const { x, y, width, height } = touch.artwork.getBoundingClientRect();
  const offsetX = (event.clientX - x) / width;
  const offsetY = (event.clientY - y) / height;
  const inside = offsetX >= 0 && offsetX <= 1 && offsetY >= 0 && offsetY <= 1;
  if (inside) {
   touch.reflection.style.setProperty('--touch-x', `${offsetX * 100}%`);
   touch.reflection.style.setProperty('--touch-y', `${offsetY * 100}%`);
  }
  touch.frame.classList.toggle('is-touch-lit', inside);
 }

 document.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'touch' || !event.isPrimary) return;
  const artwork = event.target.closest('.touch-holo-artwork');
  if (!artwork) return;
  stopTouch();
  let reflection = reflections.get(artwork);
  if (!reflection) {
   reflection = document.createElement('span');
   reflection.className = 'touch-holo-reflection';
   reflection.setAttribute('aria-hidden', 'true');
   artwork.append(reflection);
   reflections.set(artwork, reflection);
  }
  const frame = artwork.closest('.intro-cover-photo, .lesson-scene, .quiz-image');
  touch = { id: event.pointerId, artwork, frame, reflection };
  moveTouch(event);
 }, { passive: true });
 document.addEventListener('pointermove', moveTouch, { passive: true });
 document.addEventListener('pointerup', stopTouch);
 document.addEventListener('pointercancel', stopTouch);
 document.addEventListener('lostpointercapture', stopTouch);
 window.addEventListener('blur', () => stopTouch());
 document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopTouch();
 });
})();
