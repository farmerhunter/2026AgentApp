# 2026AgentApp

AI Study Agent for Middle School Learning.

This project is a competition demo for an active AI learning assistant. The agent ingests homework, exam papers, notes, or student questions; generates learning insights; creates daily or weekly study plans; triggers reminders; and exposes the results through a simple dashboard.

## Core Demo

- Ingest text, image, or PDF learning materials.
- Use an LLM to analyze progress, weak points, and next steps.
- Generate structured Markdown/JSON outputs for insight, planning, and reminders.
- Use a `skill.md` strategy file to define planning and reminder behavior.
- Display long-term learning history and active analysis in a dashboard.

## Repository Layout

- `docs/`: public product, architecture, deployment, and demo documentation
- `src/agent/`: agent modules for ingest, analysis, planning, reminders, and storage
- `src/dashboard/`: dashboard application code
- `src/prompts/`: reusable prompt templates
- `src/skills/`: skill strategy files used by the agent
- `data/`: public sample inputs and outputs only
- `runtime/`: local generated data, ignored by Git
- `media/`: public diagrams, screenshots, and demo assets
- `deliverables/`: final competition report and video notes
- `private_notes/`: local-only planning notes and raw references, ignored by Git

## Public Repo Policy

Do not commit real student data, API keys, raw competition PDFs, private chat logs, or generated runtime records. Use sanitized examples in `data/sample_inputs/` and `data/sample_outputs/` instead.
