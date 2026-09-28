import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NurseDashboard } from './NurseDashboard';
import { applyDashboardMessage, emptyDashboardState } from './model';

describe('NurseDashboard', () => {
  it('shows a prioritized request with elapsed time and next action', () => {
    const state = applyDashboardMessage(emptyDashboardState(), { id: 'r1', ts: 1000, room: '204', kind: 'REQUEST', payload: { request: 'HELP' } });
    const html = renderToStaticMarkup(<NurseDashboard state={state} now={38000} onQuestion={() => {}} onStatus={() => {}} />);
    expect(html).toContain('ROOM 204');
    expect(html).toContain('HELP');
    expect(html).toContain('00:37');
    expect(html).toContain('Acknowledge');
  });
  it('shows question library and chronological dialog history', () => {
    let state = emptyDashboardState();
    state = applyDashboardMessage(state, { id: 'q1', ts: 1, room: '204', kind: 'QUESTION', payload: { questionId: 'pain' } });
    state = applyDashboardMessage(state, { id: 'a1', ts: 2, room: '204', kind: 'ANSWER', payload: { questionId: 'pain', answer: 'YES' } });
    const html = renderToStaticMarkup(<NurseDashboard state={state} now={1000} onQuestion={() => {}} onStatus={() => {}} />);
    expect(html).toContain('Are you in pain?');
    expect(html).toContain('Patient:');
    expect(html).toContain('YES');
    expect(html).toContain('Question library');
  });
});
