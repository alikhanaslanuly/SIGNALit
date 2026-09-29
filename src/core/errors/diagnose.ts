import { classifyGesture, GESTURES, scoreGesture, type GestureId, type Recognition } from '../gestures';
import type { Finger, HandFeatures } from '../vision/types';
import { DIAGNOSTIC_CONFIG as cfg } from './config';
import { GESTURE_PATTERNS } from './patterns';
import type { DiagnosticContext, Hint } from './types';

const FINGERS: Finger[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const hint = (code: string, layer: Hint['layer'], targetGesture?: GestureId, params?: Hint['params']): Hint =>
  ({ code, layer, severity: 'warn', ...(targetGesture ? { targetGesture } : {}), ...(params ? { params } : {}) });

/** One actionable hint, ordered by frame, pose, finger, then dialog context. */
export function diagnose(features: HandFeatures | null, recognition: Recognition, context: DiagnosticContext = {}): Hint[] {
  if (!features) return [hint('HAND_MISSING', 1)];
  const baseline = context.handSizeBaseline;
  const minSize = baseline ? Math.max(0.05, baseline * 0.55) : cfg.minHandSize;
  const maxSize = baseline ? Math.min(0.5, baseline * 1.8) : cfg.maxHandSize;
  if (features.handSize < minSize) return [hint('TOO_FAR', 1)];
  if (features.handSize > maxSize) return [hint('TOO_CLOSE', 1)];
  if (features.edgeMargin < cfg.minEdgeMargin) return [hint('NEAR_EDGE', 1)];
  if (features.brightness < cfg.minBrightness) return [hint('TOO_DARK', 1)];
  if (features.speed > cfg.maxSpeed) return [hint('KEEP_STILL', 2)];
  if (features.palmFacing < cfg.minPalmFacing) return [hint('FACE_CAMERA', 2)];

  // Vision may filter by expected gestures. Score the unfiltered pose to
  // distinguish a valid but out-of-context gesture from a malformed target.
  const detected = classifyGesture(features)?.gesture ?? recognition.gesture;
  if (detected && context.expected?.length && !context.expected.includes(detected)) {
    return [hint('EXPECTED_GESTURES', 4, undefined, { gestures: context.expected.join(',') })];
  }
  const target = context.target ?? (context.expected?.length === 1 ? context.expected[0] : undefined) ??
    (detected ?? GESTURES.map(gesture => ({ gesture, score: scoreGesture(features, gesture) }))
      .sort((a, b) => b.score - a.score)[0].gesture);
  if (detected === target || (recognition.gesture === target && recognition.state !== 'none')) return [];
  const pattern = GESTURE_PATTERNS[target];
  let correction: { finger: Finger; code: string; difference: number } | null = null;
  for (const finger of FINGERS) {
    const desired = pattern.fingers[finger];
    if (desired === 'any') continue;
    const value = features.fingerExt[finger];
    const difference = desired === 'extended' ? cfg.extendedThreshold - value : value - cfg.foldedThreshold;
    if (difference > cfg.minFingerDifference && (!correction || difference > correction.difference)) {
      correction = { finger, code: desired === 'extended' ? 'EXTEND_FINGER' : 'FOLD_FINGER', difference };
    }
  }
  if (correction) return [hint(correction.code, 3, target, { finger: correction.finger })];
  if (pattern.thumbDirection === 'up' && features.thumbAngleDeg > cfg.thumbUpMaxAngle) return [hint('THUMB_UP', 3, target)];
  if (pattern.thumbDirection === 'down' && features.thumbAngleDeg < cfg.thumbDownMinAngle) return [hint('THUMB_DOWN', 3, target)];
  return [];
}
