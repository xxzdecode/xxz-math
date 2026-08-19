import { STUDENTS } from '../js/core.js';

const STUDENT_IDS = new Set(STUDENTS.map(student => student.id));
const HANDOFF = new Set(['not_reported', 'reported_taught', 'reported_needs_reinforcement']);
const TEACHING = new Set(['not_recorded', 'learning', 'taught_by_us']);
const MASTERY = new Set(['unverified', 'learning', 'stable', 'reinforce']);

const text = value => typeof value === 'string' ? value.trim() : '';

export function teacherProgressResponse(value) {
  const records = Array.isArray(value?.records) ? value.records : [];
  return {
    schema_version: 1,
    records: records.flatMap(record => {
      const studentId = text(record?.student_id);
      const knowledgeId = text(record?.knowledge_id);
      if (!STUDENT_IDS.has(studentId) || !knowledgeId) return [];
      return [{
        student_id: studentId,
        knowledge_id: knowledgeId,
        handoff_status: HANDOFF.has(record.handoff_status) ? record.handoff_status : 'not_reported',
        teaching_status: TEACHING.has(record.teaching_status) ? record.teaching_status : 'not_recorded',
        mastery_status: MASTERY.has(record.mastery_status) ? record.mastery_status : 'unverified'
      }];
    })
  };
}

export function validateTeachingStatusUpdate(studentId, knowledgeId, teachingStatus) {
  const normalizedStudentId = text(studentId);
  const normalizedKnowledgeId = text(knowledgeId);
  if (!STUDENT_IDS.has(normalizedStudentId)) throw Object.assign(new Error('学生身份无效'), { status: 400 });
  if (!/^[a-z0-9][a-z0-9-]{1,99}$/.test(normalizedKnowledgeId)) throw Object.assign(new Error('知识点 ID 无效'), { status: 400 });
  if (!TEACHING.has(teachingStatus)) throw Object.assign(new Error('教学状态无效'), { status: 400 });
  return {
    studentId: normalizedStudentId,
    knowledgeId: normalizedKnowledgeId,
    teachingStatus
  };
}
