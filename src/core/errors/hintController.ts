import { DIAGNOSTIC_CONFIG as cfg } from './config';
import type { Hint } from './types';

export interface HintDisplay { hint: Hint | null; corrected: boolean }

export class HintController {
  private visible: Hint | null = null;
  private shownAt = 0;
  private clearSince: number | null = null;

  update(hints: readonly Hint[], nowMs: number): HintDisplay {
    const next = hints[0] ?? null;
    if (!this.visible) {
      if (next) { this.visible = next; this.shownAt = nowMs; }
      return { hint: this.visible, corrected: false };
    }
    if (next?.code === this.visible.code && JSON.stringify(next.params) === JSON.stringify(this.visible.params)) {
      this.clearSince = null;
      return { hint: this.visible, corrected: false };
    }
    if (next) {
      if (nowMs - this.shownAt >= cfg.hintVisibleMs) {
        this.visible = next;
        this.shownAt = nowMs;
      }
      this.clearSince = null;
      return { hint: this.visible, corrected: false };
    }
    this.clearSince ??= nowMs;
    if (nowMs - this.shownAt < cfg.hintVisibleMs || nowMs - this.clearSince < cfg.correctedWaitMs) {
      return { hint: this.visible, corrected: false };
    }
    this.visible = null;
    this.clearSince = null;
    return { hint: null, corrected: true };
  }

  reset(): void { this.visible = null; this.clearSince = null; this.shownAt = 0; }
}
