import type { SignalMessage } from '../contracts';

export interface Transport {
  send(message: SignalMessage): void;
  subscribe(cb: (message: SignalMessage) => void): () => void;
  close(): void;
}

export function isSignalMessage(value: unknown): value is SignalMessage {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && typeof item.ts === 'number' &&
    typeof item.room === 'string' &&
    (item.kind === 'REQUEST' || item.kind === 'QUESTION' || item.kind === 'ANSWER' || item.kind === 'STATUS') &&
    !!item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload);
}
