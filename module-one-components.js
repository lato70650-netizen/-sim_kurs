(() => {
 'use strict';
 const q = window.SIM_INTRO?.quiz[0];
 if (!q) return;
 const buttons = [...document.querySelectorAll('[data-demo-answer]')];
 const feedback = document.getElementById('quiz-feedback');
 const reset = () => {
  buttons.forEach(b => { b.disabled=false; b.classList.remove('answer-correct','answer-wrong'); b.setAttribute('aria-pressed','false'); });
  feedback.hidden=true;
 };
 buttons.forEach(b => b.addEventListener('click', () => {
  const correct = (b.dataset.demoAnswer === 'true') === q.correct;
  buttons.forEach(x => { x.classList.remove('answer-correct','answer-wrong'); x.setAttribute('aria-pressed',String(x===b)); });
  b.classList.add(correct?'answer-correct':'answer-wrong');
  feedback.dataset.correct=String(correct); feedback.hidden=false;
  feedback.textContent=(correct?'Верно. ':'Попробуйте ещё раз. ')+q.explanation;
  if (correct) buttons.forEach(x=>x.disabled=true);
 }));
 document.getElementById('demo-retry').addEventListener('click',reset);
 reset();
})();
