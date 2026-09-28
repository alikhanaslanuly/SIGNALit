import { describe, expect, it } from 'vitest';
import type { SignalMessage } from '../../contracts';
import { applyDashboardMessage, emptyDashboardState, sortedRequests } from './model';

const message = (id: string, ts: number, kind: SignalMessage['kind'], payload: Record<string, unknown>, room = '204'): SignalMessage =>
  ({ id, ts, room, kind, payload });

describe('dashboard model', () => {
  it('sorts urgent requests first, then TOILET, then WATER; older first in each group', () => {
    const entries = [
      message('water', 1, 'REQUEST', { request: 'WATER' }),
      message('help2', 5, 'REQUEST', { request: 'HELP' }),
      message('toilet', 3, 'REQUEST', { request: 'TOILET' }),
      message('help1', 2, 'REQUEST', { request: 'PAIN' }),
    ];
    const state = entries.reduce(applyDashboardMessage, emptyDashboardState());
    expect(sortedRequests(state).map(request => request.id)).toEqual(['help1', 'help2', 'toilet', 'water']);
  });
  it('keeps active requests above completed ones and records completion time', () => {
    let state = emptyDashboardState();
    state = applyDashboardMessage(state, message('old', 1000, 'REQUEST', { request: 'PAIN' }));
    state = applyDashboardMessage(state, message('new', 2000, 'REQUEST', { request: 'PAIN' }));
    state = applyDashboardMessage(state, message('done', 4000, 'STATUS', { requestId: 'old', status: 'COMPLETED' }));
    expect(sortedRequests(state).map(request => request.id)).toEqual(['new', 'old']);
    expect(state.requests[0]?.completedAt).toBe(4000);
  });
  it('tracks question and answer, status updates, and cancellation without duplicate events', () => {
    let state = emptyDashboardState();
    state = applyDashboardMessage(state, message('q1', 100, 'QUESTION', { questionId: 'pain' }));
    state = applyDashboardMessage(state, message('a1', 200, 'ANSWER', { questionId: 'pain', answer: 'YES' }));
    state = applyDashboardMessage(state, message('r1', 300, 'REQUEST', { request: 'HELP' }));
    state = applyDashboardMessage(state, message('s1', 400, 'STATUS', { requestId: 'r1', status: 'ACKNOWLEDGED' }));
    state = applyDashboardMessage(state, message('s1', 400, 'STATUS', { requestId: 'r1', status: 'ACKNOWLEDGED' }));
    expect(state.history).toHaveLength(2);
    expect(state.requests[0]?.status).toBe('ACKNOWLEDGED');
    state = applyDashboardMessage(state, message('s2', 500, 'STATUS', { requestId: 'r1', status: 'COMPLETED' }));
    state = applyDashboardMessage(state, message('s3', 600, 'STATUS', { requestId: 'r1', status: 'PENDING' }));
    expect(state.requests[0]?.status).toBe('COMPLETED');
    state = applyDashboardMessage(state, message('s4', 700, 'STATUS', { requestId: 'r1', status: 'CANCELLED' }));
    expect(sortedRequests(state)).toEqual([]);
  });
});
