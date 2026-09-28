import { describe, expect, it } from 'vitest';
import { initialDialogState, transitionDialog } from './dialog';

const gesture = (value: 'YES' | 'NO' | 'HELP' | 'PAIN' | 'WATER' | 'TOILET', now: number, id = `m-${now}`) =>
  ({ type: 'GESTURE' as const, gesture: value, now, messageId: id });

describe('dialog state machine', () => {
  it('answers a nurse question with a confirmed YES', () => {
    const asked = transitionDialog(initialDialogState('204'), { type: 'QUESTION', questionId: 'pain', now: 100 });
    expect(asked.state.phase).toBe('WAITING_YES_NO');
    const answered = transitionDialog(asked.state, gesture('YES', 1200, 'a1'));
    expect(answered.state).toMatchObject({ phase: 'IDLE', lastAnswer: 'YES' });
    expect(answered.messages).toEqual([{ id: 'a1', ts: 1200, room: '204', kind: 'ANSWER', payload: { questionId: 'pain', answer: 'YES' } }]);
  });
  it('confirms WATER and cancels TOILET with NO', () => {
    const pending = transitionDialog(initialDialogState('204'), gesture('WATER', 100));
    expect(pending.state).toMatchObject({ phase: 'REQUEST_CONFIRMATION', pendingRequest: 'WATER' });
    expect(pending.messages).toEqual([]);
    const sent = transitionDialog(pending.state, gesture('YES', 1500, 'r1'));
    expect(sent.messages[0]).toMatchObject({ id: 'r1', kind: 'REQUEST', payload: { request: 'WATER' } });
    expect(sent.state.activeRequest).toMatchObject({ id: 'r1', gesture: 'WATER', status: 'PENDING' });
    const toilet = transitionDialog(sent.state, gesture('TOILET', 2000));
    const cancelled = transitionDialog(toilet.state, gesture('NO', 3200));
    expect(cancelled.state.phase).toBe('IDLE');
    expect(cancelled.messages).toEqual([]);
  });
  it('sends HELP immediately and permits NO cancellation for three seconds', () => {
    const sent = transitionDialog(initialDialogState('204'), gesture('HELP', 1000, 'urgent'));
    expect(sent.state).toMatchObject({ phase: 'CANCEL_WINDOW', cancelUntil: 4000 });
    expect(sent.messages[0]).toMatchObject({ id: 'urgent', kind: 'REQUEST', payload: { request: 'HELP' } });
    expect(transitionDialog(sent.state, gesture('HELP', 2000)).messages).toEqual([]);
    const cancelled = transitionDialog(sent.state, gesture('NO', 3000, 'cancel'));
    expect(cancelled.messages[0]).toMatchObject({ kind: 'STATUS', payload: { requestId: 'urgent', status: 'CANCELLED' } });
    expect(cancelled.state.activeRequest).toBeNull();
    const expired = transitionDialog(sent.state, { type: 'TICK', now: 4001 });
    expect(expired.state.phase).toBe('IDLE');
    expect(transitionDialog(expired.state, gesture('NO', 5000)).messages).toEqual([]);
  });
  it('updates only the matching request and never moves status backwards', () => {
    const sent = transitionDialog(initialDialogState('204'), gesture('PAIN', 1000, 'r1'));
    const seen = transitionDialog(sent.state, { type: 'STATUS', requestId: 'r1', status: 'ACKNOWLEDGED', now: 2000 });
    expect(seen.state.activeRequest?.status).toBe('ACKNOWLEDGED');
    const unrelated = transitionDialog(seen.state, { type: 'STATUS', requestId: 'other', status: 'COMPLETED', now: 2100 });
    expect(unrelated.state.activeRequest?.status).toBe('ACKNOWLEDGED');
    const complete = transitionDialog(seen.state, { type: 'STATUS', requestId: 'r1', status: 'COMPLETED', now: 2200 });
    const stale = transitionDialog(complete.state, { type: 'STATUS', requestId: 'r1', status: 'ACKNOWLEDGED', now: 2300 });
    expect(stale.state.activeRequest?.status).toBe('COMPLETED');
  });
});
