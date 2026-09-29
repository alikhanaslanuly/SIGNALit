import { describe, expect, it } from 'vitest';
import type { HandFeatures } from '../vision/types';
import type { Recognition } from '../gestures/types';
import { diagnose } from './diagnose';

const base: HandFeatures = {
  fingerExt: { thumb: 0.2, index: 1, middle: 1, ring: 1, pinky: 0.1 },
  thumbAngleDeg: 90, palmFacing: 0.9, handSize: 0.2,
  center: { x: 0.5, y: 0.5 }, edgeMargin: 0.2, speed: 0.02, brightness: 0.5,
};
const none: Recognition = { gesture: null, confidence: 0, state: 'none', holdProgress: 0 };
const withFeature = (changes: Partial<HandFeatures>): HandFeatures => ({ ...base, ...changes });

describe('diagnose', () => {
  it('asks for a hand when none is visible', () => expect(diagnose(null, none, {})[0]?.code).toBe('HAND_MISSING'));
  it.each([
    ['TOO_FAR', { handSize: 0.06 }],
    ['TOO_CLOSE', { handSize: 0.43 }],
    ['NEAR_EDGE', { edgeMargin: 0.025 }],
    ['TOO_DARK', { brightness: 0.1 }],
    ['KEEP_STILL', { speed: 1.2 }],
    ['FACE_CAMERA', { palmFacing: 0.28 }],
  ] as const)('%s', (code, changes) => {
    expect(diagnose(withFeature(changes), none, { target: 'WATER' })[0]?.code).toBe(code);
  });
  it('asks to fold a pinky for WATER', () => {
    const features = withFeature({ fingerExt: { ...base.fingerExt, pinky: 1 } });
    expect(diagnose(features, none, { target: 'WATER' })[0]).toMatchObject({ code: 'FOLD_FINGER', layer: 3, params: { finger: 'pinky' } });
  });
  it('asks to fold a middle finger for TOILET', () => {
    const features = withFeature({ fingerExt: { thumb: 0.1, index: 1, middle: 1, ring: 0, pinky: 0 } });
    expect(diagnose(features, none, { target: 'TOILET' })[0]).toMatchObject({ code: 'FOLD_FINGER', params: { finger: 'middle' } });
  });
  it.each([
    ['HELP', { thumb: 1, index: 1, middle: 1, ring: 1, pinky: 0 }, 'EXTEND_FINGER'],
    ['PAIN', { thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0 }, 'FOLD_FINGER'],
  ] as const)('corrects a finger for %s', (target, fingerExt, code) => {
    expect(diagnose(withFeature({ fingerExt }), none, { target })[0]?.code).toBe(code);
  });
  it('asks for a downward thumb for NO', () => {
    const features = withFeature({ fingerExt: { thumb: 1, index: 0, middle: 0, ring: 0, pinky: 0 }, thumbAngleDeg: 85 });
    expect(diagnose(features, none, { target: 'NO' })[0]?.code).toBe('THUMB_DOWN');
  });
  it('corrects thumb direction for YES', () => {
    const features = withFeature({ fingerExt: { thumb: 1, index: 0, middle: 0, ring: 0, pinky: 0 }, thumbAngleDeg: 95 });
    expect(diagnose(features, none, { target: 'YES' })[0]?.code).toBe('THUMB_UP');
  });
  it('prioritizes a technically valid wrong gesture over finger corrections', () => {
    expect(diagnose(base, none, { expected: ['YES', 'NO'] })[0]).toMatchObject({ code: 'EXPECTED_GESTURES', layer: 4 });
  });
  it('returns no hint for a correct held gesture', () => {
    expect(diagnose(base, { gesture: 'WATER', confidence: 0.95, state: 'holding', holdProgress: 0.5 }, { target: 'WATER' })).toEqual([]);
  });
});
