# weekly_report

## Purpose

Consolidate one week's learning materials, local findings, memory state, and action candidates into a cross-subject weekly report readable by students and parents. This skill handles the first-phase consolidation step — merging multiple findings into insights — and produces the final weekly report JSON.

Corresponds to use case 5 in `docs/03_design_brief.md`.

## Terminology

| Term | Chinese | Definition |
|------|---------|------------|
| **Finding** | 发现 | Local, per-material judgment from `learning_insight_update`. |
| **Insight** | 见解 | Formed through consolidation — merging multiple findings, short-term memory, and historical patterns. |
| **Consolidation** | 聚合 | The step that groups, merges, and elevates local findings into insights. |

## Input

### Required

| Source | Description |
|--------|-------------|
| Upload records | This week's `upload_meta` entries |
| Question confirmation results | This week's `question_confirmation_result` entries |
| Focus question records | This week's `focus_question_records` |
| Local findings | `learning_findings` batches from this week |
| Short-term memory | Current `short_term_memory` snapshot |
| Long-term memory | Current `long_term_memory` summary (optional) |
| Textbook summaries | Relevant `textbook_content_summary` entries referenced by findings |

### Optional

- Previous week's weekly report (for continuity).
- Text notes from this week.

**Important**: Do NOT re-analyze raw materials from scratch. Prefer consuming `learning_insight_update` findings to avoid redundant reasoning and inconsistent conclusions.

## Output

Output must conform to:
- `data/contracts/weekly_report.contract.json`
- `data/contracts/week_reports_index.contract.json`

Additionally, this skill's consolidation step produces:
- `data/contracts/insight_consolidation.contract.json`

### Weekly report structure

| Section | Content |
|---------|---------|
| `student` | Student info and grade |
| `week` | Start/end dates and display title |
| `subjects[]` | Cross-subject overview with `status` (active/no_data) |
| `learning_context` | Week context summary |
| `uploaded_materials[]` | List of uploaded materials with links |
| `text_notes[]` | This week's text notes |
| `focus_questions[]` | Key question records |
| `analysis` | Overall summary + per-subject breakdown + main risks |
| `suggestions[]` | Per-subject learning suggestions |
| `next_actions[]` | Actionable next-week plan |

## Consolidation Step

This skill includes a first-phase consolidation step. It must be kept as a **separate, identifiable step** within the skill so it can later be extracted into a standalone `finding_consolidation` job.

### Consolidation workflow

```
1. Load this week's local findings (all subjects)
2. Group findings by subject, concept, and problem pattern
3. Identify repeated or high-priority patterns
   - Same knowledge point appearing in multiple findings
   - Same error type recurring across materials
   - Findings with high confidence and high priority
4. Form consolidated insights:
   - Merge related findings into a single insight
   - Assign pattern type (recurring_within_week, early_stage, stable, improving, worsening)
   - Determine confidence based on finding count and consistency
5. Update memory candidates:
   - Short-term: add new follow-ups from this week's findings
   - Long-term: evaluate whether any pattern meets long-term criteria
6. Generate action plan candidates per subject
```

### Insight formation rules

- A consolidated insight MUST be supported by at least one finding.
- Single-finding insights are allowed when the finding has high confidence and high priority, but must be marked as `early_stage`.
- Multi-finding insights (same concept, same pattern across materials) are preferred and have higher confidence.
- Do NOT inflate a single minor finding into an insight.

## Subject Handling

- Report must cover all three subjects (`chinese`/`math`/`english`).
- Subjects with no data this week should show `status: "no_data"` with an appropriate summary message.
- Cross-subject overview should highlight common patterns without blurring subject boundaries.
- Per-subject sections should be clearly separated.

## Allowed Tools

- File reading within the approved workspace.
- JSON parsing and validation.
- LLM reasoning for consolidation, pattern identification, and report language.
- No real API calls required for first version.

## Prohibited Actions

- Do NOT re-confirm whether questions are important — trust the confirmation results.
- Do NOT fabricate trends when evidence is insufficient.
- Do NOT output overly long or unactionable suggestions.
- Do NOT expose real student privacy data.
- Do NOT merge consolidation logic indistinguishably into report rendering.
- Do NOT use local absolute paths in output.

## Output Style

- Short, clear, and actionable.
- Cross-subject overview must not replace per-subject detail sections.
- Every important suggestion should trace back to a finding, note, or consolidated insight.
- Do NOT inflate a one-time minor error into a long-term trend.
- Next-week action count should be limited and executable.
- Clearly distinguish between local findings and consolidated insights in the report language.
- Chinese for display text; use `subject` codes and `subject_label` consistently.

## Relationship to Other Skills

- **Upstream**: depends on `learning_insight_update` for local findings.
- **Downstream**: produces the final weekly report consumed by the Web UI.
- **Data contracts**: produces `weekly_report`, `week_reports_index`, and the consolidation output.

## Quality Expectations

- Report is concise and parent/student-readable.
- Subjects are clearly separated with their own status.
- Insights are traceable to source findings.
- Action items are specific and executable.
- First-phase consolidation is identifiable as a distinct step.
- Handles missing data gracefully (e.g., English `no_data`).
