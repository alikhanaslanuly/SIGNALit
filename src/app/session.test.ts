import { describe, expect, it } from 'vitest';
import { MockEngine } from '../core/mock/mockEngine';
import { MemoryTransport } from '../transport';
import { SignalSession } from './session';

describe('SIGNAL session', () => {
  it('runs question, answer, request, acknowledgement, and completion end to end', async () => {
    let now = 1000;
    let id = 0;
    const engine = new MockEngine();
    const transport = new MemoryTransport();
    const session = new SignalSession({ engine, transport, mode: 'mock', now: () => now, makeId: () => `id-${++id}` });
    await session.start();
    expect(session.snapshot.screen).toBe('dialog');
    session.sendQuestion('water');
    expect(session.snapshot.dialog.phase).toBe('WAITING_YES_NO');
    now += 1200;
    engine.emitConfirmed('YES');
    expect(session.snapshot.dashboard.history.map(message => message.kind)).toEqual(['QUESTION', 'ANSWER']);
    now += 1200;
    engine.emitConfirmed('TOILET');
    expect(session.snapshot.dialog.pendingRequest).toBe('TOILET');
    now += 1200;
    engine.emitConfirmed('YES');
    const request = session.snapshot.dashboard.requests[0];
    expect(request).toMatchObject({ gesture: 'TOILET', status: 'PENDING' });
    session.setRequestStatus(request.id, 'ACKNOWLEDGED');
    expect(session.snapshot.dialog.activeRequest?.status).toBe('ACKNOWLEDGED');
    session.setRequestStatus(request.id, 'COMPLETED');
    expect(session.snapshot.dialog.activeRequest?.status).toBe('COMPLETED');
    session.dispose();
  });
  it('sends urgent HELP and cancels it on NO before timeout', async () => {
    let now = 1000;
    const engine = new MockEngine();
    const session = new SignalSession({ engine, transport: new MemoryTransport(), mode: 'mock', now: () => now, makeId: () => String(now) });
    await session.start();
    engine.emitConfirmed('HELP');
    expect(session.snapshot.dialog.phase).toBe('CANCEL_WINDOW');
    expect(session.snapshot.dashboard.requests[0]?.gesture).toBe('HELP');
    now = 2000;
    engine.emitConfirmed('NO');
    expect(session.snapshot.dashboard.requests[0]?.status).toBe('CANCELLED');
    session.dispose();
  });
  it('updates recognition context when a question arrives', async () => {
    const engine = new MockEngine();
    const session = new SignalSession({ engine, transport: new MemoryTransport(), mode: 'mock', now: () => 1000, makeId: () => 'q1' });
    await session.start();
    session.sendQuestion('pain');
    engine.emitConfirmed('WATER');
    expect(session.snapshot.dialog.phase).toBe('WAITING_YES_NO');
    expect(session.snapshot.hint?.code).toBe('EXPECTED_GESTURES');
    session.dispose();
  });
  it('shows camera startup while browser permission is pending', async () => {
    let release: (() => void) | undefined;
    class SlowEngine extends MockEngine {
      override start(): Promise<void> {
        return new Promise(resolve => { release = () => { void super.start().then(resolve); }; });
      }
    }
    const session = new SignalSession({ engine: new SlowEngine(), transport: new MemoryTransport(), mode: 'mock' });
    const pending = session.start();
    expect(session.snapshot.cameraStarting).toBe(true);
    release?.();
    await pending;
    expect(session.snapshot.cameraStarting).toBe(false);
    session.dispose();
  });
  it('returns to start and permits a retry after a runtime camera error', async () => {
    const engine = new MockEngine();
    const session = new SignalSession({ engine, transport: new MemoryTransport(), mode: 'mock' });
    await session.start();
    engine.emitError(new Error('camera disconnected'));
    expect(session.snapshot.screen).toBe('start');
    expect(session.snapshot.cameraError).toBe('camera disconnected');
    await session.start();
    expect(session.snapshot.screen).toBe('dialog');
    expect(session.snapshot.cameraError).toBeNull();
    session.dispose();
  });
  it('does not enter dialog when a failed startup resolves late', async () => {
    let release: (() => void) | undefined;
    class SlowEngine extends MockEngine {
      override async start(): Promise<void> {
        await super.start();
        await new Promise<void>(resolve => { release = resolve; });
      }
    }
    const engine = new SlowEngine();
    const session = new SignalSession({ engine, transport: new MemoryTransport(), mode: 'mock' });
    const pending = session.start();
    await Promise.resolve();
    engine.emitError(new Error('camera disconnected'));
    release?.();
    await pending;
    expect(session.snapshot.screen).toBe('start');
    expect(session.snapshot.cameraError).toBe('camera disconnected');
    session.dispose();
  });
  it('reconciles backend identity and restores a patient request after reload', async () => {
    const engine = new MockEngine(); const transport = new MemoryTransport();
    const session = new SignalSession({ engine, transport, mode: 'mock', now: () => 1000, makeId: () => 'local-id' });
    await session.start(); engine.emitConfirmed('HELP');
    transport.send({ id: 'server-id', ts: 1000, room: '204', kind: 'REQUEST', payload: { request: 'HELP', localRequestId: 'local-id' } });
    transport.send({ id: 'status', ts: 1100, room: '204', kind: 'STATUS', payload: { requestId: 'server-id', status: 'ACKNOWLEDGED', note: 'COMING' } });
    expect(session.snapshot.dialog.activeRequest).toMatchObject({ id: 'server-id', status: 'ACKNOWLEDGED', note: 'COMING' });
    session.dispose();
    const restoredTransport = new MemoryTransport(); const restored = new SignalSession({ engine: null, transport: restoredTransport, mode: 'real' });
    restoredTransport.send({ id: 'restored', ts: 1, room: '204', kind: 'REQUEST', payload: { request: 'WATER', status: 'ACKNOWLEDGED' } });
    expect(restored.snapshot.dialog.activeRequest).toMatchObject({ id: 'restored', gesture: 'WATER', status: 'ACKNOWLEDGED' }); restored.dispose();
  });

});

it('does not resurrect an older request when the latest recovered request was cancelled', () => {
  const transport = new MemoryTransport(); const session = new SignalSession({ engine:null,transport,mode:'real' });
  transport.send({id:'latest',ts:20,room:'204',kind:'REQUEST',payload:{request:'HELP',status:'CANCELLED',hydrated:true}});
  transport.send({id:'old',ts:10,room:'204',kind:'REQUEST',payload:{request:'WATER',status:'COMPLETED',hydrated:true}});
  expect(session.snapshot.dialog.activeRequest).toBeNull(); session.dispose();
});

it('speaks a new reply once and never speaks restored replies or premature delivery', async () => {
  const { vi } = await import('vitest'); const feedback = await import('../audio/feedback');
  const speak = vi.spyOn(feedback, 'speakFeedback').mockImplementation(() => {}); const sound = vi.spyOn(feedback, 'playFeedbackSound').mockImplementation(() => {}); vi.stubGlobal('window', {});
  const engine = new MockEngine(); const transport = new MemoryTransport(); const session = new SignalSession({ engine,transport,mode:'mock',makeId:()=> 'local',now:()=>1000 });
  try {
    session.setLocale('en'); session.setAudioEnabled(true); await session.start(); engine.emitConfirmed('HELP');
    expect(speak.mock.calls.map(call => call[0])).not.toContain('Request sent'); speak.mockClear();
    transport.send({id:'restore',ts:1100,room:'204',kind:'STATUS',payload:{requestId:'local',status:'ACKNOWLEDGED',note:'COMING',hydrated:true}});
    expect(speak).not.toHaveBeenCalled();
    const reply = {id:'live-reply',ts:1200,room:'204',kind:'STATUS' as const,payload:{requestId:'local',status:'ACKNOWLEDGED',note:'WAIT'}};
    transport.send(reply); transport.send(reply); expect(speak).toHaveBeenCalledTimes(1); expect(speak.mock.calls[0][0]).toContain('Please wait');
  } finally { session.dispose(); speak.mockRestore(); sound.mockRestore(); vi.unstubAllGlobals(); }
});
