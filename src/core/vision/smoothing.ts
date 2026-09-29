import type { HandFrame, Landmark } from './types';

const blend = (previous: Landmark, current: Landmark, alpha: number): Landmark => ({
  x: alpha * current.x + (1 - alpha) * previous.x,
  y: alpha * current.y + (1 - alpha) * previous.y,
  z: alpha * current.z + (1 - alpha) * previous.z,
});

/** Stateful EMA, deliberately reset when a hand disappears or changes. */
export class LandmarkSmoother {
  private previous: HandFrame | null = null;
  private readonly alpha: number;

  constructor(alpha = 0.55) {
    this.alpha = alpha;
    if (alpha <= 0 || alpha > 1) throw new RangeError('EMA alpha must be in (0, 1]');
  }

  reset(): void {
    this.previous = null;
  }

  update(frame: HandFrame): HandFrame {
    const previous = this.previous;
    const changedHand = previous?.handedness && frame.handedness && previous.handedness !== frame.handedness;
    const stale = previous && frame.timestampMs - previous.timestampMs > 250;
    const jumped = previous && Math.hypot(
      frame.landmarks[0].x - previous.landmarks[0].x,
      frame.landmarks[0].y - previous.landmarks[0].y,
    ) > 0.3;

    if (!previous || changedHand || stale || jumped) {
      this.previous = frame;
      return frame;
    }

    const smoothed: HandFrame = {
      ...frame,
      landmarks: frame.landmarks.map((point, i) => blend(previous.landmarks[i], point, this.alpha)),
      worldLandmarks: frame.worldLandmarks && previous.worldLandmarks
        ? frame.worldLandmarks.map((point, i) => blend(previous.worldLandmarks![i], point, this.alpha))
        : frame.worldLandmarks,
    };
    this.previous = smoothed;
    return smoothed;
  }
}
