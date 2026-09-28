import { afterEach, describe, expect, it, vi } from 'vitest';
import { HoldDetector } from '../gestures/hold';
import { VisionEngine } from './engine';

function makeEngine(video: Partial<HTMLVideoElement> = {}): VisionEngine {
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0 }),
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
});
