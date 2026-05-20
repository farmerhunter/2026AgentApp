# textbook_summary

## Purpose

Convert textbook PDFs, lecture notes, or pre-extracted textbook text into a structured textbook content summary that Hermes can reuse for later analysis — linking questions, mistakes, notes, and weekly reports back to chapters, learning units, and knowledge points.

Corresponds to use case 1 in `docs/03_design_brief.md`.

## Input

### Required

| Field | Description |
|-------|-------------|
| `subject` | Internal subject code: `chinese` / `math` / `english` |
| `subject_label` | Chinese display name: 语文 / 数学 / 英语 |
| `grade` | Grade level, e.g. 八年级 |
| `source_title` | Textbook or material title |
| `source_type` | e.g. 课本 PDF, 讲义, 教材摘要 |

### Optional

| Field | Description |
|-------|-------------|
| `publisher` | Publisher name |
| `page_range` | Page range covered, e.g. 42-58 |
| `captured_at` | Date the material was captured or uploaded |

### Source material

- **First version (demo)**: pre-extracted or sample textbook text. No real PDF parsing required.
- **Long-term**: real PDF text extraction or OCR output.

## Output

Output must conform to `data/contracts/textbook_content_summary.contract.json`.

Key output fields:
- `textbook_id`: stable identifier
- `subject` / `subject_label`
- `grade`, `source_title`, `source_type`
- `chapters[]`: each with `chapter_id`, `chapter_title`, `page_range`
- `learning_units[]`: under each chapter, with `unit_id`, `title`, `knowledge_points[]`
- `knowledge_points[]`: each with `knowledge_point_id`, `name`, `description`
- `hermes_summary`: short plain-text summary

## Subject Handling

- Always output internal `subject` code (`chinese`/`math`/`english`), never use Chinese text in `subject`.
- Always include `subject_label` for display.
- Do not use subject as a navigation concept; use it for filtering, grouping, and rendering subject sections.

## Allowed Tools

- File reading (PDF or extracted text) from the approved workspace.
- Web search for textbook syllabus or curriculum reference (with approval).
- JSON validation against the contract.

## Uncertain Content

When the textbook structure, chapter boundaries, or knowledge points cannot be determined with high confidence:
- Mark uncertain sections explicitly.
- Do not fabricate chapter titles, unit names, or knowledge points.
- Use placeholder markers like `[待确认]` for uncertain content.
- Record the uncertainty reason in a note field when available.

## Prohibited Actions

- Do NOT save full textbook text verbatim — only structured summaries.
- Do NOT include copyrighted textbook content beyond summary-level extraction.
- Do NOT output real student names, school names, or private data.
- Do NOT use local absolute paths (`/var/lib/`, `/Users/`, etc.) in output.
- Do NOT output subject codes as Chinese text in the `subject` field.

## Output Style

- Concise and structured.
- Chinese for display text, English for internal codes.
- Knowledge point granularity should serve later question-mistake association — not too fine, not too broad.
- Short `hermes_summary` for quick overview.
