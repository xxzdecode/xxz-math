import './common.js?v=20260820-1';
import { STUDENTS, describeProgressState, emptyProgressState, normalizeProgress, organizeCatalog, summarizeProgress } from './core.js';
import { hasTeacherSession, isTeacherApiConfigured, loadProgress, saveTeachingStatus } from './api.js?v=20260820-1';
import { knowledgeContent } from './knowledge-content.js';

let catalogValue = null;
let progressValue = null;
let activeStudent = 'sister';
const STAGE_LABELS = Object.freeze({ 'g6-transition': '六年级｜小初衔接', g7: '七年级', g4: '四年级' });

const statusClass = status => ['stable', 'reinforce', 'learning'].includes(status) ? status : 'unverified';

function filters() {
  return {
    search: document.querySelector('#knowledgeSearch').value.trim().toLowerCase(),
    stage: document.querySelector('#stageFilter').value,
    domain: document.querySelector('#domainFilter').value,
    source: document.querySelector('#sourceFilter').value
  };
}

function matchesFilters(item, location) {
  const current = filters();
  const content = knowledgeContent(item);
  const searchable = [
    item.title, item.domain, item.curriculumDomain, item.textbookRef,
    ...(item.objectiveTags || []), content.summary, ...(content.rules || []), content.example, content.pitfall,
    location?.textbookTitle, location?.chapter
  ].filter(Boolean).join(' ').toLowerCase();
  return (!current.search || searchable.includes(current.search))
    && (current.stage === 'all' || item.stage === current.stage)
    && (current.domain === 'all' || item.domain === current.domain)
    && (current.source === 'all' || current.source === (location ? 'textbook' : 'supplement'));
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

function openKnowledgeDialog(item, location, state, teacherActive) {
  const dialog = document.querySelector('#knowledgeDialog');
  const root = document.querySelector('#knowledgeDialogContent');
  const content = knowledgeContent(item);
  root.replaceChildren();
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = `${STAGE_LABELS[item.stage] || item.stage} · ${item.domain}`;
  const title = document.createElement('h2');
  title.textContent = item.title;
  const summary = document.createElement('p');
  summary.className = 'knowledge-detail-summary';
  summary.textContent = content.summary;
  root.append(eyebrow, title, summary);
  const meta = document.createElement('div');
  meta.className = 'knowledge-detail-meta';
  const locationText = location ? `${location.textbookTitle} · ${location.chapter}` : '衔接与补充';
  [locationText, item.textbookRef, ...(item.objectiveTags || [])].filter(Boolean).forEach(value => {
    const tag = document.createElement('span');
    tag.textContent = value;
    meta.append(tag);
  });
  root.append(meta);
  appendDetailList(root, '核心要点', content.rules);
  appendDetailList(root, '例子', content.example);
  appendDetailList(root, '容易出错', content.pitfall);
  if (teacherActive) {
    const display = describeProgressState(state);
    const privateSection = document.createElement('section');
    privateSection.className = 'knowledge-private-detail';
    const privateTitle = document.createElement('h3');
    privateTitle.textContent = '教师状态';
    const privateList = document.createElement('ul');
    [
      `交接教学层：${display.baselineLabel}`,
      `下一动作：${display.nextAction}`,
      `我们的教学：${display.teachingLabel}`,
      `实测掌握：${display.masteryLabel}`
    ].forEach(value => {
      const listItem = document.createElement('li'); listItem.textContent = value; privateList.append(listItem);
    });
    privateSection.append(privateTitle, privateList);
    const update = document.createElement('div');
    update.className = 'teaching-status-editor';
    const label = document.createElement('label');
    label.textContent = '更新我们的教学状态';
    const select = document.createElement('select');
    [
      ['not_recorded', '尚未记录教学'],
      ['learning', '正在教学或练习'],
      ['taught_by_us', '我们已完成教学']
    ].forEach(([value, text]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
    });
    select.value = state.teachingStatus;
    const save = document.createElement('button');
    save.type = 'button'; save.className = 'primary-button'; save.textContent = '保存教学状态';
    const message = document.createElement('p');
    message.className = 'inline-status'; message.setAttribute('aria-live', 'polite');
    save.addEventListener('click', async () => {
      save.disabled = true; message.textContent = '正在保存…';
      try {
        await saveTeachingStatus(activeStudent, item.knowledgeId, select.value);
        const record = progressValue?.records?.find(value => value.student_id === activeStudent && value.knowledge_id === item.knowledgeId);
        if (record) record.teaching_status = select.value;
        message.textContent = '教学状态已保存';
        render();
      } catch (error) {
        message.textContent = error?.message || '保存失败';
      } finally {
        save.disabled = false;
      }
    });
    label.append(select);
    update.append(label, save, message);
    privateSection.append(update);
    root.append(privateSection);
  }
  dialog.showModal();
}

function renderKnowledgeItem(item, state, teacherActive, location) {
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
  subtitle.textContent = (item.objectiveTags || []).slice(0, 3).join(' · ') || item.curriculumDomain || item.domain;
  open.append(title, subtitle);
  open.addEventListener('click', () => openKnowledgeDialog(item, location, state, teacherActive));
  article.append(open);
  if (teacherActive) {
    const display = describeProgressState(state);
    const stack = document.createElement('div');
    stack.className = 'status-stack';
    const status = document.createElement('span');
    status.className = `status ${statusClass(display.masteryStatus)}`;
    status.textContent = `实测掌握：${display.masteryLabel}`;
    const handoff = document.createElement('small');
    handoff.textContent = `交接基线：${display.baselineLabel}`;
    const action = document.createElement('small');
    action.textContent = `下一动作：${display.nextAction}`;
    const teaching = document.createElement('small');
    teaching.textContent = `我们的教学：${display.teachingLabel}`;
    stack.append(status, handoff, action, teaching);
    article.append(stack);
  } else {
    const status = document.createElement('span');
    status.className = 'status public';
    status.textContent = '通用知识';
    article.append(status);
  }
  return article;
}

function appendKnowledgeGroup(parent, headingLevel, headingText, items, progress, teacherActive, locationFor) {
  const visibleItems = items.filter(item => (!teacherActive || progress.has(item.knowledgeId)) && matchesFilters(item, locationFor(item)));
  if (!visibleItems.length) return false;
  const section = document.createElement('section');
  section.className = 'knowledge-group';
  const heading = document.createElement(headingLevel);
  heading.textContent = headingText;
  const list = document.createElement('div');
  list.className = 'knowledge-list';
  section.append(heading, list);
  visibleItems.forEach(item => list.append(renderKnowledgeItem(
    item,
    progress.get(item.knowledgeId) || emptyProgressState(),
    teacherActive,
    locationFor(item)
  )));
  parent.append(section);
  return true;
}

function renderTeacherSummary(progress, teacherActive) {
  const root = document.querySelector('#teacherSummary');
  root.replaceChildren();
  root.hidden = !teacherActive || !progressValue;
  if (root.hidden) return;
  const counts = summarizeProgress(progress);
  const labels = [
    ['scheduled_review_or_diagnostic', '复习诊断'],
    ['full_reteach_then_workbook', '完整重教 + 一课一练'],
    ['full_instruction_then_workbook', '新课完整教学 + 一课一练']
  ];
  const heading = document.createElement('h2');
  heading.textContent = '教师教学概览';
  const list = document.createElement('div');
  list.className = 'teacher-summary-grid';
  for (const [code, label] of labels) {
    const item = document.createElement('div');
    item.className = 'teacher-summary-item';
    item.innerHTML = `<strong>${counts[code]}</strong><span>${label}</span>`;
    list.append(item);
  }
  const mastery = document.createElement('p');
  mastery.className = 'teacher-summary-note';
  mastery.textContent = `实测掌握仍待核验：${counts.unverified} 项。交接记录只决定教学起点，不代表已经掌握。`;
  root.append(heading, list, mastery);
}

function render() {
  const root = document.querySelector('#knowledgeGroups');
  const teacherActive = hasTeacherSession();
  const progress = normalizeProgress(progressValue, activeStudent);
  const view = organizeCatalog(catalogValue);
  const locationMap = new Map();
  for (const textbook of view.textbooks) {
    for (const chapter of textbook.chapters) {
      for (const item of chapter.items) locationMap.set(item.knowledgeId, { textbookTitle: textbook.textbookTitle, chapter: chapter.title });
    }
  }
  const eligibleCatalog = view.catalog.filter(item => !teacherActive || progress.has(item.knowledgeId));
  const visibleCatalog = eligibleCatalog.filter(item => matchesFilters(item, locationMap.get(item.knowledgeId)));
  document.querySelector('#visibleKnowledgeCount').textContent = visibleCatalog.length;
  document.querySelector('#textbookKnowledgeCount').textContent = visibleCatalog.filter(item => locationMap.has(item.knowledgeId)).length;
  document.querySelector('#supplementKnowledgeCount').textContent = visibleCatalog.filter(item => !locationMap.has(item.knowledgeId)).length;
  root.replaceChildren();
  renderTeacherSummary(progress, teacherActive);
  for (const textbook of view.textbooks) {
    const section = document.createElement('section');
    section.className = 'textbook-map';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = '教材主序';
    const heading = document.createElement('h2');
    heading.textContent = textbook.textbookTitle;
    section.append(eyebrow, heading);
    let hasItems = false;
    for (const chapter of textbook.chapters) {
      hasItems = appendKnowledgeGroup(
        section, 'h3', chapter.title, chapter.items, progress, teacherActive,
        item => locationMap.get(item.knowledgeId)
      ) || hasItems;
    }
    if (hasItems) root.append(section);
  }
  const supplemental = document.createElement('section');
  supplemental.className = 'supplement-map';
  const supplementalHeading = document.createElement('h2');
  supplementalHeading.textContent = '衔接与补充';
  const supplementalIntro = document.createElement('p');
  supplementalIntro.textContent = '未列入本册教材主序、但仍需衔接复习或补充教学的通用知识。';
  supplemental.append(supplementalHeading, supplementalIntro);
  let hasSupplementalItems = false;
  for (const group of view.supplementalGroups) {
    const stage = STAGE_LABELS[group.stage] || group.stage || '其他';
    hasSupplementalItems = appendKnowledgeGroup(
      supplemental, 'h3', `${stage} · ${group.domain}`, group.items, progress, teacherActive, () => null
    ) || hasSupplementalItems;
  }
  if (hasSupplementalItems) root.append(supplemental);
  document.querySelector('#knowledgeEmpty').hidden = visibleCatalog.length > 0;
  const hint = document.querySelector('#teacherProgressHint');
  hint.hidden = teacherActive;
  hint.textContent = isTeacherApiConfigured()
    ? '当前为公共视图。学生状态需要进入老师模式。'
    : '当前为公共只读视图。教师服务尚未连接，学生状态不会加载。';
  document.querySelector('#studentSwitch').hidden = !teacherActive;
}

async function refreshTeacherProgress() {
  if (!hasTeacherSession()) {
    progressValue = null;
    render();
    return;
  }
  const status = document.querySelector('#knowledgeStatus');
  status.textContent = '正在读取学生进度…';
  try {
    progressValue = await loadProgress();
    status.textContent = '学生进度已更新';
  } catch (error) {
    progressValue = null;
    status.textContent = error.message;
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
  document.querySelector('#studentSwitch').append(button);
}
document.querySelector('[data-student="sister"]')?.classList.add('active');

for (const selector of ['#knowledgeSearch', '#stageFilter', '#domainFilter', '#sourceFilter']) {
  document.querySelector(selector).addEventListener(selector === '#knowledgeSearch' ? 'input' : 'change', render);
}

document.querySelector('#knowledgeDialog .dialog-close').addEventListener('click', () => {
  document.querySelector('#knowledgeDialog').close();
});
document.querySelector('#knowledgeDialog').addEventListener('click', event => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});

fetch('./data/knowledge-catalog.json')
  .then(response => response.ok ? response.json() : Promise.reject(new Error('知识点快照尚未生成')))
  .then(value => {
    catalogValue = value;
    const domains = [...new Set(organizeCatalog(value).catalog.map(item => item.domain))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const select = document.querySelector('#domainFilter');
    for (const domain of domains) {
      const option = document.createElement('option');
      option.value = domain;
      option.textContent = domain;
      select.append(option);
    }
    render();
    return refreshTeacherProgress();
  })
  .catch(error => { document.querySelector('#knowledgeStatus').textContent = error.message; });

document.addEventListener('teacher-session-changed', refreshTeacherProgress);
