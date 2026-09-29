import { describe, expect, it } from 'vitest';
import { MockEngine } from '../core/mock/mockEngine';
import { MemoryTransport } from '../transport';
import { SignalSession } from './session';
import { toPatientView } from './viewModel';

describe('patient view adapter', () => {
  it('maps nurse questions, confirmation, urgent cancel, and status', async () => {
    let now = 1000;
    const engine = new MockEngine();
    const session = new SignalSession({ engine, transport: new MemoryTransport(), mode: 'mock', now: () => now, makeId: () => String(now) });
    await session.start();
    session.sendQuestion('pain');
    expect(toPatientView(session.snapshot, 'ru')).toMatchObject({ screen: 'dialog', question: 'Вам больно?' });
    engine.emitConfirmed('NO');
    now += 1000;
    engine.emitConfirmed('WATER');
    expect(toPatientView(session.snapshot, 'ru')).toMatchObject({ screen: 'dialog', confirmation: 'WATER' });
    engine.emitConfirmed('NO');
    engine.emitConfirmed('HELP');
    expect(toPatientView(session.snapshot, 'en')).toMatchObject({ screen: 'dialog', urgent: { gesture: 'HELP', secondsRemaining: 5 } });
    session.dispose();
  });
});
