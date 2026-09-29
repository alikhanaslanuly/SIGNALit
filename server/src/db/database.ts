import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { schema } from './schema.js';

export function createDatabase(filename = ':memory:'): Database.Database {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  const columns = db.prepare('PRAGMA table_info(requests)').all() as Array<{ name: string }>;
  if (!columns.some(column => column.name === 'client_request_id')) db.exec('ALTER TABLE requests ADD COLUMN client_request_id TEXT');
  if (!columns.some(column => column.name === 'cancelled_at')) db.exec('ALTER TABLE requests ADD COLUMN cancelled_at TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS requests_client_id_idx ON requests(patient_id, client_request_id)');
  return db;
}
