/** Shared semantic contracts. Camera-specific fields stay inside VisionEngine. */
export type GestureId = 'YES' | 'NO' | 'HELP' | 'PAIN' | 'WATER' | 'TOILET';
export type Finger = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
export interface HandFrame {
  t: number;
  landmarks: { x: number; y: number; z: number }[];
  /** Vision can legitimately omit handedness; score is then 0. */
  handedness: 'Left' | 'Right' | null;
  score: number;
}
export interface HandFeatures {
  fingerExt: Record<Finger, number>;
  thumbAngleDeg: number;
  palmFacing: number;
  handSize: number;
  center: { x: number; y: number };
  edgeMargin: number;
  speed: number;
  brightness: number;
}
export interface Recognition {
  gesture: GestureId | null;
  confidence: number;
  state: 'none' | 'candidate' | 'holding' | 'confirmed';
  holdProgress: number;
}
export interface Hint {
  code: string;
  layer: 1 | 2 | 3 | 4;
  severity: 'info' | 'warn';
  params?: Record<string, string | number>;
  targetGesture?: GestureId;
}
export type Status = 'PENDING' | 'ACKNOWLEDGED' | 'COMPLETED';
export interface SignalMessage {
  id: string;
  ts: number;
  room: string;
  kind: 'REQUEST' | 'QUESTION' | 'ANSWER' | 'STATUS';
  payload: Record<string, unknown>;
}
export interface Engine {
  onFrame(cb: (frame: HandFrame | null, features: HandFeatures | null) => void): () => void;
  onRecognition(cb: (recognition: Recognition) => void): () => void;
  onHints(cb: (hints: Hint[]) => void): () => void;
  setContext(ctx: { expected?: GestureId[]; target?: GestureId }): void;
}
export interface RuntimeEngine extends Engine {
  start(): Promise<void>;
  stop(): void;
  onError(cb: (error: Error) => void): () => void;
}
