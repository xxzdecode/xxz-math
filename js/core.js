export const STUDENTS = Object.freeze([
  { id: 'sister', label: '姐姐', name: 'Crystal', currentGrade: 7 },
  { id: 'brother', label: '弟弟', name: 'Gavin', currentGrade: 4 }
]);

export const STATUS_LABELS = Object.freeze({
  unverified: '待核验',
  learning: '学习中',
  stable: '实测稳定',
  reinforce: '需要巩固'
});

export const DISPLAY_STATUS_LABELS = Object.freeze({
  red: '未掌握或尚未教授',
  yellow: '已教授，掌握待确认',
  green: '确认已经掌握'
});

export const HANDOFF_LABELS = Object.freeze({
  not_reported: '交接未提及，按新课处理',
  reported_taught: '已接触但不扎实，待复习核验',
  reported_needs_reinforcement: '按完全没学过处理'
});

export const HANDOFF_ACTIONS = Object.freeze({
  not_reported: '新课完整教学 + 对应《一课一练》',
  reported_taught: '旧题复习 / 诊断',
  reported_needs_reinforcement: '完整重教 + 对应《一课一练》'
});

export const HANDOFF_LEARNING_STAGES = Object.freeze({
  not_reported: 'not_introduced_by_handoff',
  reported_taught: 'introduced_needs_review',
  reported_needs_reinforcement: 'treat_as_new_instruction'
});

export const HANDOFF_ACTION_CODES = Object.freeze({
  not_reported: 'full_instruction_then_workbook',
  reported_taught: 'scheduled_review_or_diagnostic',
  reported_needs_reinforcement: 'full_reteach_then_workbook'
});

export const TEACHING_LABELS = Object.freeze({
  not_recorded: '我们尚未记录教学',
  learning: '我们正在教学',
  taught_by_us: '我们已完成教学'
});

const STUDENT_IDS = new Set(STUDENTS.map(student => student.id));
const HANDOFF_STATUSES = new Set(Object.keys(HANDOFF_LABELS));
const TEACHING_STATUSES = new Set(Object.keys(TEACHING_LABELS));
const MASTERY_STATUSES = new Set(Object.keys(STATUS_LABELS));
const STUDENT_CURRENT_GRADES = new Map(STUDENTS.map(student => [student.id, student.currentGrade]));

const text = value => typeof value === 'string' ? value.trim() : '';

export function deriveDisplayStatus({
  studentId,
  pointGrade,
  handoffStatus = 'not_reported',
  teachingStatus = 'not_recorded',
  masteryStatus = 'unverified'
} = {}) {
  if (masteryStatus === 'stable') return 'green';
  if (masteryStatus === 'reinforce' || handoffStatus === 'reported_needs_reinforcement') return 'red';
  if (teachingStatus === 'learning' || teachingStatus === 'taught_by_us' || handoffStatus === 'reported_taught') return 'yellow';
  const currentGrade = STUDENT_CURRENT_GRADES.get(studentId);
  return currentGrade && Number(pointGrade) >= currentGrade ? 'red' : 'yellow';
}

export function rectangleMetrics(width, height) {
  return { area: width * height, perimeter: 2 * (width + height) };
}

export function triangleMetrics(base, height) {
  return { area: base * height / 2 };
}

export function parallelogramMetrics(base, side, height) {
  return { area: base * height, perimeter: 2 * (base + side) };
}

export function trapezoidMetrics(topBase, bottomBase, height) {
  return { area: (topBase + bottomBase) * height / 2 };
}

export function regularPolygonMetrics(sides, sideLength) {
  return {
    perimeter: sides * sideLength,
    interiorAngleSum: (sides - 2) * 180,
    interiorAngle: (sides - 2) * 180 / sides
  };
}

export function translatePoint(x, y, deltaX, deltaY) {
  return { x: x + deltaX, y: y + deltaY };
}

export function cuboidMetrics(length, width, height) {
  return {
    volume: length * width * height,
    surfaceArea: 2 * (length * width + length * height + width * height)
  };
}

export function angleKind(angle) {
  if (angle === 0) return '零角';
  if (angle < 90) return '锐角';
  if (angle === 90) return '直角';
  if (angle < 180) return '钝角';
  if (angle === 180) return '平角';
  return '优角';
}

export function circleMetrics(radius, angle = 360) {
  return {
    circumference: 2 * Math.PI * radius,
    area: Math.PI * radius * radius,
    arcLength: 2 * Math.PI * radius * angle / 360,
    sectorArea: Math.PI * radius * radius * angle / 360
  };
}

export function solidMetrics(radius, height) {
  const baseArea = Math.PI * radius * radius;
  return {
    cylinderVolume: baseArea * height,
    coneVolume: baseArea * height / 3,
    cylinderLateralArea: 2 * Math.PI * radius * height,
    cylinderSurfaceArea: 2 * baseArea + 2 * Math.PI * radius * height
  };
}

export function normalizeCatalog(value) {
  const points = Array.isArray(value?.knowledge_points) ? value.knowledge_points : [];
  const seen = new Set();
  return points.filter(point => {
    const id = text(point?.knowledge_id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map(point => ({
    knowledgeId: text(point.knowledge_id),
    stage: text(point.stage),
    domain: text(point.domain) || '其他',
    title: text(point.title) || text(point.knowledge_id),
    curriculumDomain: text(point.curriculum_domain),
    objectiveTags: Array.isArray(point.objective_tags) ? point.objective_tags.map(text).filter(Boolean) : [],
    textbookRef: text(point.textbook_ref),
    grade: Number(point.grade) || Number(String(point.stage || '').replace(/^g/, '')) || 0,
    summary: text(point.summary),
    sortOrder: Number(point.sort_order) || 0
  }));
}

export function organizeCatalog(value) {
  const catalog = normalizeCatalog(value);
  const pointById = new Map(catalog.map(point => [point.knowledgeId, point]));
  const sequenced = new Set();
  const sourceSequences = Array.isArray(value?.textbook_sequences) ? value.textbook_sequences : [];
  const textbooks = sourceSequences.flatMap(sequence => {
    const sequenceId = text(sequence?.sequence_id);
    const textbookTitle = text(sequence?.textbook_title);
    if (!sequenceId || !textbookTitle || !Array.isArray(sequence?.chapters)) return [];
    const chapters = sequence.chapters.flatMap(chapter => {
      const title = text(chapter?.chapter);
      if (!title || !Array.isArray(chapter?.knowledge_ids)) return [];
      const items = chapter.knowledge_ids.flatMap(value => {
        const knowledgeId = text(value);
        const point = pointById.get(knowledgeId);
        if (!point || sequenced.has(knowledgeId)) return [];
        sequenced.add(knowledgeId);
        return [point];
      });
      return items.length ? [{ title, items }] : [];
    });
    return chapters.length ? [{ sequenceId, textbookTitle, chapters }] : [];
  });

  const supplementalMap = new Map();
  for (const item of catalog) {
    if (sequenced.has(item.knowledgeId)) continue;
    const key = `${item.stage}|${item.domain}`;
    if (!supplementalMap.has(key)) supplementalMap.set(key, { stage: item.stage, domain: item.domain, items: [] });
    supplementalMap.get(key).items.push(item);
  }
  return { catalog, textbooks, supplementalGroups: [...supplementalMap.values()] };
}

export function normalizeProgress(value, studentId) {
  if (!STUDENT_IDS.has(studentId)) return new Map();
  const records = Array.isArray(value?.records) ? value.records : [];
  return new Map(records
    .filter(record => record?.student_id === studentId && text(record?.knowledge_id))
    .map(record => [text(record.knowledge_id), {
      handoffStatus: HANDOFF_STATUSES.has(record.handoff_status) ? record.handoff_status : 'not_reported',
      teachingStatus: TEACHING_STATUSES.has(record.teaching_status) ? record.teaching_status : 'not_recorded',
      masteryStatus: MASTERY_STATUSES.has(record.mastery_status) ? record.mastery_status : 'unverified',
      displayStatus: ['red', 'yellow', 'green'].includes(record.display_status)
        ? record.display_status
        : deriveDisplayStatus({
          studentId,
          pointGrade: Number(record.grade) || Number(text(record.knowledge_id).match(/^g(\d+)-/)?.[1]) || 0,
          handoffStatus: record.handoff_status,
          teachingStatus: record.teaching_status,
          masteryStatus: record.mastery_status
        }),
      statusSource: text(record.status_source) || 'legacy_mapping',
      statusUpdatedAt: text(record.status_updated_at)
    }]));
}

export function emptyProgressState(studentId, pointGrade) {
  return {
    handoffStatus: 'not_reported',
    teachingStatus: 'not_recorded',
    masteryStatus: 'unverified',
    displayStatus: deriveDisplayStatus({ studentId, pointGrade }),
    statusSource: 'initial_assumption',
    statusUpdatedAt: ''
  };
}

export function describeProgressState(state = emptyProgressState()) {
  const handoffStatus = HANDOFF_STATUSES.has(state.handoffStatus) ? state.handoffStatus : 'not_reported';
  const teachingStatus = TEACHING_STATUSES.has(state.teachingStatus) ? state.teachingStatus : 'not_recorded';
  const masteryStatus = MASTERY_STATUSES.has(state.masteryStatus) ? state.masteryStatus : 'unverified';
  return {
    baselineLabel: HANDOFF_LABELS[handoffStatus],
    handoffLearningStage: HANDOFF_LEARNING_STAGES[handoffStatus],
    nextAction: HANDOFF_ACTIONS[handoffStatus],
    nextTeachingAction: HANDOFF_ACTION_CODES[handoffStatus],
    teachingLabel: TEACHING_LABELS[teachingStatus],
    masteryLabel: STATUS_LABELS[masteryStatus],
    masteryStatus,
    displayStatus: ['red', 'yellow', 'green'].includes(state.displayStatus) ? state.displayStatus : 'yellow',
    displayLabel: DISPLAY_STATUS_LABELS[state.displayStatus] || DISPLAY_STATUS_LABELS.yellow,
    statusSource: state.statusSource || 'initial_assumption',
    statusUpdatedAt: state.statusUpdatedAt || ''
  };
}

export function summarizeProgress(progress) {
  const counts = {
    scheduled_review_or_diagnostic: 0,
    full_reteach_then_workbook: 0,
    full_instruction_then_workbook: 0,
    unverified: 0,
    total: 0
  };
  if (!(progress instanceof Map)) return counts;
  for (const state of progress.values()) {
    const display = describeProgressState(state);
    counts[display.nextTeachingAction] += 1;
    if (display.masteryStatus === 'unverified') counts.unverified += 1;
    counts.total += 1;
  }
  return counts;
}
