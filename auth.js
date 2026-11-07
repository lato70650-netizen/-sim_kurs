(() => {
  'use strict';
  // Public browser key only. Authentication is handled by Supabase Auth.
  const client = window.supabase?.createClient(
    'https://vkdszexertrpywykviob.supabase.co',
    'sb_publishable_l_iG4BUwy7AU3tzF72V_TA_TQugUH2g'
  );
  const byId = (id) => document.getElementById(id);
  const dialog = byId('auth-dialog');
  const form = byId('auth-form');
  const email = byId('auth-email');
  const password = byId('auth-password');
  const submit = byId('auth-submit');
  const switchMode = byId('auth-switch');
  const open = byId('auth-open');
  const signout = byId('auth-signout');
  const status = byId('account-status');
  let registering = false;
  let busy = false;

  function message(id, text) {
    byId(id).textContent = text;
    byId(id).hidden = !text;
  }
  function resetMessages() {
    message('auth-error', '');
    message('auth-message', '');
  }
  function renderUser(user) {
    byId('account-email').textContent = user?.email || '';
    byId('account-email').hidden = !user;
    open.hidden = !!user;
    signout.hidden = !user;
  }
  function setBusy(value) {
    busy = value;
    form.setAttribute('aria-busy', String(value));
    [submit, switchMode, byId('auth-close'), email, password, byId('password-visibility')]
      .forEach((control) => { control.disabled = value; });
    submit.textContent = value ? 'Подожди…' : registering ? 'Создать аккаунт' : 'Войти';
  }
  function setMode(value) {
    registering = value;
    resetMessages();
    byId('auth-title').textContent = value ? 'Создать аккаунт' : 'Войти в аккаунт';
    byId('auth-description').textContent = value
      ? 'Укажи email и придумай пароль. После регистрации ты сразу войдёшь в аккаунт.'
      : 'Введи email и пароль, которые указал при регистрации.';
    byId('password-hint').hidden = !value;
    password.autocomplete = value ? 'new-password' : 'current-password';
    password.minLength = value ? 8 : 1;
    password.value = '';
    password.type = 'password';
    byId('password-visibility').textContent = 'Показать';
    byId('password-visibility').setAttribute('aria-pressed', 'false');
    byId('password-visibility').setAttribute('aria-label', 'Показать пароль');
    byId('auth-switch-label').textContent = value ? 'Уже есть аккаунт?' : 'Ещё нет аккаунта?';
    switchMode.textContent = value ? 'Войти' : 'Зарегистрироваться';
    submit.textContent = value ? 'Создать аккаунт' : 'Войти';
  }
  function errorText(error) {
    switch (error.code) {
      case 'invalid_credentials': return 'Неверный email или пароль. Проверь их и попробуй снова.';
      case 'user_already_exists': case 'email_exists': return 'Этот email уже зарегистрирован. Нажми «Войти» и введи пароль.';
      case 'weak_password': return 'Пароль слишком простой. Добавь буквы, цифры и другие символы.';
      case 'email_address_invalid': case 'validation_failed': return 'Проверь email и пароль и попробуй снова.';
      case 'email_not_confirmed': return 'Email ещё не подтверждён. Проверь письмо от сервиса.';
      case 'over_request_rate_limit': case 'over_email_send_rate_limit': return 'Слишком много попыток. Подожди немного и попробуй снова.';
      case 'signup_disabled': return 'Регистрация временно недоступна. Попробуй позже.';
      default: return 'Не удалось подключиться. Проверь интернет и попробуй ещё раз.';
    }
  }
  open.addEventListener('click', () => {
    status.textContent = '';
    setMode(false);
    dialog.showModal();
    if (!client) message('auth-error', 'Сервис входа не загрузился. Обнови страницу и попробуй снова.');
  });
  byId('auth-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => { password.value = ''; open.focus(); });
  switchMode.addEventListener('click', () => { setMode(!registering); email.focus(); });
  byId('password-visibility').addEventListener('click', (event) => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    event.currentTarget.textContent = visible ? 'Скрыть' : 'Показать';
    event.currentTarget.setAttribute('aria-pressed', String(visible));
    event.currentTarget.setAttribute('aria-label', visible ? 'Скрыть пароль' : 'Показать пароль');
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    resetMessages();
    if (!client) {
      message('auth-error', 'Сервис входа не загрузился. Обнови страницу и попробуй снова.');
      return;
    }
    const credentials = { email: email.value.trim(), password: password.value };
    setBusy(true);
    try {
      const { data, error } = registering
        ? await client.auth.signUp(credentials)
        : await client.auth.signInWithPassword(credentials);
      if (error) throw error;
      if (data.session) {
        renderUser(data.session.user);
        status.textContent = registering ? 'Аккаунт создан. Ты вошёл в аккаунт.' : 'Ты вошёл в аккаунт.';
        dialog.close();
        signout.focus();
      } else {
        message('auth-message', 'Проверь почту: если адрес новый, сервис отправил письмо для подтверждения. Если аккаунт уже есть, нажми «Войти».');
      }
    } catch (error) {
      message('auth-error', errorText(error));
    } finally {
      setBusy(false);
    }
  });
  signout.addEventListener('click', async () => {
    if (!client || signout.disabled) return;
    signout.disabled = true;
    status.textContent = '';
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      renderUser(null);
      status.textContent = 'Ты вышел из аккаунта.';
      open.focus();
    } catch {
      status.textContent = 'Не удалось выйти. Проверь интернет и попробуй ещё раз.';
    } finally {
      signout.disabled = false;
    }
  });
  if (client) {
    client.auth.onAuthStateChange((_event, session) => renderUser(session?.user));
    client.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      renderUser(data.session?.user);
    }).catch(() => { status.textContent = 'Не удалось проверить вход. Обнови страницу или войди снова.'; });
  }
})();
