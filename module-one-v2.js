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
