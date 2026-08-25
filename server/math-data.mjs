import { STUDENTS } from '../js/core.js';

const STUDENT_IDS = new Set(STUDENTS.map(student => student.id));
const HANDOFF = new Set(['not_reported', 'reported_taught', 'reported_needs_reinforcement']);
const TEACHING = new Set(['not_recorded', 'learning', 'taught_by_us']);
const MASTERY = new Set(['unverified', 'learning', 'stable', 'reinforce']);
const DISPLAY = new Set(['red', 'yellow', 'green']);
const WEAKNESS = new Set(['watching', 'active', 'improving']);

const text = value => typeof value === 'string' ? value.trim() : '';

export function teacherProgressResponse(value) {
  const records = Array.isArray(value?.records) ? value.records : [];
  return {
    schema_version: 2,
    records: records.flatMap(record => {
      const studentId = text(record?.student_id);
      const knowledgeId = text(record?.knowledge_id);
      if (!STUDENT_IDS.has(studentId) || !knowledgeId) return [];
      const safe = {
        student_id: studentId,
        knowledge_id: knowledgeId,
        handoff_status: HANDOFF.has(record.handoff_status) ? record.handoff_status : 'not_reported',
        teaching_status: TEACHING.has(record.teaching_status) ? record.teaching_status : 'not_recorded',
        mastery_status: MASTERY.has(record.mastery_status) ? record.mastery_status : 'unverified'
      };
      if (DISPLAY.has(record.display_status)) safe.display_status = record.display_status;
      if (['manual', 'initial_assumption', 'legacy_mapping', 'analysis'].includes(record.status_source)) safe.status_source = record.status_source;
      if (text(record.status_updated_at)) safe.status_updated_at = text(record.status_updated_at);
      return [safe];
    })
  };
}

export function teacherWeaknessResponse(value) {
  const students = {};
  for (const studentId of STUDENT_IDS) {
    const items = Array.isArray(value?.students?.[studentId]?.items) ? value.students[studentId].items : [];
    students[studentId] = {
      items: items.flatMap(item => {
        const knowledgeId = text(item?.knowledge_id);
        const title = text(item?.title);
        const status = text(item?.status);
        const lastSeenAt = text(item?.last_seen_at);
        if (!/^[a-z0-9][a-z0-9-]{1,99}$/.test(knowledgeId) || !title || !WEAKNESS.has(status) || !lastSeenAt) return [];
        return [{ knowledge_id: knowledgeId, title, status, last_seen_at: lastSeenAt }];
      })
    };
  }
  return {
    schema_version: 1,
    source_updated_at: text(value?.source_updated_at),
    source_hash: text(value?.source_hash),
    students
  };
}

export function validateDisplayStatusUpdate(studentId, knowledgeId, displayStatus) {
  const normalizedStudentId = text(studentId);
  const normalizedKnowledgeId = text(knowledgeId);
  if (!STUDENT_IDS.has(normalizedStudentId)) throw Object.assign(new Error('学生身份无效'), { status: 400 });
  if (!/^[a-z0-9][a-z0-9-]{1,99}$/.test(normalizedKnowledgeId)) throw Object.assign(new Error('知识点 ID 无效'), { status: 400 });
  if (!DISPLAY.has(displayStatus)) throw Object.assign(new Error('掌握状态无效'), { status: 400 });
  return { studentId: normalizedStudentId, knowledgeId: normalizedKnowledgeId, displayStatus };
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
