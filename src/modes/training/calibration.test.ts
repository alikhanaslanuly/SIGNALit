import { describe, expect, it } from 'vitest';
import type { HandFeatures } from '../../core/vision/types';
import { CalibrationSession } from './calibration';
const features: HandFeatures = { fingerExt: { thumb: 0.9, index: 0.1, middle: 0.1, ring: 0.1, pinky: 0.1 }, thumbAngleDeg: 15, palmFacing: 0.9, handSize: 0.19, center: { x: 0.5, y: 0.5 }, edgeMargin: 0.2, speed: 0.02, brightness: 0.5 };
describe('CalibrationSession', () => {
  it('collects ten seconds of stable matching samples with separate YES and NO targets', () => {
    const session = new CalibrationSession(0);
    for (let now = 0; now <= 5000; now += 50) session.update(features, 'YES', now);
    expect(session.target).toBe('NO');
    for (let now = 5050; now <= 10100; now += 50) session.update({ ...features, thumbAngleDeg: 165 }, 'NO', now);
    expect(session.completed).toBe(true);
    expect(session.profile).toMatchObject({ calibrated: true, handSizeBaseline: 0.19, thumbUpAngleDeg: 15, thumbDownAngleDeg: 165 });
  });
  it('does not advance a countdown without a visible hand', () => {
    const session = new CalibrationSession(0);
    session.update(null, null, 10000);
    expect(session.progress).toBe(0); expect(session.completed).toBe(false); expect(session.target).toBe('YES');
    expect(session.profile.calibrated).toBe(false);
  });
  it('pauses on poor quality and does not credit time spent missing', () => {
    const session = new CalibrationSession(0);
    session.update(features, 'YES', 0); session.update(features, 'YES', 100);
    const progress = session.progress;
    for (const bad of [{ ...features, speed: 2 }, { ...features, handSize: 0.01 }, { ...features, brightness: 0.01 }, { ...features, handSize: NaN }, { ...features, edgeMargin: 0 }]) session.update(bad, 'YES', 1000);
    session.update(null, null, 5000); session.update(features, 'YES', 10000);
    expect(session.progress).toBe(progress); expect(session.sampleCount).toBe(3);
  });
  it('caps large frame gaps and offers failure after the timeout', () => {
    const session = new CalibrationSession(0); session.update(features, 'YES', 0); session.update(features, 'YES', 6000);
    expect(session.progress).toBeLessThanOrEqual(0.02);
    session.update(null, null, 90001); expect(session.failed).toBe(true); expect(session.completed).toBe(false);
  });
});
