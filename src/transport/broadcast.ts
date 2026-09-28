import type { SignalMessage } from '../contracts';
import { isSignalMessage, type Transport } from './types';

type ChannelLike = Pick<BroadcastChannel, 'postMessage' | 'close' | 'onmessage'>;

/** Semantic messages only; camera frames never enter BroadcastChannel. */
export class BroadcastTransport implements Transport {
  private listeners = new Set<(message: SignalMessage) => void>();
  private seen = new Set<string>();
  private history: SignalMessage[] = [];
  private readonly peerId = crypto.randomUUID();
  constructor(private readonly channel: ChannelLike = new BroadcastChannel('signal-demo-v1')) {
    this.channel.onmessage = event => {
      if (isSignalMessage(event.data)) { this.deliver(event.data); return; }
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      const control = data as Record<string, unknown>;
      if (control.type === 'SYNC_REQUEST' && typeof control.peerId === 'string') {
        this.channel.postMessage({ type: 'SYNC_RESPONSE', peerId: control.peerId, messages: this.history });
      } else if (control.type === 'SYNC_RESPONSE' && control.peerId === this.peerId && Array.isArray(control.messages)) {
        for (const message of control.messages) if (isSignalMessage(message)) this.deliver(message);
      }
    };
    this.channel.postMessage({ type: 'SYNC_REQUEST', peerId: this.peerId });
  }
  private deliver(message: SignalMessage): void {
    if (this.seen.has(message.id)) return;
    this.seen.add(message.id);
    this.history.push(message);
    if (this.history.length > 500) this.seen.delete(this.history.shift()!.id);
    for (const listener of this.listeners) listener(message);
  }
  send(message: SignalMessage): void {
    this.deliver(message);
    this.channel.postMessage(message);
  }
  subscribe(cb: (message: SignalMessage) => void): () => void {
    this.listeners.add(cb);
    for (const message of this.history) cb(message);
    return () => this.listeners.delete(cb);
  }
  close(): void { this.listeners.clear(); this.channel.onmessage = null; this.channel.close(); }
}
