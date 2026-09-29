import type { Hint, Recognition } from '../../contracts';
import type { Finger } from './types';

export const FINGER_LANDMARKS: Readonly<Record<Finger, readonly number[]>> = {
  thumb: [1, 2, 3, 4], index: [5, 6, 7, 8], middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16], pinky: [17, 18, 19, 20],
};
export interface FingerHighlight { finger: Finger; state: 'correcting' | 'corrected' }
/** Uses the exact debounced hint displayed in the UI, never a separate diagnosis. */
export function correctionFinger(hint: Hint | null, state: Recognition['state']): Finger | null {
  if (!hint || state === 'confirmed') return null;
  if (hint.code === 'THUMB_UP' || hint.code === 'THUMB_DOWN') return 'thumb';
  if (hint.code !== 'EXTEND_FINGER' && hint.code !== 'FOLD_FINGER') return null;
  const finger = hint.params?.finger;
  return typeof finger === 'string' && Object.hasOwn(FINGER_LANDMARKS, finger) ? finger as Finger : null;
}
