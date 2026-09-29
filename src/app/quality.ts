import type { Recognition, Hint } from '../contracts';
export const QUALITY_KEY = 'signal.quality.v1';
export interface QualitySnapshot {
  startedAt: number; updatedAt: number; frames: number; visibleFrames: number; fps: number;
  confirmed: number; interruptedHolds: number; corrections: Record<string, number>;
  gestures: Record<string, number>; confirmationMs: number; timedConfirmations: number;
}
/** Aggregate measurements only. No images, landmarks, or patient identifiers. */
export class QualityRecorder {
  snapshot: QualitySnapshot;
  private lastSave = 0;
  private windowFrames = 0;
  private windowStart = 0;
  private attemptStart: number | null = null;
  private attemptGesture: Recognition['gesture'] = null;
  private previous: Recognition['state'] = 'none';
  private lastHint = '';
  constructor(now = Date.now()) {
    this.snapshot = { startedAt: now, updatedAt: now, frames: 0, visibleFrames: 0, fps: 0, confirmed: 0,
      interruptedHolds: 0, corrections: {}, gestures: {}, confirmationMs: 0, timedConfirmations: 0 };
  }
  frame(visible: boolean, now = Date.now()): void {
    this.snapshot.frames++; if (visible) this.snapshot.visibleFrames++;
    this.windowFrames++; this.windowStart ||= now;
    if (now - this.windowStart >= 1000) {
      this.snapshot.fps = this.windowFrames * 1000 / (now - this.windowStart);
      this.windowFrames = 0; this.windowStart = now;
    }
    this.snapshot.updatedAt = now;
    if (now - this.lastSave >= 1000) {
      this.lastSave = now;
      try { localStorage.setItem(QUALITY_KEY, JSON.stringify(this.snapshot)); } catch { /* Optional local diagnostics. */ }
    }
  }
  recognition(value: Recognition, now = Date.now()): void {
    if ((value.state === 'candidate' || value.state === 'holding') && (this.attemptStart === null || value.gesture !== this.attemptGesture)) { this.attemptStart = now; this.attemptGesture = value.gesture; }
    if (value.state === 'none' && this.previous === 'holding') this.snapshot.interruptedHolds++;
    if (value.state === 'confirmed' && this.previous !== 'confirmed' && value.gesture) {
      this.snapshot.confirmed++;
      this.snapshot.gestures[value.gesture] = (this.snapshot.gestures[value.gesture] ?? 0) + 1;
      if (this.attemptStart !== null) { this.snapshot.confirmationMs += now - this.attemptStart; this.snapshot.timedConfirmations++; }
    }
    if (value.state === 'none' || value.state === 'confirmed') this.attemptStart = null;
    this.previous = value.state;
  }
  hint(hint: Hint | null): void {
    const key = hint ? `${hint.code}:${hint.params?.finger ?? ''}` : '';
    if (key && key !== this.lastHint) this.snapshot.corrections[key] = (this.snapshot.corrections[key] ?? 0) + 1;
    this.lastHint = key;
  }
}
export function readQuality(): QualitySnapshot | null {
  try { const value = JSON.parse(localStorage.getItem(QUALITY_KEY) ?? 'null'); return value && typeof value.frames === 'number' && value.frames > 0 ? value : null; } catch { return null; }
}
