# Architecture

The first demo is a file-backed active study agent. Hermes or a similar agent runtime triggers analysis jobs, calls an LLM, writes Markdown/JSON outputs, and exposes those outputs to a dashboard.

## Main Flow

1. A student uploads a file or submits text.
2. The ingest module extracts usable text and metadata.
3. The analysis module asks an LLM to identify progress, weak points, and suggestions.
4. The planner module creates a daily or weekly study plan from the latest insight.
5. The reminders module records active reminders and follow-up events.
6. The storage module saves Markdown/JSON files.
7. The dashboard reads stored files and renders the latest history, insight, plan, and reminders.

## Source Modules

- `src/agent/ingest/`: text, image, PDF, and upload parsing
- `src/agent/analysis/`: LLM calls and insight generation
- `src/agent/planner/`: study plan generation and adjustment rules
- `src/agent/reminders/`: reminders, scheduled summaries, and event triggers
- `src/agent/storage/`: Markdown/JSON read and write helpers
- `src/dashboard/`: web dashboard for reviewing generated outputs
- `src/prompts/`: prompt templates used by analysis and planning
- `src/skills/`: skill strategy files such as `study_assistant.skill.md`
- `src/tests/`: validation and demo tests

## Storage Model

The runtime app writes generated records under `runtime/`, which is ignored by Git. Public examples live in `data/sample_outputs/`.

Expected runtime records:

- `student_profile.md`
- `history.md`
- `insight.md`
- `plan.md`
- `chat_history.md`
- `events.log`

This keeps the first version simple while leaving a path to migrate to a database later.

## Deployment Target

The planned deployment target is a lightweight Tencent Cloud server or Docker container running the agent runtime, webhook service, dashboard, and LLM integration.
