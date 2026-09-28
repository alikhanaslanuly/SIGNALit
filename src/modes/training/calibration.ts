import type { GestureId } from '../../core/gestures';
import type { HandFeatures } from '../../core/vision/types';

export interface CalibrationProfile {
  calibrated: boolean;
  handSizeBaseline: number;
  thumbExtensionThreshold: number;
  thumbUpAngleDeg: number;
  thumbDownAngleDeg: number;
}

export const DEFAULT_CALIBRATION_PROFILE: CalibrationProfile = {
  calibrated: false, handSizeBaseline: 0.2, thumbExtensionThreshold: 0.7,
  thumbUpAngleDeg: 30, thumbDownAngleDeg: 150,
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/** Five seconds each for YES and NO. Only stable, matching poses are sampled. */
export class CalibrationSession {
  private yes: HandFeatures[] = [];
  private no: HandFeatures[] = [];
  constructor(readonly startedAt: number) {}
  target: 'YES' | 'NO' = 'YES';
  completed = false;
  get sampleCount(): number { return this.yes.length + this.no.length; }
  get progress(): number { return this.completed ? 1 : Math.min(1, Math.max(0, this.elapsed / 10000)); }
  private elapsed = 0;

  update(features: HandFeatures | null, gesture: GestureId | null, nowMs: number): void {
    if (this.completed) return;
    this.elapsed = Math.max(0, nowMs - this.startedAt);
    this.target = this.elapsed < 5000 ? 'YES' : 'NO';
    if (features && features.speed <= 0.25 && gesture === this.target) {
      (this.target === 'YES' ? this.yes : this.no).push(features);
    }
    if (this.elapsed >= 10000) this.completed = true;
  }

  get profile(): CalibrationProfile {
    if (!this.yes.length || !this.no.length) return DEFAULT_CALIBRATION_PROFILE;
    const all = [...this.yes, ...this.no];
    return {
      calibrated: true,
      handSizeBaseline: median(all.map(value => value.handSize)),
      thumbExtensionThreshold: Math.max(0.55, Math.min(0.9, median(all.map(value => value.fingerExt.thumb)) * 0.8)),
      thumbUpAngleDeg: median(this.yes.map(value => value.thumbAngleDeg)),
      thumbDownAngleDeg: median(this.no.map(value => value.thumbAngleDeg)),
    };
  }
}
