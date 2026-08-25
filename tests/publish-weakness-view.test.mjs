import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWeaknessView } from '../scripts/publish-weakness-view.mjs';

const siteMap = { grades: [{ groups: [{ items: [['g4-site-relations', '关系', '摘要']] }] }] };

test('publisher collapses private mechanisms to one safe knowledge summary', () => {
  const view = buildWeaknessView({
    schema_version: 1,
    updated_at: '2026-08-25T10:00:00+08:00',
    weaknesses: [
      {
        weakness_id: 'private-1', student_id: 'brother', knowledge_id: 'g4-private-relations', site_knowledge_id: 'g4-site-relations',
        mechanism_key: 'private-mechanism', display_title: '减法各部分关系', status: 'watching',
        last_failed_at: '2026-08-24T10:00:00+08:00', failure_evidence: [{ prompt: '原题' }]
      },
      {
        weakness_id: 'private-2', student_id: 'brother', knowledge_id: 'g4-private-relations', site_knowledge_id: 'g4-site-relations',
        mechanism_key: 'another-private-mechanism', display_title: '逆向关系推理', status: 'active',
        last_failed_at: '2026-08-23T10:00:00+08:00', teacher_note: '不要发布'
      }
    ]
  }, siteMap);
  assert.deepEqual(view.students.brother.items, [{
    knowledge_id: 'g4-site-relations', title: '逆向关系推理', status: 'active', last_seen_at: '2026-08-23T10:00:00+08:00'
  }]);
  assert.match(view.source_hash, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(view), /private-mechanism|原题|teacher_note|不要发布/);
});

test('resolved weaknesses stay private and unknown knowledge ids fail', () => {
  const resolved = buildWeaknessView({
    schema_version: 1, updated_at: '2026-08-25', weaknesses: [{
      student_id: 'brother', knowledge_id: 'g4-private-relations', site_knowledge_id: 'g4-site-relations', display_title: '已解决', status: 'resolved'
    }]
  }, siteMap);
  assert.deepEqual(resolved.students.brother.items, []);
  assert.throws(() => buildWeaknessView({
    schema_version: 1, updated_at: '2026-08-25', weaknesses: [{
      student_id: 'brother', knowledge_id: 'private-missing', site_knowledge_id: 'missing', display_title: '未知', status: 'watching', last_failed_at: '2026-08-25'
    }]
  }, siteMap), /知识点无效/);
});
