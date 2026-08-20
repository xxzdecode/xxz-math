import test from 'node:test';
import assert from 'node:assert/strict';
import {
  angleKind,
  circleMetrics,
  cuboidMetrics,
  deriveDisplayStatus,
  describeProgressState,
  normalizeCatalog,
  normalizeProgress,
  organizeCatalog,
  rectangleMetrics,
  regularPolygonMetrics,
  solidMetrics,
  summarizeProgress,
  trapezoidMetrics,
  translatePoint,
  triangleMetrics
} from '../js/core.js';
import { knowledgeContent } from '../js/knowledge-content.js';

test('rectangle and triangle formulas', () => {
  assert.deepEqual(rectangleMetrics(8, 5), { area: 40, perimeter: 26 });
  assert.deepEqual(triangleMetrics(8, 6), { area: 24 });
});

test('circle sector and same-base same-height solids', () => {
  const circle = circleMetrics(3, 90);
  assert.ok(Math.abs(circle.sectorArea - Math.PI * 9 / 4) < 1e-10);
  const solid = solidMetrics(3, 8);
  assert.ok(Math.abs(solid.cylinderVolume / solid.coneVolume - 3) < 1e-10);
});

test('angle classification and trapezoid area follow geometry definitions', () => {
  assert.equal(angleKind(35), '锐角');
  assert.equal(angleKind(90), '直角');
  assert.equal(angleKind(120), '钝角');
  assert.equal(angleKind(180), '平角');
  assert.deepEqual(trapezoidMetrics(5, 9, 4), { area: 28 });
});

test('polygon, translation and cuboid calculations stay exact', () => {
  assert.deepEqual(regularPolygonMetrics(5, 4), { perimeter: 20, interiorAngleSum: 540, interiorAngle: 108 });
  assert.deepEqual(translatePoint(-2, 1, 3, 2), { x: 1, y: 3 });
  assert.deepEqual(cuboidMetrics(7, 4, 5), { volume: 140, surfaceArea: 166 });
});

test('every knowledge point receives useful public detail content', async () => {
  const catalog = JSON.parse(await (await import('node:fs/promises')).readFile(
    new URL('../data/knowledge-catalog.json', import.meta.url), 'utf8'
  ));
  for (const point of normalizeCatalog(catalog)) {
    const content = knowledgeContent(point);
    assert.ok(content.summary.length >= 15, `${point.knowledgeId} needs a summary`);
    assert.ok(content.rules.length >= 3, `${point.knowledgeId} needs rules`);
    assert.ok(content.example, `${point.knowledgeId} needs an example`);
    assert.ok(content.pitfall, `${point.knowledgeId} needs a pitfall`);
  }
});

test('catalog removes duplicate ids and progress stays student-specific', () => {
  const catalog = normalizeCatalog({ knowledge_points: [
    { knowledge_id: 'a', title: 'A' }, { knowledge_id: 'a', title: '重复' }, { knowledge_id: 'b', title: 'B' }
  ] });
  assert.deepEqual(catalog.map(item => item.knowledgeId), ['a', 'b']);
  const progress = normalizeProgress({ records: [
    { student_id: 'sister', knowledge_id: 'a', handoff_status: 'reported_taught' },
    { student_id: 'brother', knowledge_id: 'a', mastery_status: 'reinforce' }
  ] }, 'sister');
  assert.equal(progress.get('a').handoffStatus, 'reported_taught');
  assert.equal(progress.get('a').masteryStatus, 'unverified');
});

test('initial display colors use evidence first and current grade second', () => {
  assert.equal(deriveDisplayStatus({ studentId: 'sister', pointGrade: 6 }), 'yellow');
  assert.equal(deriveDisplayStatus({ studentId: 'sister', pointGrade: 7 }), 'red');
  assert.equal(deriveDisplayStatus({ studentId: 'brother', pointGrade: 3 }), 'yellow');
  assert.equal(deriveDisplayStatus({ studentId: 'brother', pointGrade: 4 }), 'red');
  assert.equal(deriveDisplayStatus({ studentId: 'brother', pointGrade: 4, teachingStatus: 'taught_by_us' }), 'yellow');
  assert.equal(deriveDisplayStatus({ studentId: 'sister', pointGrade: 7, masteryStatus: 'stable' }), 'green');
  assert.equal(deriveDisplayStatus({ studentId: 'sister', pointGrade: 6, handoffStatus: 'reported_needs_reinforcement' }), 'red');
});

test('handoff baseline determines next action without promoting mastery', () => {
  const taught = describeProgressState({
    handoffStatus: 'reported_taught', teachingStatus: 'not_recorded', masteryStatus: 'unverified'
  });
  assert.equal(taught.baselineLabel, '已接触但不扎实，待复习核验');
  assert.equal(taught.handoffLearningStage, 'introduced_needs_review');
  assert.equal(taught.nextAction, '旧题复习 / 诊断');
  assert.equal(taught.nextTeachingAction, 'scheduled_review_or_diagnostic');
  assert.equal(taught.masteryLabel, '待核验');

  const reinforce = describeProgressState({
    handoffStatus: 'reported_needs_reinforcement', teachingStatus: 'not_recorded', masteryStatus: 'unverified'
  });
  assert.equal(reinforce.baselineLabel, '按完全没学过处理');
  assert.equal(reinforce.handoffLearningStage, 'treat_as_new_instruction');
  assert.equal(reinforce.nextAction, '完整重教 + 对应《一课一练》');
  assert.equal(reinforce.nextTeachingAction, 'full_reteach_then_workbook');
  assert.equal(reinforce.masteryLabel, '待核验');

  const notReported = describeProgressState({
    handoffStatus: 'not_reported', teachingStatus: 'not_recorded', masteryStatus: 'unverified'
  });
  assert.equal(notReported.baselineLabel, '交接未提及，按新课处理');
  assert.equal(notReported.handoffLearningStage, 'not_introduced_by_handoff');
  assert.equal(notReported.nextAction, '新课完整教学 + 对应《一课一练》');
  assert.equal(notReported.nextTeachingAction, 'full_instruction_then_workbook');
  assert.equal(notReported.masteryLabel, '待核验');
});

test('catalog organization preserves textbook and chapter order and isolates supplements', () => {
  const view = organizeCatalog({
    knowledge_points: [
      { knowledge_id: 'supplement', stage: 'g6-transition', domain: '衔接', title: '衔接知识' },
      { knowledge_id: 'chapter-2', stage: 'g7', domain: '整式', title: '第二节' },
      { knowledge_id: 'chapter-1', stage: 'g7', domain: '整式', title: '第一节' }
    ],
    textbook_sequences: [{
      sequence_id: 'book', textbook_title: '教材', chapters: [
        { chapter: '第一章', knowledge_ids: ['chapter-1'] },
        { chapter: '第二章', knowledge_ids: ['chapter-2'] }
      ]
    }]
  });
  assert.deepEqual(view.textbooks[0].chapters.map(chapter => chapter.title), ['第一章', '第二章']);
  assert.deepEqual(view.textbooks[0].chapters.flatMap(chapter => chapter.items.map(item => item.knowledgeId)), ['chapter-1', 'chapter-2']);
  assert.deepEqual(view.supplementalGroups.flatMap(group => group.items.map(item => item.knowledgeId)), ['supplement']);
});

test('teacher summary counts three actions per student without promoting mastery', () => {
  const progress = normalizeProgress({ records: [
    { student_id: 'sister', knowledge_id: 'review', handoff_status: 'reported_taught', mastery_status: 'unverified' },
    { student_id: 'sister', knowledge_id: 'reteach', handoff_status: 'reported_needs_reinforcement', mastery_status: 'unverified' },
    { student_id: 'sister', knowledge_id: 'new', handoff_status: 'not_reported', mastery_status: 'unverified' },
    { student_id: 'brother', knowledge_id: 'other', handoff_status: 'reported_taught', mastery_status: 'unverified' }
  ] }, 'sister');
  assert.deepEqual(summarizeProgress(progress), {
    scheduled_review_or_diagnostic: 1,
    full_reteach_then_workbook: 1,
    full_instruction_then_workbook: 1,
    unverified: 3,
    total: 3
  });
});
