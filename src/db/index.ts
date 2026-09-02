import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.join(__dirname, "..", "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "feedback.db");
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'RECEIVED'
      CHECK (status IN ('RECEIVED', 'ANALYZING', 'DONE', 'FAILED')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Lightweight additive migration: add columns introduced after the initial
// release if they're missing, so an existing dev DB doesn't need to be
// deleted. Fine for this project's scale; a real migration tool would
// replace this once there's more than one or two additive changes.
const existingColumns = new Set(
  (db.prepare(`PRAGMA table_info(feedback)`).all() as { name: string }[]).map(
    (col) => col.name
  )
);

const columnsToAdd: Record<string, string> = {
  raw_ai_response: "TEXT",
  analysis_result: "TEXT",
  failure_reason: "TEXT",
};

for (const [column, definition] of Object.entries(columnsToAdd)) {
  if (!existingColumns.has(column)) {
    db.exec(`ALTER TABLE feedback ADD COLUMN ${column} ${definition}`);
  }
}
