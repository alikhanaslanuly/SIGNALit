export const GESTURES = ['YES', 'NO', 'HELP', 'PAIN', 'TOILET', 'WATER'] as const;

export type GestureId = (typeof GESTURES)[number];

export type RecognitionState = 'none' | 'candidate' | 'holding' | 'confirmed';

export interface Recognition {
  gesture: GestureId | null;
  confidence: number;
  state: RecognitionState;
  holdProgress: number;
}

export interface GestureMatch {
  gesture: GestureId;
  confidence: number;
  runnerUp: number;
}
