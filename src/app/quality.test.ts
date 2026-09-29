import { expect, it } from 'vitest';
import { QualityRecorder } from './quality';
it('measures frames, interrupted holds, and confirmations without claiming accuracy', () => {
  const quality = new QualityRecorder(0);
  quality.frame(true, 1); quality.frame(false, 1001);
  quality.recognition({ gesture: 'HELP', state: 'holding', confidence: 0.8, holdProgress: 0.5 }, 100);
  quality.recognition({ gesture: null, state: 'none', confidence: 0, holdProgress: 0 }, 200);
  quality.recognition({ gesture: 'WATER', state: 'candidate', confidence: 0.8, holdProgress: 0 }, 300);
  const confirmed = { gesture: 'WATER' as const, state: 'confirmed' as const, confidence: 0.9, holdProgress: 1 };
  quality.recognition(confirmed, 1300); quality.recognition(confirmed, 1400);
  expect(quality.snapshot).toMatchObject({ frames: 2, visibleFrames: 1, confirmed: 1, interruptedHolds: 1, confirmationMs: 1000, timedConfirmations: 1, gestures: { WATER: 1 } });
});
