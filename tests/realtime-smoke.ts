/** Uses a disposable in-memory database and real HTTP + Socket.IO polling. */
import assert from 'node:assert/strict';
import { io, type Socket } from 'socket.io-client';
import { createRuntime } from '../server/src/runtime';
import { ApiClient } from '../src/api/client';
import { BackendTransport } from '../src/transport/backend';
import { SignalSession } from '../src/app/session';
import { MockEngine } from '../src/core/mock/mockEngine';
const runtime = createRuntime();
await new Promise<void>(resolve => runtime.httpServer.listen(0, '127.0.0.1', resolve));
const address = runtime.httpServer.address(); assert(address && typeof address !== 'string');
const url = `http://127.0.0.1:${address.port}`;
const api = new ApiClient({ baseUrl: url });
const until = async (predicate: () => boolean, label: string) => { const start = Date.now(); while (!predicate()) { if (Date.now() - start > 6000) throw new Error(`Timeout: ${label}`); await new Promise(resolve => setTimeout(resolve, 20)); } };
let session: SignalSession | undefined; let transport: BackendTransport | undefined; let nurse: Socket | undefined;
try {
  const patient = await api.post<{ id: string }>('/api/patients', { displayName: 'Disposable demo', room: '204' });
  let patientSocket!: Socket;
  transport = new BackendTransport({ api, patientId: patient.id, room: '204', audience: 'patient', socketUrl: url,
    socketFactory: destination => { patientSocket = io(destination, { transports: ['polling'], forceNew: true }); return patientSocket; },
    onReconnect: () => { void transport!.loadRequests('all'); } });
  const engine = new MockEngine(); let id = 0;
  session = new SignalSession({ engine, transport, mode: 'mock', makeId: () => `smoke-${++id}` });
  await session.start();
  nurse = io(url, { transports: ['polling'], forceNew: true }); const nurseRequests: any[] = [];
  nurse.on('connect', () => nurse!.emit('join:nurses')); nurse.on('REQUEST_CREATED', value => { if (!nurseRequests.some(request => request.id === value.id)) nurseRequests.push(value); });
  await until(() => patientSocket.connected && nurse!.connected, 'both sockets connected');
  await new Promise(resolve => setTimeout(resolve, 80));
  engine.emitConfirmed('HELP');
  await until(() => nurseRequests.length === 1, 'HELP delivered to nurse');
  const helpId = nurseRequests[0].id;
  const duplicate = await api.post<any>('/api/requests', { patientId: patient.id, type: 'HELP', clientRequestId: 'smoke-1' }); assert.equal(duplicate.id, helpId);
  await api.post(`/api/requests/${helpId}/acknowledge`, {});
  await api.post(`/api/requests/${helpId}/acknowledge`, {});
  await until(() => session!.snapshot.dialog.activeRequest?.status === 'ACKNOWLEDGED', 'ack visible to patient');
  await api.post(`/api/requests/${helpId}/replies`, { code: 'COMING', clientReplyId: 'reply-smoke' });
  await api.post(`/api/requests/${helpId}/replies`, { code: 'COMING', clientReplyId: 'reply-smoke' });
  assert.equal((await api.get<any>(`/api/requests/${helpId}`)).replies.length, 1);
  await until(() => session!.snapshot.dialog.activeRequest?.note === 'COMING', 'reply visible to patient');
  patientSocket.disconnect();
  await api.post(`/api/requests/${helpId}/complete`, {});
  await api.post(`/api/requests/${helpId}/complete`, {});
  nurse.disconnect(); nurse.connect();
  patientSocket.connect();
  await until(() => session!.snapshot.dialog.activeRequest?.status === 'COMPLETED', 'completion recovered after reconnect');
  engine.emitConfirmed('WATER'); assert.equal(session.snapshot.dialog.pendingRequest, 'WATER'); engine.emitConfirmed('YES');
  await until(() => nurseRequests.length === 2, 'WATER + YES delivered');
  const waterId = nurseRequests[1].id;
  await api.post(`/api/requests/${waterId}/acknowledge`, {}); await api.post(`/api/requests/${waterId}/complete`, {});
  await until(() => session!.snapshot.dialog.activeRequest?.status === 'COMPLETED', 'second completion delivered');
  engine.emitConfirmed('HELP'); engine.emitConfirmed('NO');
  await until(() => nurseRequests.length === 3, 'cancellable HELP delivered');
  await until(() => session!.snapshot.dialog.activeRequest === null, 'cancel returned to patient');
  const requests = await api.get<any[]>('/api/requests'); assert.equal(requests.length, 3);
  assert.equal(requests.find(request => request.id === nurseRequests[2].id).status, 'CANCELLED');
  console.log('PASS: real HTTP + Socket.IO polling; HELP → ack → reply → reconnect → complete; WATER + YES; urgent cancellation; 3 requests; duplicate create/ack/reply/complete; both sockets reconnect; no duplicates.');
} finally { session?.dispose(); nurse?.disconnect(); await new Promise<void>(resolve => runtime.io.close(() => resolve())); runtime.db.close(); }
