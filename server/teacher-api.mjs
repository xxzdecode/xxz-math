import { createServer } from 'node:http';
import { PinRateLimiter, createSessionToken, validatePinVerifier, verifyPin, verifySessionToken } from './security.mjs';
import { teacherProgressResponse, validateTeachingStatusUpdate } from './math-data.mjs';
import { SupabaseMathStore } from './supabase-store.mjs';

const PORT = Number(process.env.MATH_TEACHER_API_PORT || 8787);
const ALLOWED_ORIGIN = String(process.env.MATH_ALLOWED_ORIGIN || '');
const PIN_VERIFIER = String(process.env.MATH_TEACHER_PIN_VERIFIER || '');
const PIN_PEPPER = String(process.env.MATH_PIN_PEPPER || '');
const SESSION_SECRET = String(process.env.MATH_SESSION_SECRET || '');
const limiter = new PinRateLimiter();
const store = new SupabaseMathStore({
  url: process.env.SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  table: process.env.MATH_SUPABASE_TABLE,
  progressRpc: process.env.MATH_PROGRESS_RPC
});

if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) throw new Error('MATH_TEACHER_API_PORT is invalid');
validatePinVerifier(PIN_VERIFIER);
createSessionToken(SESSION_SECRET);
if (Buffer.byteLength(PIN_PEPPER, 'utf8') < 32) throw new Error('MATH_PIN_PEPPER must contain at least 32 bytes');
if (!/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(ALLOWED_ORIGIN) && !/^https:\/\/[a-z0-9.-]+$/i.test(ALLOWED_ORIGIN)) {
  throw new Error('MATH_ALLOWED_ORIGIN must be one exact http localhost or https production origin');
}

function send(response, status, value, extraHeaders = {}) {
  const body = value === null ? '' : JSON.stringify(value);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    Vary: 'Origin',
    ...extraHeaders
  });
  response.end(body);
}

async function readJson(request, limit = 16_384) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > limit) throw Object.assign(new Error('请求内容过大'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw Object.assign(new Error('请求 JSON 无效'), { status: 400 }); }
}

function bearerToken(request) {
  const match = /^Bearer ([A-Za-z0-9._-]+)$/.exec(String(request.headers.authorization || ''));
  return match?.[1] || '';
}

function requireTeacher(request) {
  const session = verifySessionToken(bearerToken(request), SESSION_SECRET);
  if (!session) throw Object.assign(new Error('教师会话无效或已过期'), { status: 401 });
  return session;
}

function safeClientKey(request) {
  return String(request.socket.remoteAddress || 'local');
}

async function handleAuth(request, response) {
  const clientKey = safeClientKey(request);
  const allowed = limiter.check(clientKey);
  if (!allowed.allowed) {
    send(response, 429, { message: '密码尝试过多，请稍后再试' }, { 'Retry-After': String(allowed.retryAfterSeconds) });
    return;
  }
  const body = await readJson(request, 256);
  const valid = await verifyPin(body.pin, PIN_VERIFIER, PIN_PEPPER);
  if (!valid) {
    const state = limiter.failure(clientKey);
    send(response, state.allowed ? 401 : 429, { message: '密码错误或暂时不可用' }, state.allowed ? {} : { 'Retry-After': String(state.retryAfterSeconds) });
    return;
  }
  limiter.success(clientKey);
  const nowSeconds = Math.floor(Date.now() / 1000);
  send(response, 200, {
    token: createSessionToken(SESSION_SECRET, { nowSeconds, ttlSeconds: 900 }),
    expires_at: new Date((nowSeconds + 900) * 1000).toISOString()
  });
}

async function handleRequest(request, response) {
  const origin = String(request.headers.origin || '');
  if (origin !== ALLOWED_ORIGIN) {
    send(response, 403, { message: '请求来源不允许' }, { 'Access-Control-Allow-Origin': 'null' });
    return;
  }
  if (request.method === 'OPTIONS') {
    send(response, 204, null, {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '600'
    });
    return;
  }

  const url = new URL(request.url || '/', 'http://local.invalid');
  if (request.method === 'POST' && url.pathname === '/math/auth') {
    await handleAuth(request, response);
    return;
  }

  requireTeacher(request);
  if (request.method === 'GET' && url.pathname === '/math/teacher/progress') {
    send(response, 200, teacherProgressResponse(await store.progress()));
    return;
  }
  const progressMatch = /^\/math\/teacher\/progress\/([^/]+)\/([^/]+)$/.exec(url.pathname);
  if (request.method === 'PUT' && progressMatch) {
    const studentId = decodeURIComponent(progressMatch[1]);
    const knowledgeId = decodeURIComponent(progressMatch[2]);
    const body = await readJson(request);
    const update = validateTeachingStatusUpdate(studentId, knowledgeId, String(body.teaching_status || ''));
    const result = await store.saveTeachingStatus(update);
    send(response, 200, result);
    return;
  }
  send(response, 404, { message: '接口不存在' });
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch(error => {
    const status = Number(error?.status) || 500;
    const message = status >= 500 ? '教师服务暂时不可用' : error?.message || '请求失败';
    if (status >= 500) console.error(error);
    if (!response.headersSent) send(response, status, { message });
    else response.destroy();
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Math teacher API listening on http://127.0.0.1:${PORT}/math`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
