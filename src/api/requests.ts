import type { GestureId, Status } from '../contracts';
import type { ApiClient } from './client';

export interface RequestRecord {
  id: string; clientRequestId?: string; patientId: string; room: string; type: GestureId; status: Status | 'CANCELLED';
  createdAt: string; acknowledgedAt: string | null; completedAt: string | null; quickReply: 'COMING' | 'WAIT' | null;
  cancelledAt?: string | null;
  replies?: Array<{ id: string; code: 'COMING' | 'WAIT'; createdAt: string }>;
}

export function createRequest(client: ApiClient, patientId: string, type: GestureId, clientRequestId?: string): Promise<RequestRecord> {
  return client.post('/api/requests', { patientId, type, ...(clientRequestId ? { clientRequestId } : {}) });
}
export function listRequests(client: ApiClient, filters: { status?: 'all' | 'active' | 'completed'; patientId?: string; room?: string } = {}): Promise<RequestRecord[]> {
  const query = new URLSearchParams();
  if (filters.status) query.set('status', filters.status);
  if (filters.patientId) query.set('patientId', filters.patientId);
  if (filters.room) query.set('room', filters.room);
  const suffix = query.toString() ? `?${query}` : '';
  return client.get(`/api/requests${suffix}`);
}
export function getRequest(client: ApiClient, requestId: string): Promise<RequestRecord> { return client.get(`/api/requests/${encodeURIComponent(requestId)}`); }
export function acknowledgeRequest(client: ApiClient, requestId: string): Promise<RequestRecord> { return client.post(`/api/requests/${encodeURIComponent(requestId)}/acknowledge`, {}); }
export function completeRequest(client: ApiClient, requestId: string): Promise<RequestRecord> { return client.post(`/api/requests/${encodeURIComponent(requestId)}/complete`, {}); }
export function sendQuickReply(client: ApiClient, requestId: string, code: 'COMING' | 'WAIT', clientReplyId: string = crypto.randomUUID()): Promise<RequestRecord> { return client.post(`/api/requests/${encodeURIComponent(requestId)}/replies`, { code, clientReplyId }); }

export function cancelRequest(client: ApiClient, requestId: string): Promise<RequestRecord> { return client.post(`/api/requests/${encodeURIComponent(requestId)}/cancel`, {}); }
