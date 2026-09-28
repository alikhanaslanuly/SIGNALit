import type { GestureMatch, GestureId, Recognition } from './types';

export interface HoldOptions {
  holdMs?: number;
  candidateMs?: number;
  cooldownMs?: number;
  releaseMs?: number;
  maxFrameGapMs?: number;
}

const NONE: Recognition = { gesture: null, confidence: 0, state: 'none', holdProgress: 0 };

/** A confirmed gesture fires once; it must be released and clear cooldown to rearm. */
export class HoldDetector {
  private active: GestureId | null = null;
  private activeSince = 0;
  private lastSeenAt = 0;
  private latched: GestureId | null = null;
  private releaseSince: number | null = null;
  private cooldownUntil = 0;

  private readonly holdMs: number;
  private readonly candidateMs: number;
  private readonly cooldownMs: number;
  private readonly releaseMs: number;
  private readonly maxFrameGapMs: number;

  constructor(options: HoldOptions = {}) {
    this.holdMs = options.holdMs ?? 1000;
    this.candidateMs = options.candidateMs ?? 150;
    this.cooldownMs = options.cooldownMs ?? 1500;
    this.releaseMs = options.releaseMs ?? 250;
    this.maxFrameGapMs = options.maxFrameGapMs ?? 220;
  }

  reset(): void {
    this.active = null;
    this.activeSince = 0;
    this.lastSeenAt = 0;
    this.latched = null;
    this.releaseSince = null;
    this.cooldownUntil = 0;
  }

  update(match: GestureMatch | null, timestampMs: number): Recognition {
    if (this.latched) {
      if (match?.gesture === this.latched) {
        this.releaseSince = null;
        return { ...NONE };
      }
      this.releaseSince ??= timestampMs;
      if (timestampMs - this.releaseSince < this.releaseMs || timestampMs < this.cooldownUntil) {
        return { ...NONE };
      }
      this.latched = null;
      this.releaseSince = null;
    }

    if (!match) {
      this.active = null;
      return { ...NONE };
    }

    if (match.gesture !== this.active || timestampMs - this.lastSeenAt > this.maxFrameGapMs) {
      this.active = match.gesture;
      this.activeSince = timestampMs;
    }
    this.lastSeenAt = timestampMs;
    const elapsed = Math.max(0, timestampMs - this.activeSince);
    const holdProgress = Math.min(1, elapsed / this.holdMs);
    if (elapsed >= this.holdMs) {
      this.latched = match.gesture;
      this.cooldownUntil = timestampMs + this.cooldownMs;
      this.active = null;
      return { gesture: match.gesture, confidence: match.confidence, state: 'confirmed', holdProgress: 1 };
    }
    return {
      gesture: match.gesture,
      confidence: match.confidence,
      state: elapsed < this.candidateMs ? 'candidate' : 'holding',
      holdProgress,
    };
  }
}
