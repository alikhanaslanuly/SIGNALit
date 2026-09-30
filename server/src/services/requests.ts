import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { DialogEvent, QuickReply, Request, RequestType, Status } from '../types.js';
import { ApiError } from './errors.js';
import type { Patient } from '../types.js';

type RequestRow = { cancelled_at?: string | null; client_request_id?: string; id: string; patient_id: string; room: string; type: RequestType; status: Status; created_at: string; acknowledged_at: string | null; completed_at: string | null; quick_reply: QuickReply | null };
type DialogRow = { id: string; patient_id: string; request_id: string | null; kind: 'QUESTION' | 'ANSWER'; question_id: string; answer: 'YES' | 'NO' | null; created_at: string };
const toRequest = (row: RequestRow): Request => ({ id: row.id, ...(row.client_request_id ? { clientRequestId: row.client_request_id } : {}), patientId: row.patient_id, room: row.room, type: row.type, status: row.status, createdAt: row.created_at, acknowledgedAt: row.acknowledged_at, completedAt: row.completed_at, quickReply: row.quick_reply });
const toDialogEvent = (row: DialogRow): DialogEvent => ({ id: row.id, patientId: row.patient_id, requestId: row.request_id, kind: row.kind, questionId: row.question_id, answer: row.answer, createdAt: row.created_at });

export function createRequestService(db: Database.Database, patients: { find(id: string): Patient }) {
  const hydrate = (row: RequestRow): Request => ({ ...toRequest(row), cancelledAt: row.cancelled_at ?? null,
    replies: db.prepare('SELECT id, code, created_at AS createdAt FROM request_replies WHERE request_id = ? ORDER BY created_at, rowid').all(row.id) as NonNullable<Request['replies']> });
  const find = (id: string): Request => {
    const row = db.prepare('SELECT * FROM requests WHERE id = ?').get(id) as RequestRow | undefined;
    if (!row) throw new ApiError('REQUEST_NOT_FOUND', 'Request not found', 404);
    return hydrate(row);
  };
  return {
    create(patientId: string, type: RequestType, clientRequestId?: string): Request {
      if (clientRequestId) {
        const previous = db.prepare('SELECT * FROM requests WHERE patient_id = ? AND client_request_id = ?').get(patientId, clientRequestId) as RequestRow | undefined;
        if (previous) { if (previous.type !== type) throw new ApiError('IDEMPOTENCY_CONFLICT', 'Request key already used', 409); return hydrate(previous); }
      }
      const patient = patients.find(patientId);
      const request: Request = { id: randomUUID(), ...(clientRequestId ? { clientRequestId } : {}), patientId, room: patient.room, type, status: 'PENDING', createdAt: new Date().toISOString(), acknowledgedAt: null, completedAt: null, quickReply: null };
      db.prepare('INSERT INTO requests (id, patient_id, room, type, status, created_at, client_request_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(request.id, request.patientId, request.room, request.type, request.status, request.createdAt, clientRequestId ?? null);
      return request;
    },
    find,
    list(filters: { status?: string; patientId?: string; room?: string }): Request[] {
      const where: string[] = [];
      const values: string[] = [];
      if (filters.status === 'active') where.push("status IN ('PENDING', 'ACKNOWLEDGED')");
      if (filters.status === 'completed') where.push("status = 'COMPLETED'");
      if (filters.patientId) { where.push('patient_id = ?'); values.push(filters.patientId); }
      if (filters.room) { where.push('room = ?'); values.push(filters.room); }
      const query = `SELECT * FROM requests${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC`;
      return (db.prepare(query).all(...values) as RequestRow[]).map(hydrate);
    },
    acknowledge(id: string): Request {
      const request = find(id);
      if (request.status === 'ACKNOWLEDGED' || request.status === 'COMPLETED') return request;
      if (request.status !== 'PENDING') throw new ApiError('INVALID_STATUS_TRANSITION', 'Only pending requests can be acknowledged', 409);
      const acknowledgedAt = new Date().toISOString();
      db.prepare('UPDATE requests SET status = ?, acknowledged_at = ? WHERE id = ?').run('ACKNOWLEDGED', acknowledgedAt, id);
      return { ...request, status: 'ACKNOWLEDGED', acknowledgedAt };
    },
    complete(id: string): Request {
      const request = find(id);
      if (request.status === 'COMPLETED') return request;
      if (request.status !== 'ACKNOWLEDGED') throw new ApiError('INVALID_STATUS_TRANSITION', 'Only acknowledged requests can be completed', 409);
      const completedAt = new Date().toISOString();
      db.prepare('UPDATE requests SET status = ?, completed_at = ? WHERE id = ?').run('COMPLETED', completedAt, id);
      return { ...request, status: 'COMPLETED', completedAt };
    },
    cancel(id: string): Request {
      const request = find(id);
      if (request.status === 'CANCELLED') return request;
      if (request.status === 'COMPLETED') throw new ApiError('INVALID_STATUS_TRANSITION', 'Completed requests cannot be cancelled', 409);
      const cancelledAt = new Date().toISOString();
      db.prepare('UPDATE requests SET status = ?, cancelled_at = ? WHERE id = ?').run('CANCELLED', cancelledAt, id);
      return { ...request, status: 'CANCELLED', cancelledAt };
    },
    reply(id: string, code: QuickReply, clientReplyId?: string): Request {
      const request = find(id);
      if (clientReplyId) {
        const prior = db.prepare('SELECT code FROM request_replies WHERE request_id = ? AND client_reply_id = ?').get(id, clientReplyId) as { code: QuickReply } | undefined;
        if (prior) { if (prior.code !== code) throw new ApiError('IDEMPOTENCY_CONFLICT', 'Reply key already used', 409); return request; }
      }
      if (request.status === 'COMPLETED' || request.status === 'CANCELLED') throw new ApiError('INVALID_STATUS_TRANSITION', 'Closed requests cannot receive replies', 409);
      db.transaction(() => {
        db.prepare('INSERT INTO request_replies (id, request_id, code, created_at, client_reply_id) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), id, code, new Date().toISOString(), clientReplyId ?? null);
        db.prepare('UPDATE requests SET quick_reply = ? WHERE id = ?').run(code, id);
      })();
      return find(id);
    },
    addQuestion(patientId: string, questionId: string): DialogEvent {
      const patient = patients.find(patientId);
      const event: DialogEvent = { id: randomUUID(), patientId, room: patient.room, requestId: null, kind: 'QUESTION', questionId, answer: null, createdAt: new Date().toISOString() };
      db.prepare('INSERT INTO dialog_events (id, patient_id, kind, question_id, created_at) VALUES (?, ?, ?, ?, ?)').run(event.id, patientId, event.kind, event.questionId, event.createdAt);
      return event;
    },
    addAnswer(patientId: string, questionId: string, answer: 'YES' | 'NO'): DialogEvent {
      const patient = patients.find(patientId);
      const event: DialogEvent = { id: randomUUID(), patientId, room: patient.room, requestId: null, kind: 'ANSWER', questionId, answer, createdAt: new Date().toISOString() };
      db.prepare('INSERT INTO dialog_events (id, patient_id, kind, question_id, answer, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(event.id, patientId, event.kind, event.questionId, event.answer, event.createdAt);
      return event;
    },
    dialog(patientId: string): DialogEvent[] {
      patients.find(patientId);
      return (db.prepare('SELECT * FROM dialog_events WHERE patient_id = ? ORDER BY created_at ASC').all(patientId) as DialogRow[]).map(toDialogEvent);
    },
  };
}
