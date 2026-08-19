import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');

test('static configuration contains no teacher PIN or Supabase secret', async () => {
  const config = `${await read('config.js')}\n${await read('config.example.js')}`;
  assert.doesNotMatch(config, /pin|password|service[_-]?role|supabase[_-]?(?:key|secret)/i);
});

test('private teacher data is not shipped in the public snapshot', async () => {
  const catalog = await read('data/knowledge-catalog.json');
  assert.doesNotMatch(catalog, /student_id|teacher_note|handoff_status|teaching_status|mastery_status|evidence_id|textbook_file|workbook_file|source_ref/i);
});

test('browser API uses only the backend endpoint and session-scoped token', async () => {
  const api = await read('js/api.js');
  assert.match(api, /sessionStorage/);
  assert.doesNotMatch(api, /localStorage|supabase\.co|service[_-]?role/i);
});

test('server storage is restricted to the math progress key and teaching-status RPC', async () => {
  const store = await read('server/supabase-store.mjs');
  assert.match(store, /math_student_progress_v1/);
  assert.match(store, /saveTeachingStatus/);
  assert.doesNotMatch(store, /assessment|grading|paper_id|question_id|kp_ids/i);
  assert.match(store, /\/rpc\//);
});

test('the website has only geometry and knowledge navigation', async () => {
  const pages = `${await read('index.html')}\n${await read('knowledge.html')}`;
  assert.doesNotMatch(pages, /grading\.html|在线批改|paper_id|question_id|kp_ids/i);
});
