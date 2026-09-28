import type { GestureId } from '../gestures';
import type { Engine, HandFeatures, HandFrame } from './types';

export interface FeatureSample {
  /** The pose the participant was asked to show. */
  expected: GestureId;
  /** Kept for compatibility with the first recorder format. */
  gesture: GestureId;
  participantId: string;
  recordedAt: string;
  frame: HandFrame;
  features: HandFeatures;
}

/** Manual, development-only fixture recorder. No camera pixels are stored. */
export function createDevFeatureRecorder(engine: Engine) {
  const isDevelopment = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;
  if (!isDevelopment) throw new Error('Feature recording is available only in Vite development mode');
  const samples: FeatureSample[] = [];
  let latest: { frame: HandFrame; features: HandFeatures } | null = null;
  const unsubscribe = engine.onFrame((frame, features) => {
    latest = frame && features ? { frame, features } : null;
  });

  return {
    capture(gesture: GestureId, participantId: string): FeatureSample {
      if (!participantId.trim()) throw new Error('participantId is required');
      if (!latest) throw new Error('No hand features available to record');
      const sample: FeatureSample = {
        expected: gesture,
        gesture,
        participantId: participantId.trim(),
        recordedAt: new Date().toISOString(),
        frame: structuredClone(latest.frame),
        features: structuredClone(latest.features),
      };
      samples.push(sample);
      return sample;
    },
    samples(): readonly FeatureSample[] { return samples; },
    download(): void {
      const blob = new Blob([JSON.stringify(samples, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `signal-features-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    dispose(): void { unsubscribe(); },
  };
}
