# learning_insight_update

## Purpose

This is the **core agent capability** of the project. It transforms learning evidence — upload sessions, question splits, human confirmations, text notes, and textbook summaries — into structured, traceable, confidence-annotated local findings. It generates candidates for memory, action, and weekly context that feed into downstream consolidation and weekly report generation.

Corresponds to use case 4 in `design_docs/03_design_brief.md`.

**Important**: This skill is NOT limited to the current Web UI upload-material flow. It should be designed to accept evidence from any future source: WeChat messages, parent/teacher feedback, quiz scores, study plan completion records, classroom notes, and review check-in logs.

## Terminology

| Term | Chinese | Definition |
|------|---------|------------|
| **Evidence** | 学习证据 | Raw or semi-structured input: uploads, split results, confirmations, notes, textbook summaries. |
| **Finding** | 发现 / 局部发现 | Local, traceable, confidence-annotated judgment from a single upload, question, note, or small group of related materials. |
| **Insight** | 见解 | Formed ONLY through consolidation — merging multiple findings, short-term memory, and historical patterns. Never from a single isolated event. |
| **Short-term memory** | 短期记忆 | Weekly or recent context, loosely absorbing findings. |
| **Long-term memory** | 长期记忆 | Stable learning profile, recurring problem patterns, and long-term follow-ups. Strict write conditions. |

## Input

### Primary evidence sources

| Source | Contract | Required fields |
|--------|----------|-----------------|
| Textbook summary | `textbook_content_summary` | `textbook_id`, `subject`, `subject_label`, `chapters`, `learning_units`, `knowledge_points` |
| Upload metadata | `upload_meta` | `upload_id`, `subject`, `subject_label`, `source_type`, `captured_at` |
| Question split result | `question_split_result` | `upload_id`, `subject`, `questions[]` with `question_id`, `question_text`, `bbox`, `related_knowledge_point_ids` |
| Question confirmation | `question_confirmation_result` | `upload_id`, `subject`, `confirmations[]` with `question_id`, `selected`, `student_mark`, `knowledge_point` |
| Text note | `text_note` | `note_id`, `subject`, `subject_label`, `content`, `note_type` |

### Optional supplementary input

- Existing focus question records.
- Previous weekly report summaries.
- Existing short-term or long-term memory snapshots.

### Future input sources (not required for first version)

- WeChat text messages.
- Parent or teacher feedback.
- Quiz/exam scores.
- Study plan completion records.
- Classroom notes.
- Review check-in logs.

## Output

### Primary output

Output must conform to `data/contracts/learning_findings.contract.json`.

Each finding must include:

| Field | Description |
|-------|-------------|
| `finding_id` | Stable identifier |
| `scope` | Always `"local"` — this skill never produces global insights |
| `finding_type` | Error classification (see below) |
| `statement` | Clear Chinese statement of the finding |
| `evidence_summary` | What evidence supports this finding |
| `concept_links[]` | Links to textbook chapters, learning units, or knowledge points |
| `mistake_reasons[]` | One or more from the error classification list |
| `confidence` | `high` / `medium` / `low` |
| `is_recurring` | Whether this pattern has been observed before |
| `memory_candidates[]` | Suggested memory entries (short-term or long-term) |
| `action_candidates[]` | Suggested follow-up actions |
| `weekly_context_candidates[]` | Items for inclusion in this week's report context |

### Secondary outputs

- **Focus question records**: conforming to `focus_question_records.contract.json`.
- **Learning findings batch**: conforming to `learning_findings.contract.json`.

## Internal Capability Modules

### Evidence Normalization

Unify heterogeneous evidence into a common structure:
- Question confirmation records → evidence items with question IDs and student marks.
- Text notes → evidence items with content and subject.
- Textbook summaries → concept reference graph.
- Upload metadata → session context.

Always preserve source references so every finding is traceable.

### Concept Mapping

Link evidence to textbook chapters, learning units, and knowledge points:
- When the relationship is clear → explicit link with high confidence.
- When uncertain → mark as `uncertain` with medium/low confidence.
- Do NOT force-map evidence to concepts when no clear relationship exists.

### Error Reasoning

Classify the problem type. First-version categories:

| Code | Chinese | Description |
|------|---------|-------------|
| `concept_gap` | 概念不清 | Fundamental concept not understood |
| `procedure_gap` | 步骤不熟 | Knows the concept but can't execute steps |
| `calculation_error` | 计算错误 | Arithmetic or algebraic mistake |
| `reading_comprehension` | 审题/阅读问题 | Misunderstood the question or passage |
| `expression_issue` | 表达问题 | Poor answer structure, writing, or organization |
| `memory_recall` | 记忆不牢 | Forgot previously learned material |
| `carelessness` | 粗心 | Careless mistake, insufficient checking |
| `study_habit` | 学习习惯 | Broader study habit issue |
| `unknown` | 证据不足 | Insufficient evidence to determine |

Subject-specific considerations:
- **Math**: concept, procedure, calculation, modeling, question reading.
- **Chinese**: reading comprehension, expression structure, textual evidence, vocabulary.
- **English**: vocabulary, grammar, reading comprehension, expression accuracy, listening/speaking input.

### Memory Candidate Generation

Determine whether a finding should become a memory candidate.

Short-term memory (loose criteria):
- Any local finding can enter short-term memory as weekly context.

Long-term memory (strict criteria):
- Similar problem observed across multiple weeks.
- Student explicitly marked as "don't understand."
- Foundational concept that blocks future learning.
- Emphasized by teacher or parent.
- Multiple related findings in the same week.

Do NOT write to long-term memory when:
- Evidence is insufficient.
- Single isolated minor error.
- Cannot determine subject or knowledge point.
- Contains privacy-sensitive content.

### Action Candidate Generation

Generate actionable follow-up candidates. Types:

| Type | Description |
|------|-------------|
| `redo_question` | Redo the specific question |
| `review_concept` | Review the underlying concept |
| `read_textbook_section` | Re-read the relevant textbook section |
| `make_summary` | Organize notes or create a summary |
| `practice_set` | Do targeted practice exercises |
| `ask_for_help` | Ask teacher/parent/agent for clarification |
| `check_again` | Re-check in the next session |

Actions must be specific, executable, and limited in number. The final action plan is formed during consolidation, not by this skill alone.

### Weekly Context Candidate Generation

Determine which findings should feed into the weekly report:
- Related to this week's learning goals.
- Representative or recurring.
- Can be converted into next week's actions.
- Has explanatory value for students and parents.

## Subject Handling

- Always use internal `subject` codes (`chinese`/`math`/`english`).
- Always include `subject_label` for display.
- Maintain per-subject separation in findings, memory candidates, and action candidates.
- Cross-subject patterns should be noted but clearly attributed.

## Allowed Tools

- File reading within the approved workspace.
- JSON parsing and validation.
- Web search for curriculum or concept reference (with approval).
- LLM reasoning for error classification and statement generation.

## Uncertain Content

- When error classification is ambiguous, use `unknown` and note the ambiguity.
- When concept links are uncertain, mark confidence as `low` or `medium`.
- When evidence is insufficient for a finding, do NOT create a finding.
- Always distinguish "Hermes thinks" from "evidence shows."

## Prohibited Actions

- Do NOT produce global insights from a single batch of evidence.
- Do NOT directly overwrite long-term memory.
- Do NOT fabricate knowledge points or mistake reasons.
- Do NOT output real student names, school names, phone numbers, or private data.
- Do NOT use local absolute paths in output.
- Do NOT limit this skill's capability to the current Web UI flow.

## Output Style

- Findings: clear Chinese statements with traceable evidence.
- Confidence ratings: always present; never overstate certainty.
- Action candidates: specific, executable, limited count.
- Memory candidates: clearly distinguish short-term vs. long-term.
- Subject labels: always included alongside internal codes.

## Relationship to Other Skills

- **Upstream**: consumes `textbook_summary` output for concept mapping.
- **Downstream**: feeds local findings → `weekly_report` for consolidation and report generation.
- **Data contracts**: produces `learning_findings` and `focus_question_records`.

## Quality Expectations

This skill determines the core value of the system. Quality criteria:
- Evidence citations are clear and traceable.
- Error classification is reasonable and subject-aware.
- Avoid over-inference; respect evidence boundaries.
- Action suggestions are specific, not vague.
- Per-subject differences are preserved.
- Insufficient evidence is handled gracefully.
- Findings are local and scoped; insights are deferred to consolidation.
- Output structure is stable for downstream consumption.
