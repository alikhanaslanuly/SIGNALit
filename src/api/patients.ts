import type { GestureId } from '../contracts';
import type { ApiClient } from './client';

export interface PatientRecord { id: string; displayName: string; room: string; createdAt: string; active: boolean }
export interface DialogRecord {
  id: string; patientId: string; requestId: string | null; kind: 'QUESTION' | 'ANSWER';
  questionId: string; answer: 'YES' | 'NO' | null; createdAt: string;
}

export function createPatient(client: ApiClient, input: { displayName: string; room: string }): Promise<PatientRecord> {
  return client.post('/api/patients', input);
}

export function listPatients(client: ApiClient): Promise<PatientRecord[]> { return client.get('/api/patients'); }
export function getPatient(client: ApiClient, patientId: string): Promise<PatientRecord> { return client.get(`/api/patients/${encodeURIComponent(patientId)}`); }
export function updatePatient(client: ApiClient, patientId: string, input: { displayName?: string; room?: string; active?: boolean }): Promise<PatientRecord> {
  return client.request(`/api/patients/${encodeURIComponent(patientId)}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export function askQuestion(client: ApiClient, patientId: string, questionId: string): Promise<DialogRecord> {
  return client.post(`/api/patients/${encodeURIComponent(patientId)}/questions`, { questionId });
}
export function answerQuestion(client: ApiClient, patientId: string, questionId: string, answer: Extract<GestureId, 'YES' | 'NO'>): Promise<DialogRecord> {
  return client.post(`/api/patients/${encodeURIComponent(patientId)}/answers`, { questionId, answer });
}
export function getDialog(client: ApiClient, patientId: string): Promise<DialogRecord[]> {
  return client.get(`/api/patients/${encodeURIComponent(patientId)}/dialog`);
}
