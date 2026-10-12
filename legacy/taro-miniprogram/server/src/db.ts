import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { config } from './config.js'

const dbFile = resolve(config.dbPath)
mkdirSync(dirname(dbFile), { recursive: true })

export const db = new Database(dbFile)
db.pragma('journal_mode = WAL')

db.exec(`
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS session_records (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  status TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_records_cycle ON session_records(cycle_id);
CREATE TABLE IF NOT EXISTS cycle_reviews (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS knowledge (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_read_at TEXT
);
CREATE TABLE IF NOT EXISTS diet_records (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS llm_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scene TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_cny REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`)

/** 全量导出（Product Principle #4：数据可带走；不含体检指标——那从未上云） */
export function exportAll(): Record<string, unknown[]> {
  const tables = ['plans', 'session_records', 'cycle_reviews', 'diet_records', 'knowledge', 'memories']
  const out: Record<string, unknown[]> = {}
  for (const t of tables) {
    out[t] = db.prepare(`SELECT * FROM ${t}`).all() as unknown[]
  }
  return out
}
