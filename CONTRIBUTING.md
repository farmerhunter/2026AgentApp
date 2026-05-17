# Contributing

This is a small two-person competition project. Keep changes simple, easy to review, and documented.

## Workflow

1. Create a branch for each feature or fix.
2. Keep commits focused on one logical change.
3. Update the related docs when behavior, architecture, prompts, or demo flow changes.
4. Use sample data in `data/`; keep private notes and real student data out of Git.
5. Open a pull request before merging into `main`.

## Code Organization

- Agent behavior belongs in `src/agent/`.
- Dashboard code belongs in `src/dashboard/`.
- Prompt templates belong in `src/prompts/`.
- Strategy rules belong in `src/skills/`.
- Tests belong in `src/tests/`.

## Privacy

Never commit API keys, real student records, raw chat logs, or private reference files.
