import type { SignalMessage } from '../contracts';
import type { Transport } from './types';

/** One in-page event bus for the split patient/dashboard route. */
export class MemoryTransport implements Transport {
  private listeners = new Set<(message: SignalMessage) => void>();
  send(message: SignalMessage): void {
    for (const listener of this.listeners) listener(message);
  }
  subscribe(cb: (message: SignalMessage) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  close(): void { this.listeners.clear(); }
}
