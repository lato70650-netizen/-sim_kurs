(() => {
  'use strict';
  const page = document.body.dataset.introPage;
  const data = window.SIM_INTRO;
  if (!page || !data) return;
  const chapterNavigation = document.querySelector('.lesson-navigation');
  if (chapterNavigation && window.matchMedia('(max-width: 700px)').matches) chapterNavigation.open = false;
  const key = 'sim-introduction-progress-v1';
  window.addEventListener('pageshow', (event) => { if (event.persisted) window.location.reload(); });
  window.addEventListener('storage', (event) => { if (page === 'overview' && event.key === key) window.location.reload(); });
  let storage = null;
  let temporary = false;
  for (const name of ['localStorage', 'sessionStorage']) {
    try {
      const candidate = window[name];
      candidate.setItem(key + '-test', '1');
      candidate.removeItem(key + '-test');
      storage = candidate;
      temporary = name === 'sessionStorage';
      break;
    } catch { /* Lessons remain available even when browser storage is blocked. */ }
  }
  let state = { completed: 0, quizComplete: false };
  try {
    const saved = JSON.parse(storage?.getItem(key) || 'null');
    if (saved && Number.isInteger(saved.completed) && saved.completed >= 0 && saved.completed <= 5) {
      state.completed = saved.completed;
      state.quizComplete = saved.completed === 5 && saved.quizComplete === true;
    }
  } catch { /* A corrupt record must not break the course. */ }
  function warning() {
    const text = !storage ? 'Хранилище браузера недоступно. Отметки не сохраняются, поэтому уроки открыты без ограничений.' : temporary ? 'Отметки сохранятся только в этой вкладке. Чтобы продолжить позже, разрешите браузеру хранить данные сайта.' : '';
    const box = document.getElementById('storage-warning');
    if (box && text) { box.hidden = false; box.textContent = text; }
  }
  function save() {
    try { storage?.setItem(key, JSON.stringify(state)); }
    catch { storage = null; warning(); }
  }
  const url = (i) => i < 5 ? `lesson-${i + 1}.html` : 'introduction-quiz.html';
  const isAvailable = (i) => !storage || i <= state.completed;
  const titles = [...data.lessons, 'Различаем транспорт'];
  warning();
  const toc = document.getElementById('lesson-links');
  if (toc) titles.forEach((title, i) => {
    const li = document.createElement('li');
    const item = document.createElement(isAvailable(i) ? 'a' : 'span');
    if (isAvailable(i)) item.href = url(i);
    else { item.className = 'locked-link'; item.setAttribute('aria-disabled', 'true'); }
    if (Number(page) === i) item.setAttribute('aria-current', 'page');
    const index = document.createElement('span'); index.className = 'toc-index'; index.textContent = String(i + 1).padStart(2, '0'); index.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.textContent = title + (isAvailable(i) ? '' : ' — пока закрыт');
    item.append(index, label); li.append(item); toc.append(li);
  });
  if (page === 'overview') {
    const done = state.completed + (state.quizComplete ? 1 : 0);
    document.getElementById('intro-progress').textContent = `Завершено ${done} из 6 шагов`;
    const resume = document.getElementById('continue-intro');
    resume.href = url(state.completed);
    resume.firstChild.textContent = state.quizComplete ? 'Повторить задание ' : state.completed ? 'Продолжить знакомство ' : 'Начать знакомство ';
    document.querySelectorAll('[data-step]').forEach((item) => {
      const i = Number(item.dataset.step);
      const available = isAvailable(i);
      const link = item.querySelector('.step-link');
      const completed = i < state.completed || (i === 5 && state.quizComplete);
      item.querySelector('.step-state').textContent = completed ? 'Завершён · можно повторить' : available ? 'Можно начать' : `После ${i === 5 ? 'урока 5' : 'урока ' + i}`;
      if (!available) {
        const locked = document.createElement('span');
        locked.className = 'step-link is-locked'; locked.textContent = 'Пока закрыт'; locked.setAttribute('aria-disabled', 'true'); link.replaceWith(locked);
      }
    });
    return;
  }
  const number = Number(page);
  const article = document.getElementById('lesson-article');
  if (!isAvailable(number)) {
    article.hidden = true;
    document.getElementById('lesson-locked').hidden = false;
    return;
  }
  if (number < 5) {
    document.getElementById('complete-lesson').addEventListener('click', () => {
      state.completed = Math.max(state.completed, number + 1);
      save();
      window.location.href = url(number + 1);
    });
    return;
  }
  let current = 0;
  const answers = [...document.querySelectorAll('[data-answer]')];
  const feedback = document.getElementById('quiz-feedback');
  const next = document.getElementById('next-question');
  function renderQuestion(focus = false) {
    const q = data.quiz[current];
    document.getElementById('question-position').textContent = `Пример ${current + 1} из ${data.quiz.length}`;
    const heading = document.getElementById('question-text'); heading.textContent = q.text;
    feedback.hidden = true; feedback.textContent = ''; next.hidden = true;
    next.textContent = current === data.quiz.length - 1 ? 'Завершить знакомство' : 'Следующий пример';
    answers.forEach(b => { b.disabled = false; });
    if (focus) heading.focus({ preventScroll: true });
  }
  answers.forEach(button => button.addEventListener('click', () => {
    const q = data.quiz[current];
    const correct = (button.dataset.answer === 'true') === q.correct;
    feedback.hidden = false; feedback.dataset.correct = String(correct);
    feedback.textContent = correct ? `Верно. ${q.explanation}` : `Попробуйте ещё раз. ${q.explanation}`;
    if (correct) { answers.forEach(b => { b.disabled = true; }); next.hidden = false; }
  }));
  next.addEventListener('click', () => {
    current++;
    if (current < data.quiz.length) { renderQuestion(true); return; }
    state.completed = 5; state.quizComplete = true; save();
    document.getElementById('quiz-panel').hidden = true;
    document.getElementById('quiz-summary').textContent = data.summary;
    const result = document.getElementById('quiz-result'); result.hidden = false;
    result.querySelector('h2').focus({ preventScroll: true });
  });
  document.getElementById('retry-quiz').addEventListener('click', () => {
    current = 0; document.getElementById('quiz-result').hidden = true;
    document.getElementById('quiz-panel').hidden = false; renderQuestion(true);
  });
  renderQuestion();
})();
