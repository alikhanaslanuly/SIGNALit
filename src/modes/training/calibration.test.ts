import { describe, expect, it } from 'vitest';
import type { HandFeatures } from '../../core/vision/types';
import { CalibrationSession } from './calibration';

const features: HandFeatures = { fingerExt: { thumb: 0.9, index: 0.1, middle: 0.1, ring: 0.1, pinky: 0.1 }, thumbAngleDeg: 15, palmFacing: 0.9, handSize: 0.19, center: { x: 0.5, y: 0.5 }, edgeMargin: 0.2, speed: 0.02, brightness: 0.5 };

describe('CalibrationSession', () => {
  it('collects stable YES and NO samples over ten seconds', () => {
    const session = new CalibrationSession(0);
    session.update(features, 'YES', 1000);
    session.update({ ...features, speed: 2 }, 'YES', 2000);
    expect(session.sampleCount).toBe(1);
    session.update(null, null, 5000);
    expect(session.target).toBe('NO');
    session.update({ ...features, thumbAngleDeg: 165 }, 'NO', 6000);
    session.update(null, null, 10000);
    expect(session.completed).toBe(true);
    expect(session.profile).toMatchObject({ calibrated: true, handSizeBaseline: 0.19, thumbUpAngleDeg: 15, thumbDownAngleDeg: 165 });
  });
  it('uses defaults when no valid samples arrive', () => {
    const session = new CalibrationSession(0);
    session.update(null, null, 10000);
    expect(session.profile.calibrated).toBe(false);
  });
});
