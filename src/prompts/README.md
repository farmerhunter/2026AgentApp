# Prompts

This directory stores reusable prompt templates consumed by future Hermes job runners.

Current architecture and the V1 detailed prompt-design baseline are documented in:

```text
docs/v2/architecture.md
docs/v1/hermes/prompt-design.md
```

Prompt files:

- `textbook_summary.prompt.md`
- `learning_insight_update.prompt.md`
- `weekly_report.prompt.md`

Keep this README short. Update the executable prompt, skill, contract, and tests together. Update V2 architecture or add an ADR only when the responsibility boundary or shared contract changes; do not continue expanding the V1 historical document for ordinary prompt tuning.
