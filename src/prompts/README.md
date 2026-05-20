# Prompts

This directory stores reusable prompt templates for Hermes task-specific jobs.

Prompts are different from skills:

- `src/skills/` defines the stable behavior rules for a Hermes capability.
- `src/prompts/` defines the concrete LLM task template used by a job runner.
- `data/contracts/` defines the JSON shape the prompt output must satisfy.
- `src/agent/jobs/` will load input data, choose the matching skill and prompt, call the LLM or fixture implementation, validate output, and write results.

First-version prompt templates:

- `textbook_summary.prompt.md`: supports the `textbook_summary` job.
- `learning_insight_update.prompt.md`: supports the `learning_insight_update` job.
- `weekly_report.prompt.md`: supports the `weekly_report` job.

The prompt templates have been checked against the #45 task-specific skill files now present in `src/skills/`:

- `src/skills/textbook_summary.skill.md`
- `src/skills/learning_insight_update.skill.md`
- `src/skills/weekly_report.skill.md`

They also reference the #53 finding / insight / memory contracts now present in `data/contracts/`.

## Usage In Job Runner

A future job runner should:

1. Load the relevant JSON inputs.
2. Load the matching skill rules.
3. Load one prompt template from this directory.
4. Fill the template variables.
5. Ask the LLM to return JSON only.
6. Validate the result against the relevant contract.
7. Write output to the runtime output directory or public demo data.

## Shared Prompt Rules

All Hermes prompts must follow these rules:

- Return JSON only. Do not wrap the JSON in Markdown fences.
- Preserve `subject` as an internal code: `chinese`, `math`, or `english`.
- Use `subject_label` for Chinese display text.
- Keep source references so results can be traced back to evidence.
- Mark uncertain OCR, model inference, or concept mapping explicitly.
- Do not invent source materials, student answers, scores, or teacher comments.
- Do not expose local absolute paths, API keys, private notes, or real student privacy.
- Keep recommendations concrete, limited, and suitable for a middle school student.

## Skill Alignment Notes

`textbook_summary.prompt.md` aligns with `textbook_summary.skill.md`:

- Preserves `subject` / `subject_label`.
- Produces `textbook_content_summary` JSON.
- Marks uncertain textbook structure instead of inventing chapters or knowledge points.
- Avoids storing long textbook passages.

`learning_insight_update.prompt.md` aligns with `learning_insight_update.skill.md`:

- Treats this as the core Hermes capability.
- Produces local findings, not global insights.
- Uses `learning_findings.contract.json` as the primary output shape.
- Allows focus-question records as a secondary output when the job runner requests an output bundle.
- Keeps memory candidates separate from short-term and long-term memory writes.

`weekly_report.prompt.md` aligns with `weekly_report.skill.md`:

- Consumes local findings and memory before raw evidence.
- Keeps consolidation as an explicit step.
- Allows a high-confidence, high-priority single finding to become an `early_stage` consolidated insight, matching the skill rules.
- Keeps next actions limited and executable.
