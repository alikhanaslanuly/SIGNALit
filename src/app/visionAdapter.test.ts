import { describe, expect, it } from 'vitest';
import type { HandFeatures, HandFrame } from '../core/vision/types';
import type { Recognition } from '../core/gestures';
import { SignalEngineAdapter } from './visionAdapter';

class FakeVision {
  frame: ((frame: HandFrame | null, features: HandFeatures | null) => void) | null = null;
  recognition: ((recognition: Recognition) => void) | null = null;
  context: unknown = null;
  onFrame(cb: typeof this.frame) { this.frame = cb; return () => { this.frame = null; }; }
  onRecognition(cb: typeof this.recognition) { this.recognition = cb; return () => { this.recognition = null; }; }
  onError() { return () => {}; }
  setContext(context: unknown) { this.context = context; }
  start() { return Promise.resolve(); }
  stop() {}
}

const features: HandFeatures = { fingerExt: { thumb: 1, index: 0, middle: 0, ring: 0, pinky: 0 }, thumbAngleDeg: 10, palmFacing: 0.9, handSize: 0.2, center: { x: 0.5, y: 0.5 }, edgeMargin: 0.2, speed: 0, brightness: 0.5 };

describe('SignalEngineAdapter', () => {
  it('maps Vision frame fields and emits B hints through the shared contract', () => {
    const vision = new FakeVision();
    const adapter = new SignalEngineAdapter(vision);
    let timestamp = -1;
    let hintCode = '';
    adapter.onFrame(frame => { timestamp = frame?.t ?? -1; });
    adapter.onHints(hints => { hintCode = hints[0]?.code ?? ''; });
    const frame: HandFrame = { landmarks: Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 })), handedness: null, timestampMs: 123, width: 640, height: 480, brightness: 0.5 };
    vision.frame?.(frame, features);
    vision.recognition?.({ gesture: 'YES', confidence: 0.95, state: 'confirmed', holdProgress: 1 });
    expect(timestamp).toBe(123);
    expect(hintCode).toBe('');
    adapter.setContext({ target: 'NO' });
    vision.frame?.(frame, features);
    vision.recognition?.({ gesture: null, confidence: 0, state: 'none', holdProgress: 0 });
    expect(hintCode).toBe('THUMB_DOWN');
    adapter.dispose();
  });
});
