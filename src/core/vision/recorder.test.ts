import { describe, expect, it } from 'vitest';
import { createDevFeatureRecorder } from './recorder';
import type { Engine, HandFeatures, HandFrame } from './types';

function setup() {
  let onFrame: Parameters<Engine['onFrame']>[0] = () => {};
  const engine: Engine = {
    start: async () => {},
    stop: () => {},
    onFrame: callback => { onFrame = callback; return () => { onFrame = () => {}; }; },
    onRecognition: () => () => {},
    onError: () => () => {},
    setContext: () => {},
  };
  const frame: HandFrame = {
    landmarks: Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 })),
    handedness: 'Right', timestampMs: 100, width: 640, height: 480, brightness: 0.5,
  };
  const features: HandFeatures = {
    fingerExt: { thumb: 1, index: 0, middle: 0, ring: 0, pinky: 0 },
    thumbAngleDeg: 0, palmFacing: 0.9, handSize: 0.2,
    center: { x: 0.5, y: 0.5 }, edgeMargin: 0.1, speed: 0, brightness: 0.5,
  };
  return { frame, features, emit: (nextFrame: HandFrame | null, nextFeatures: HandFeatures | null) => onFrame(nextFrame, nextFeatures), engine };
}

describe('development fixture recorder', () => {
  it('refuses to download an empty fixture file', () => {
    const { engine } = setup();
    const recorder = createDevFeatureRecorder(engine);
    expect(() => recorder.download()).toThrow('No samples');
    recorder.dispose();
  });

  it('captures a detached frame, features, and expected gesture', () => {
    const { frame, features, emit, engine } = setup();
    const recorder = createDevFeatureRecorder(engine);
    emit(frame, features);
    const sample = recorder.capture('YES', 'p1');

    expect(sample).toMatchObject({ gesture: 'YES', expected: 'YES', participantId: 'p1' });
    expect(sample.frame.landmarks).toHaveLength(21);
    expect(sample.frame).toEqual(frame);
    expect(sample.features).toEqual(features);

    frame.landmarks[0].x = 0.1;
    features.fingerExt.thumb = 0;
    expect(sample.frame.landmarks[0].x).toBe(0.5);
    expect(sample.features.fingerExt.thumb).toBe(1);
    recorder.dispose();
  });

  it('refuses a capture after the hand disappears', () => {
    const { frame, features, emit, engine } = setup();
    const recorder = createDevFeatureRecorder(engine);
    emit(frame, features);
    emit(null, null);
    expect(() => recorder.capture('YES', 'p1')).toThrow('No hand');
    recorder.dispose();
  });
});
