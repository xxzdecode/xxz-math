import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeWeaknessView } from '../js/weakness-view.js';

test('weakness view keeps only safe fields and sorts by action priority', () => {
  const view = normalizeWeaknessView({
    schema_version: 1,
    source_updated_at: '2026-08-25T12:00:00+08:00',
    source_hash: 'hash',
    students: {
      sister: { items: [] },
      brother: { items: [
        { knowledge_id: 'g4-b', title: '改善项', status: 'improving', last_seen_at: '2026-08-25', prompt: 'private' },
        { knowledge_id: 'g4-a', title: '巩固项', status: 'active', last_seen_at: '2026-08-22', answer: 'private' },
        { knowledge_id: 'g4-c', title: '观察项', status: 'watching', last_seen_at: '2026-08-24' },
        { knowledge_id: '../bad', title: '非法', status: 'active', last_seen_at: '2026-08-24' }
      ] }
    }
  });
  assert.deepEqual(view.students.brother.items.map(item => item.status), ['active', 'watching', 'improving']);
  assert.deepEqual(Object.keys(view.students.brother.items[0]), ['knowledgeId', 'title', 'status', 'lastSeenAt']);
});
