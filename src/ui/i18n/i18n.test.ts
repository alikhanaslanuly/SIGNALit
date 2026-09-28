import { describe, expect, it } from 'vitest';
import { getHintText, getText } from './index';

describe('patient translations', () => {
  it('translates all six gestures in RU and EN', () => {
    for (const locale of ['ru', 'en'] as const) {
      for (const gesture of ['YES', 'NO', 'HELP', 'PAIN', 'WATER', 'TOILET'] as const) {
        expect(getText(locale).gestures[gesture].label.length).toBeGreaterThan(0);
      }
    }
  });
  it('explains a finger correction in the chosen language', () => {
    expect(getHintText('en', { code: 'FOLD_FINGER', layer: 3, severity: 'warn', params: { finger: 'pinky' } })).toBe('Fold your little finger');
    expect(getHintText('ru', { code: 'HAND_MISSING', layer: 1, severity: 'warn' })).toBe('Поднимите руку в кадр');
  });
  it('names a training target when the current gesture is out of context', () => {
    expect(getHintText('en', { code: 'EXPECTED_GESTURES', layer: 4, severity: 'warn', params: { gestures: 'WATER' } })).toBe('Show WATER now');
  });
});
