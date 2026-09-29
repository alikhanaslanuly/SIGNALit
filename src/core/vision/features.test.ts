import { describe, expect, it } from 'vitest';
import { extractHandFeatures, fingerExtension, handCenter, handSize } from './features';
import { LandmarkSmoother } from './smoothing';
import type { HandFrame, Landmark } from './types';

function points(): Landmark[] {
  return Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
}

function frame(landmarks: Landmark[], timestampMs = 0): HandFrame {
  return { landmarks, handedness: 'Right', timestampMs, width: 640, height: 480, brightness: 0.6 };
}

describe('hand geometry', () => {
  it('rates a straight finger above a bent finger with continuous scores', () => {
    const straight = points();
    [straight[5], straight[6], straight[7], straight[8]] = [
      { x: 0.4, y: 0.6, z: 0 }, { x: 0.4, y: 0.5, z: 0 },
      { x: 0.4, y: 0.4, z: 0 }, { x: 0.4, y: 0.3, z: 0 },
    ];
    const bent = points();
    [bent[5], bent[6], bent[7], bent[8]] = [
      { x: 0.4, y: 0.6, z: 0 }, { x: 0.4, y: 0.5, z: 0 },
      { x: 0.5, y: 0.5, z: 0 }, { x: 0.6, y: 0.5, z: 0 },
    ];
    expect(fingerExtension(straight, 5)).toBeGreaterThan(0.9);
    expect(fingerExtension(bent, 5)).toBeLessThan(0.4);
  });

  it('uses wrist to middle MCP for size and palm landmarks for center', () => {
    const hand = points();
    hand[0] = { x: 0.5, y: 0.9, z: 0 };
    hand[5] = { x: 0.3, y: 0.6, z: 0 };
    hand[9] = { x: 0.5, y: 0.6, z: 0 };
    hand[13] = { x: 0.7, y: 0.6, z: 0 };
    hand[17] = { x: 0.9, y: 0.6, z: 0 };
    expect(handSize(hand)).toBeCloseTo(0.3);
    expect(handCenter(hand)).toEqual({ x: 0.58, y: 0.66 });
    const features = extractHandFeatures(frame(hand));
    expect(features.handSize).toBeCloseTo(0.3);
    expect(features.center.x).toBeCloseTo(0.58);
    expect(features.brightness).toBe(0.6);
  });

  it('computes speed from the previous smoothed frame', () => {
    const first = points();
    first[0] = { x: 0.5, y: 0.9, z: 0 };
    first[9] = { x: 0.5, y: 0.6, z: 0 };
    const second = first.map(point => ({ ...point, x: point.x + 0.03 }));
    const features = extractHandFeatures(frame(second, 100), frame(first, 0));
    expect(features.speed).toBeCloseTo(1, 4);
  });
});

describe('landmark smoothing', () => {
  it('blends jitter and resets when tracking is interrupted', () => {
    const smoother = new LandmarkSmoother(0.5);
    const first = frame(points(), 0);
    expect(smoother.update(first)).toBe(first);
    const moved = frame(points().map(point => ({ ...point, x: point.x + 0.2 })), 50);
    expect(smoother.update(moved).landmarks[0].x).toBeCloseTo(0.6);
    smoother.reset();
    expect(smoother.update(moved)).toBe(moved);
  });
});
