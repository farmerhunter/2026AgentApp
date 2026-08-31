// Mechanical checks only; mathematical correctness and diagnosis need review.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const base = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || path.join(base, 'results/2026-08-31-baseline-v01'));
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const manifest = read('manifest.json');
const types = new Set(['concept_gap', 'procedure_gap', 'calculation_error',
  'reading_comprehension', 'expression_issue', 'memory_recall', 'carelessness',
  'study_habit', 'unknown']);
const actionTypes = new Set(['review_concept', 'redo_question', 'practice_set', 'ask_for_help', 'check_again']);
let cost = 0, tokens = 0, calls = 0;
let allCostsKnown = true;

const caseIds = manifest.case_ids || ['Q1', 'Q2', 'Q4'];
assert(caseIds.length >= 1 && caseIds.length <= 3 && new Set(caseIds).size === caseIds.length);
assert(caseIds.every(id => /^[QH][0-9]+$/.test(id)));
assert.deepEqual(manifest.results.map(r => r.case_id), caseIds);
assert(manifest.results.every(r => r.exit_code === 0));
for (const id of caseIds) {
  const input = read(`${id}/input.json`);
  const out = read(`${id}/stdout.txt`);
  const usage = read(`${id}/usage.json`);
  const preflight = read(`${id}/preflight.stdout.txt`);
  const f = out.finding;
  const nodes = new Map(input.knowledge_map.knowledge_points.map(n => [n.knowledge_point_id, n.name]));
  assert.equal(out.case_id, id);
  assert.equal(f.scope, 'local');
  assert(types.has(f.finding_type));
  assert(['high', 'medium', 'low'].includes(f.confidence));
  assert(Array.isArray(f.mistake_reasons) && f.mistake_reasons.every(r => types.has(r)));
  assert(typeof f.statement === 'string' && f.statement.trim());
  assert(typeof f.evidence_summary === 'string' && f.evidence_summary.trim());
  assert.equal(input.knowledge_map.map_id, manifest.map_id);
  assert.equal(input.knowledge_map.map_version, manifest.map_version);
  assert(Array.isArray(f.concept_links) && f.concept_links.length <= 2);
  assert(f.concept_links.every(n => nodes.has(n.concept_id) && nodes.get(n.concept_id) === n.concept_name));
  assert(Array.isArray(f.action_candidates) && f.action_candidates.length <= 2);
  assert(f.action_candidates.every(a => actionTypes.has(a.action_type) && typeof a.description === 'string' && a.description.trim()));
  assert(Array.isArray(f.memory_candidates) && f.memory_candidates.length <= 1);
  assert(f.memory_candidates.every(m => m.review_status === 'pending' && typeof m.statement === 'string' && m.statement.trim()));
  assert.equal(f.is_recurring, false);
  assert.deepEqual(preflight.tools, []);
  assert.deepEqual(preflight.loaded_skills, ['confirmed-mistake-analysis-probe']);
  assert.deepEqual(preflight.missing_skills, []);
  assert(usage.completed && !usage.failed);
  assert.equal(usage.api_calls, 1);
  tokens += usage.total_tokens;
  calls += usage.api_calls;
  if (typeof usage.estimated_cost_usd === 'number') cost += usage.estimated_cost_usd;
  else allCostsKnown = false;
  console.log(`${id}: mechanical checks passed; content review is separate`);
}
const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'skill-snapshot.md'))).digest('hex');
assert.equal(sha, manifest.skill_sha256);
console.log(JSON.stringify({ calls, tokens, estimated_cost_usd: allCostsKnown ? cost : null,
  cost_note: 'Hermes estimate, not a verified bill', skill_snapshot: 'hash matched' }, null, 2));
