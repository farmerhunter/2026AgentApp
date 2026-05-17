# Study Assistant Skill

## Purpose

Define the strategy rules for the AI Study Agent.

## Data Parsing Rules

- Extract subject, topic, date, source type, and visible student answers when available.
- Keep uncertain OCR or image interpretations marked as uncertain.
- Preserve enough source context for later review.

## Insight Generation Rules

- Identify student progress, weak points, and likely causes.
- Prefer concrete observations over broad comments.
- Return concise Markdown or JSON that can be displayed in the dashboard.

## Study Plan Rules

- Prioritize weak points that block future learning.
- Keep plans realistic for a middle school student.
- Include daily and weekly actions when useful.
- Adjust future plans based on completion history.

## Reminder Rules

- Trigger reminders for weak points, unfinished tasks, and weekly summaries.
- Keep reminders short and actionable.
- Record every generated reminder in the event log.
