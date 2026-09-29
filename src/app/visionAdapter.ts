import type { Engine, HandFeatures, HandFrame, Hint, Recognition, RuntimeEngine } from '../contracts';
import { diagnose, HintController, type HintDisplay } from '../core/errors';
import type { Recognition as VisionRecognition } from '../core/gestures';
import { drawHandFrame } from '../core/vision';
import type { HandFeatures as VisionFeatures, HandFrame as VisionFrame, VisionContext } from '../core/vision/types';

export interface VisionLike {
  start(): Promise<void>;
  stop(): void;
  onFrame(cb: (frame: VisionFrame | null, features: VisionFeatures | null) => void): () => void;
  onRecognition(cb: (recognition: VisionRecognition) => void): () => void;
  onError(cb: (error: Error) => void): () => void;
  setContext(context: VisionContext): void;
}

/** Adapts A's camera model to the common Engine and B's hint stream. */
export class SignalEngineAdapter implements RuntimeEngine {
  private frameListeners = new Set<Parameters<Engine['onFrame']>[0]>();
  private recognitionListeners = new Set<Parameters<Engine['onRecognition']>[0]>();
  private hintListeners = new Set<Parameters<Engine['onHints']>[0]>();
  private hintDisplayListeners = new Set<(display: HintDisplay) => void>();
  private errorListeners = new Set<(error: Error) => void>();
  private readonly unsubscribe: (() => void)[];
  private readonly hintController = new HintController();
  private context: VisionContext = {};
  private latestFeatures: VisionFeatures | null = null;
  private handSizeBaseline: number | undefined;
  private lastHintKey = '';

  private vision: VisionLike;
  private canvas?: HTMLCanvasElement | null;

  constructor(vision: VisionLike, canvas?: HTMLCanvasElement | null) {
    this.vision = vision;
    this.canvas = canvas;
    this.unsubscribe = [
      vision.onFrame((frame, features) => {
        this.latestFeatures = features;
        if (this.canvas) drawHandFrame(this.canvas, frame, true);
        const mapped: HandFrame | null = frame ? {
          t: frame.timestampMs, landmarks: frame.landmarks.map(({ x, y, z }) => ({ x, y, z })),
          handedness: frame.handedness, score: frame.handednessScore ?? 0,
        } : null;
        for (const cb of this.frameListeners) cb(mapped, features as HandFeatures | null);
      }),
      vision.onRecognition(value => {
        const recognition = value as Recognition;
        for (const cb of this.recognitionListeners) cb(recognition);
        const raw = diagnose(this.latestFeatures, value, { ...this.context, handSizeBaseline: this.handSizeBaseline });
        const display = this.hintController.update(raw, performance.now());
        const key = JSON.stringify({ hint: display.hint, corrected: display.corrected });
        if (key !== this.lastHintKey) {
          this.lastHintKey = key;
          const hints: Hint[] = display.hint ? [display.hint] : [];
          for (const cb of this.hintListeners) cb(hints);
          for (const cb of this.hintDisplayListeners) cb(display);
        }
      }),
      vision.onError(error => { for (const cb of this.errorListeners) cb(error); }),
    ];
  }
  start(): Promise<void> { return this.vision.start(); }
  stop(): void { this.vision.stop(); this.hintController.reset(); this.lastHintKey = ''; }
  dispose(): void { this.stop(); for (const unsubscribe of this.unsubscribe) unsubscribe(); }
  onFrame(cb: Parameters<Engine['onFrame']>[0]): () => void { this.frameListeners.add(cb); return () => this.frameListeners.delete(cb); }
  onRecognition(cb: Parameters<Engine['onRecognition']>[0]): () => void { this.recognitionListeners.add(cb); return () => this.recognitionListeners.delete(cb); }
  onHints(cb: Parameters<Engine['onHints']>[0]): () => void { this.hintListeners.add(cb); return () => this.hintListeners.delete(cb); }
  onHintDisplay(cb: (display: HintDisplay) => void): () => void { this.hintDisplayListeners.add(cb); return () => this.hintDisplayListeners.delete(cb); }
  onError(cb: (error: Error) => void): () => void { this.errorListeners.add(cb); return () => this.errorListeners.delete(cb); }
  setContext(context: Parameters<Engine['setContext']>[0]): void {
    this.context = context;
    this.hintController.reset();
    this.lastHintKey = '';
    this.vision.setContext(context);
  }
  setHandSizeBaseline(value: number | undefined): void { this.handSizeBaseline = value; }
}
