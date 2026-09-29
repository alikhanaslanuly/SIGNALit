import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { createDatabase } from '../src/db/database.js';
import { createApp } from '../src/app.js';

describe('append-only request history and file persistence', () => {
  it('keeps replies and status timestamps across reopen; retrying every action is idempotent', () => {
    const directory = mkdtempSync(join(tmpdir(), 'signal-persistence-')); const filename = join(directory, 'nested', 'demo.db');
    const first = createApp({ db: createDatabase(filename) });
    try {
      const patient = first.services.patients.create({ displayName: 'Demo', room: '204' });
      const request = first.services.requests.create(patient.id, 'HELP', 'create-key');
      expect(first.services.requests.create(patient.id, 'HELP', 'create-key').id).toBe(request.id);
      const ack = first.services.requests.acknowledge(request.id);
      expect(first.services.requests.acknowledge(request.id).acknowledgedAt).toBe(ack.acknowledgedAt);
      first.services.requests.reply(request.id, 'WAIT', 'reply-1');
      first.services.requests.reply(request.id, 'COMING', 'reply-2');
      first.services.requests.reply(request.id, 'COMING', 'reply-2');
      const done = first.services.requests.complete(request.id);
      expect(first.services.requests.complete(request.id).completedAt).toBe(done.completedAt);
      expect(first.services.requests.acknowledge(request.id).status).toBe('COMPLETED');
      expect(first.services.requests.reply(request.id, 'COMING', 'reply-2').replies).toHaveLength(2);
      expect(() => first.services.requests.reply(request.id, 'WAIT', 'reply-3')).toThrow();
      expect(() => first.services.requests.reply(request.id, 'WAIT', 'reply-2')).toThrow();
      first.db.close();
      const reopened = createApp({ db: createDatabase(filename) });
      try {
        const recovered = reopened.services.requests.find(request.id);
        expect(recovered.status).toBe('COMPLETED'); expect(recovered.completedAt).toBe(done.completedAt);
        expect(recovered.replies?.map(reply => reply.code)).toEqual(['WAIT', 'COMING']);
        expect(recovered.replies?.every(reply => Number.isFinite(Date.parse(reply.createdAt)))).toBe(true);
        expect(reopened.services.requests.list({})).toHaveLength(1);
      } finally { reopened.db.close(); }
    } finally { if (first.db.open) first.db.close(); rmSync(directory, { recursive: true, force: true }); }
  });
  it('migrates an existing database without inventing historic reply timestamps', () => {
    const directory = mkdtempSync(join(tmpdir(), 'signal-migration-')); const filename = join(directory, 'old.db');
    const old = new Database(filename);
    old.exec(`CREATE TABLE patients (id TEXT PRIMARY KEY, display_name TEXT NOT NULL, room TEXT NOT NULL, created_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE requests (id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, room TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, acknowledged_at TEXT, completed_at TEXT, quick_reply TEXT);
      INSERT INTO patients VALUES ('p', 'Demo', '204', '2026-01-01T00:00:00Z', 1);
      INSERT INTO requests VALUES ('r', 'p', '204', 'HELP', 'PENDING', '2026-01-01T00:00:00Z', NULL, NULL, 'WAIT');`);
    old.close(); const app = createApp({ db: createDatabase(filename) });
    try { expect(app.services.requests.find('r')).toMatchObject({ quickReply: 'WAIT', replies: [], cancelledAt: null }); }
    finally { app.db.close(); rmSync(directory, { recursive: true, force: true }); }
  });
});
