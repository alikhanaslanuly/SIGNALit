export const schema = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    room TEXT NOT NULL,
    created_at TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    room TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    acknowledged_at TEXT,
    completed_at TEXT,
    quick_reply TEXT
  );

  CREATE TABLE IF NOT EXISTS request_replies (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES requests(id),
    code TEXT NOT NULL,
    created_at TEXT NOT NULL,
    client_reply_id TEXT,
    UNIQUE(request_id, client_reply_id)
  );
  CREATE INDEX IF NOT EXISTS replies_request_idx ON request_replies(request_id);

  CREATE TABLE IF NOT EXISTS dialog_events (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    request_id TEXT REFERENCES requests(id),
    kind TEXT NOT NULL,
    question_id TEXT NOT NULL,
    answer TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS requests_status_idx ON requests(status);
  CREATE INDEX IF NOT EXISTS requests_patient_idx ON requests(patient_id);
  CREATE INDEX IF NOT EXISTS dialog_patient_idx ON dialog_events(patient_id);
`;
