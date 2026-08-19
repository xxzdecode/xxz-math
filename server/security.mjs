import {
  createHmac,
  pbkdf2 as pbkdf2Callback,
  randomBytes,
  timingSafeEqual
} from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2 = promisify(pbkdf2Callback);
const VERIFIER_PREFIX = 'pbkdf2-sha256';
const MIN_ITERATIONS = 210_000;

const encode = value => Buffer.from(value).toString('base64url');
const decodeJson = value => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));

function requirePepper(pepper) {
  const value = String(pepper || '');
  if (Buffer.byteLength(value, 'utf8') < 32) throw new Error('MATH_PIN_PEPPER must contain at least 32 bytes');
  return value;
}

export async function createPinVerifier(pin, { iterations = 310_000, salt = randomBytes(16), pepper } = {}) {
  if (!/^\d{4}$/.test(String(pin))) throw new Error('PIN must contain exactly four digits');
  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS) throw new Error('PBKDF2 iteration count is too low');
  const hash = await pbkdf2(`${String(pin)}\0${requirePepper(pepper)}`, salt, iterations, 32, 'sha256');
  return `${VERIFIER_PREFIX}$${iterations}$${Buffer.from(salt).toString('base64url')}$${hash.toString('base64url')}`;
}

function parseVerifier(verifier) {
  const [prefix, rawIterations, rawSalt, rawHash, ...extra] = String(verifier || '').split('$');
  const iterations = Number(rawIterations);
  const salt = Buffer.from(rawSalt || '', 'base64url');
  const hash = Buffer.from(rawHash || '', 'base64url');
  if (prefix !== VERIFIER_PREFIX || extra.length || !Number.isInteger(iterations) || iterations < MIN_ITERATIONS || salt.length < 16 || hash.length !== 32) {
    throw new Error('Teacher PIN verifier is not configured correctly');
  }
  return { iterations, salt, hash };
}

export function validatePinVerifier(verifier) {
  parseVerifier(verifier);
  return true;
}

export async function verifyPin(pin, verifier, pepper) {
  if (!/^\d{4}$/.test(String(pin))) return false;
  const { iterations, salt, hash } = parseVerifier(verifier);
  const candidate = await pbkdf2(`${String(pin)}\0${requirePepper(pepper)}`, salt, iterations, hash.length, 'sha256');
  return timingSafeEqual(candidate, hash);
}

function requireSessionSecret(secret) {
  const value = Buffer.from(String(secret || ''), 'utf8');
  if (value.length < 32) throw new Error('MATH_SESSION_SECRET must contain at least 32 bytes');
  return value;
}

function signatureFor(unsigned, secret) {
  return createHmac('sha256', requireSessionSecret(secret)).update(unsigned).digest('base64url');
}

export function createSessionToken(secret, { nowSeconds = Math.floor(Date.now() / 1000), ttlSeconds = 900 } = {}) {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 900) throw new Error('Teacher session TTL must be between 60 and 900 seconds');
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encode(JSON.stringify({ aud: 'math-teacher-api', iat: nowSeconds, exp: nowSeconds + ttlSeconds }));
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${signatureFor(unsigned, secret)}`;
}

export function verifySessionToken(token, secret, { nowSeconds = Math.floor(Date.now() / 1000) } = {}) {
  try {
    const [headerPart, payloadPart, signaturePart, ...extra] = String(token || '').split('.');
    if (!headerPart || !payloadPart || !signaturePart || extra.length) return null;
    const unsigned = `${headerPart}.${payloadPart}`;
    const expected = Buffer.from(signatureFor(unsigned, secret), 'base64url');
    const actual = Buffer.from(signaturePart, 'base64url');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const header = decodeJson(headerPart);
    const payload = decodeJson(payloadPart);
    if (header.alg !== 'HS256' || payload.aud !== 'math-teacher-api') return null;
    if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.exp <= nowSeconds || payload.iat > nowSeconds + 30 || payload.exp - payload.iat > 900) return null;
    return payload;
  } catch {
    return null;
  }
}

export class PinRateLimiter {
  constructor({ maxFailures = 5, windowMs = 15 * 60_000, blockMs = 15 * 60_000, now = Date.now } = {}) {
    this.maxFailures = maxFailures;
    this.windowMs = windowMs;
    this.blockMs = blockMs;
    this.now = now;
    this.entries = new Map();
  }

  check(key) {
    const entry = this.entries.get(key);
    if (!entry) return { allowed: true, retryAfterSeconds: 0 };
    const current = this.now();
    if (entry.blockedUntil > current) return { allowed: false, retryAfterSeconds: Math.ceil((entry.blockedUntil - current) / 1000) };
    if (current - entry.windowStartedAt >= this.windowMs) this.entries.delete(key);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  failure(key) {
    const current = this.now();
    let entry = this.entries.get(key);
    if (!entry || current - entry.windowStartedAt >= this.windowMs) entry = { failures: 0, windowStartedAt: current, blockedUntil: 0 };
    entry.failures += 1;
    if (entry.failures >= this.maxFailures) entry.blockedUntil = current + this.blockMs;
    this.entries.set(key, entry);
    return this.check(key);
  }

  success(key) {
    this.entries.delete(key);
  }
}
