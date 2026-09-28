import { describe, expect, it } from 'vitest';
import type { Recognition } from '../../core/gestures/types';
import { TrainingSession, chooseBestTrainingResult, saveBestTrainingResult, TRAINING_RESULT_KEY } from './training';

const confirmed = (gesture: Recognition['gesture']): Recognition => ({ gesture, confidence: 0.95, state: 'confirmed', holdProgress: 1 });

describe('TrainingSession', () => {
  it('advances only on a confirmed target and records results', () => {
    const session = new TrainingSession(1000, ['YES', 'NO']);
    expect(session.state.currentGesture).toBe('YES');
    session.update(confirmed('NO'), null, 1200);
    expect(session.state.currentIndex).toBe(0);
    session.update(confirmed(null), { code: 'THUMB_UP', layer: 3, severity: 'warn' }, 1300);
    session.update(confirmed('YES'), null, 2000);
    expect(session.state).toMatchObject({ currentGesture: 'NO', currentIndex: 1, correctedErrors: 1, hintsShown: 1 });
    session.update(confirmed('NO'), null, 3000);
    expect(session.state.completed).toBe(true);
    expect(session.result).toMatchObject({ totalGestures: 2, completedGestures: 2, averageReactionMs: 1000, correctedErrors: 1 });
  });
  it('keeps the faster completed result', () => {
    const slow = { startedAt: 0, finishedAt: 5000, totalGestures: 2, completedGestures: 2, hintsShown: 1, correctedErrors: 1, averageReactionMs: 2500 };
    const fast = { ...slow, averageReactionMs: 1000 };
    expect(chooseBestTrainingResult(slow, fast)).toEqual(fast);
    expect(chooseBestTrainingResult(fast, slow)).toEqual(fast);
  });
  it('persists the best result and ignores malformed saved data', () => {
    const result = { startedAt: 0, finishedAt: 2000, totalGestures: 1, completedGestures: 1, hintsShown: 0, correctedErrors: 0, averageReactionMs: 2000 };
    const values = new Map<string, string>([[TRAINING_RESULT_KEY, '{bad']]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(saveBestTrainingResult(result, storage)).toEqual(result);
    expect(JSON.parse(values.get(TRAINING_RESULT_KEY)!)).toEqual(result);
  });
});
