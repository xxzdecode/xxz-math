#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const apply = process.argv.includes('--apply');
const materialArg = process.argv.find(value => !value.startsWith('--') && value !== process.argv[0] && value !== process.argv[1]);
if (!materialArg) throw new Error('请传入 Material Hub 数学模块路径');

const materialRoot = path.resolve(materialArg);
const progress = JSON.parse(await readFile(path.join(materialRoot, 'state', 'student-progress.json'), 'utf8'));
if (![1, 2].includes(progress?.schema_version) || !Array.isArray(progress.records)) throw new Error('student-progress.json 格式无效');

const students = new Set(['sister', 'brother']);
const handoff = new Set(['not_reported', 'reported_taught', 'reported_needs_reinforcement']);
const teaching = new Set(['not_recorded', 'learning', 'taught_by_us']);
const mastery = new Set(['unverified', 'learning', 'stable', 'reinforce']);
const seen = new Set();
const records = progress.records.map((record, index) => {
  const studentId = String(record?.student_id || '');
  const knowledgeId = String(record?.knowledge_id || '');
  const key = `${studentId}:${knowledgeId}`;
  if (!students.has(studentId)) throw new Error(`records[${index}] 学生无效`);
  if (!/^[a-z0-9][a-z0-9-]{1,99}$/.test(knowledgeId) || seen.has(key)) throw new Error(`records[${index}] 知识点无效或重复`);
  if (!handoff.has(record.handoff_status) || !teaching.has(record.teaching_status) || !mastery.has(record.mastery_status)) {
    throw new Error(`records[${index}] 状态无效`);
  }
  seen.add(key);
  return {
    student_id: studentId,
    knowledge_id: knowledgeId,
    handoff_status: record.handoff_status,
    teaching_status: record.teaching_status,
    mastery_status: record.mastery_status
  };
});

const counts = Object.fromEntries([...students].map(student => [student, records.filter(record => record.student_id === student).length]));
console.log(`私有进度预检通过：${records.length} 条（姐姐 ${counts.sister}，弟弟 ${counts.brother}）`);
if (!apply) {
  console.log('当前为 dry-run；增加 --apply 才会写入 Supabase。');
  process.exit(0);
}

const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
if (!url || !serviceRoleKey) throw new Error('apply 需要 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY 环境变量');

const response = await fetch(`${url}/rest/v1/math_private_state_v1?on_conflict=key`, {
  method: 'POST',
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal'
  },
  body: JSON.stringify([{ key: 'math_student_progress_v1', value: { schema_version: 1, records } }])
});
if (!response.ok) throw new Error(`Supabase 私有进度初始化失败（HTTP ${response.status}）`);
console.log('Supabase math_student_progress_v1 已初始化。');
