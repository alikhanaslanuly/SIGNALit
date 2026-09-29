import type { HandFrame } from './types';

const CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

/** Optional canvas overlay; consumers never need a MediaPipe import. */
export function drawHandFrame(canvas: HTMLCanvasElement, frame: HandFrame | null, mirrorX = false): void {
  const width = frame?.width || canvas.width;
  const height = frame?.height || canvas.height;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  if (!frame) return;
  const position = (index: number) => ({
    x: (mirrorX ? 1 - frame.landmarks[index].x : frame.landmarks[index].x) * width,
    y: frame.landmarks[index].y * height,
  });
  ctx.strokeStyle = '#29e1b2';
  ctx.lineWidth = Math.max(2, width / 320);
  for (const [a, b] of CONNECTIONS) {
    const start = position(a);
    const end = position(b);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 21; i++) {
    const point = position(i);
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(2, width / 220), 0, Math.PI * 2);
    ctx.fill();
  }
}
