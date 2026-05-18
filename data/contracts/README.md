# Demo JSON Contracts

This folder defines the first-version JSON contracts shared by Hermes, demo data, and Hermes Web.

The files are example-shaped contracts rather than strict JSON Schema files. They use stable field names, public URL-style paths, and sanitized demo values so the Web UI can be built before a real backend exists.

## Public URL Rules

- Use `/data/...` URLs for files that the Web UI may fetch or display.
- Do not store local absolute paths such as `/var/lib/hermes/data/...` in public JSON.
- Keep private/raw storage paths in backend configuration, not in these contracts.

## First-Version Contracts

- `textbook_content_summary.contract.json`: Hermes understanding of a textbook, chapter, or prepared textbook summary.
- `text_note.contract.json`: free-form student notes, knowledge points, reminders, or questions.
- `upload_meta.contract.json`: metadata for a material upload.
- `question_split_result.contract.json`: normalized result from question splitting/OCR.
- `question_confirmation_result.contract.json`: human-confirmed key-question records.
- `focus_question_records.contract.json`: Hermes-generated focus-question records.
- `week_reports_index.contract.json`: index file for historical weekly reports.
- `weekly_report.contract.json`: full weekly report detail consumed by Hermes Web.

## ID Conventions

- `student_id`: stable student identifier, demo value is `student_demo`.
- `textbook_id`: stable textbook or material identifier.
- `upload_id`: upload session identifier, for example `upload_20260518_001`.
- `question_id`: question identifier scoped to an upload.
- `focus_question_id`: Hermes-generated focus-question record identifier.
- `weekly_report_id`: week identifier, for example `week_20260518_20260524`.
