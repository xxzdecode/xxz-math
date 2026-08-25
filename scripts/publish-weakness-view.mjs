#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDENTS = ['sister', 'brother'];
const PUBLISHED_STATUSES = ['active', 'watching', 'improving'];
const STATUS_PRIORITY = new Map(PUBLISHED_STATUSES.map((status, index) => [status, index]));
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,99}$/;
const STORAGE_KEY = 'math_weakness_view_v1';
const text = value => typeof value === 'string' ? value.trim() : '';

function canonicalHash(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

export function buildWeaknessView(weaknessState, siteKnowledgeMap) {
  if (weaknessState?.schema_version !== 1 || !Array.isArray(weaknessState.weaknesses)) throw new Error('student-weaknesses.json 格式无效');
  const knowledgeIds = new Set((siteKnowledgeMap?.grades || []).flatMap(grade =>
    (grade.groups || []).flatMap(group => (group.items || []).map(item => item?.[0]))));
  const grouped = new Map();
  for (const weakness of weaknessState.weaknesses) {
    const studentId = text(weakness?.student_id);
    const knowledgeId = text(weakness?.site_knowledge_id);
    const status = text(weakness?.status);
    if (!STUDENTS.includes(studentId)) throw new Error(`薄弱项学生无效：${studentId}`);
    if (!ID_PATTERN.test(knowledgeId) || !knowledgeIds.has(knowledgeId)) throw new Error(`薄弱项知识点无效：${knowledgeId}`);
    if (status === 'resolved') continue;
    if (!PUBLISHED_STATUSES.includes(status)) throw new Error(`薄弱项状态无效：${status}`);
    const title = text(weakness.display_title);
    const lastSeenAt = text(weakness.last_failed_at || weakness.last_passed_at || weakness.updated_at);
    if (!title || !lastSeenAt) throw new Error(`薄弱项缺少展示标题或日期：${weakness.weakness_id || knowledgeId}`);
    const key = `${studentId}:${knowledgeId}`;
    const candidate = { knowledge_id: knowledgeId, title, status, last_seen_at: lastSeenAt };
    const current = grouped.get(key);
    if (!current || STATUS_PRIORITY.get(candidate.status) < STATUS_PRIORITY.get(current.status)
        || (candidate.status === current.status && candidate.last_seen_at > current.last_seen_at)) grouped.set(key, candidate);
  }

  const students = Object.fromEntries(STUDENTS.map(studentId => [studentId, {
    items: [...grouped.entries()]
      .filter(([key]) => key.startsWith(`${studentId}:`))
      .map(([, item]) => item)
      .sort((left, right) => STATUS_PRIORITY.get(left.status) - STATUS_PRIORITY.get(right.status)
        || right.last_seen_at.localeCompare(left.last_seen_at)
        || left.title.localeCompare(right.title, 'zh-CN'))
  }]));
  const source = {
    schema_version: 1,
    source_updated_at: text(weaknessState.updated_at),
    students
  };
  return { ...source, source_hash: canonicalHash(source) };
}

async function readRemote(url, serviceRoleKey) {
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' };
  const response = await fetch(`${url}/rest/v1/math_private_state_v1?key=eq.${STORAGE_KEY}&select=value`, { headers, cache: 'no-store' });
  if (!response.ok) throw new Error(`Supabase 薄弱项读取失败（HTTP ${response.status}）`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length > 1) throw new Error('Supabase 薄弱项数据无效');
  return { headers, value: rows[0]?.value || null };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const audit = process.argv.includes('--audit') || apply;
  const materialArg = process.argv.slice(2).find(value => !value.startsWith('--'));
  if (!materialArg) throw new Error('请传入 Material Hub 数学模块路径');
  const materialRoot = path.resolve(materialArg);
  const [weaknessState, siteKnowledgeMap] = await Promise.all([
    readFile(path.join(materialRoot, 'state', 'student-weaknesses.json'), 'utf8').then(JSON.parse),
    readFile(path.join(materialRoot, 'state', 'site-knowledge-map.json'), 'utf8').then(JSON.parse)
  ]);
  const snapshot = buildWeaknessView(weaknessState, siteKnowledgeMap);
  const counts = Object.fromEntries(STUDENTS.map(student => [student, snapshot.students[student].items.length]));
  console.log(`脱敏快照预检通过：姐姐 ${counts.sister} 条，弟弟 ${counts.brother} 条；source_hash=${snapshot.source_hash}`);
  if (!audit) {
    console.log('当前为本地 dry-run；增加 --audit 只读核对线上快照，增加 --apply 才会写入 Supabase。');
    return;
  }

  const url = text(process.env.SUPABASE_URL).replace(/\/+$/, '');
  const serviceRoleKey = text(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceRoleKey) throw new Error('audit/apply 需要 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  const remote = await readRemote(url, serviceRoleKey);
  console.log(`线上快照：${remote.value?.source_hash || '尚未发布'}`);
  if (!apply) return;

  const response = await fetch(`${url}/rest/v1/math_private_state_v1?on_conflict=key`, {
    method: 'POST',
    headers: { ...remote.headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ key: STORAGE_KEY, value: snapshot }])
  });
  if (!response.ok) throw new Error(`Supabase 薄弱项发布失败（HTTP ${response.status}）`);
  const verified = await readRemote(url, serviceRoleKey);
  if (verified.value?.source_hash !== snapshot.source_hash) throw new Error('Supabase 写后回读 source_hash 不一致');
  console.log('Supabase math_weakness_view_v1 已发布并通过写后回读。');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
