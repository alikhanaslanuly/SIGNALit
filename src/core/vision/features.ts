import type { HandFeatures, HandFrame, Landmark, Point } from './types';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (start: number, end: number, value: number) => {
  const t = clamp01((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};
const distance = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const distance2D = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function angleDeg(a: Landmark, pivot: Landmark, b: Landmark): number {
  const u = [a.x - pivot.x, a.y - pivot.y, a.z - pivot.z];
  const v = [b.x - pivot.x, b.y - pivot.y, b.z - pivot.z];
  const length = Math.hypot(...u) * Math.hypot(...v);
  if (length < 1e-8) return 0;
  const cosine = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / length;
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}

/** Continuous extension from joint straightness and fingertip reach. */
export function fingerExtension(landmarks: readonly Landmark[], mcp: number): number {
  if (landmarks.length !== 21) throw new RangeError('Expected 21 hand landmarks');
  const [base, pip, dip, tip] = landmarks.slice(mcp, mcp + 4);
  if (!base || !pip || !dip || !tip) throw new RangeError('Invalid finger MCP index');
  const chainLength = distance(base, pip) + distance(pip, dip) + distance(dip, tip);
  const reach = chainLength > 1e-8 ? distance(base, tip) / chainLength : 0;
  return clamp01(
    0.55 * smoothstep(110, 170, angleDeg(base, pip, dip)) +
    0.15 * smoothstep(120, 175, angleDeg(pip, dip, tip)) +
    0.30 * smoothstep(0.64, 0.88, reach),
  );
}

export function thumbExtension(landmarks: readonly Landmark[]): number {
  if (landmarks.length !== 21) throw new RangeError('Expected 21 hand landmarks');
  const palmSpan = distance(landmarks[2], landmarks[17]);
  const reach = palmSpan > 1e-8 ? distance(landmarks[4], landmarks[17]) / palmSpan : 0;
  return clamp01(
    0.35 * smoothstep(110, 165, angleDeg(landmarks[1], landmarks[2], landmarks[3])) +
    0.25 * smoothstep(115, 170, angleDeg(landmarks[2], landmarks[3], landmarks[4])) +
    0.40 * smoothstep(0.75, 1.45, reach),
  );
}

export function handCenter(landmarks: readonly Landmark[]): Point {
  if (landmarks.length !== 21) throw new RangeError('Expected 21 hand landmarks');
  const palm = [0, 5, 9, 13, 17].map(index => landmarks[index]);
  return {
    x: palm.reduce((sum, point) => sum + point.x, 0) / palm.length,
    y: palm.reduce((sum, point) => sum + point.y, 0) / palm.length,
  };
}

export function handSize(landmarks: readonly Landmark[]): number {
  if (landmarks.length !== 21) throw new RangeError('Expected 21 hand landmarks');
  return distance2D(landmarks[0], landmarks[9]);
}

/** Palm-plane alignment. Its sign is intentionally ignored; front/back needs calibration. */
function palmAlignment(landmarks: readonly Landmark[]): number {
  const wrist = landmarks[0];
  const index = landmarks[5];
  const pinky = landmarks[17];
  const a = { x: index.x - wrist.x, y: index.y - wrist.y, z: index.z - wrist.z };
  const b = { x: pinky.x - wrist.x, y: pinky.y - wrist.y, z: pinky.z - wrist.z };
  const normal = {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
  const magnitude = Math.hypot(normal.x, normal.y, normal.z);
  return magnitude > 1e-8 ? clamp01(Math.abs(normal.z) / magnitude) : 0;
}

/** Pure frame-to-features transform; pass the previous smoothed frame for speed. */
export function extractHandFeatures(frame: HandFrame, previous?: HandFrame | null): HandFeatures {
  const points = frame.landmarks;
  if (points.length !== 21) throw new RangeError('Expected 21 hand landmarks');
  const center = handCenter(points);
  const size = handSize(points);
  const previousCenter = previous ? handCenter(previous.landmarks) : center;
  const elapsedSeconds = previous ? (frame.timestampMs - previous.timestampMs) / 1000 : 0;
  const thumb = points[4];
  const thumbBase = points[2];
  const thumbLength = distance2D(thumb, thumbBase);
  const upComponent = thumbLength > 1e-8 ? (thumbBase.y - thumb.y) / thumbLength : 0;

  return {
    fingerExt: {
      thumb: thumbExtension(points),
      index: fingerExtension(points, 5),
      middle: fingerExtension(points, 9),
      ring: fingerExtension(points, 13),
      pinky: fingerExtension(points, 17),
    },
    thumbAngleDeg: Math.acos(Math.max(-1, Math.min(1, upComponent))) * 180 / Math.PI,
    palmFacing: palmAlignment(frame.worldLandmarks?.length === 21 ? frame.worldLandmarks : points),
    handSize: size,
    center,
    edgeMargin: clamp01(Math.min(...points.flatMap(point => [point.x, 1 - point.x, point.y, 1 - point.y]))),
    speed: elapsedSeconds > 0 && size > 1e-8 ? distance2D(center, previousCenter) / size / elapsedSeconds : 0,
    brightness: clamp01(frame.brightness),
  };
}
