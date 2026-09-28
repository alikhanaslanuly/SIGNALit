import type { Engine, GestureId, HandFeatures, HandFrame, Hint, Recognition, RuntimeEngine } from '../../contracts';

/** Development-only engine for testing the full flow without camera permission. */
export class MockEngine implements RuntimeEngine {
  private running = false;
  private context: Parameters<Engine['setContext']>[0] = {};
  private frameListeners = new Set<Parameters<Engine['onFrame']>[0]>();
  private recognitionListeners = new Set<Parameters<Engine['onRecognition']>[0]>();
  private hintListeners = new Set<Parameters<Engine['onHints']>[0]>();
  private errorListeners = new Set<(error: Error) => void>();

  async start(): Promise<void> { this.running = true; }
  stop(): void {
    if (!this.running) return;
    this.emitFrame(null, null);
    this.emitRecognition({ gesture: null, confidence: 0, state: 'none', holdProgress: 0 });
    this.emitHints([]);
    this.running = false;
  }
  onFrame(cb: Parameters<Engine['onFrame']>[0]): () => void { this.frameListeners.add(cb); return () => this.frameListeners.delete(cb); }
  onRecognition(cb: Parameters<Engine['onRecognition']>[0]): () => void { this.recognitionListeners.add(cb); return () => this.recognitionListeners.delete(cb); }
  onHints(cb: Parameters<Engine['onHints']>[0]): () => void { this.hintListeners.add(cb); return () => this.hintListeners.delete(cb); }
  onError(cb: (error: Error) => void): () => void { this.errorListeners.add(cb); return () => this.errorListeners.delete(cb); }
  setContext(context: Parameters<Engine['setContext']>[0]): void { this.context = context; }

  emitFrame(frame: HandFrame | null, features: HandFeatures | null): void {
    if (!this.running) return;
    for (const cb of this.frameListeners) cb(frame, features);
  }
  emitNoHand(): void {
    this.emitFrame(null, null);
    this.emitRecognition({ gesture: null, confidence: 0, state: 'none', holdProgress: 0 });
    this.emitHint('HAND_MISSING');
  }
  emitRecognition(recognition: Recognition): void {
    if (!this.running) return;
    for (const cb of this.recognitionListeners) cb(recognition);
  }
  emitCandidate(gesture: GestureId): void { this.emitRecognition({ gesture, confidence: 0.8, state: 'candidate', holdProgress: 0 }); }
  emitHolding(gesture: GestureId, progress = 0.5): void { this.emitRecognition({ gesture, confidence: 0.9, state: 'holding', holdProgress: progress }); }
  emitConfirmed(gesture: GestureId): void {
    if (this.context.expected && !this.context.expected.includes(gesture)) {
      this.emitHint('EXPECTED_GESTURES');
      return;
    }
    this.emitRecognition({ gesture, confidence: 0.95, state: 'confirmed', holdProgress: 1 });
  }
  emitHints(hints: Hint[]): void { if (this.running) for (const cb of this.hintListeners) cb(hints); }
  emitHint(code: string): void {
    const layer: Hint['layer'] = code === 'EXPECTED_GESTURES' ? 4 : code === 'FOLD_FINGER' ? 3
      : code === 'KEEP_STILL' ? 2 : 1;
    this.emitHints([{ code, layer, severity: 'warn' }]);
  }
  emitError(error: Error): void { if (this.running) for (const cb of this.errorListeners) cb(error); }
}
