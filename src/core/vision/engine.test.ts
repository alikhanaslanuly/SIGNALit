import { afterEach, describe, expect, it, vi } from 'vitest';
import { HoldDetector } from '../gestures/hold';
import { VisionEngine } from './engine';

function makeEngine(video: Partial<HTMLVideoElement> = {}): VisionEngine {
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, getContext: () => null }),
  });
  return new VisionEngine(video as HTMLVideoElement);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('VisionEngine context', () => {
  it('keeps hold progress when the same context is supplied again', () => {
    const reset = vi.spyOn(HoldDetector.prototype, 'reset');
    const engine = makeEngine();

    engine.setContext({ expected: ['YES', 'NO'], target: 'YES' });
    expect(reset).toHaveBeenCalledTimes(1);

    engine.setContext({ expected: ['NO', 'YES'], target: 'YES' });
    expect(reset).toHaveBeenCalledTimes(1);

    engine.setContext({ expected: ['NO'], target: 'NO' });
    expect(reset).toHaveBeenCalledTimes(2);
  });
});

describe('VisionEngine camera lifecycle', () => {
  it('reports denied camera permission through onError', async () => {
    const denied = new DOMException('Permission denied', 'NotAllowedError');
    const getUserMedia = vi.fn().mockRejectedValue(denied);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    const engine = makeEngine({ pause: vi.fn(), srcObject: null });
    const errors: Error[] = [];
    engine.onError(error => errors.push(error));

    await expect(engine.start()).rejects.toBe(denied);
    expect(errors).toEqual([denied]);
  });

  it('opens the camera once and closes a late stream after stop', async () => {
    let resolveStream!: (stream: MediaStream) => void;
    const pendingStream = new Promise<MediaStream>(resolve => { resolveStream = resolve; });
    const getUserMedia = vi.fn(() => pendingStream);
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    const video = { pause: vi.fn(), srcObject: null };
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    const engine = makeEngine(video);

    const first = engine.start();
    const second = engine.start();
    expect(second).toBe(first);
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    engine.stop();
    resolveStream(stream);
    await first;
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });

  it('does not report a play interruption caused by stop as a camera error', async () => {
    let rejectPlay!: (error: Error) => void;
    const pendingPlay = new Promise<void>((_resolve, reject) => { rejectPlay = reject; });
    const play = vi.fn(() => pendingPlay);
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    const engine = makeEngine({ play, pause: vi.fn(), srcObject: null });

    const starting = engine.start();
    await vi.waitFor(() => expect(play).toHaveBeenCalledOnce());
    engine.stop();
    rejectPlay(new Error('play interrupted by stop'));

    await expect(starting).resolves.toBeUndefined();
    expect(stopTrack).toHaveBeenCalledOnce();
  });
});

describe('VisionEngine frame mapping', () => {
  it('keeps the MediaPipe handedness score for the shared-contract adapter', () => {
    const engine = makeEngine({ videoWidth: 640, videoHeight: 480 });
    let frameScore: number | undefined;
    engine.onFrame(frame => { frameScore = frame?.handednessScore; });
    const result = {
      landmarks: [Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }))],
      handedness: [[{ categoryName: 'Right', score: 0.91 }]],
      worldLandmarks: [],
    };
    const processResult = engine as unknown as { processResult(result: unknown, timestampMs: number): void };

    processResult.processResult(result, 100);

    expect(frameScore).toBe(0.91);
  });
});
