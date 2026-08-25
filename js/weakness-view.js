export const WEAKNESS_STATUS_LABELS = Object.freeze({
  active: '需巩固',
  watching: '待观察',
  improving: '改善中'
});

export const WEAKNESS_STATUS_ORDER = Object.freeze(['active', 'watching', 'improving']);
const STUDENT_IDS = Object.freeze(['sister', 'brother']);
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,99}$/;
const text = value => typeof value === 'string' ? value.trim() : '';

export function normalizeWeaknessItem(value) {
  const knowledgeId = text(value?.knowledge_id);
  const title = text(value?.title);
  const status = text(value?.status);
  const lastSeenAt = text(value?.last_seen_at);
  if (!ID_PATTERN.test(knowledgeId) || !title || !WEAKNESS_STATUS_ORDER.includes(status) || !lastSeenAt) return null;
  return { knowledgeId, title, status, lastSeenAt };
}
export function sortWeaknessItems(items) {
  return [...items].sort((left, right) =>
    WEAKNESS_STATUS_ORDER.indexOf(left.status) - WEAKNESS_STATUS_ORDER.indexOf(right.status)
      || right.lastSeenAt.localeCompare(left.lastSeenAt)
      || left.title.localeCompare(right.title, 'zh-CN'));
}

export function normalizeWeaknessView(value) {
  const source = value && typeof value === 'object' ? value : {};
  const students = {};
  for (const studentId of STUDENT_IDS) {
    const items = Array.isArray(source.students?.[studentId]?.items) ? source.students[studentId].items : [];
    students[studentId] = { items: sortWeaknessItems(items.map(normalizeWeaknessItem).filter(Boolean)) };
  }
  return {
    schemaVersion: Number(source.schema_version) === 1 ? 1 : 1,
    sourceUpdatedAt: text(source.source_updated_at),
    sourceHash: text(source.source_hash),
    students
  };
}
