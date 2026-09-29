import { describe, expect, it } from 'vitest';
import { correctionFinger, FINGER_LANDMARKS } from './correction';
import { getHintText } from '../../ui/i18n';
describe('Error Mode overlay target', () => {
  it('maps every MediaPipe finger to its exact four landmarks', () => {
    expect(FINGER_LANDMARKS).toEqual({ thumb: [1,2,3,4], index: [5,6,7,8], middle: [9,10,11,12], ring: [13,14,15,16], pinky: [17,18,19,20] });
  });
  it('uses the same finger as localized text for both correction actions', () => {
    for (const code of ['EXTEND_FINGER', 'FOLD_FINGER']) {
      const hint = { code, params: { finger: 'pinky' }, layer: 3 as const, severity: 'warn' as const };
      expect(correctionFinger(hint, 'none')).toBe('pinky');
      expect(getHintText('ru', hint)).toContain('мизинец');
      expect(getHintText('en', hint)).toContain('little finger');
      expect(correctionFinger(hint, 'confirmed')).toBeNull();
    }
  });
  it('handles absent or unrecognized targets safely, and targets thumb orientation', () => {
    for (const finger of [undefined, 'wrist', 'constructor']) expect(correctionFinger({ code: 'FOLD_FINGER', layer: 3, severity: 'warn', params: finger ? { finger } : {} }, 'none')).toBeNull();
    expect(correctionFinger(null, 'holding')).toBeNull();
    expect(correctionFinger({ code: 'HAND_MISSING', params: { finger: 'pinky' }, layer: 1, severity: 'info' }, 'none')).toBeNull();
    expect(correctionFinger({ code: 'THUMB_UP', layer: 3, severity: 'warn' }, 'none')).toBe('thumb');
  });
});
