import type { GestureId } from '../gestures/types';

export interface Hint {
  code: string;
  layer: 1 | 2 | 3 | 4;
  severity: 'info' | 'warn';
  params?: Record<string, string | number>;
  targetGesture?: GestureId;
}

export interface DiagnosticContext {
  expected?: readonly GestureId[];
  target?: GestureId;
  handSizeBaseline?: number;
}
