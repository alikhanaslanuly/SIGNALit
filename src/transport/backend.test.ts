import { describe, expect, it } from 'vitest';
import type { ApiClient } from '../api';
import { BackendTransport } from './backend';

class FakeSocket {
  private handlers = new Map<string, (payload?: unknown) => void>();
  emitted: Array<{ event: string; payload?: unknown }> = [];
  on(event: string, handler: (...args: any[]) => void) { this.handlers.set(event, handler); return this; }
  off() { return this; }
  emit(event: string, payload?: unknown) { this.emitted.push({ event, payload }); return this; }
  disconnect() {}
  trigger(event: string, payload?: unknown) { this.handlers.get(event)?.(payload); }
}

const request = { id: 'server-request', patientId: 'patient-1', room: '204', type: 'HELP' as const, status: 'PENDING' as const,
  createdAt: '2026-09-29T00:00:00.000Z', acknowledgedAt: null, completedAt: null, quickReply: null };

describe('BackendTransport', () => {
  it('does not invoke reconnect work during synchronous construction', () => {
    const socket = new FakeSocket();
    let reconnects = 0;
    const transport = new BackendTransport({ api: {} as ApiClient, audience: 'nurse', room: '204', socketUrl: 'http://localhost:4000', socketFactory: () => socket, onReconnect: () => { reconnects++; } });
    expect(reconnects).toBe(0);
    socket.trigger('connect');
    expect(reconnects).toBe(1);
    transport.close();
  });

  it('maps a request response and realtime status to the local session request id', async () => {
    const socket = new FakeSocket();
    const api = { post: async (path: string) => path === '/api/requests' ? request : { ...request, status: 'ACKNOWLEDGED', acknowledgedAt: '2026-09-29T00:01:00.000Z' } } as unknown as ApiClient;
    const transport = new BackendTransport({ api, patientId: 'patient-1', audience: 'patient', room: '204', socketUrl: 'http://localhost:4000', socketFactory: () => socket });
    const messages: Array<{ kind: string; id: string; payload: Record<string, unknown> }> = [];
    transport.subscribe(message => messages.push(message));
    transport.send({ id: 'local-request', ts: 1, room: '204', kind: 'REQUEST', payload: { request: 'HELP' } });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(messages[0]).toMatchObject({ kind: 'REQUEST', id: 'server-request', payload: { requestId: 'server-request', status: 'PENDING' } });

    socket.trigger('REQUEST_UPDATED', { ...request, status: 'ACKNOWLEDGED', acknowledgedAt: '2026-09-29T00:01:00.000Z' });
    expect(messages[1]).toMatchObject({ kind: 'STATUS', payload: { requestId: 'server-request', status: 'ACKNOWLEDGED' } });
    transport.close();
  });

  it('resolves nurse questions to the active patient in the configured room', async () => {
    const socket = new FakeSocket();
    const calls: string[] = [];
    const api = {
      get: async () => [{ id: 'patient-1', displayName: 'A', room: '204', createdAt: '', active: true }],
      post: async (path: string, body: unknown) => { calls.push(`${path}:${JSON.stringify(body)}`); return { id: 'dialog-1', patientId: 'patient-1', requestId: null, kind: 'QUESTION', questionId: 'water', answer: null, createdAt: '2026-09-29T00:00:00.000Z' }; },
    } as unknown as ApiClient;
    const transport = new BackendTransport({ api, audience: 'nurse', room: '204', socketUrl: 'http://localhost:4000', socketFactory: () => socket });
    transport.send({ id: 'question-1', ts: 1, room: '204', kind: 'QUESTION', payload: { questionId: 'water' } });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(calls).toEqual(['/api/patients/patient-1/questions:{"questionId":"water"}']);
    transport.close();
  });
});

describe('realtime lifecycle regression', () => {
  it('delivers acknowledgement, replies, completion once each and recovers missed updates', async () => {
    const socket = new FakeSocket(); let current: any = request;
    const api = { get: async () => [current] } as unknown as ApiClient;
    const transport = new BackendTransport({ api, patientId: 'patient-1', audience: 'patient', socketUrl: '', socketFactory: () => socket });
    const messages: any[] = []; transport.subscribe(message => messages.push(message));
    socket.trigger('REQUEST_CREATED', request);
    socket.trigger('REQUEST_UPDATED', { ...request, status: 'ACKNOWLEDGED', acknowledgedAt: '2026-09-29T00:01:00Z' });
    socket.trigger('QUICK_REPLY_CREATED', { ...request, status: 'ACKNOWLEDGED', quickReply: 'COMING' });
    socket.trigger('QUICK_REPLY_CREATED', { ...request, status: 'ACKNOWLEDGED', quickReply: 'WAIT' });
    current = { ...request, status: 'COMPLETED', acknowledgedAt: '2026-09-29T00:01:00Z', completedAt: '2026-09-29T00:02:00Z', quickReply: 'COMING' };
    await transport.loadRequests('all'); await transport.loadRequests('all');
    expect(messages.filter(message => message.kind === 'REQUEST')).toHaveLength(1);
    expect(messages.filter(message => message.payload.status === 'COMPLETED')).toHaveLength(1);
    expect(messages.filter(message => message.payload.note === 'WAIT')).toHaveLength(1);
    transport.close();
  });
  it('ignores other patients even when the room matches', () => {
    const socket = new FakeSocket(); const transport = new BackendTransport({ api: {} as ApiClient, patientId: 'patient-1', audience: 'patient', socketUrl: '', socketFactory: () => socket });
    const messages: any[] = []; transport.subscribe(message => messages.push(message));
    transport.ingestRequest({ ...request, patientId: 'other' });
    socket.trigger('REQUEST_CREATED', { ...request, patientId: 'other' });
    socket.trigger('REQUEST_UPDATED', { ...request, patientId: 'other' });
    expect(messages).toHaveLength(0); transport.close();
  });
  it('reports delivery failures and retries using the same idempotency key', async () => {
    const socket = new FakeSocket(); const bodies: any[] = []; let fail = true; let errors = 0;
    const api = { post: async (_path: string, body: any) => { bodies.push(body); if (fail) throw new Error('offline'); return request; } } as unknown as ApiClient;
    const transport = new BackendTransport({ api, patientId: 'patient-1', audience: 'patient', socketUrl: '', socketFactory: () => socket, onError: () => errors++ });
    transport.send({ id: 'stable-id', ts: 1, room: '204', kind: 'REQUEST', payload: { request: 'HELP' } });
    await new Promise(resolve => setTimeout(resolve, 0)); fail = false; transport.retryFailed();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(errors).toBe(1); expect(bodies.map(body => body.clientRequestId)).toEqual(['stable-id', 'stable-id']); transport.close();
  });
});

it('does not regress a live reply or completion when older HTTP recovery arrives', async () => {
  const socket = new FakeSocket(); let snapshot: any = request;
  const api = { get: async () => [snapshot] } as unknown as ApiClient;
  const transport = new BackendTransport({ api, patientId: 'patient-1', audience: 'patient', socketUrl: '', socketFactory: () => socket });
  const messages: any[] = []; transport.subscribe(message => messages.push(message));
  const first = { id: 'reply-1', code: 'WAIT', createdAt: '2026-09-29T00:01:01Z' };
  const second = { id: 'reply-2', code: 'COMING', createdAt: '2026-09-29T00:01:02Z' };
  socket.trigger('REQUEST_CREATED', request);
  socket.trigger('QUICK_REPLY_CREATED', { ...request, quickReply: 'COMING', replies: [first, second] });
  snapshot = { ...request, quickReply: 'WAIT', replies: [first] }; await transport.loadRequests();
  expect(messages.at(-1).payload.note).toBe('COMING');
  socket.trigger('REQUEST_UPDATED', { ...snapshot, status: 'COMPLETED', completedAt: '2026-09-29T00:02:00Z', quickReply: 'COMING', replies: [first, second] });
  snapshot = { ...request, status: 'ACKNOWLEDGED', quickReply: 'WAIT', replies: [first] }; await transport.loadRequests();
  expect(messages.at(-1).payload.status).toBe('COMPLETED'); expect(messages.filter(message => message.payload.note === 'WAIT')).toHaveLength(0);
  transport.close();
});

it('correlates recovery that wins the race against the create HTTP response', async () => {
  const socket = new FakeSocket(); let finish!: (value: unknown) => void;
  const api = { post: () => new Promise(resolve => { finish = resolve; }), get: async () => [{ ...request, clientRequestId: 'local-inflight' }] } as unknown as ApiClient;
  const transport = new BackendTransport({ api, patientId:'patient-1', audience:'patient',socketUrl:'',socketFactory:()=>socket });
  const messages: any[] = []; transport.subscribe(message => messages.push(message));
  transport.send({id:'local-inflight',ts:1,room:'204',kind:'REQUEST',payload:{request:'HELP'}});
  await transport.loadRequests();
  expect(messages.find(message => message.kind === 'REQUEST').payload.localRequestId).toBe('local-inflight');
  socket.trigger('REQUEST_UPDATED', {...request,clientRequestId:'local-inflight',status:'ACKNOWLEDGED'});
  finish({...request,clientRequestId:'local-inflight'}); await new Promise(resolve => setTimeout(resolve,0));
  expect(messages.filter(message => message.kind === 'REQUEST')).toHaveLength(1);
  expect(messages.at(-1).payload.status).toBe('ACKNOWLEDGED'); transport.close();
});
