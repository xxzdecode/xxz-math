import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGradeCatalog, buildPublicCatalog } from '../scripts/import-material-hub-data.mjs';

test('grade catalog publishes grades one through seven in order without private fields', () => {
  const grades = Array.from({ length: 7 }, (_, index) => ({
    grade: index + 1,
    title: `${index + 1} 年级`,
    groups: [{ domain: '数与运算', items: [[`g${index + 1}-numbers`, '数的认识', '理解数的意义。']] }]
  }));
  const notes = Object.fromEntries(grades.map((_, index) => [`g${index + 1}-numbers`, {
    idea: '这是针对该知识点的具体核心理解。',
    rules: ['第一条具体规则', '第二条具体规则'],
    example: '2＋3＝5。',
    caution: '这里记录具体的易错点。'
  }]));
  const result = buildGradeCatalog(
    { schema_version: 1, grades },
    { schema_version: 1, notes },
    '2026-08-20T00:00:00.000Z'
  );
  assert.deepEqual(result.grades.map(value => value.grade), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(result.knowledge_points.length, 7);
  assert.equal(result.schema_version, 4);
  assert.equal(result.knowledge_points[0].notes.example, '2＋3＝5。');
  assert.doesNotMatch(JSON.stringify(result), /student_id|mastery_status|evidence/i);
});

const emptySequences = { schema_version: 1, sequences: [] };

test('public catalog strips every private or progress field', () => {
  const result = buildPublicCatalog({
    schema_version: 2,
    knowledge_points: [{
      knowledge_id: 'kp-1', stage: 'g6', domain: '图形', title: '圆',
      handoff_status: 'reported_taught', mastery_status: 'stable', teacher_note: 'private'
    }]
  }, emptySequences, '2026-08-19T00:00:00.000Z');
  assert.deepEqual(result.knowledge_points[0], {
    knowledge_id: 'kp-1', stage: 'g6', domain: '图形', title: '圆'
  });
  assert.equal(result.schema_version, 2);
  assert.equal(result.generated_at, '2026-08-19T00:00:00.000Z');
});

test('public catalog rejects duplicate or incomplete knowledge ids', () => {
  assert.throws(() => buildPublicCatalog({
    schema_version: 2,
    knowledge_points: [
      { knowledge_id: 'kp-1', stage: 'g6', domain: '图形', title: '圆' },
      { knowledge_id: 'kp-1', stage: 'g6', domain: '图形', title: '扇形' }
    ]
  }, emptySequences), /重复 ID/);
  assert.throws(() => buildPublicCatalog({ schema_version: 2, knowledge_points: [{}] }, emptySequences), /knowledge_id/);
});

test('public catalog imports an arbitrary number of knowledge points without student fields', () => {
  const sourcePoints = Array.from({ length: 137 }, (_, index) => ({
    knowledge_id: `textbook-kp-${index + 1}`,
    stage: index % 2 ? 'g7-semester-1' : 'g4-semester-1',
    domain: `单元 ${Math.floor(index / 10) + 1}`,
    title: `知识点 ${index + 1}`,
    handoff_status: 'not_reported',
    handoff_learning_stage: 'not_introduced_by_handoff',
    next_teaching_action: 'full_instruction_then_workbook',
    mastery_status: 'unverified'
  }));
  const result = buildPublicCatalog({ schema_version: 2, knowledge_points: sourcePoints }, emptySequences);
  assert.equal(result.knowledge_points.length, sourcePoints.length);
  assert.equal(result.knowledge_points.at(-1).knowledge_id, 'textbook-kp-137');
  assert.equal('handoff_status' in result.knowledge_points[0], false);
  assert.equal('next_teaching_action' in result.knowledge_points[0], false);
});

test('textbook order keeps only public titles, chapters and known knowledge ids', () => {
  const result = buildPublicCatalog({
    schema_version: 2,
    knowledge_points: [
      { knowledge_id: 'kp-1', stage: 'g7', domain: '整式', title: '整式' },
      { knowledge_id: 'kp-2', stage: 'g7', domain: '整式', title: '合并同类项' },
      { knowledge_id: 'extra', stage: 'g6-transition', domain: '衔接', title: '计算衔接' }
    ]
  }, {
    schema_version: 1,
    sequences: [{
      sequence_id: 'textbook-a', student_id: 'sister', textbook_file: 'private/path/沪教7上.pdf', workbook_file: 'private/workbook.pdf',
      chapters: [{ chapter: '第10章', knowledge_ids: ['kp-1', 'kp-2'] }]
    }]
  });
  assert.deepEqual(result.textbook_sequences, [{
    sequence_id: 'textbook-a', textbook_title: '沪教7上',
    chapters: [{ chapter: '第10章', knowledge_ids: ['kp-1', 'kp-2'] }]
  }]);
  assert.equal(JSON.stringify(result).includes('student_id'), false);
  assert.equal(JSON.stringify(result).includes('private/path'), false);
  assert.equal(JSON.stringify(result).includes('workbook_file'), false);
});

test('textbook order rejects unknown or repeated main-sequence nodes', () => {
  const catalog = {
    schema_version: 2,
    knowledge_points: [{ knowledge_id: 'kp-1', stage: 'g7', domain: '整式', title: '整式' }]
  };
  assert.throws(() => buildPublicCatalog(catalog, {
    schema_version: 1,
    sequences: [{ sequence_id: 'a', textbook_file: 'a.pdf', chapters: [{ chapter: '一', knowledge_ids: ['missing'] }] }]
  }), /未知知识点/);
  assert.throws(() => buildPublicCatalog(catalog, {
    schema_version: 1,
    sequences: [{ sequence_id: 'a', textbook_file: 'a.pdf', chapters: [
      { chapter: '一', knowledge_ids: ['kp-1'] }, { chapter: '二', knowledge_ids: ['kp-1'] }
    ] }]
  }), /重复引用/);
});
