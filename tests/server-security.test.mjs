import test from 'node:test';
import assert from 'node:assert/strict';
import { PinRateLimiter, createPinVerifier, createSessionToken, verifyPin, verifySessionToken } from '../server/security.mjs';

test('four-digit PIN is verified only against a salted irreversible verifier', async () => {
  const testPin = String.fromCharCode(50, 52, 54, 56);
  const wrongPin = String.fromCharCode(50, 52, 54, 57);
  const pepper = 'local-test-pepper-that-is-longer-than-thirty-two-bytes';
  const verifier = await createPinVerifier(testPin, {
    iterations: 210_000,
    salt: Buffer.alloc(16, 7),
    pepper
  });
  assert.match(verifier, /^pbkdf2-sha256\$210000\$/);
  assert.doesNotMatch(verifier, new RegExp(testPin));
  assert.equal(await verifyPin(testPin, verifier, pepper), true);
  assert.equal(await verifyPin(wrongPin, verifier, pepper), false);
  assert.equal(await verifyPin(testPin, verifier, `${pepper}x`), false);
  assert.equal(await verifyPin('abcd', verifier, pepper), false);
});

test('teacher session is audience-bound, signed and expires within 15 minutes', () => {
  const secret = 'local-test-secret-that-is-longer-than-thirty-two-bytes';
  const token = createSessionToken(secret, { nowSeconds: 1000, ttlSeconds: 900 });
  assert.equal(verifySessionToken(token, secret, { nowSeconds: 1500 }).aud, 'math-teacher-api');
  assert.equal(verifySessionToken(token, secret, { nowSeconds: 1900 }), null);
  assert.equal(verifySessionToken(`${token}x`, secret, { nowSeconds: 1500 }), null);
  assert.throws(() => createSessionToken(secret, { nowSeconds: 1000, ttlSeconds: 901 }), /between 60 and 900/);
});

test('server-side PIN limiter blocks repeated failures and resets after success', () => {
  let now = 0;
  const limiter = new PinRateLimiter({ maxFailures: 3, windowMs: 1000, blockMs: 2000, now: () => now });
  assert.equal(limiter.failure('client').allowed, true);
  assert.equal(limiter.failure('client').allowed, true);
  assert.equal(limiter.failure('client').allowed, false);
  now = 1000;
  assert.equal(limiter.check('client').allowed, false);
  now = 2001;
  assert.equal(limiter.check('client').allowed, true);
  limiter.failure('client');
  limiter.success('client');
  assert.equal(limiter.check('client').allowed, true);
});
