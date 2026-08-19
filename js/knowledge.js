import './common.js';
import { STUDENTS, describeProgressState, emptyProgressState, normalizeProgress, organizeCatalog, summarizeProgress } from './core.js';
import { hasTeacherSession, isTeacherApiConfigured, loadProgress } from './api.js';

let catalogValue = null;
let progressValue = null;
let activeStudent = 'sister';
const STAGE_LABELS = Object.freeze({ 'g6-transition': '六年级｜小初衔接', g7: '七年级', g4: '四年级' });

const statusClass = status => ['stable', 'reinforce', 'learning'].includes(status) ? status : 'unverified';

function renderKnowledgeItem(item, state, teacherActive) {
  const article = document.createElement('article');
  article.className = 'knowledge-item';
  article.dataset.knowledgeId = item.knowledgeId;
  const title = document.createElement('strong');
  title.textContent = item.title;
  const titleWrap = document.createElement('div');
  titleWrap.append(title);
  article.append(titleWrap);
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

function appendKnowledgeGroup(parent, headingLevel, headingText, items, progress, teacherActive) {
  const visibleItems = teacherActive ? items.filter(item => progress.has(item.knowledgeId)) : items;
  if (!visibleItems.length) return false;
  const section = document.createElement('section');
  section.className = 'knowledge-group';
  const heading = document.createElement(headingLevel);
  heading.textContent = headingText;
  const list = document.createElement('div');
  list.className = 'knowledge-list';
  section.append(heading, list);
  visibleItems.forEach(item => list.append(renderKnowledgeItem(item, progress.get(item.knowledgeId) || emptyProgressState(), teacherActive)));
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
      hasItems = appendKnowledgeGroup(section, 'h3', chapter.title, chapter.items, progress, teacherActive) || hasItems;
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
    hasSupplementalItems = appendKnowledgeGroup(supplemental, 'h3', `${stage} · ${group.domain}`, group.items, progress, teacherActive) || hasSupplementalItems;
  }
  if (hasSupplementalItems) root.append(supplemental);
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

fetch('./data/knowledge-catalog.json')
  .then(response => response.ok ? response.json() : Promise.reject(new Error('知识点快照尚未生成')))
  .then(value => { catalogValue = value; render(); return refreshTeacherProgress(); })
  .catch(error => { document.querySelector('#knowledgeStatus').textContent = error.message; });

document.addEventListener('teacher-session-changed', refreshTeacherProgress);
