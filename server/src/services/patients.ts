import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { Patient } from '../types.js';
import { ApiError } from './errors.js';
import type { PatientInput, PatientPatchInput } from '../validation/schemas.js';

type PatientRow = { id: string; display_name: string; room: string; created_at: string; active: number };
const toPatient = (row: PatientRow): Patient => ({ id: row.id, displayName: row.display_name, room: row.room, createdAt: row.created_at, active: row.active === 1 });

export function createPatientService(db: Database.Database) {
  const find = (id: string): Patient => {
    const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as PatientRow | undefined;
    if (!row) throw new ApiError('PATIENT_NOT_FOUND', 'Patient not found', 404);
    return toPatient(row);
  };
  return {
    create(input: PatientInput): Patient {
      const patient: Patient = { id: randomUUID(), displayName: input.displayName, room: input.room, createdAt: new Date().toISOString(), active: true };
      db.prepare('INSERT INTO patients (id, display_name, room, created_at, active) VALUES (?, ?, ?, ?, 1)').run(patient.id, patient.displayName, patient.room, patient.createdAt);
      return patient;
    },
    list(): Patient[] {
      return (db.prepare('SELECT * FROM patients ORDER BY created_at DESC').all() as PatientRow[]).map(toPatient);
    },
    find,
    update(id: string, input: PatientPatchInput): Patient {
      const patient = find(id);
      const updated = { ...patient, ...input };
      db.prepare('UPDATE patients SET display_name = ?, room = ?, active = ? WHERE id = ?').run(updated.displayName, updated.room, updated.active ? 1 : 0, id);
      return updated;
    },
  };
}
