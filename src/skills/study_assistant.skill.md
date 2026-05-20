# Study Assistant Skill (Overview)

This is the top-level study assistant skill. It defines the overall strategy and references the three task-specific skills that handle individual Hermes jobs.

## Task-Specific Skills

| Skill | Use Case | Input | Output Contract |
|-------|----------|-------|-----------------|
| [textbook_summary.skill.md](textbook_summary.skill.md) | 用例 1 — 教材理解 | Textbook PDF / extracted text / metadata | `textbook_content_summary` |
| [learning_insight_update.skill.md](learning_insight_update.skill.md) | 用例 4 — 学习洞察 | Uploads, split results, confirmations, notes, textbook summaries | `learning_findings`, `focus_question_records` |
| [weekly_report.skill.md](weekly_report.skill.md) | 用例 5 — 周报生成 | Weekly findings, memory, materials, notes | `weekly_report`, `week_reports_index` |

## Development Flow

Each Hermes capability follows this sequence:

```
1. Design document    → docs/15-17
2. Data contract      → data/contracts/
3. Sample data        → data/sample_inputs/ + data/sample_outputs/
4. Skill              → src/skills/*.skill.md  (this directory)
5. Prompt             → src/prompts/*.prompt.md
6. Job runner         → src/agent/jobs/run_*.py
7. Contract validation
8. Web UI integration
```

## Data Pipeline

```
Textbook PDF / text
  → textbook_summary
  → textbook_content_summary.json

Upload + split + confirmation + notes + textbooks
  → learning_insight_update
  → learning_findings.json + focus_question_records.json

Weekly findings + memory + materials
  → weekly_report (includes consolidation step)
  → weekly_report.json + week_reports_index.json
```

## Cross-Cutting Rules

- All outputs must use internal `subject` codes (`chinese`/`math`/`english`), not Chinese text.
- All outputs must include `subject_label` for display.
- No local absolute paths in any output.
- No real student names, school names, or private data.
- First-phase consolidation runs inside `weekly_report` as a separate, identifiable step.
- "Finding" ≠ "Insight": single-session outputs are local findings; insights require cross-finding consolidation.

## References

- `docs/14_hermes_agent_runtime.md` — Runtime architecture
- `docs/15_textbook_summary_skill_design.md` — Textbook summary design
- `docs/16_learning_insight_update_skill_design.md` — Learning insight design
- `docs/17_weekly_report_skill_design.md` — Weekly report design
- `data/contracts/README.md` — Contract catalog and pipeline explanation
