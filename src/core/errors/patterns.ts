import type { GestureId } from '../gestures/types';
import type { Finger } from '../vision/types';

export type DesiredFingerState = 'extended' | 'folded' | 'any';
export interface GesturePattern {
  fingers: Record<Finger, DesiredFingerState>;
  thumbDirection?: 'up' | 'down';
  requirePalmFacing?: boolean;
}

export const GESTURE_PATTERNS: Record<GestureId, GesturePattern> = {
  YES: { fingers: { thumb: 'extended', index: 'folded', middle: 'folded', ring: 'folded', pinky: 'folded' }, thumbDirection: 'up' },
  NO: { fingers: { thumb: 'extended', index: 'folded', middle: 'folded', ring: 'folded', pinky: 'folded' }, thumbDirection: 'down' },
  HELP: { fingers: { thumb: 'extended', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'extended' }, requirePalmFacing: true },
  PAIN: { fingers: { thumb: 'folded', index: 'folded', middle: 'folded', ring: 'folded', pinky: 'folded' } },
  TOILET: { fingers: { thumb: 'any', index: 'extended', middle: 'folded', ring: 'folded', pinky: 'folded' } },
  WATER: { fingers: { thumb: 'any', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'folded' } },
};
