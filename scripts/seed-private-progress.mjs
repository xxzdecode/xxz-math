#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveDisplayStatus } from '../js/core.js';

const STUDENT_GRADES = Object.freeze({ sister: 7, brother: 4 });
const STUDENTS = new Set(Object.keys(STUDENT_GRADES));
const HANDOFF = new Set(['not_reported', 'reported_taught', 'reported_needs_reinforcement']);
const TEACHING = new Set(['not_recorded', 'learning', 'taught_by_us']);
const MASTERY = new Set(['unverified', 'learning', 'stable', 'reinforce']);
const DISPLAY = new Set(['red', 'yellow', 'green']);
const SOURCES = new Set(['manual', 'initial_assumption', 'legacy_mapping', 'analysis']);

const recordKey = record => `${record.student_id}:${record.knowledge_id}`;
const gradeFromId = knowledgeId => Number(String(knowledgeId).match(/^g(\d+)-/)?.[1]) || 0;

function normalizedRecord(record, index) {
  const studentId = String(record?.student_id || '');
  const knowledgeId = String(record?.knowledge_id || '');
  if (!STUDENTS.has(studentId)) throw new Error(`records[${index}] 学生无效`);
  if (!/^[a-z0-9][a-z0-9-]{1,99}$/.test(knowledgeId)) throw new Error(`records[${index}] 知识点无效`);
  if (!HANDOFF.has(record.handoff_status) || !TEACHING.has(record.teaching_status) || !MASTERY.has(record.mastery_status)) {
    throw new Error(`records[${index}] 状态无效`);
  }
  return {
    student_id: studentId,
    knowledge_id: knowledgeId,
    handoff_status: record.handoff_status,
    teaching_status: record.teaching_status,
    mastery_status: record.mastery_status,
    display_status: deriveDisplayStatus({
      studentId,
      pointGrade: gradeFromId(knowledgeId),
      handoffStatus: record.handoff_status,
      teachingStatus: record.teaching_status,
      masteryStatus: record.mastery_status
    }),
    status_source: 'legacy_mapping'
  };
}

export function buildSeedRecords(progress, siteMap) {
  if (![1, 2].includes(progress?.schema_version) || !Array.isArray(progress.records)) throw new Error('student-progress.json 格式无效');
  if (siteMap?.schema_version !== 1 || !Array.isArray(siteMap.grades)) throw new Error('site-knowledge-map.json 格式无效');

  const records = new Map();
  progress.records.forEach((record, index) => {
    const normalized = normalizedRecord(record, index);
    const key = recordKey(normalized);
    if (records.has(key)) throw new Error(`records[${index}] 知识点重复`);
    records.set(key, normalized);
  });

  for (const [studentId, currentGrade] of Object.entries(STUDENT_GRADES)) {
    for (const grade of siteMap.grades) {
      const pointGrade = Number(grade.grade);
      if (!Number.isInteger(pointGrade) || pointGrade < 1 || pointGrade > currentGrade) continue;
      for (const item of (grade.groups || []).flatMap(group => group.items || [])) {
        const knowledgeId = String(item?.[0] || '');
        if (!/^[a-z0-9][a-z0-9-]{1,99}$/.test(knowledgeId)) throw new Error(`网站知识点 ID 无效：${knowledgeId}`);
        const key = `${studentId}:${knowledgeId}`;
        if (records.has(key)) continue;
        records.set(key, {
          student_id: studentId,
          knowledge_id: knowledgeId,
          handoff_status: 'not_reported',
          teaching_status: 'not_recorded',
          mastery_status: 'unverified',
          display_status: deriveDisplayStatus({ studentId, pointGrade }),
          status_source: 'initial_assumption'
        });
      }
    }
  }
  return [...records.values()];
}

export function mergeProductionRecords(seedRecords, existingRecords) {
  const merged = new Map(seedRecords.map(record => [recordKey(record), record]));
  for (const existing of Array.isArray(existingRecords) ? existingRecords : []) {
    const studentId = String(existing?.student_id || '');
    const knowledgeId = String(existing?.knowledge_id || '');
    if (!STUDENTS.has(studentId) || !/^[a-z0-9][a-z0-9-]{1,99}$/.test(knowledgeId)) continue;
    const key = `${studentId}:${knowledgeId}`;
    const seeded = merged.get(key);
    if (!seeded) {
      merged.set(key, existing);
      continue;
    }
    const preserved = { ...seeded, ...existing };
    if (!DISPLAY.has(existing.display_status)) {
      preserved.display_status = deriveDisplayStatus({
        studentId,
        pointGrade: gradeFromId(knowledgeId),
        handoffStatus: preserved.handoff_status,
        teachingStatus: preserved.teaching_status,
        masteryStatus: preserved.mastery_status
      });
      preserved.status_source = SOURCES.has(existing.status_source) ? existing.status_source : seeded.status_source;
    }
    merged.set(key, preserved);
  }
  return [...merged.values()];
}

async function fetchExistingRecords(url, serviceRoleKey) {
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' };
  const response = await fetch(`${url}/rest/v1/math_private_state_v1?key=eq.math_student_progress_v1&select=value`, { headers, cache: 'no-store' });
  if (!response.ok) throw new Error(`Supabase 私有进度读取失败（HTTP ${response.status}）`);
  const rows = await response.json();
  return { headers, records: Array.isArray(rows?.[0]?.value?.records) ? rows[0].value.records : [] };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const audit = process.argv.includes('--audit') || apply;
  const materialArg = process.argv.slice(2).find(value => !value.startsWith('--'));
  if (!materialArg) throw new Error('请传入 Material Hub 数学模块路径');

  const materialRoot = path.resolve(materialArg);
  const [progress, siteMap] = await Promise.all([
    readFile(path.join(materialRoot, 'state', 'student-progress.json'), 'utf8').then(JSON.parse),
    readFile(path.join(materialRoot, 'state', 'site-knowledge-map.json'), 'utf8').then(JSON.parse)
  ]);
  const records = buildSeedRecords(progress, siteMap);
  const counts = Object.fromEntries([...STUDENTS].map(student => [student, records.filter(record => record.student_id === student).length]));
  console.log(`私有进度预检通过：${records.length} 条（姐姐 ${counts.sister}，弟弟 ${counts.brother}）`);
  if (!audit) {
    console.log('当前为本地 dry-run；增加 --audit 只读核对线上合并，增加 --apply 才会写入 Supabase。');
    return;
  }

  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!url || !serviceRoleKey) throw new Error('audit/apply 需要 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  const existing = await fetchExistingRecords(url, serviceRoleKey);
  const merged = mergeProductionRecords(records, existing.records);
  const manualCount = existing.records.filter(record => DISPLAY.has(record?.display_status)).length;
  console.log(`生产合并预览：源文件 ${records.length} 条，线上 ${existing.records.length} 条（含明确颜色 ${manualCount} 条），合并后 ${merged.length} 条。`);
  if (!apply) {
    console.log('只读审计完成；未写入 Supabase。');
    return;
  }

  const response = await fetch(`${url}/rest/v1/math_private_state_v1?on_conflict=key`, {
    method: 'POST',
    headers: { ...existing.headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ key: 'math_student_progress_v1', value: { schema_version: 2, records: merged } }])
  });
  if (!response.ok) throw new Error(`Supabase 私有进度初始化失败（HTTP ${response.status}）`);
  console.log('Supabase math_student_progress_v1 已安全合并。');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
