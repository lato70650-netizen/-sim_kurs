(() => {
'use strict';
const page=document.body.dataset.rulesPage, data=window.SIM_RULES;
if(!data||page===undefined)return;
const key='sim-rules-progress-v1';
let storage=null,temporary=false;
for(const type of ['localStorage','sessionStorage'])try{const s=window[type];s.setItem(key+'-test','1');s.removeItem(key+'-test');storage=s;temporary=type==='sessionStorage';break;}catch{}
let state={completed:0};
try{const s=JSON.parse(storage?.getItem(key)||'null');if(Number.isInteger(s?.completed)&&s.completed>=0&&s.completed<=5)state=s;}catch{}
function warning(){const box=document.getElementById('storage-warning');if(box&&(!storage||temporary)){box.hidden=false;box.textContent=storage?'Отметки сохранятся только в этой вкладке.':'Хранилище недоступно: отметки не сохраняются, поэтому уроки открыты без ограничений.';}}
warning();
const available=i=>!storage||i<=state.completed;
const url=i=>`rules-lesson-${i+1}.html`;
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
window.addEventListener('storage',e=>{if(e.key===key)location.reload();});
if(page==='overview'){
 document.getElementById('rules-progress').textContent=`Завершено ${state.completed} из 5 уроков`;
 document.querySelectorAll('[data-step]').forEach(el=>{const i=Number(el.dataset.step);el.querySelector('.step-state').textContent=i<state.completed?'Завершён · можно повторить':available(i)?'Можно начать':`После урока ${i}`;if(!available(i)){const a=el.querySelector('a');const span=document.createElement('span');span.className='step-link is-locked';span.setAttribute('aria-disabled','true');span.textContent='Пока закрыт';a.replaceWith(span);}});return;
}
const n=Number(page),lesson=data.lessons[n];if(!lesson)return;
const toc=document.getElementById('lesson-links');
data.lessons.forEach((l,i)=>{const li=document.createElement('li'),a=document.createElement(available(i)?'a':'span');a.textContent=`${i+1}. ${l.title}${available(i)?'':' — пока закрыт'}`;if(available(i))a.href=url(i);else{a.className='locked-link';a.setAttribute('aria-disabled','true');}if(i===n)a.setAttribute('aria-current','page');li.append(a);toc.append(li);});
if(!available(n)){document.getElementById('lesson-article').hidden=true;document.getElementById('lesson-locked').hidden=false;return;}
let current=0;
const done=document.getElementById('complete-lesson'),next=document.getElementById('next-question'),feedback=document.getElementById('quiz-feedback'),answers=document.getElementById('rules-answers');
// A previously completed lesson remains traversable while its practice can be repeated.
if(n<state.completed){done.disabled=false;document.getElementById('completion-hint').textContent='Этот урок уже завершён. Можно повторить задание или перейти дальше.';}
function render(focus=false){
 const q=lesson.quiz[current];document.getElementById('question-position').textContent=`Ситуация ${current+1} из ${lesson.quiz.length}`;
 const h=document.getElementById('question-text');h.textContent=q.text;feedback.hidden=true;next.hidden=true;answers.replaceChildren();
 q.options.forEach((option,i)=>{const b=document.createElement('button');b.type='button';b.textContent=option;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>{const correct=i===q.correct;[...answers.children].forEach(x=>{x.classList.remove('answer-wrong','answer-correct');x.setAttribute('aria-pressed',String(x===b));});b.classList.add(correct?'answer-correct':'answer-wrong');feedback.hidden=false;feedback.dataset.correct=String(correct);feedback.textContent=(correct?'Верно. ':'Попробуйте ещё раз. ')+q.explanation;if(correct){[...answers.children].forEach(x=>x.disabled=true);next.hidden=false;next.textContent=current===lesson.quiz.length-1?'Завершить задание':'Следующая ситуация';}});answers.append(b);});
 if(focus){h.focus();}
}
next.addEventListener('click',()=>{if(++current<lesson.quiz.length){render(true);return;}document.getElementById('rules-quiz').hidden=true;document.getElementById('practice-result').hidden=false;document.getElementById('practice-result').querySelector('h3').focus();done.disabled=false;document.getElementById('completion-hint').textContent='Ситуации разобраны. Завершите урок кнопкой ниже; отметка сохранится в этом браузере.';});
document.getElementById('retry-practice').addEventListener('click',()=>{current=0;document.getElementById('rules-quiz').hidden=false;document.getElementById('practice-result').hidden=true;render(true);});
done.addEventListener('click',()=>{state.completed=Math.max(state.completed,n+1);try{storage?.setItem(key,JSON.stringify(state));}catch{storage=null;warning();}location.href=n===4?'./#practice':url(n+1);});
render();
})();
