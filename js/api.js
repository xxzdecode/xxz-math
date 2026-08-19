const config = () => window.MATH_SITE_CONFIG || {};
const TOKEN_KEY = 'xxzcard_math_teacher_session';

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

export function loadTeacherStatus() {
  return request('/status', { authenticated: false });
}

export async function setupTeacherPin(pin) {
  if (!/^\d{4}$/.test(String(pin))) throw new Error('请输入 4 位数字密码');
  const result = await request('/setup', {
    authenticated: false,
    method: 'POST',
    body: JSON.stringify({ pin: String(pin) })
  });
  if (typeof result?.token !== 'string' || !result.token) throw new Error('教师服务没有返回有效会话');
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
