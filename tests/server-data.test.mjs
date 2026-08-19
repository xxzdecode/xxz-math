import test from 'node:test';
import assert from 'node:assert/strict';
import { teacherProgressResponse, validateTeachingStatusUpdate } from '../server/math-data.mjs';

test('teacher progress response strips evidence and preserves handoff versus mastery', () => {
  const result = teacherProgressResponse({ records: [{
    student_id: 'sister',
    knowledge_id: 'g6-circle-sector',
    handoff_status: 'reported_taught',
    teaching_status: 'not_recorded',
    mastery_status: 'unverified',
    evidence_ids: ['private-evidence'],
    teacher_note: 'private-note'
  }] });
  assert.deepEqual(result.records[0], {
    student_id: 'sister',
    knowledge_id: 'g6-circle-sector',
    handoff_status: 'reported_taught',
    teaching_status: 'not_recorded',
    mastery_status: 'unverified'
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
