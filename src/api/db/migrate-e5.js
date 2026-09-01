export function runE5Migrations(db) {
  const tableInfo = (table) => db.prepare(`PRAGMA table_info(${table})`).all();
  const hasColumn = (table, column) => tableInfo(table).some((row) => row.name === column);

  const addColumn = (table, column, ddl) => {
    if (!hasColumn(table, column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    }
  };

  addColumn("findings", "question_id", "TEXT");
  addColumn("findings", "upload_id", "TEXT");
  addColumn("findings", "source_memory_ids_json", "TEXT");

  addColumn("weekly_reports", "report_json", "TEXT");
  addColumn("weekly_reports", "generated_by", "TEXT");

  addColumn("hermes_jobs", "skill_version", "TEXT");
  addColumn("hermes_jobs", "skill_sha256", "TEXT");
  addColumn("hermes_jobs", "output_json", "TEXT");

  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_findings_question
     ON findings(question_id)`,
  );
}
