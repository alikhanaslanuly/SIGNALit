export type CameraFailure = 'blocked' | 'missing' | 'busy' | 'unsupported' | 'model' | 'interrupted' | 'unknown';
/** Stable codes keep browser/device details out of patient-facing copy. */
export function cameraFailure(error: unknown): CameraFailure {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'blocked';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'missing';
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
  if (name === 'NotSupportedError') return 'unsupported';
  if (name === 'ModelError') return 'model';
  if (name === 'StreamInterruptedError') return 'interrupted';
  return 'unknown';
}
export function visionError(name: 'ModelError' | 'StreamInterruptedError' | 'NotSupportedError', message: string): Error {
  return Object.assign(new Error(message), { name });
}
