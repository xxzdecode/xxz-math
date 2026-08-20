import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeedRecords, mergeProductionRecords } from '../scripts/seed-private-progress.mjs';

const item = (id, title = id) => [id, title, `${title}的具体内容`];
const siteMap = {
  schema_version: 1,
  grades: [
    { grade: 1, groups: [{ domain: '数与运算', items: [item('g1-basic')] }] },
    { grade: 2, groups: [{ domain: '数与运算', items: [item('g2-basic')] }] },
    { grade: 3, groups: [{ domain: '数与运算', items: [item('g3-basic')] }] },
    { grade: 4, groups: [{ domain: '数与运算', items: [item('g4-current')] }] },
    { grade: 5, groups: [{ domain: '数与运算', items: [item('g5-basic')] }] },
    { grade: 6, groups: [{ domain: '数与运算', items: [item('g6-basic')] }] },
    { grade: 7, groups: [{ domain: '数与运算', items: [item('g7-current')] }] }
  ]
};

test('seed fills every visible grade with yellow history and red current-grade defaults', () => {
  const records = buildSeedRecords({ schema_version: 2, records: [] }, siteMap);
  const byKey = new Map(records.map(record => [`${record.student_id}:${record.knowledge_id}`, record]));
  assert.equal(records.length, 11);
  assert.equal(byKey.get('sister:g6-basic').display_status, 'yellow');
  assert.equal(byKey.get('sister:g7-current').display_status, 'red');
  assert.equal(byKey.get('brother:g3-basic').display_status, 'yellow');
  assert.equal(byKey.get('brother:g4-current').display_status, 'red');
  assert.equal(byKey.has('brother:g5-basic'), false);
});

test('seed honors legacy evidence and production merge preserves manual state', () => {
  const seed = buildSeedRecords({ schema_version: 2, records: [{
    student_id: 'sister', knowledge_id: 'g6-basic', handoff_status: 'reported_needs_reinforcement',
    teaching_status: 'not_recorded', mastery_status: 'unverified'
  }] }, siteMap);
  assert.equal(seed.find(record => record.student_id === 'sister' && record.knowledge_id === 'g6-basic').display_status, 'red');

  const merged = mergeProductionRecords(seed, [{
    student_id: 'sister', knowledge_id: 'g6-basic', handoff_status: 'reported_needs_reinforcement',
    teaching_status: 'taught_by_us', mastery_status: 'unverified', display_status: 'green', status_source: 'manual'
  }]);
  const preserved = merged.find(record => record.student_id === 'sister' && record.knowledge_id === 'g6-basic');
  assert.equal(preserved.display_status, 'green');
  assert.equal(preserved.teaching_status, 'taught_by_us');
  assert.equal(preserved.status_source, 'manual');
});
