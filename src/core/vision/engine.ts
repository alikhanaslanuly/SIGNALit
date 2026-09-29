import { cameraFailure, visionError } from './cameraFailure';
import type { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { classifyGesture, HoldDetector, type Recognition } from '../gestures';
import { extractHandFeatures } from './features';
import { LandmarkSmoother } from './smoothing';
import type { Engine, HandFeatures, HandFrame, Landmark, VisionContext } from './types';

type FrameListener = (frame: HandFrame | null, features: HandFeatures | null) => void;
type RecognitionListener = (recognition: Recognition) => void;
type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

export interface CameraState { permission: 'unknown' | 'granted' | 'denied'; stream: boolean; model: boolean }
export interface VisionEngineOptions {
  onState?: (state: CameraState) => void;
  /** Vite's import.meta.env.BASE_URL; defaults to /. */
  baseUrl?: string;
  targetFps?: number;
  smoothingAlpha?: number;
}

const stoppedStream = (stream: MediaStream) => stream.getTracks().forEach(track => track.stop());
const localPath = (base: string, path: string) => `${base.replace(/\/?$/, '/')}${path}`;

/** The inference loop and all MediaPipe state live outside React. */
export class VisionEngine implements Engine {
  private readonly frameListeners = new Set<FrameListener>();
  private readonly recognitionListeners = new Set<RecognitionListener>();
  private readonly errorListeners = new Set<(error: Error) => void>();
  private readonly smoother: LandmarkSmoother;
  private readonly hold = new HoldDetector();
  private readonly baseUrl: string;
  private readonly intervalMs: number;
  private readonly sampleCanvas = document.createElement('canvas');

  private context: VisionContext = {};
  private stream: MediaStream | null = null;
  private landmarker: HandLandmarker | null = null;
  private wasmFileset: WasmFileset | null = null;
  private delegate: 'GPU' | 'CPU' = 'CPU';
  private startPromise: Promise<void> | null = null;
  private generation = 0;
  private running = false;
  private rafId: number | null = null;
  private lastVideoTime = -1;
  private lastInferenceAt = -Infinity;
  private lastTimestamp = -1;
  private previousFrame: HandFrame | null = null;
  private brightness = 0.5;
  private brightnessAt = -Infinity;
  private lastFrameAt = 0;
  private cameraState: CameraState = { permission: 'unknown', stream: false, model: false };
  private readonly onState?: (state: CameraState) => void;
  private updateCamera(patch: Partial<CameraState>): void { this.cameraState = { ...this.cameraState, ...patch }; this.onState?.(this.cameraState); }

  private video: HTMLVideoElement;

  constructor(video: HTMLVideoElement, options: VisionEngineOptions = {}) {
    this.video = video;
    this.onState = options.onState;
    this.baseUrl = options.baseUrl ?? '/';
    this.intervalMs = 1000 / Math.max(1, Math.min(60, options.targetFps ?? 30));
    this.smoother = new LandmarkSmoother(options.smoothingAlpha ?? 0.55);
    this.sampleCanvas.width = 16;
    this.sampleCanvas.height = 16;
  }

  start(): Promise<void> {
    if (this.running) return Promise.resolve();
    if (this.startPromise) return this.startPromise;
    const generation = ++this.generation;
    const promise = this.startInternal(generation)
      .catch(error => {
        // video.play() may reject after stop() aborts playback. That is a
        // normal cancellation, not a camera failure for the caller.
        if (generation !== this.generation) return;
        if (cameraFailure(error) === 'blocked') this.updateCamera({ permission: 'denied' });
        this.emitError(error);
        this.stop();
        throw error;
      })
      .finally(() => {
        if (this.startPromise === promise) this.startPromise = null;
      });
    this.startPromise = promise;
    return promise;
  }

  private async startInternal(generation: number): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw visionError('NotSupportedError', 'Camera API unavailable');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 } },
    });
    if (generation !== this.generation) {
      stoppedStream(stream);
      return;
    }
    this.stream = stream;
    this.updateCamera({ permission: 'granted', stream: true });
    for (const track of stream.getTracks()) track.addEventListener?.('ended', () => {
      if (generation !== this.generation) return;
      this.emitError(visionError('StreamInterruptedError', 'Camera stream interrupted'));
      this.stop();
    }, { once: true });
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = stream;
    await this.video.play();
    if (generation !== this.generation) return;

    try {
    const { FilesetResolver } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(localPath(this.baseUrl, 'wasm'));
    if (generation !== this.generation) return;
    this.wasmFileset = fileset;
    const landmarker = await this.createLandmarker(fileset);
    if (generation !== this.generation) {
      landmarker.close();
      return;
    }
    this.landmarker = landmarker;
    this.updateCamera({ model: true });
    this.lastFrameAt = performance.now();
    this.running = true;
    this.schedule(generation);
    } catch { throw visionError('ModelError', 'Hand tracking could not start'); }
  }

  private async createLandmarker(fileset: WasmFileset): Promise<HandLandmarker> {
    const { HandLandmarker } = await import('@mediapipe/tasks-vision');
    const options = {
      runningMode: 'VIDEO' as const,
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.5,
    };
    const modelAssetPath = localPath(this.baseUrl, 'models/hand_landmarker.task');
    try {
      const landmarker = await HandLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: { modelAssetPath, delegate: 'GPU' },
      });
      this.delegate = 'GPU';
      return landmarker;
    } catch {
      const landmarker = await HandLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: { modelAssetPath, delegate: 'CPU' },
      });
      this.delegate = 'CPU';
      return landmarker;
    }
  }

  private schedule(generation: number): void {
    if (generation === this.generation && this.running) {
      this.rafId = requestAnimationFrame(() => this.tick(generation));
    }
  }

  private tick(generation: number): void {
    if (generation !== this.generation || !this.running || !this.landmarker) return;
    const now = performance.now();
    if (document.hidden || this.video.currentTime !== this.lastVideoTime) this.lastFrameAt = now;
    if (now - this.lastFrameAt > 10000) {
      this.emitError(visionError('StreamInterruptedError', 'Camera frames stopped')); this.stop(); return;
    }
    if (this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        this.video.currentTime !== this.lastVideoTime &&
        now - this.lastInferenceAt >= this.intervalMs) {
      this.lastVideoTime = this.video.currentTime;
      this.lastInferenceAt = now;
      const timestampMs = Math.max(now, this.lastTimestamp + 1);
      this.lastTimestamp = timestampMs;
      let result: HandLandmarkerResult;
      try {
        result = this.landmarker.detectForVideo(this.video, timestampMs);
      } catch (error) {
        void this.recoverInference(generation, error);
        return;
      }
      this.processResult(result, timestampMs);
    }
    this.schedule(generation);
  }

  private async recoverInference(generation: number, error: unknown): Promise<void> {
    if (this.delegate !== 'GPU' || !this.wasmFileset) {
      this.emitError(visionError('ModelError', 'Hand tracking interrupted'));
      this.stop();
      return;
    }
    this.landmarker?.close();
    this.landmarker = null;
    try {
      const { HandLandmarker } = await import('@mediapipe/tasks-vision');
      const replacement = await HandLandmarker.createFromOptions(this.wasmFileset, {
        baseOptions: { modelAssetPath: localPath(this.baseUrl, 'models/hand_landmarker.task'), delegate: 'CPU' },
        runningMode: 'VIDEO',
        numHands: 1,
      });
      if (generation !== this.generation) {
        replacement.close();
        return;
      }
      this.delegate = 'CPU';
      this.landmarker = replacement;
      this.lastVideoTime = -1;
      this.schedule(generation);
    } catch (fallbackError) {
      this.emitError(visionError('ModelError', 'Hand tracking interrupted'));
      this.stop();
    }
  }

  private processResult(result: HandLandmarkerResult, timestampMs: number): void {
    const points = result.landmarks[0];
    if (!points || points.length !== 21) {
      this.smoother.reset();
      this.previousFrame = null;
      this.emitFrame(null, null);
      this.emitRecognition(this.hold.update(null, timestampMs));
      return;
    }

    const handedness = result.handedness?.[0]?.[0];
    const category = handedness?.categoryName;
    const rawFrame: HandFrame = {
      landmarks: points.map(({ x, y, z }): Landmark => ({ x, y, z })),
      worldLandmarks: result.worldLandmarks?.[0]?.map(({ x, y, z }): Landmark => ({ x, y, z })),
      handedness: category === 'Left' || category === 'Right' ? category : null,
      handednessScore: handedness?.score,
      timestampMs,
      width: this.video.videoWidth,
      height: this.video.videoHeight,
      brightness: this.sampleBrightness(timestampMs),
    };
    const frame = this.smoother.update(rawFrame);
    const features = extractHandFeatures(frame, this.previousFrame);
    this.previousFrame = frame;
    const match = classifyGesture(features, { expected: this.context.expected });
    this.emitFrame(frame, features);
    this.emitRecognition(this.hold.update(match, timestampMs));
  }

  private sampleBrightness(timestampMs: number): number {
    if (timestampMs - this.brightnessAt < 250) return this.brightness;
    this.brightnessAt = timestampMs;
    const ctx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return this.brightness;
    try {
      ctx.drawImage(this.video, 0, 0, 16, 16);
      const rgba = ctx.getImageData(0, 0, 16, 16).data;
      let total = 0;
      for (let i = 0; i < rgba.length; i += 4) {
        total += 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
      }
      this.brightness = total / 256 / 255;
    } catch {
      // A temporary unavailable video frame should not stop recognition.
    }
    return this.brightness;
  }

  stop(): void {
    this.generation++;
    this.startPromise = null;
    this.running = false;
    this.updateCamera({ stream: false, model: false });
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.landmarker?.close();
    this.landmarker = null;
    this.wasmFileset = null;
    if (this.stream) stoppedStream(this.stream);
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
    this.smoother.reset();
    this.hold.reset();
    this.previousFrame = null;
    this.lastVideoTime = -1;
    this.lastInferenceAt = -Infinity;
    this.lastTimestamp = -1;
    this.emitFrame(null, null);
    this.emitRecognition({ gesture: null, confidence: 0, state: 'none', holdProgress: 0 });
  }

  onFrame(cb: FrameListener): () => void {
    this.frameListeners.add(cb);
    return () => this.frameListeners.delete(cb);
  }

  onRecognition(cb: RecognitionListener): () => void {
    this.recognitionListeners.add(cb);
    return () => this.recognitionListeners.delete(cb);
  }

  onError(cb: (error: Error) => void): () => void {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }

  setContext(context: VisionContext): void {
    const expected = context.expected ? [...new Set(context.expected)] : undefined;
    const previous = this.context;
    const sameExpected = previous.expected === undefined
      ? expected === undefined
      : expected !== undefined && previous.expected.length === expected.length &&
        previous.expected.every(gesture => expected.includes(gesture));
    if (previous.target === context.target && sameExpected) return;
    this.context = { expected, target: context.target };
    this.hold.reset();
  }

  private emitFrame(frame: HandFrame | null, features: HandFeatures | null): void {
    for (const cb of this.frameListeners) {
      try { cb(frame, features); } catch (error) { console.error('Vision frame listener failed', error); }
    }
  }

  private emitRecognition(recognition: Recognition): void {
    for (const cb of this.recognitionListeners) {
      try { cb(recognition); } catch (error) { console.error('Vision recognition listener failed', error); }
    }
  }

  private emitError(error: unknown): void {
    const reported = error instanceof Error ? error : new Error(String(error));
    for (const cb of this.errorListeners) {
      try { cb(reported); } catch (listenerError) { console.error('Vision error listener failed', listenerError); }
    }
  }
}
