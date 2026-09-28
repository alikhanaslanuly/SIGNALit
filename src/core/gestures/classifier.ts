import type { HandFeatures } from '../vision/types';
import { GESTURES, type GestureId, type GestureMatch } from './types';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (start: number, end: number, value: number) => {
  const t = clamp01((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

type FingerPattern = Partial<Record<keyof HandFeatures['fingerExt'], boolean>>;

function patternScore(features: HandFeatures, pattern: FingerPattern, extras: number[] = []): number {
  const terms = Object.entries(pattern).map(([finger, extended]) => {
    const value = features.fingerExt[finger as keyof HandFeatures['fingerExt']];
    return clamp01(extended ? value : 1 - value);
  });
  terms.push(...extras.map(clamp01));
  return terms.length ? Math.pow(terms.reduce((product, value) => product * value, 1), 1 / terms.length) : 0;
}

/** Independent, webcam-free score for each SIGNAL gesture. */
export function scoreGesture(features: HandFeatures, gesture: GestureId): number {
  const up = Math.cos(features.thumbAngleDeg * Math.PI / 180);
  const directionUp = smoothstep(0.35, 0.85, up);
  const directionDown = smoothstep(0.35, 0.85, -up);

  switch (gesture) {
    case 'YES':
      return patternScore(features, { thumb: true, index: false, middle: false, ring: false, pinky: false }, [directionUp]);
    case 'NO':
      return patternScore(features, { thumb: true, index: false, middle: false, ring: false, pinky: false }, [directionDown]);
    case 'HELP':
      return patternScore(features, { thumb: true, index: true, middle: true, ring: true, pinky: true }, [features.palmFacing]);
    case 'PAIN':
      // A fist usually keeps the thumb across the palm. A vertical thumb is
      // more likely YES/NO even when its extension score is only moderate.
      return patternScore(
        features,
        { thumb: false, index: false, middle: false, ring: false, pinky: false },
        [0.3 + 0.7 * smoothstep(0.2, 0.7, Math.abs(Math.sin(features.thumbAngleDeg * Math.PI / 180)))],
      );
    case 'TOILET':
      return patternScore(features, { thumb: false, index: true, middle: false, ring: false, pinky: false });
    case 'WATER':
      return patternScore(features, { thumb: false, index: true, middle: true, ring: true, pinky: false });
  }
}

export interface ClassifierOptions {
  minConfidence?: number;
  minMargin?: number;
  expected?: readonly GestureId[];
}

/** Returns null for weak or ambiguous frames, without forcing the expected gesture. */
export function classifyGesture(features: HandFeatures, options: ClassifierOptions = {}): GestureMatch | null {
  const ranked = GESTURES.map(gesture => ({ gesture, confidence: scoreGesture(features, gesture) }))
    .sort((a, b) => b.confidence - a.confidence);
  const best = ranked[0];
  const runnerUp = ranked[1].confidence;
  if (best.confidence < (options.minConfidence ?? 0.72)) return null;
  if (best.confidence - runnerUp < (options.minMargin ?? 0.12)) return null;
  if (options.expected && !options.expected.includes(best.gesture)) return null;
  return { ...best, runnerUp };
}
