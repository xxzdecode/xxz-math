import './common.js?v=20260820-3';
import { DISPLAY_STATUS_LABELS, STUDENTS, describeProgressState, emptyProgressState, normalizeCatalog, normalizeProgress } from './core.js';
import { hasTeacherSession, isTeacherApiConfigured, loadProgress, saveDisplayStatus } from './api.js?v=20260820-3';
import { knowledgeContent } from './knowledge-content.js';

let catalogValue = null;
let progressValue = { schema_version: 2, records: [] };
let activeStudent = 'sister';

const GRADE_LIMIT = Object.freeze({ sister: 7, brother: 4 });
const STATUS_ORDER = Object.freeze(['red', 'yellow', 'green']);
const SOURCE_LABELS = Object.freeze({
  manual: '老师手动判断',
  initial_assumption: '初始待核验',
  legacy_mapping: '由原交接状态转换',
  analysis: '错题分析建议'
});
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
  const searchable = [item.title, item.domain, item.summary, content.summary, ...(content.rules || []), content.example, content.pitfall]
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

async function updateDisplayStatus(item, displayStatus, messageNode = null) {
  if (!STATUS_ORDER.includes(displayStatus)) return false;
  if (messageNode) messageNode.textContent = '正在保存…';
  try {
    await saveDisplayStatus(activeStudent, item.knowledgeId, displayStatus);
    ensureLocalRecord(item, displayStatus);
    if (messageNode) messageNode.textContent = '掌握状态已保存';
    render();
    return true;
  } catch (error) {
    if (messageNode) messageNode.textContent = error?.message || '保存失败';
    else q('#knowledgeStatus').textContent = error?.message || '保存失败';
    return false;
  }
}

function appendDetailList(parent, title, values) {
  const items = (Array.isArray(values) ? values : [values]).filter(Boolean);
  if (!items.length) return;
  const heading = document.createElement('h3');
  heading.textContent = title;
  const list = document.createElement('ul');
  for (const value of items) {
    const item = document.createElement('li');
    item.textContent = value;
    list.append(item);
  }
  parent.append(heading, list);
}

function statusSelector(item, state, message) {
  const root = document.createElement('div');
  root.className = 'status-selector';
  for (const status of STATUS_ORDER) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `status-choice ${status}`;
    button.dataset.selected = String(state.displayStatus === status);
    const dot = document.createElement('span');
    dot.className = `mastery-dot ${status}`;
    dot.setAttribute('aria-hidden', 'true');
    button.append(dot, document.createTextNode(DISPLAY_STATUS_LABELS[status]));
    button.addEventListener('click', async () => {
      root.querySelectorAll('button').forEach(value => { value.disabled = true; });
      const saved = await updateDisplayStatus(item, status, message);
      root.querySelectorAll('button').forEach(value => { value.disabled = false; });
      if (saved) root.querySelectorAll('button').forEach(value => { value.dataset.selected = String(value === button); });
    });
    root.append(button);
  }
  return root;
}

function openKnowledgeDialog(item, state, teacherActive) {
  const dialog = q('#knowledgeDialog');
  const root = q('#knowledgeDialogContent');
  const content = knowledgeContent(item);
  const display = describeProgressState(state);
  root.replaceChildren();
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = `${item.grade} 年级 · ${item.domain}`;
  const title = document.createElement('h2');
  title.textContent = item.title;
  const summary = document.createElement('p');
  summary.className = 'knowledge-detail-summary';
  summary.textContent = item.summary || content.summary;
  root.append(eyebrow, title, summary);
  appendDetailList(root, '关键规则', content.rules);
  appendDetailList(root, '例子', content.example);
  appendDetailList(root, '容易出错', content.pitfall);
  if (teacherActive) {
    const privateSection = document.createElement('section');
    privateSection.className = 'knowledge-private-detail';
    const privateTitle = document.createElement('h3');
    privateTitle.textContent = '掌握状态';
    const message = document.createElement('p');
    message.className = 'inline-status';
    message.setAttribute('aria-live', 'polite');
    privateSection.append(privateTitle, statusSelector(item, display, message));
    const meta = document.createElement('p');
    meta.className = 'status-source';
    const source = SOURCE_LABELS[display.statusSource] || display.statusSource;
    meta.textContent = `来源：${source}${display.statusUpdatedAt ? ` · 更新于 ${new Date(display.statusUpdatedAt).toLocaleString('zh-CN')}` : ''}`;
    privateSection.append(meta);
    const detail = document.createElement('details');
    const detailTitle = document.createElement('summary');
    detailTitle.textContent = '查看原交接与证据层';
    const detailList = document.createElement('ul');
    [
      `交接教学层：${display.baselineLabel}`,
      `下一动作：${display.nextAction}`,
      `我们的教学：${display.teachingLabel}`,
      `原实测记录：${display.masteryLabel}`
    ].forEach(value => {
      const li = document.createElement('li');
      li.textContent = value;
      detailList.append(li);
    });
    detail.append(detailTitle, detailList);
    privateSection.append(detail, message);
    root.append(privateSection);
  }
  dialog.showModal();
}

function renderKnowledgeItem(item, state, teacherActive) {
  const article = document.createElement('article');
  article.className = 'knowledge-item';
  article.dataset.knowledgeId = item.knowledgeId;
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'knowledge-open';
  open.setAttribute('aria-label', `查看${item.title}详情`);
  const title = document.createElement('strong');
  title.textContent = item.title;
  const subtitle = document.createElement('small');
  subtitle.textContent = item.summary;
  open.append(title, subtitle);
  open.addEventListener('click', () => openKnowledgeDialog(item, state, teacherActive));
  article.append(open);
  if (teacherActive) {
    const display = describeProgressState(state);
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `mastery-dot ${display.displayStatus}`;
    dot.title = `${display.displayLabel}；点击切换状态`;
    dot.setAttribute('aria-label', `${item.title}：${display.displayLabel}，点击切换`);
    dot.addEventListener('click', async () => {
      const next = STATUS_ORDER[(STATUS_ORDER.indexOf(display.displayStatus) + 1) % STATUS_ORDER.length];
      dot.disabled = true;
      await updateDisplayStatus(item, next);
      dot.disabled = false;
    });
    article.append(dot);
  }
  return article;
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
  note.textContent = '圆点可直接点击循环切换；进入详情可明确选择颜色。未来错题分析只会作用于对应的小知识点。';
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
    const domains = [...new Set(gradeItems.map(item => item.domain))];
    for (const domain of domains) {
      const group = document.createElement('section');
      group.className = 'knowledge-group';
      const groupTitle = document.createElement('h3');
      groupTitle.textContent = domain;
      const list = document.createElement('div');
      list.className = 'knowledge-list';
      gradeItems.filter(item => item.domain === domain).forEach(item => list.append(renderKnowledgeItem(
        item, stateFor(progress, item), teacherActive
      )));
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
    ? '当前为公共知识地图。进入老师模式后可查看并修改个人掌握状态。'
    : '当前为公共只读知识地图。教师服务尚未连接。';
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
q('#knowledgeDialog .dialog-close').addEventListener('click', () => q('#knowledgeDialog').close());
q('#knowledgeDialog').addEventListener('click', event => {
  if (event.target === event.currentTarget) event.currentTarget.close();
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
