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
