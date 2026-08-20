import test from 'node:test';
import assert from 'node:assert/strict';
import { teacherProgressResponse, validateDisplayStatusUpdate, validateTeachingStatusUpdate } from '../server/math-data.mjs';

test('teacher progress response strips evidence and preserves handoff versus mastery', () => {
  const result = teacherProgressResponse({ records: [{
    student_id: 'sister',
    knowledge_id: 'g6-circle-sector',
    handoff_status: 'reported_taught',
    teaching_status: 'not_recorded',
    mastery_status: 'unverified',
    display_status: 'yellow',
    status_source: 'manual',
    status_updated_at: '2026-08-20T10:00:00.000Z',
    evidence_ids: ['private-evidence'],
    teacher_note: 'private-note'
  }] });
  assert.deepEqual(result.records[0], {
    student_id: 'sister',
    knowledge_id: 'g6-circle-sector',
    handoff_status: 'reported_taught',
    teaching_status: 'not_recorded',
    mastery_status: 'unverified',
    display_status: 'yellow',
    status_source: 'manual',
    status_updated_at: '2026-08-20T10:00:00.000Z'
  });
});

test('teacher write accepts only known students, stable knowledge ids and teaching status', () => {
  assert.deepEqual(validateTeachingStatusUpdate('sister', 'g6-circle-sector', 'learning'), {
    studentId: 'sister', knowledgeId: 'g6-circle-sector', teachingStatus: 'learning'
  });
  assert.throws(() => validateTeachingStatusUpdate('student-3', 'g6-circle-sector', 'learning'), /学生身份无效/);
  assert.throws(() => validateTeachingStatusUpdate('sister', '../private', 'learning'), /知识点 ID 无效/);
  assert.throws(() => validateTeachingStatusUpdate('sister', 'g6-circle-sector', 'stable'), /教学状态无效/);
});

test('teacher can directly set only red yellow or green display status', () => {
  assert.deepEqual(validateDisplayStatusUpdate('brother', 'g4-rounding', 'yellow'), {
    studentId: 'brother', knowledgeId: 'g4-rounding', displayStatus: 'yellow'
  });
  assert.throws(() => validateDisplayStatusUpdate('brother', 'g4-rounding', 'gray'), /掌握状态无效/);
});
