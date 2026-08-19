#!/usr/bin/env node

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const requiredText = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`公共知识点缺少有效 ${field}`);
  return value.trim();
};

function publicTextbookTitle(sequence, index) {
  for (const field of ['textbook_title', 'title', 'public_title']) {
    if (typeof sequence?.[field] === 'string' && sequence[field].trim()) return sequence[field].trim();
  }
  const sourceName = requiredText(sequence?.textbook_file, `sequences[${index}].textbook_file`)
    .replaceAll('\\', '/')
    .split('/')
    .at(-1);
  return path.parse(sourceName).name;
}

function buildPublicSequences(source, knowledgeIds) {
  if (source?.schema_version !== 1 || !Array.isArray(source.sequences)) {
    throw new Error('textbook-sequences.json 不是支持的 schema_version 1');
  }
  const sequenceIds = new Set();
  const sequencedKnowledgeIds = new Set();
  return source.sequences.map((sequence, sequenceIndex) => {
    const sequenceId = requiredText(sequence?.sequence_id, `sequences[${sequenceIndex}].sequence_id`);
    if (sequenceIds.has(sequenceId)) throw new Error(`教材顺序存在重复 ID：${sequenceId}`);
    sequenceIds.add(sequenceId);
    if (!Array.isArray(sequence?.chapters)) throw new Error(`教材顺序 ${sequenceId} 缺少 chapters`);
    return {
      sequence_id: sequenceId,
      textbook_title: publicTextbookTitle(sequence, sequenceIndex),
      chapters: sequence.chapters.map((chapter, chapterIndex) => {
        const chapterTitle = requiredText(chapter?.chapter, `sequences[${sequenceIndex}].chapters[${chapterIndex}].chapter`);
        if (!Array.isArray(chapter?.knowledge_ids)) throw new Error(`教材章节 ${chapterTitle} 缺少 knowledge_ids`);
        const chapterKnowledgeIds = chapter.knowledge_ids.map((value, knowledgeIndex) => {
          const knowledgeId = requiredText(value, `sequences[${sequenceIndex}].chapters[${chapterIndex}].knowledge_ids[${knowledgeIndex}]`);
          if (!knowledgeIds.has(knowledgeId)) throw new Error(`教材章节引用未知知识点：${knowledgeId}`);
          if (sequencedKnowledgeIds.has(knowledgeId)) throw new Error(`教材主序重复引用知识点：${knowledgeId}`);
          sequencedKnowledgeIds.add(knowledgeId);
          return knowledgeId;
        });
        return { chapter: chapterTitle, knowledge_ids: chapterKnowledgeIds };
      })
    };
  });
}

export function buildPublicCatalog(source, sequenceSource, generatedAt = new Date().toISOString()) {
  if (![1, 2].includes(source?.schema_version) || !Array.isArray(source.knowledge_points)) {
    throw new Error('knowledge-catalog.json 不是支持的 schema_version 1 或 2');
  }
  const seen = new Set();
  const knowledgePoints = source.knowledge_points.map((point, index) => {
    const knowledgeId = requiredText(point?.knowledge_id, `knowledge_points[${index}].knowledge_id`);
    if (seen.has(knowledgeId)) throw new Error(`公共知识点存在重复 ID：${knowledgeId}`);
    seen.add(knowledgeId);
    const safePoint = {
      knowledge_id: knowledgeId,
      stage: requiredText(point?.stage, `knowledge_points[${index}].stage`),
      domain: requiredText(point?.domain, `knowledge_points[${index}].domain`),
      title: requiredText(point?.title, `knowledge_points[${index}].title`)
    };
    if (typeof point?.curriculum_domain === 'string' && point.curriculum_domain.trim()) {
      safePoint.curriculum_domain = point.curriculum_domain.trim();
    }
    if (Array.isArray(point?.objective_tags)) {
      const tags = [...new Set(point.objective_tags.filter(value => typeof value === 'string').map(value => value.trim()).filter(Boolean))];
      if (tags.length) safePoint.objective_tags = tags;
    }
    if (typeof point?.textbook_ref === 'string' && point.textbook_ref.trim()) {
      safePoint.textbook_ref = point.textbook_ref.trim();
    }
    return safePoint;
  });
  const textbookSequences = buildPublicSequences(sequenceSource, seen);
  return {
    schema_version: 2,
    generated_at: generatedAt,
    knowledge_points: knowledgePoints,
    textbook_sequences: textbookSequences
  };
}

export async function importMaterialHubData(materialRoot) {
  const stateRoot = path.join(path.resolve(materialRoot), 'state');
  const [source, sequenceSource] = await Promise.all([
    readFile(path.join(stateRoot, 'knowledge-catalog.json'), 'utf8').then(JSON.parse),
    readFile(path.join(stateRoot, 'textbook-sequences.json'), 'utf8').then(JSON.parse)
  ]);
  const safe = buildPublicCatalog(source, sequenceSource);
  const outputDir = path.join(siteRoot, 'data');
  const outputPath = path.join(outputDir, 'knowledge-catalog.json');
  const temporaryPath = `${outputPath}.tmp`;
  await mkdir(outputDir, { recursive: true });
  try {
    await writeFile(temporaryPath, `${JSON.stringify(safe, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, outputPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
  return safe;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const materialRoot = process.argv[2] ? path.resolve(process.argv[2]) : null;
  if (!materialRoot) throw new Error('请传入 Material Hub 数学模块路径');
  const safe = await importMaterialHubData(materialRoot);
  const sequenceNodes = safe.textbook_sequences.reduce((count, sequence) => (
    count + sequence.chapters.reduce((chapterCount, chapter) => chapterCount + chapter.knowledge_ids.length, 0)
  ), 0);
  console.log(`已生成 ${safe.knowledge_points.length} 个公共知识点、${sequenceNodes} 个教材主序节点：data/knowledge-catalog.json`);
}
