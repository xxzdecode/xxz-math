import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');

test('edge teacher API reads all secrets from environment and keeps math namespace', async () => {
  const edge = await read('supabase/functions/math-teacher-api/index.ts');
  assert.match(edge, /requiredEnv\('MATH_PIN_PEPPER'\)/);
  assert.match(edge, /requiredEnv\('MATH_SESSION_SECRET'\)/);
  assert.match(edge, /math_teacher_auth_v1/);
  assert.match(edge, /math_private_state_v1/);
  assert.match(edge, /math_teacher_rate_limit_v1/);
  assert.match(edge, /math_set_teaching_status_v1/);
  assert.doesNotMatch(edge, /https:\/\/[a-z0-9-]+\.supabase\.co/i);
  assert.doesNotMatch(edge, /service_role\W+[A-Za-z0-9._-]{20,}/i);
  assert.doesNotMatch(edge, /requiredEnv\('MATH_TEACHER_PIN_VERIFIER'\)/);
  assert.doesNotMatch(edge, /requiredEnv\('MATH_SETUP_TOKEN'\)/);
});

test('migration denies browser roles and grants only service role', async () => {
  const migration = await read('supabase/migrations/202608190001_math_teacher_private_state.sql');
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on public\.math_private_state_v1 from public, anon, authenticated/i);
  assert.match(migration, /grant select, insert, update on public\.math_private_state_v1 to service_role/i);
  assert.match(migration, /revoke all on function public\.math_set_teaching_status_v1[^;]+from public, anon, authenticated/is);
  assert.doesNotMatch(migration, /create policy/i);
});

test('persistent teacher rate limit uses a timestamp variable that cannot resolve to SQL current_time', async () => {
  const initial = await read('supabase/migrations/202608190001_math_teacher_private_state.sql');
  const fix = await read('supabase/migrations/202608200001_fix_math_teacher_rate_limit.sql');
  for (const migration of [initial, fix]) {
    assert.match(migration, /current_at timestamptz := now\(\)/i);
    assert.doesNotMatch(migration, /current_time timestamptz/i);
  }
});

test('private seed stays dry-run unless apply is explicit and strips evidence fields', async () => {
  const seed = await read('scripts/seed-private-progress.mjs');
  assert.match(seed, /process\.argv\.includes\('--apply'\)/);
  assert.match(seed, /if \(!apply\)/);
  assert.doesNotMatch(seed, /evidence_ids|teacher_note|source_ref|item_locator/);
  assert.match(seed, /math_student_progress_v1/);
});
