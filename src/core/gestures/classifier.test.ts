import { describe, expect, it } from 'vitest';
import type { HandFeatures } from '../vision/types';
import { classifyGesture, scoreGesture } from './classifier';

function features(fingerExt: HandFeatures['fingerExt'], thumbAngleDeg = 0, palmFacing = 0.9): HandFeatures {
  return {
    fingerExt, thumbAngleDeg, palmFacing, handSize: 0.25,
    center: { x: 0.5, y: 0.5 }, edgeMargin: 0.2, speed: 0, brightness: 0.6,
  };
}

describe('gesture classifier', () => {
  it('separates thumbs up and thumbs down', () => {
    const thumb = { thumb: 0.95, index: 0.05, middle: 0.05, ring: 0.05, pinky: 0.05 };
    expect(classifyGesture(features(thumb, 0))?.gesture).toBe('YES');
    expect(classifyGesture(features(thumb, 180))?.gesture).toBe('NO');
    expect(scoreGesture(features(thumb, 90), 'YES')).toBeLessThan(0.5);
  });

  it('does not mistake a partly extended upward thumb for a fist', () => {
    const thumb = { thumb: 0.6, index: 0.05, middle: 0.05, ring: 0.05, pinky: 0.05 };
    expect(classifyGesture(features(thumb, 0))?.gesture).toBe('YES');
  });

  it('classifies the four remaining finger patterns', () => {
    expect(classifyGesture(features({ thumb: 0.95, index: 0.95, middle: 0.95, ring: 0.95, pinky: 0.95 }))?.gesture).toBe('HELP');
    expect(classifyGesture(features({ thumb: 0.05, index: 0.05, middle: 0.05, ring: 0.05, pinky: 0.05 }))?.gesture).toBe('PAIN');
    expect(classifyGesture(features({ thumb: 0.05, index: 0.95, middle: 0.05, ring: 0.05, pinky: 0.05 }))?.gesture).toBe('TOILET');
    expect(classifyGesture(features({ thumb: 0.05, index: 0.95, middle: 0.95, ring: 0.95, pinky: 0.05 }))?.gesture).toBe('WATER');
  });

  it('rejects ambiguous frames and never forces an expected answer', () => {
    const uncertain = features({ thumb: 0.5, index: 0.5, middle: 0.5, ring: 0.5, pinky: 0.5 });
    expect(classifyGesture(uncertain)).toBeNull();
    const yes = features({ thumb: 0.95, index: 0.05, middle: 0.05, ring: 0.05, pinky: 0.05 });
    expect(classifyGesture(yes, { expected: ['NO'] })).toBeNull();
    expect(classifyGesture(yes, { minMargin: 1 })).toBeNull();
  });
});
