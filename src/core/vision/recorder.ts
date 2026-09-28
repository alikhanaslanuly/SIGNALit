import type { GestureId } from '../gestures';
import type { Engine, HandFeatures } from './types';

export interface FeatureSample {
  gesture: GestureId;
  participantId: string;
  recordedAt: string;
  features: HandFeatures;
}

/** Manual, development-only fixture recorder. No camera frames are stored. */
export function createDevFeatureRecorder(engine: Engine) {
  const isDevelopment = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;
  if (!isDevelopment) throw new Error('Feature recording is available only in Vite development mode');
  const samples: FeatureSample[] = [];
  let latest: HandFeatures | null = null;
  const unsubscribe = engine.onFrame((_frame, features) => { latest = features; });

  return {
    capture(gesture: GestureId, participantId: string): FeatureSample {
      if (!participantId.trim()) throw new Error('participantId is required');
      if (!latest) throw new Error('No hand features available to record');
      const sample: FeatureSample = {
        gesture,
        participantId: participantId.trim(),
        recordedAt: new Date().toISOString(),
        features: structuredClone(latest),
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
