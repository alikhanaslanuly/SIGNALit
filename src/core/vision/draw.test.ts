import { expect, it, vi } from 'vitest';
import { drawHandFrame } from './draw';
import type { HandFrame } from './types';
it('highlights only the finger chain and mirrors it with the camera', () => {
  const lines: Array<{ color: string; start: number; end: number }> = [];
  let start = 0; let end = 0;
  const context = { strokeStyle: '', fillStyle: '', lineWidth: 0, clearRect: vi.fn(), beginPath() {}, moveTo(x: number) { start = x; }, lineTo(x: number) { end = x; }, stroke() { lines.push({ color: this.strokeStyle, start, end }); }, arc() {}, fill() {} };
  const canvas = { width: 640, height: 480, getContext: () => context } as unknown as HTMLCanvasElement;
  const frame: HandFrame = { width: 640, height: 480, brightness: 0.5, handedness: 'Left', timestampMs: 0, landmarks: Array.from({ length: 21 }, (_, index) => ({ x: index / 21, y: 0.5, z: 0 })) };
  drawHandFrame(canvas, frame, true, { finger: 'pinky', state: 'correcting' });
  const highlighted = lines.filter(line => line.color === '#ffbd45'); expect(highlighted).toHaveLength(3);
  expect(highlighted[0].start).toBeCloseTo((1 - 17 / 21) * 640);
  expect(highlighted[2].end).toBeCloseTo((1 - 20 / 21) * 640);
  expect(() => drawHandFrame(canvas, { ...frame, landmarks: [] }, true)).not.toThrow();
  drawHandFrame(canvas, null); expect(context.clearRect).toHaveBeenCalledTimes(3);
});
