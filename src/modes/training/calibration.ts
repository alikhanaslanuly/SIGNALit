import type { GestureId } from '../../core/gestures';
import { DIAGNOSTIC_CONFIG as quality } from '../../core/errors/config';
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
  readonly startedAt: number;
  constructor(startedAt: number) {
    this.startedAt = startedAt;
  }
  target: 'YES' | 'NO' = 'YES';
  completed = false;
  get sampleCount(): number { return this.yes.length + this.no.length; }
  get progress(): number { return this.completed ? 1 : Math.min(1, Math.max(0, this.elapsed / 10000)); }
  private elapsed = 0;

  private lastSampleAt: number | null = null;
  failed = false;
  quality: 'missing' | 'closer' | 'farther' | 'still' | 'pose' | 'good' = 'missing';
  update(features: HandFeatures | null, gesture: GestureId | null, nowMs: number): void {
    if (this.completed || this.failed) return;
    if (nowMs - this.startedAt > 90000) { this.failed = true; return; }
    const finite = features && [features.handSize, features.speed, features.brightness, features.palmFacing,
      features.edgeMargin, features.thumbAngleDeg, ...Object.values(features.fingerExt)].every(Number.isFinite);
    this.quality = !finite ? 'missing' : features.handSize < quality.minHandSize ? 'closer'
      : features.handSize > quality.maxHandSize ? 'farther'
      : features.speed > 0.25 || features.edgeMargin < quality.minEdgeMargin || features.brightness < quality.minBrightness || features.palmFacing < quality.minPalmFacing ? 'still'
      : gesture !== this.target ? 'pose' : 'good';
    if (this.quality !== 'good' || !features) { this.lastSampleAt = null; return; }
    const delta = this.lastSampleAt === null ? 0 : Math.min(200, Math.max(0, nowMs - this.lastSampleAt));
    this.lastSampleAt = nowMs;
    (this.target === 'YES' ? this.yes : this.no).push(features);
    this.elapsed += delta;
    if (this.target === 'YES' && this.elapsed >= 5000 && this.yes.length >= 20) {
      this.target = 'NO'; this.lastSampleAt = null;
    }
    if (this.elapsed >= 10000 && this.yes.length >= 20 && this.no.length >= 20) this.completed = true;
  }

  get profile(): CalibrationProfile {
    if (!this.completed || this.yes.length < 20 || this.no.length < 20) return DEFAULT_CALIBRATION_PROFILE;
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
