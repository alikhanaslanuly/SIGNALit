import { expect, it } from 'vitest';
import { cameraFailure, visionError } from './cameraFailure';
it.each([['NotAllowedError', 'blocked'], ['NotFoundError', 'missing'], ['NotReadableError', 'busy'], ['NotSupportedError', 'unsupported'], ['ModelError', 'model'], ['StreamInterruptedError', 'interrupted']])('maps %s to actionable %s copy', (name, expected) => {
  expect(cameraFailure(Object.assign(new Error('Private browser details'), { name }))).toBe(expected);
});
it('reports model and stream failures through stable names', () => { expect(cameraFailure(visionError('ModelError', 'details'))).toBe('model'); });
