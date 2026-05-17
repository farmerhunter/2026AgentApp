# Architecture Decisions

## ADR-001: Use File-Backed Storage for the First Demo

Decision: store generated insights, plans, chat history, and reminder events as Markdown/JSON files.

Reason: this keeps the demo easy to inspect, easy to export, and simple to connect to a dashboard.

Future option: migrate to a database if the project grows to support multiple students or heavier history queries.

## ADR-002: Keep Raw Planning Material Private

Decision: raw ChatGPT/Codex logs, source PDFs, and private planning notes belong in `private_notes/`.

Reason: the public repository should be clean, understandable, and safe to share.
