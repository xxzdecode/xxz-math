import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');

test('first teacher PIN is set in the website without entering static configuration', async () => {
  const api = await read('js/api.js');
  const common = await read('js/common.js');
  assert.match(api, /history\.replaceState/);
  assert.match(api, /request\('\/setup'/);
  assert.match(api, /setup_token: setupToken/);
  assert.doesNotMatch(api, /localStorage/);
  assert.match(common, /首次设置老师密码/);
  assert.match(common, /teacherPinConfirm/);
  assert.match(common, /pin !== confirm/);
});

test('edge setup stores only a private irreversible verifier', async () => {
  const edge = await read('supabase/functions/math-teacher-api/index.ts');
  assert.match(edge, /pbkdf2-sha256/);
  assert.match(edge, /math_teacher_auth_v1/);
  assert.match(edge, /pin_verifier/);
  assert.doesNotMatch(edge, /value:\s*\{[^}]*\bpin\s*:/s);
});
