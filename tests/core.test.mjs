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

test('every knowledge point contains specific public notes instead of generated filler', async () => {
  const catalog = JSON.parse(await (await import('node:fs/promises')).readFile(
    new URL('../data/knowledge-catalog.json', import.meta.url), 'utf8'
  ));
  for (const point of normalizeCatalog(catalog)) {
    const content = knowledgeContent(point);
    assert.ok(content.idea.length >= 15, `${point.knowledgeId} needs a specific idea`);
    assert.ok(content.rules.length >= 2, `${point.knowledgeId} needs rules`);
    assert.ok(content.example, `${point.knowledgeId} needs an example`);
    assert.match(content.example, /[\d＝=<>＜＞÷×＋－]/, `${point.knowledgeId} needs a worked example`);
    assert.ok(content.caution, `${point.knowledgeId} needs a caution`);
    assert.doesNotMatch(JSON.stringify(content), /教材例题中找出|用估算检查结果|先说清概念和条件/);
  }
});

test('knowledge page uses inline accordion notes and keeps mastery out of note bodies', async () => {
  const { readFile } = await import('node:fs/promises');
  const [html, script] = await Promise.all([
    readFile(new URL('../knowledge.html', import.meta.url), 'utf8'),
    readFile(new URL('../js/knowledge.js', import.meta.url), 'utf8')
  ]);
  assert.match(html, /id="expandAll"/);
  assert.match(html, /id="collapseAll"/);
  assert.doesNotMatch(html, /knowledgeDialog|<dialog/);
  assert.match(script, /createElement\('details'\)/);
  assert.match(script, /核心理解/);
  assert.match(script, /具体方法/);
  assert.doesNotMatch(script, /查看原交接与证据层|statusSelector|进入详情可明确选择颜色/);
});

test('geometry course follows derivation order, expands principles by default, and keeps formulas visible', async () => {
  const { readFile } = await import('node:fs/promises');
  const [html, css, script] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../js/geometry.js', import.meta.url), 'utf8')
  ]);
  const chapters = ['chapter-boundary', 'chapter-rectangle', 'chapter-cut', 'chapter-circle', 'chapter-composite', 'chapter-solid', 'chapter-relation', 'chapter-motion'];
  let previous = -1;
  for (const chapter of chapters) {
    const position = html.indexOf(`id="${chapter}"`);
    assert.ok(position > previous, `${chapter} should follow the learning path`);
    previous = position;
  }
  assert.ok((html.match(/data-derivation/g) || []).length >= 6);
  assert.doesNotMatch(html, /data-prev|data-next|derivation-controls/);
  assert.match(html, /方格理解：每行方格数 × 行数/);
  assert.match(html, /扇形的弧围成圆锥底面一圈/);
  assert.match(html, /class="circle-quick-formulas"/);
  assert.match(html, /<h3>半圆<\/h3>/);
  assert.match(html, /id="rectAreaFormula"/);
  assert.match(html, /id="rectPerimeterFormula"/);
  assert.match(html, /<rect id="rectShape"[^>]*rx="0"/);
  assert.match(html, /id="showPrinciples"[^>]*aria-pressed="true"[^>]*>全部展开<\/button>/);
  assert.match(html, /id="hidePrinciples"[^>]*aria-pressed="false"[^>]*>只看图形与公式<\/button>/);
  assert.equal((html.match(/class="sector-piece/g) || []).length, 8);
  assert.doesNotMatch(html, /class="sector-row"/);
  assert.ok((html.match(/data-principle hidden/g) || []).length >= 10);
  assert.doesNotMatch(html, /class="formula-card[^>]*data-principle/);
  assert.doesNotMatch(html, /class="experiment-card[^>]*data-principle/);
  assert.match(script, /function setPrinciplesVisible\(visible\)/);
  assert.match(script, /setPrinciplesVisible\(true\)/);
  assert.doesNotMatch(script, /\.disabled\s*=/);
  assert.match(css, /--bg:\s*#eaf4ff/);
  assert.match(css, /\.area-formula\s*\{[^}]*background:\s*#eaf4ff/s);
  assert.match(css, /\.perimeter-formula\s*\{[^}]*background:\s*#fff1df/s);
  assert.match(css, /\.volume-formula\s*\{[^}]*background:\s*#f2edff/s);
  assert.match(css, /\.shape-fill\s*\{[^}]*var\(--shape-dark\)/s);
  assert.match(css, /--shape:\s*#64b3cf/);
  assert.doesNotMatch(css, /\.shape-fill\s*\{[^}]*207,\s*102,\s*117/s);
  assert.match(css, /\.derivation-card\s*\{[^}]*grid-template-columns:\s*repeat\(3/s);
  assert.match(script, /const GRID_UNIT = 20/);
  assert.match(script, /installUnitGrids\(\)/);
  assert.match(css, /\.svg-grid-minor\s*\{/);
  assert.doesNotMatch(css, /\.lab-canvas\s*\{[^}]*background-image:/s);
  assert.match(html, /每小格代表 1 个长度单位/);
  assert.match(html, /points="40,160 160,40 280,160"/);
  assert.match(html, /points="160,40 280,160 400,40"/);
  assert.match(html, /points="80,40 200,40 280,160 40,160"/);
  assert.match(html, /points="200,40 440,40 400,160 280,160"/);
  assert.match(script, /S＝a×b＝\$\{width\}×\$\{height\}/);
  assert.match(script, /S＝（a＋b）×h÷2/);
  assert.match(script, /V＝abh＝/);
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
