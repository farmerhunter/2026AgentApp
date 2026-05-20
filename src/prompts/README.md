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

Current local repo may not yet include the latest VPS-created skill files for #45. These prompt templates therefore reference the design docs and contracts directly. After #45 is synced back, verify the prompts against the final skill files.

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
