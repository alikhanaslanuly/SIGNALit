import { describe, expect, it } from 'vitest';
import { HintController } from './hintController';
import type { Hint } from './types';

const missing: Hint = { code: 'HAND_MISSING', layer: 1, severity: 'warn' };
const edge: Hint = { code: 'NEAR_EDGE', layer: 1, severity: 'warn' };

describe('HintController', () => {
  it('holds the visible hint for 1200ms and waits 500ms before clearing', () => {
    const controller = new HintController();
    expect(controller.update([missing], 0).hint?.code).toBe('HAND_MISSING');
    expect(controller.update([edge], 800).hint?.code).toBe('HAND_MISSING');
    expect(controller.update([], 1200).hint?.code).toBe('HAND_MISSING');
    expect(controller.update([], 1699).hint?.code).toBe('HAND_MISSING');
    expect(controller.update([], 1700)).toEqual({ hint: null, corrected: true });
  });
  it('does not flicker when the same error returns', () => {
    const controller = new HintController();
    controller.update([missing], 0);
    controller.update([], 1300);
    expect(controller.update([missing], 1400).hint?.code).toBe('HAND_MISSING');
    expect(controller.update([], 1500).hint?.code).toBe('HAND_MISSING');
  });
});
