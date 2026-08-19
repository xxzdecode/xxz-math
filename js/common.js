import {
  hasTeacherSession,
  isTeacherApiConfigured,
  loadTeacherStatus,
  login,
  logout,
  setupTeacherPin
} from './api.js';

function ensureModal() {
  let modal = document.querySelector('#teacherLoginModal');
  if (modal) return modal;
  modal = document.createElement('dialog');
  modal.id = 'teacherLoginModal';
  modal.className = 'teacher-dialog';
  modal.innerHTML = `
    <form method="dialog" class="teacher-login" id="teacherLoginForm">
      <button class="dialog-close" type="button" aria-label="关闭">×</button>
      <p class="eyebrow">教师入口</p>
      <h2>输入 4 位密码</h2>
      <p class="muted">用于查看姐姐和弟弟的私有教学状态。</p>
      <input id="teacherPin" name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="off" aria-label="教师密码" required>
      <input id="teacherPinConfirm" name="pinConfirm" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="off" aria-label="再次输入教师密码" placeholder="再输入一次确认" hidden>
      <p class="form-error" id="teacherLoginError" role="alert"></p>
      <button class="primary-button" id="teacherLoginSubmit" type="submit" value="default">进入老师模式</button>
    </form>`;
  document.body.append(modal);
  modal.querySelector('.dialog-close').addEventListener('click', () => modal.close());
  modal.addEventListener('close', () => {
    modal.querySelector('#teacherPin').value = '';
    modal.querySelector('#teacherPinConfirm').value = '';
    modal.querySelector('#teacherLoginError').textContent = '';
  });
  modal.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    const error = modal.querySelector('#teacherLoginError');
    const submit = modal.querySelector('#teacherLoginSubmit');
    const pin = modal.querySelector('#teacherPin').value;
    const confirm = modal.querySelector('#teacherPinConfirm').value;
    error.textContent = '';
    if (modal.dataset.mode === 'setup' && pin !== confirm) {
      error.textContent = '两次输入不一致，请重新确认';
      return;
    }
    submit.disabled = true;
    try {
      if (modal.dataset.mode === 'setup') await setupTeacherPin(pin);
      else await login(pin);
      modal.close();
      document.dispatchEvent(new CustomEvent('teacher-session-changed', { detail: { active: true } }));
    } catch (cause) {
      error.textContent = cause?.message || '登录失败';
    } finally {
      modal.querySelector('#teacherPin').value = '';
      modal.querySelector('#teacherPinConfirm').value = '';
      submit.disabled = false;
    }
  });
  return modal;
}

function configureModal(modal, setupRequired) {
  modal.dataset.mode = setupRequired ? 'setup' : 'login';
  modal.querySelector('h2').textContent = setupRequired ? '首次设置老师密码' : '输入 4 位密码';
  modal.querySelector('.muted').textContent = setupRequired
    ? '输入两次，以后直接用这个密码进入老师模式。'
    : '用于查看姐姐和弟弟的私有教学状态。';
  modal.querySelector('#teacherPin').autocomplete = setupRequired ? 'new-password' : 'current-password';
  modal.querySelector('#teacherPinConfirm').hidden = !setupRequired;
  modal.querySelector('#teacherLoginSubmit').textContent = setupRequired ? '设置并进入' : '进入老师模式';
  modal.querySelector('#teacherLoginSubmit').disabled = false;
  modal.querySelector('#teacherLoginError').textContent = '';
}

function updateTeacherButton() {
  const button = document.querySelector('[data-teacher-login]');
  if (!button) return;
  const configured = isTeacherApiConfigured();
  button.textContent = !configured ? '只读 · 未连接' : hasTeacherSession() ? '退出老师模式' : '老师入口';
  button.disabled = !configured;
  button.title = configured ? '' : '教师服务尚未配置，当前只能查看公共内容';
  button.dataset.active = String(hasTeacherSession());
}

document.querySelector('[data-teacher-login]')?.addEventListener('click', async () => {
  if (!isTeacherApiConfigured()) return;
  if (hasTeacherSession()) {
    logout();
    document.dispatchEvent(new CustomEvent('teacher-session-changed', { detail: { active: false } }));
  } else {
    const modal = ensureModal();
    const button = document.querySelector('[data-teacher-login]');
    button.disabled = true;
    button.textContent = '正在连接…';
    try {
      const status = await loadTeacherStatus();
      configureModal(modal, Boolean(status?.setup_required));
      modal.showModal();
      modal.querySelector('#teacherPin').focus();
    } catch (error) {
      configureModal(modal, false);
      modal.querySelector('#teacherLoginError').textContent = error?.message || '教师服务暂时不可用';
      modal.showModal();
    } finally {
      updateTeacherButton();
    }
  }
});

document.addEventListener('teacher-session-changed', updateTeacherButton);
updateTeacherButton();

export { ensureModal, updateTeacherButton };
