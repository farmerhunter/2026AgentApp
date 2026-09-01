export function runE4Migrations(db) {
  const tableInfo = (table) => db.prepare(`PRAGMA table_info(${table})`).all();
  const hasColumn = (table, column) => tableInfo(table).some((row) => row.name === column);

  const addColumn = (table, column, ddl) => {
    if (!hasColumn(table, column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    }
  };

  addColumn("uploads", "storage_key", "TEXT");
  addColumn("uploads", "file_name", "TEXT");
  addColumn("uploads", "file_size", "INTEGER");
  addColumn("uploads", "mime_type", "TEXT");
  addColumn("uploads", "image_width", "INTEGER");
  addColumn("uploads", "image_height", "INTEGER");

  addColumn("questions", "student_answer_text", "TEXT");
  addColumn("questions", "question_type", "TEXT");
  addColumn("questions", "ocr_confidence", "REAL");

  addColumn("ocr_jobs", "attempt", "INTEGER DEFAULT 1");
  addColumn("ocr_jobs", "is_latest", "INTEGER DEFAULT 1");
  addColumn("ocr_jobs", "provider_request_id", "TEXT");
  addColumn("ocr_jobs", "provider_metadata_json", "TEXT");

  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_ocr_jobs_latest
     ON ocr_jobs(upload_id, attempt)`,
  );
}
