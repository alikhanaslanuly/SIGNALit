import { afterEach, describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { createRequest, createResponse } from 'node-mocks-http';
import { createApp } from '../src/app.js';
import type { RealtimeEvent } from '../src/types.js';

const runtimes: ReturnType<typeof createApp>[] = [];
afterEach(() => { for (const runtime of runtimes.splice(0)) if(runtime.db.open) runtime.db.close(); });

async function testApp() {
  const events: { event: RealtimeEvent; payload: unknown; patientId?: string }[] = [];
  const runtime = createApp({ broadcast: (event, payload, patientId) => events.push({ event, payload, patientId }) });
  runtimes.push(runtime);
  const call = async (path: string, init: RequestInit = {}) => {
    const req = createRequest({ method: (init.method ?? 'GET') as 'GET' | 'POST' | 'PATCH', url: path, path, body: init.body ? JSON.parse(String(init.body)) : undefined, headers: { 'content-type': 'application/json' } });
    const res = createResponse({ eventEmitter: EventEmitter });
    await new Promise<void>((resolve, reject) => {
      res.on('end', resolve);
      runtime.app(req, res, reject);
    });
    return { status: res.statusCode, body: res._getJSONData() as any };
  };
  return { call, events, runtime };
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

describe('SIGNAL backend API', () => {
  it('registers and lists patients, rejecting invalid input', async () => {
    const api = await testApp();
    expect((await api.call('/api/patients', post({ displayName: '', room: '204' }))).status).toBe(400);
    const created = await api.call('/api/patients', post({ displayName: 'Amina', room: '204' }));
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ displayName: 'Amina', room: '204', active: true });
    expect((await api.call('/api/patients')).body).toHaveLength(1);
    expect((await api.call(`/api/patients/${created.body.id}`)).body.id).toBe(created.body.id);
  });

  it('updates allowed patient session metadata and active state', async () => {
    const api = await testApp();
    const patient = (await api.call('/api/patients', post({ displayName: 'Amina', room: '204' }))).body;
    const updated = await api.call(`/api/patients/${patient.id}`, { method: 'PATCH', body: JSON.stringify({ displayName: 'Amina K.', room: '205', active: false }) });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ displayName: 'Amina K.', room: '205', active: false });
    expect((await api.call(`/api/patients/${patient.id}`, { method: 'PATCH', body: JSON.stringify({ diagnosis: 'x' }) })).status).toBe(400);
  });

  it('creates requests from patient semantics and filters active/completed requests', async () => {
    const api = await testApp();
    const patient = (await api.call('/api/patients', post({ displayName: 'Amina', room: '204' }))).body;
    const created = await api.call('/api/requests', post({ patientId: patient.id, type: 'HELP' }));
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ patientId: patient.id, room: '204', type: 'HELP', status: 'PENDING' });
    expect(api.events.map(event => event.event)).toContain('REQUEST_CREATED');
    expect((await api.call('/api/requests?status=active')).body).toHaveLength(1);
    expect((await api.call('/api/requests?status=completed')).body).toHaveLength(0);
    expect((await api.call('/api/requests', post({ patientId: 'missing', type: 'WATER' }))).status).toBe(404);
  });

  it('enforces acknowledgement and completion transitions', async () => {
    const api = await testApp();
    const patient = (await api.call('/api/patients', post({ displayName: 'Amina', room: '204' }))).body;
    const request = (await api.call('/api/requests', post({ patientId: patient.id, type: 'WATER' }))).body;
    expect((await api.call(`/api/requests/${request.id}/complete`, post({}))).status).toBe(409);
    const acknowledged = await api.call(`/api/requests/${request.id}/acknowledge`, post({}));
    expect(acknowledged.body.status).toBe('ACKNOWLEDGED');
    expect((await api.call(`/api/requests/${request.id}/acknowledge`, post({}))).body.acknowledgedAt).toBe(acknowledged.body.acknowledgedAt);
    const completed = await api.call(`/api/requests/${request.id}/complete`, post({}));
    expect(completed.body.status).toBe('COMPLETED');
    expect(api.events.map(event => event.event)).toContain('REQUEST_UPDATED');
  });

  it('stores allowed quick replies and rejects invalid codes', async () => {
    const api = await testApp();
    const patient = (await api.call('/api/patients', post({ displayName: 'Amina', room: '204' }))).body;
    const request = (await api.call('/api/requests', post({ patientId: patient.id, type: 'HELP' }))).body;
    expect((await api.call(`/api/requests/${request.id}/replies`, post({ code: 'COMING' }))).body.quickReply).toBe('COMING');
    expect((await api.call(`/api/requests/${request.id}/replies`, post({ code: 'LATER' }))).status).toBe(400);
    expect(api.events.map(event => event.event)).toContain('QUICK_REPLY_CREATED');
  });

  it('stores questions and YES/NO answers in the patient dialog', async () => {
    const api = await testApp();
    const patient = (await api.call('/api/patients', post({ displayName: 'Amina', room: '204' }))).body;
    expect((await api.call(`/api/patients/${patient.id}/questions`, post({ questionId: 'pain' }))).status).toBe(201);
    expect((await api.call(`/api/patients/${patient.id}/answers`, post({ questionId: 'pain', answer: 'YES' }))).status).toBe(201);
    expect((await api.call(`/api/patients/${patient.id}/answers`, post({ questionId: 'pain', answer: 'MAYBE' }))).status).toBe(400);
    const dialog = await api.call(`/api/patients/${patient.id}/dialog`);
    expect(dialog.body).toHaveLength(2);
    expect(api.events.map(event => event.event)).toEqual(expect.arrayContaining(['QUESTION_CREATED', 'ANSWER_CREATED']));
  });

  it('returns consistent not-found errors', async () => {
    const api = await testApp();
    const response = await api.call('/api/requests/no-such-request');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found' } });
  });
  it('retries creation idempotently and persists urgent cancellation', async () => {
    const api = await testApp();
    const patient = (await api.call('/api/patients', post({ displayName: 'Demo patient', room: '204' }))).body;
    const body = { patientId: patient.id, type: 'HELP', clientRequestId: 'stable-demo-key' };
    const first = (await api.call('/api/requests', post(body))).body;
    const retry = (await api.call('/api/requests', post(body))).body;
    expect(retry.id).toBe(first.id);
    expect((await api.call('/api/requests')).body).toHaveLength(1);
    expect((await api.call(`/api/requests/${first.id}/cancel`, post({}))).body.status).toBe('CANCELLED');
    expect((await api.call('/api/requests?status=active')).body).toHaveLength(0);
    expect((await api.call(`/api/requests/${first.id}/acknowledge`, post({}))).status).toBe(409);
    expect((await api.call(`/api/requests/${first.id}/replies`, post({ code: 'COMING' }))).status).toBe(409);
  });

  it('rejects oversized names, rooms, freeform replies and unknown sessions safely', async () => {
    const api = await testApp();
    for (const body of [{displayName:'x'.repeat(101),room:'204'},{displayName:'Demo',room:'x'.repeat(31)},{displayName:42,room:'204'}]) expect((await api.call('/api/patients',post(body))).status).toBe(400);
    const patient=(await api.call('/api/patients',post({displayName:'Demo',room:'204'}))).body;
    const request=(await api.call('/api/requests',post({patientId:patient.id,type:'HELP'}))).body;
    for(const code of ['<script>alert(1)</script>','x'.repeat(10000)])expect((await api.call(`/api/requests/${request.id}/replies`,post({code}))).status).toBe(400);
    expect((await api.call('/api/patients/missing')).status).toBe(404);
    expect((await api.call('/ready')).body).toEqual({ok:true,database:true});
  });

  it('distinguishes a live process from an unavailable database without exposing details',async()=>{
    const api=await testApp();api.runtime.db.close();
    expect((await api.call('/health')).body).toEqual({ok:true});
    const ready=await api.call('/ready');expect(ready.status).toBe(503);
    expect(ready.body).toEqual({ok:false,database:false});
  });

});
