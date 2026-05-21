-- Hermes SQLite Schema — Phase G
-- Run via init.js or: sqlite3 hermes.db < schema.sql

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1. students
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  grade TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 2. uploads
CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  upload_id TEXT UNIQUE NOT NULL,
  student_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  subject_label TEXT,
  source_type TEXT,
  source_title TEXT,
  captured_at TEXT,
  uploaded_at TEXT,
  storage_provider TEXT DEFAULT 'local',
  ocr_status TEXT DEFAULT 'pending',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_uploads_student ON uploads(student_id);
CREATE INDEX IF NOT EXISTS idx_uploads_subject ON uploads(subject);

-- 3. ocr_jobs
CREATE TABLE IF NOT EXISTS ocr_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  upload_id TEXT NOT NULL,
  provider TEXT,
  provider_job_id TEXT,
  status TEXT DEFAULT 'pending',
  raw_response_url TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 4. questions
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id TEXT UNIQUE NOT NULL,
  upload_id TEXT NOT NULL,
  page INTEGER,
  question_index INTEGER,
  question_text TEXT,
  question_image_url TEXT,
  bbox_json TEXT,
  raw_ocr_json_url TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_questions_upload ON questions(upload_id);

-- 5. question_confirmations
CREATE TABLE IF NOT EXISTS question_confirmations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id TEXT NOT NULL,
  selected INTEGER DEFAULT 0,
  student_mark TEXT,
  teacher_score TEXT,
  full_score TEXT,
  knowledge_point TEXT,
  knowledge_point_ids_json TEXT,
  mistake_reason TEXT,
  review_priority TEXT,
  review_status TEXT,
  tags_json TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  UNIQUE(question_id)
);

CREATE INDEX IF NOT EXISTS idx_confirmations_question ON question_confirmations(question_id);

-- 6. focus_question_records
CREATE TABLE IF NOT EXISTS focus_question_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  focus_question_id TEXT UNIQUE NOT NULL,
  question_id TEXT,
  upload_id TEXT,
  student_id TEXT,
  subject TEXT,
  subject_label TEXT,
  related_textbook_id TEXT,
  related_chapter_id TEXT,
  knowledge_point TEXT,
  knowledge_point_ids_json TEXT,
  mistake_summary TEXT,
  recommended_action TEXT,
  review_priority TEXT,
  review_status TEXT,
  weekly_report_id TEXT,
  evidence_refs_json TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_focus_upload ON focus_question_records(upload_id);
CREATE INDEX IF NOT EXISTS idx_focus_student ON focus_question_records(student_id);

-- 7. weekly_reports
CREATE TABLE IF NOT EXISTS weekly_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekly_report_id TEXT UNIQUE NOT NULL,
  student_id TEXT,
  week_start TEXT,
  week_end TEXT,
  title TEXT,
  summary TEXT,
  report_json_url TEXT,
  status TEXT DEFAULT 'draft',
  published_at TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_reports_student ON weekly_reports(student_id);

-- 8. text_notes
CREATE TABLE IF NOT EXISTS text_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id TEXT UNIQUE NOT NULL,
  student_id TEXT,
  subject TEXT,
  subject_label TEXT,
  note_type TEXT,
  related_textbook_id TEXT,
  related_chapter_id TEXT,
  knowledge_point_ids_json TEXT,
  content TEXT,
  student_confidence TEXT,
  tags_json TEXT,
  visibility TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_notes_student ON text_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_notes_subject ON text_notes(subject);

-- 9. hermes_jobs
CREATE TABLE IF NOT EXISTS hermes_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT UNIQUE NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  payload_json TEXT,
  result_json TEXT,
  result_path TEXT,
  error_message TEXT,
  mode TEXT DEFAULT 'fixture',
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON hermes_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON hermes_jobs(job_type);

-- 10. learning_findings (finding batch)
CREATE TABLE IF NOT EXISTS learning_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  finding_batch_id TEXT UNIQUE NOT NULL,
  student_id TEXT,
  subject TEXT,
  subject_label TEXT,
  generated_by TEXT,
  generated_at TEXT,
  source_refs_json TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_lf_batch ON learning_findings(finding_batch_id);
CREATE INDEX IF NOT EXISTS idx_lf_subject ON learning_findings(subject);

-- 11. findings (individual finding)
CREATE TABLE IF NOT EXISTS findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  finding_batch_id TEXT NOT NULL,
  finding_id TEXT UNIQUE NOT NULL,
  scope TEXT,
  finding_type TEXT,
  statement TEXT,
  evidence_summary TEXT,
  confidence TEXT,
  is_recurring INTEGER DEFAULT 0,
  mistake_reasons_json TEXT,
  concept_links_json TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_findings_batch ON findings(finding_batch_id);
CREATE INDEX IF NOT EXISTS idx_findings_type ON findings(finding_type);

-- 12. memory_decisions
CREATE TABLE IF NOT EXISTS memory_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_id TEXT UNIQUE NOT NULL,
  finding_id TEXT NOT NULL,
  finding_batch_id TEXT NOT NULL,
  student_id TEXT,
  subject TEXT,
  subject_label TEXT,
  statement TEXT,
  reason TEXT,
  candidate_type TEXT,
  priority TEXT,
  note TEXT,
  status TEXT DEFAULT 'accepted',
  accepted_at TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  UNIQUE(finding_id, finding_batch_id)
);

CREATE INDEX IF NOT EXISTS idx_md_student ON memory_decisions(student_id);
CREATE INDEX IF NOT EXISTS idx_md_subject ON memory_decisions(subject);
CREATE INDEX IF NOT EXISTS idx_md_status ON memory_decisions(status);

-- 13. action_candidates
CREATE TABLE IF NOT EXISTS action_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  finding_id TEXT NOT NULL,
  action_type TEXT,
  description TEXT,
  priority TEXT,
  target_week TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_ac_finding ON action_candidates(finding_id);
