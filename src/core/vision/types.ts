import type { GestureId, Recognition } from '../gestures/types';

export type Finger = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface HandFrame {
  /** Exactly 21 normalized MediaPipe landmarks, in its standard index order. */
  landmarks: readonly Landmark[];
  worldLandmarks?: readonly Landmark[];
  handedness: 'Left' | 'Right' | null;
  /** MediaPipe handedness confidence, when available. */
  handednessScore?: number;
  timestampMs: number;
  width: number;
  height: number;
  /** Mean luma from a small camera sample, 0..1. */
  brightness: number;
}

export interface HandFeatures {
  fingerExt: Record<Finger, number>;
  /** 0 degrees points up in the camera image, 180 points down. */
  thumbAngleDeg: number;
  /** Absolute palm-plane alignment to camera, 0..1. Does not distinguish front/back. */
  palmFacing: number;
  /** Wrist-to-middle-MCP distance in normalized image coordinates. */
  handSize: number;
  center: Point;
  /** Smallest fingertip margin to an image edge, 0..0.5. */
  edgeMargin: number;
  /** Palm-center speed in hand sizes per second. */
  speed: number;
  brightness: number;
}

export interface VisionContext {
  expected?: GestureId[];
  target?: GestureId;
}

export interface Engine {
  start(): Promise<void>;
  stop(): void;
  onFrame(cb: (frame: HandFrame | null, features: HandFeatures | null) => void): () => void;
  onRecognition(cb: (recognition: Recognition) => void): () => void;
  onError(cb: (error: Error) => void): () => void;
  setContext(context: VisionContext): void;
}
