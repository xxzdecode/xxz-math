const config = () => window.MATH_SITE_CONFIG || {};
const TOKEN_KEY = 'xxzcard_math_teacher_session';
let setupToken = '';

try {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const candidate = String(hash.get('setup') || '');
  if (/^[A-Za-z0-9_-]{32,200}$/.test(candidate)) setupToken = candidate;
  if (hash.has('setup')) {
    hash.delete('setup');
    const cleanHash = hash.toString();
    history.replaceState(null, '', `${location.pathname}${location.search}${cleanHash ? `#${cleanHash}` : ''}`);
  }
} catch { /* Setup links are optional. */ }

function readToken() {
  try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

function writeToken(token) {
  if (typeof token !== 'string' || !token) throw new Error('教师服务没有返回有效会话');
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch { throw new Error('浏览器无法保存当前教师会话'); }
}

function clearToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* Nothing persisted. */ }
}

function notifySessionExpired() {
  clearToken();
  document.dispatchEvent(new CustomEvent('teacher-session-changed', { detail: { active: false, reason: 'expired' } }));
}

function endpoint(path) {
  const base = String(config().apiBase || '').replace(/\/$/, '');
  if (!base) throw new Error('教师服务尚未配置');
  return `${base}${path}`;
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(config().requestTimeoutMs) || 10000);
  const { authenticated = true, ...fetchOptions } = options;
  const token = authenticated ? readToken() : '';
  try {
    const response = await fetch(endpoint(path), {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(fetchOptions.headers || {})
      }
    });
    const body = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && authenticated && token) notifySessionExpired();
      throw new Error(body?.message || `请求失败（${response.status}）`);
    }
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('教师服务响应超时，请稍后重试');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function isTeacherApiConfigured() {
  return Boolean(String(config().apiBase || '').trim());
}

export function hasTeacherSession() {
  return isTeacherApiConfigured() && Boolean(readToken());
}

export function hasTeacherSetupToken() {
  return Boolean(setupToken);
}

export function loadTeacherStatus() {
  return request('/status', { authenticated: false });
}

export async function setupTeacherPin(pin) {
  if (!/^\d{4}$/.test(String(pin))) throw new Error('请输入 4 位数字密码');
  if (!setupToken) throw new Error('首次设置链接无效，请重新打开激活链接');
  const result = await request('/setup', {
    authenticated: false,
    method: 'POST',
    body: JSON.stringify({ pin: String(pin), setup_token: setupToken })
  });
  if (typeof result?.token !== 'string' || !result.token) throw new Error('教师服务没有返回有效会话');
  setupToken = '';
  writeToken(result.token);
  return result;
}

export async function login(pin) {
  if (!/^\d{4}$/.test(String(pin))) throw new Error('请输入 4 位数字密码');
  const result = await request('/auth', { authenticated: false, method: 'POST', body: JSON.stringify({ pin: String(pin) }) });
  if (typeof result?.token !== 'string' || !result.token) throw new Error('教师服务没有返回有效会话');
  writeToken(result.token);
  return result;
}

export function logout() {
  clearToken();
}

export const loadProgress = () => request('/teacher/progress');
export const saveTeachingStatus = (studentId, knowledgeId, teachingStatus) => request(
  `/teacher/progress/${encodeURIComponent(studentId)}/${encodeURIComponent(knowledgeId)}`,
  {
  method: 'PUT',
  body: JSON.stringify({ teaching_status: teachingStatus })
  }
);
