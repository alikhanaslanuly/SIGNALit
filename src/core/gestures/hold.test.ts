import { describe, expect, it } from 'vitest';
import { HoldDetector } from './hold';
import type { GestureMatch } from './types';

const yes: GestureMatch = { gesture: 'YES', confidence: 0.92, runnerUp: 0.2 };

describe('hold detector', () => {
  it('confirms only after a stable hold and reports progress', () => {
    const detector = new HoldDetector();
    expect(detector.update(yes, 0)).toMatchObject({ state: 'candidate', holdProgress: 0 });
    expect(detector.update(yes, 160)).toMatchObject({ state: 'holding', holdProgress: 0.16 });
    expect(detector.update(yes, 1000)).toMatchObject({ state: 'candidate', holdProgress: 0 });
    // A large inference gap restarts the hold; this is deliberate.
    expect(detector.update(yes, 1160).state).toBe('holding');
    expect(detector.update(yes, 1320).state).toBe('holding');
  });

  it('fires once, then needs release and cooldown before rearming', () => {
    const detector = new HoldDetector();
    for (let t = 0; t <= 1000; t += 100) {
      const result = detector.update(yes, t);
      if (t === 1000) expect(result).toMatchObject({ state: 'confirmed', gesture: 'YES', holdProgress: 1 });
    }
    for (let t = 1100; t <= 3000; t += 100) {
      expect(detector.update(yes, t).state).toBe('none');
    }
    detector.update(null, 3100);
    detector.update(null, 3400);
    expect(detector.update(yes, 3500).state).toBe('candidate');
  });

  it('resets a candidate when the gesture changes', () => {
    const detector = new HoldDetector();
    detector.update(yes, 0);
    detector.update(yes, 150);
    expect(detector.update({ ...yes, gesture: 'NO' }, 200)).toMatchObject({ state: 'candidate', gesture: 'NO', holdProgress: 0 });
  });
});
