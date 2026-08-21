import './common.js?v=20260821-1';
import { DISPLAY_STATUS_LABELS, STUDENTS, describeProgressState, emptyProgressState, normalizeCatalog, normalizeProgress } from './core.js';
import { hasTeacherSession, isTeacherApiConfigured, loadProgress, saveDisplayStatus } from './api.js?v=20260820-3';
import { knowledgeContent } from './knowledge-content.js';

let catalogValue = null;
let progressValue = { schema_version: 2, records: [] };
let activeStudent = 'sister';
const expandedKnowledgeIds = new Set();

const GRADE_LIMIT = Object.freeze({ sister: 7, brother: 4 });
const STATUS_ORDER = Object.freeze(['red', 'yellow', 'green']);
const q = selector => document.querySelector(selector);

function currentFilters() {
  return {
    search: q('#knowledgeSearch').value.trim().toLowerCase(),
    grade: q('#gradeFilter').value,
    domain: q('#domainFilter').value
  };
}

function matchesFilters(item) {
  const filters = currentFilters();
  const content = knowledgeContent(item);
  const searchable = [item.title, item.domain, item.summary, content.idea, ...content.rules, content.example, content.caution]
    .filter(Boolean).join(' ').toLowerCase();
  return (!filters.search || searchable.includes(filters.search))
    && (filters.grade === 'all' || item.grade === Number(filters.grade))
    && (filters.domain === 'all' || item.domain === filters.domain);
}

function stateFor(progress, item) {
  return progress.get(item.knowledgeId) || emptyProgressState(activeStudent, item.grade);
}

function ensureLocalRecord(item, displayStatus) {
  progressValue ||= { schema_version: 2, records: [] };
  progressValue.records ||= [];
  let record = progressValue.records.find(value => value.student_id === activeStudent && value.knowledge_id === item.knowledgeId);
  if (!record) {
    record = {
      student_id: activeStudent,
      knowledge_id: item.knowledgeId,
      handoff_status: 'not_reported',
      teaching_status: 'not_recorded',
      mastery_status: 'unverified'
    };
    progressValue.records.push(record);
  }
  record.display_status = displayStatus;
  record.status_source = 'manual';
  record.status_updated_at = new Date().toISOString();
}

async function updateDisplayStatus(item, displayStatus) {
  if (!STATUS_ORDER.includes(displayStatus)) return false;
  try {
    await saveDisplayStatus(activeStudent, item.knowledgeId, displayStatus);
    ensureLocalRecord(item, displayStatus);
    q('#knowledgeStatus').textContent = `${item.title}：掌握状态已保存`;
    render();
    return true;
  } catch (error) {
    q('#knowledgeStatus').textContent = error?.message || '保存失败';
    return false;
  }
}

function appendNoteSection(parent, titleText, value, className = '') {
  const values = (Array.isArray(value) ? value : [value]).filter(Boolean);
  if (!values.length) return;
  const section = document.createElement('section');
  section.className = `knowledge-note-section ${className}`.trim();
  const title = document.createElement('h4');
  title.textContent = titleText;
  section.append(title);
  if (Array.isArray(value)) {
    const list = document.createElement('ol');
    for (const text of values) {
      const item = document.createElement('li');
      item.textContent = text;
      list.append(item);
    }
    section.append(list);
  } else {
    const paragraph = document.createElement('p');
    paragraph.textContent = value;
    section.append(paragraph);
  }
  parent.append(section);
}

function updateExpandControls() {
  const details = [...document.querySelectorAll('.knowledge-item')];
  const openCount = details.filter(item => item.open).length;
  q('#expandAll').disabled = !details.length || openCount === details.length;
  q('#collapseAll').disabled = !openCount;
}

function renderKnowledgeItem(item, state, teacherActive) {
  const details = document.createElement('details');
  details.className = 'knowledge-item';
  details.dataset.knowledgeId = item.knowledgeId;
  details.open = expandedKnowledgeIds.has(item.knowledgeId);

  const summary = document.createElement('summary');
  summary.className = 'knowledge-item-summary';
  const heading = document.createElement('span');
  heading.className = 'knowledge-open';
  const title = document.createElement('strong');
  title.textContent = item.title;
  const subtitle = document.createElement('small');
  subtitle.textContent = item.summary;
  heading.append(title, subtitle);
  summary.append(heading);

  if (teacherActive) {
    const display = describeProgressState(state);
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `mastery-dot ${display.displayStatus}`;
    dot.title = `${display.displayLabel}；点击切换状态`;
    dot.setAttribute('aria-label', `${item.title}：${display.displayLabel}，点击切换`);
    dot.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      const next = STATUS_ORDER[(STATUS_ORDER.indexOf(display.displayStatus) + 1) % STATUS_ORDER.length];
      dot.disabled = true;
      await updateDisplayStatus(item, next);
    });
    summary.append(dot);
  }

  const content = knowledgeContent(item);
  const body = document.createElement('div');
  body.className = 'knowledge-note';
  appendNoteSection(body, '核心理解', content.idea, 'idea');
  appendNoteSection(body, '具体方法', content.rules, 'method');
  appendNoteSection(body, '算例', content.example, 'example');
  appendNoteSection(body, '容易出错', content.caution, 'caution');
  details.append(summary, body);
  details.addEventListener('toggle', () => {
    if (details.open) expandedKnowledgeIds.add(item.knowledgeId);
    else expandedKnowledgeIds.delete(item.knowledgeId);
    updateExpandControls();
  });
  return details;
}

function renderTeacherSummary(items, progress, teacherActive) {
  const root = q('#teacherSummary');
  root.hidden = !teacherActive;
  root.replaceChildren();
  if (!teacherActive) return;
  const counts = { red: 0, yellow: 0, green: 0 };
  for (const item of items) counts[describeProgressState(stateFor(progress, item)).displayStatus] += 1;
  const heading = document.createElement('h2');
  heading.textContent = `${STUDENTS.find(value => value.id === activeStudent)?.name} 的掌握概览`;
  const grid = document.createElement('div');
  grid.className = 'teacher-summary-grid';
  for (const status of STATUS_ORDER) {
    const card = document.createElement('div');
    card.className = 'teacher-summary-item';
    const dot = document.createElement('span');
    dot.className = `mastery-dot ${status}`;
    dot.setAttribute('aria-hidden', 'true');
    const count = document.createElement('strong');
    count.textContent = counts[status];
    const label = document.createElement('span');
    label.textContent = DISPLAY_STATUS_LABELS[status];
    card.append(dot, count, label);
    grid.append(card);
  }
  const note = document.createElement('p');
  note.className = 'teacher-summary-note';
  note.textContent = '点击知识点标题展开笔记；点击右侧圆点直接在红、黄、绿之间循环切换。';
  root.append(heading, grid, note);
}

function render() {
  if (!catalogValue) return;
  const root = q('#knowledgeGroups');
  const teacherActive = hasTeacherSession();
  const progress = normalizeProgress(progressValue, activeStudent);
  const gradeLimit = teacherActive ? GRADE_LIMIT[activeStudent] : 7;
  const catalog = normalizeCatalog(catalogValue)
    .filter(item => item.grade >= 1 && item.grade <= gradeLimit)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const visible = catalog.filter(matchesFilters);
  q('#visibleKnowledgeCount').textContent = visible.length;
  q('#visibleGradeCount').textContent = new Set(visible.map(item => item.grade)).size;
  q('#visibleDomainCount').textContent = new Set(visible.map(item => item.domain)).size;
  root.replaceChildren();
  renderTeacherSummary(catalog, progress, teacherActive);

  for (let grade = 1; grade <= gradeLimit; grade += 1) {
    const gradeItems = visible.filter(item => item.grade === grade);
    if (!gradeItems.length) continue;
    const section = document.createElement('section');
    section.className = 'grade-map';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = `GRADE ${grade}`;
    const heading = document.createElement('h2');
    heading.textContent = `${grade} 年级`;
    section.append(eyebrow, heading);
    for (const domain of [...new Set(gradeItems.map(item => item.domain))]) {
      const group = document.createElement('section');
      group.className = 'knowledge-group';
      const groupTitle = document.createElement('h3');
      groupTitle.textContent = domain;
      const list = document.createElement('div');
      list.className = 'knowledge-list';
      gradeItems.filter(item => item.domain === domain).forEach(item => list.append(
        renderKnowledgeItem(item, stateFor(progress, item), teacherActive)
      ));
      group.append(groupTitle, list);
      section.append(group);
    }
    root.append(section);
  }
  q('#knowledgeEmpty').hidden = visible.length > 0;
  q('#studentSwitch').hidden = !teacherActive;
  const hint = q('#teacherProgressHint');
  hint.hidden = teacherActive;
  hint.textContent = isTeacherApiConfigured()
    ? '当前为公共知识地图。进入老师模式后可用圆点标记个人掌握状态。'
    : '当前为公共只读知识地图。教师服务尚未连接。';
  updateExpandControls();
}

async function refreshTeacherProgress() {
  if (!hasTeacherSession()) {
    progressValue = { schema_version: 2, records: [] };
    render();
    return;
  }
  q('#knowledgeStatus').textContent = '正在读取学生进度…';
  try {
    progressValue = await loadProgress();
    q('#knowledgeStatus').textContent = '学生进度已更新';
  } catch (error) {
    progressValue = { schema_version: 2, records: [] };
    q('#knowledgeStatus').textContent = error?.message || '学生进度读取失败';
  }
  render();
}

for (const student of STUDENTS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = `${student.label} · ${student.name}`;
  button.dataset.student = student.id;
  button.addEventListener('click', () => {
    activeStudent = student.id;
    document.querySelectorAll('[data-student]').forEach(item => item.classList.toggle('active', item.dataset.student === activeStudent));
    render();
  });
  q('#studentSwitch').append(button);
}
q('[data-student="sister"]')?.classList.add('active');

for (const selector of ['#knowledgeSearch', '#gradeFilter', '#domainFilter']) {
  q(selector).addEventListener(selector === '#knowledgeSearch' ? 'input' : 'change', render);
}
q('#expandAll').addEventListener('click', () => {
  document.querySelectorAll('.knowledge-item').forEach(details => {
    expandedKnowledgeIds.add(details.dataset.knowledgeId);
    details.open = true;
  });
  updateExpandControls();
});
q('#collapseAll').addEventListener('click', () => {
  document.querySelectorAll('.knowledge-item').forEach(details => {
    expandedKnowledgeIds.delete(details.dataset.knowledgeId);
    details.open = false;
  });
  updateExpandControls();
});

fetch('./data/knowledge-catalog.json')
  .then(response => response.ok ? response.json() : Promise.reject(new Error('知识点快照尚未生成')))
  .then(value => {
    catalogValue = value;
    const domains = [...new Set(normalizeCatalog(value).map(item => item.domain))];
    for (const domain of domains) {
      const option = document.createElement('option');
      option.value = domain;
      option.textContent = domain;
      q('#domainFilter').append(option);
    }
    render();
    return refreshTeacherProgress();
  })
  .catch(error => { q('#knowledgeStatus').textContent = error.message; });

document.addEventListener('teacher-session-changed', refreshTeacherProgress);
