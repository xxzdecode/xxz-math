const encoder = new TextEncoder();
const decoder = new TextDecoder();

const requiredEnv = name => {
  const value = String(Deno.env.get(name) || '').trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

const SUPABASE_URL = requiredEnv('SUPABASE_URL').replace(/\/+$/, '');
const SERVICE_ROLE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
const PIN_PEPPER = requiredEnv('MATH_PIN_PEPPER');
const SESSION_SECRET = requiredEnv('MATH_SESSION_SECRET');
const ALLOWED_ORIGINS = new Set(
  String(Deno.env.get('MATH_ALLOWED_ORIGINS') || Deno.env.get('MATH_ALLOWED_ORIGIN') || '')
    .split(',').map(value => value.trim()).filter(Boolean)
);

if (encoder.encode(PIN_PEPPER).length < 32 || encoder.encode(SESSION_SECRET).length < 32) {
  throw new Error('Math teacher secrets must contain at least 32 bytes');
}
if (!ALLOWED_ORIGINS.size) throw new Error('MATH_ALLOWED_ORIGINS is not configured');

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function hmac(value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

function constantEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function parseVerifier(verifier) {
  const [prefix, rawIterations, rawSalt, rawHash, ...extra] = String(verifier || '').split('$');
  const iterations = Number(rawIterations);
  const salt = fromBase64Url(rawSalt || '');
  const expected = fromBase64Url(rawHash || '');
  if (prefix !== 'pbkdf2-sha256' || extra.length || !Number.isInteger(iterations) || iterations < 210_000 || salt.length < 16 || expected.length !== 32) {
    throw new Error('PIN verifier is invalid');
  }
  return { iterations, salt, expected };
}

async function pinHash(pin, salt, iterations) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(`${String(pin)}\0${PIN_PEPPER}`), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, 256));
}

async function createPinVerifier(pin) {
  if (!/^\d{4}$/.test(String(pin))) throw new Error('PIN must contain exactly four digits');
  const iterations = 310_000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pinHash(pin, salt, iterations);
  return `pbkdf2-sha256$${iterations}$${base64Url(salt)}$${base64Url(hash)}`;
}

async function verifyPin(pin, verifier) {
  if (!/^\d{4}$/.test(String(pin))) return false;
  const { iterations, salt, expected } = parseVerifier(verifier);
  const candidate = await pinHash(pin, salt, iterations);
  return constantEqual(candidate, expected);
}

async function createSession() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = base64Url(encoder.encode(JSON.stringify({ aud: 'math-teacher-api', iat: now, exp: now + 900 })));
  const unsigned = `${header}.${payload}`;
  return { token: `${unsigned}.${base64Url(await hmac(unsigned))}`, expiresAt: new Date((now + 900) * 1000).toISOString() };
}

async function verifySession(request) {
  try {
    const match = /^Bearer ([A-Za-z0-9._-]+)$/.exec(request.headers.get('authorization') || '');
    const [headerPart, payloadPart, signaturePart, ...extra] = String(match?.[1] || '').split('.');
    if (!headerPart || !payloadPart || !signaturePart || extra.length) return false;
    const unsigned = `${headerPart}.${payloadPart}`;
    if (!constantEqual(fromBase64Url(signaturePart), await hmac(unsigned))) return false;
    const header = JSON.parse(decoder.decode(fromBase64Url(headerPart)));
    const payload = JSON.parse(decoder.decode(fromBase64Url(payloadPart)));
    const now = Math.floor(Date.now() / 1000);
    return header.alg === 'HS256' && payload.aud === 'math-teacher-api'
      && Number.isInteger(payload.iat) && Number.isInteger(payload.exp)
      && payload.exp > now && payload.iat <= now + 30 && payload.exp - payload.iat <= 900;
  } catch {
    return false;
  }
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin'
  };
}

function json(origin, status, body, extra = {}) {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { ...corsHeaders(origin), ...extra } });
}

async function supabase(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Supabase request failed (${response.status})`);
  return body;
}

async function clientHash(request) {
  const address = (request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown').split(',')[0].trim();
  return Array.from(await hmac(`rate:${address}`)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function rateLimit(request, event) {
  return await supabase('/rest/v1/rpc/math_teacher_rate_limit_v1', {
    method: 'POST',
    body: JSON.stringify({ p_client_hash: await clientHash(request), p_event: event })
  });
}

async function loadPinVerifier() {
  const rows = await supabase('/rest/v1/math_private_state_v1?key=eq.math_teacher_auth_v1&select=value');
  if (!Array.isArray(rows) || rows.length === 0) return '';
  if (rows.length !== 1) throw new Error('Math teacher auth state is invalid');
  const verifier = String(rows[0]?.value?.pin_verifier || '');
  parseVerifier(verifier);
  return verifier;
}

async function savePinVerifier(verifier) {
  parseVerifier(verifier);
  await supabase('/rest/v1/math_private_state_v1?on_conflict=key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: 'math_teacher_auth_v1', value: { schema_version: 1, pin_verifier: verifier } })
  });
}

function safeProgress(value) {
  const records = Array.isArray(value?.records) ? value.records : [];
  return {
    schema_version: 1,
    records: records.flatMap(record => {
      const studentId = String(record?.student_id || '');
      const knowledgeId = String(record?.knowledge_id || '');
      if (!['sister', 'brother'].includes(studentId) || !/^[a-z0-9][a-z0-9-]{1,99}$/.test(knowledgeId)) return [];
      return [{
        student_id: studentId,
        knowledge_id: knowledgeId,
        handoff_status: ['not_reported', 'reported_taught', 'reported_needs_reinforcement'].includes(String(record.handoff_status)) ? record.handoff_status : 'not_reported',
        teaching_status: ['not_recorded', 'learning', 'taught_by_us'].includes(String(record.teaching_status)) ? record.teaching_status : 'not_recorded',
        mastery_status: ['unverified', 'learning', 'stable', 'reinforce'].includes(String(record.mastery_status)) ? record.mastery_status : 'unverified'
      }];
    })
  };
}

async function handleAuth(request, origin) {
  const verifier = await loadPinVerifier();
  if (!verifier) return json(origin, 409, { message: '请先完成首次密码设置' });
  const state = await rateLimit(request, 'check');
  if (!state.allowed) return json(origin, 429, { message: '密码尝试过多，请稍后再试' }, { 'Retry-After': String(state.retry_after_seconds || 900) });
  const body = await request.json().catch(() => ({}));
  if (!await verifyPin(body.pin, verifier)) {
    const failed = await rateLimit(request, 'failure');
    return json(origin, failed.allowed ? 401 : 429, { message: '密码错误或暂时不可用' }, failed.allowed ? {} : { 'Retry-After': String(failed.retry_after_seconds || 900) });
  }
  await rateLimit(request, 'success');
  const session = await createSession();
  return json(origin, 200, { token: session.token, expires_at: session.expiresAt });
}

async function handleSetup(request, origin) {
  if (await loadPinVerifier()) return json(origin, 409, { message: '老师密码已经设置' });
  const state = await rateLimit(request, 'check');
  if (!state.allowed) return json(origin, 429, { message: '尝试过多，请稍后再试' }, { 'Retry-After': String(state.retry_after_seconds || 900) });
  const body = await request.json().catch(() => ({}));
  if (!/^\d{4}$/.test(String(body.pin || ''))) {
    const failed = await rateLimit(request, 'failure');
    return json(origin, failed.allowed ? 400 : 429, { message: '请输入 4 位数字密码' }, failed.allowed ? {} : { 'Retry-After': String(failed.retry_after_seconds || 900) });
  }
  await savePinVerifier(await createPinVerifier(String(body.pin)));
  await rateLimit(request, 'success');
  const session = await createSession();
  return json(origin, 200, { token: session.token, expires_at: session.expiresAt });
}

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  if (!ALLOWED_ORIGINS.has(origin)) return json('null', 403, { message: '请求来源不允许' });
  if (request.method === 'OPTIONS') return json(origin, 204, null);
  try {
    const path = new URL(request.url).pathname.replace(/^.*\/math-teacher-api/, '') || '/';
    if (request.method === 'GET' && path === '/status') return json(origin, 200, { setup_required: !(await loadPinVerifier()) });
    if (request.method === 'POST' && path === '/setup') return await handleSetup(request, origin);
    if (request.method === 'POST' && path === '/auth') return await handleAuth(request, origin);
    if (!await verifySession(request)) return json(origin, 401, { message: '教师会话无效或已过期' });

    if (request.method === 'GET' && path === '/teacher/progress') {
      const rows = await supabase('/rest/v1/math_private_state_v1?key=eq.math_student_progress_v1&select=value');
      if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Math progress is not initialized');
      return json(origin, 200, safeProgress(rows[0].value));
    }
    const match = /^\/teacher\/progress\/([^/]+)\/([^/]+)$/.exec(path);
    if (request.method === 'PUT' && match) {
      const body = await request.json().catch(() => ({}));
      const result = await supabase('/rest/v1/rpc/math_set_teaching_status_v1', {
        method: 'POST',
        body: JSON.stringify({
          p_student_id: decodeURIComponent(match[1]),
          p_knowledge_id: decodeURIComponent(match[2]),
          p_teaching_status: String(body.teaching_status || '')
        })
      });
      return json(origin, 200, result);
    }
    return json(origin, 404, { message: '接口不存在' });
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Math teacher API failure');
    return json(origin, 500, { message: '教师服务暂时不可用' });
  }
});
