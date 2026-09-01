// Structural checks only; inspect the actual mathematics and evidence separately.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(process.argv[2]);
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const manifest = read('manifest.json');
const cases = read('cases-snapshot.json');
assert.equal(manifest.mode, 'real_cli');
assert.equal(manifest.case_ids.length, 1);
assert.equal(manifest.results.length, 1);
assert.equal(manifest.results[0].exit_code, 0);
const id = manifest.case_ids[0];
const input = read(`${id}/input.json`);
const output = read(`${id}/stdout.txt`);
const usage = read(`${id}/usage.json`);
const preflight = read(`${id}/preflight.stdout.txt`);
const { knowledge_map, ...actualCase } = input;
assert.deepEqual(actualCase, cases.find(item => item.case_id === id));
assert.equal(output.case_id, id);
assert.equal(knowledge_map.map_id, manifest.map_id);
assert.equal(knowledge_map.map_version, manifest.map_version);
assert.deepEqual(preflight.tools, []);
assert.deepEqual(preflight.loaded_skills, ['confirmed-mistake-analysis-probe']);
assert.deepEqual(preflight.missing_skills, []);
assert(usage.completed && !usage.failed);
const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'skill-snapshot.md'))).digest('hex');
assert.equal(hash, manifest.skill_sha256);
const config = read('config-snapshot.json');
assert.equal(config.memory.memory_enabled, false);
assert.equal(config.memory.user_profile_enabled, false);
assert.deepEqual(config.platform_toolsets.cli, []);
const text = value => assert(typeof value === 'string' && value.trim());
const memoryIds = new Set(input.accepted_memories.map(m => {
  assert.equal(m.status, 'accepted'); text(m.memory_id); text(m.statement);
  return m.memory_id;
}));
assert.equal(memoryIds.size, input.accepted_memories.length);
const subset = (items, allowed) => {
  assert(Array.isArray(items));
  assert.equal(new Set(items).size, items.length);
  assert(items.every(item => allowed.has(item)));
};

if (input.task === 'confirmed_mistake_analysis') {
  const questionIds = new Set(input.questions.map(q => q.question_id));
  assert(Array.isArray(output.findings));
  assert.equal(output.findings.length, questionIds.size);
  subset(output.findings.map(f => f.question_id), questionIds);
  const types = new Set(['concept_gap', 'procedure_gap', 'calculation_error', 'reading_comprehension',
    'expression_issue', 'memory_recall', 'carelessness', 'study_habit', 'unknown']);
  const actionTypes = new Set(['review_concept', 'redo_question', 'practice_set', 'ask_for_help', 'check_again']);
  const nodes = new Map(knowledge_map.knowledge_points.map(n => [n.knowledge_point_id, n.name]));
  for (const f of output.findings) {
    assert.equal(f.scope, 'local'); assert(types.has(f.finding_type));
    text(f.statement); text(f.evidence_summary);
    assert(['high', 'medium', 'low'].includes(f.confidence));
    subset(f.mistake_reasons, types);
    subset(f.source_memory_ids, memoryIds);
    assert.equal(typeof f.is_recurring, 'boolean');
    if (f.is_recurring) assert(f.source_memory_ids.length > 0);
    assert(Array.isArray(f.concept_links) && f.concept_links.length <= 2);
    for (const n of f.concept_links) { assert(nodes.has(n.concept_id)); assert.equal(nodes.get(n.concept_id), n.concept_name); }
    assert(Array.isArray(f.action_candidates) && f.action_candidates.length <= 2);
    for (const a of f.action_candidates) { assert(actionTypes.has(a.action_type)); text(a.description); }
    assert(Array.isArray(f.memory_candidates) && f.memory_candidates.length <= 1);
    for (const m of f.memory_candidates) { assert.equal(m.review_status, 'pending'); text(m.statement); }
  }
} else {
  assert.equal(input.task, 'weekly_learning_report');
  text(output.analysis?.overall_summary);
  assert(!Object.hasOwn(output, 'memory_candidates'));
  const questions = new Set(input.evidence.map(e => e.question.question_id));
  const findings = new Map(input.evidence.map(e => [e.finding_id, e.question.question_id]));
  assert(Array.isArray(output.evidence_links));
  for (const link of output.evidence_links) {
    text(link.claim); subset(link.question_ids, questions);
    subset(link.finding_ids, new Set(findings.keys())); subset(link.memory_ids, memoryIds);
    assert(link.question_ids.length > 0 && link.finding_ids.length > 0);
    assert(link.finding_ids.every(f => link.question_ids.includes(findings.get(f))));
  }
  assert(Array.isArray(output.actions) && output.actions.length >= 1 && output.actions.length <= 2);
  for (const a of output.actions) {
    text(a.description); text(a.reason); subset(a.question_ids, questions); assert(a.question_ids.length > 0);
  }
}
console.log(JSON.stringify({ step: id, task: input.task, structural_checks: 'passed',
  api_calls: usage.api_calls, tokens: usage.total_tokens,
  estimated_cost_usd: usage.estimated_cost_usd ?? null,
  note: 'Hermes estimate, not verified billing; content review and product integration are separate.' }, null, 2));
