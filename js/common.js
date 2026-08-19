import { hasTeacherSession, isTeacherApiConfigured, login, logout } from './api.js';

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
      <p class="form-error" id="teacherLoginError" role="alert"></p>
      <button class="primary-button" id="teacherLoginSubmit" type="submit" value="default">进入老师模式</button>
    </form>`;
  document.body.append(modal);
  modal.querySelector('.dialog-close').addEventListener('click', () => modal.close());
  modal.addEventListener('close', () => {
    modal.querySelector('#teacherPin').value = '';
    modal.querySelector('#teacherLoginError').textContent = '';
  });
  modal.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    const error = modal.querySelector('#teacherLoginError');
    const submit = modal.querySelector('#teacherLoginSubmit');
    const pin = modal.querySelector('#teacherPin').value;
    error.textContent = '';
    submit.disabled = true;
    try {
      await login(pin);
      modal.close();
      document.dispatchEvent(new CustomEvent('teacher-session-changed', { detail: { active: true } }));
    } catch (cause) {
      error.textContent = cause?.message || '登录失败';
    } finally {
      modal.querySelector('#teacherPin').value = '';
      submit.disabled = false;
    }
  });
  return modal;
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

document.querySelector('[data-teacher-login]')?.addEventListener('click', () => {
  if (!isTeacherApiConfigured()) return;
  if (hasTeacherSession()) {
    logout();
    document.dispatchEvent(new CustomEvent('teacher-session-changed', { detail: { active: false } }));
  } else {
    const modal = ensureModal();
    modal.showModal();
    modal.querySelector('#teacherPin').focus();
  }
});

document.addEventListener('teacher-session-changed', updateTeacherButton);
updateTeacherButton();

export { ensureModal, updateTeacherButton };
