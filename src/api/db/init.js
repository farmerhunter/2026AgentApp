import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DATABASE_URL?.replace("sqlite:///", "") ?? resolve(__dirname, "..", "hermes.db");

let db = null;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.defaultSafeIntegers();
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    // Run schema if tables don't exist yet
    const schema = readFileSync(resolve(__dirname, "schema.sql"), "utf-8");
    db.exec(schema);
  }
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

// Run directly: node db/init.js
if (import.meta.url === `file://${process.argv[1]}`) {
  getDb();
  console.log(`Database initialized at ${DB_PATH}`);
  closeDb();
}
