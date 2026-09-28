import { describe, expect, it } from 'vitest';
import type { SignalMessage } from '../contracts';
import { MemoryTransport } from './memory';
import { BroadcastTransport } from './broadcast';

const message: SignalMessage = { id: 'm1', ts: 100, room: '204', kind: 'REQUEST', payload: { request: 'WATER' } };

class FakeChannel {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  peers: FakeChannel[] = [];
  postMessage(data: unknown) { for (const peer of this.peers) peer.onmessage?.({ data } as MessageEvent<unknown>); }
  close() { this.onmessage = null; }
}

describe('MemoryTransport', () => {
  it('delivers semantic messages and unsubscribes', () => {
    const transport = new MemoryTransport();
    const received: SignalMessage[] = [];
    const unsubscribe = transport.subscribe(value => received.push(value));
    transport.send(message);
    unsubscribe();
    transport.send({ ...message, id: 'm2' });
    expect(received).toEqual([message]);
  });
});

describe('BroadcastTransport', () => {
  it('delivers across tabs once and ignores malformed data', () => {
    const a = new FakeChannel();
    const b = new FakeChannel();
    a.peers = [b]; b.peers = [a];
    const left = new BroadcastTransport(a);
    const right = new BroadcastTransport(b);
    const leftReceived: SignalMessage[] = [];
    const rightReceived: SignalMessage[] = [];
    left.subscribe(value => leftReceived.push(value));
    right.subscribe(value => rightReceived.push(value));
    left.send(message);
    b.onmessage?.({ data: message } as MessageEvent<unknown>);
    b.onmessage?.({ data: { id: 'bad' } } as MessageEvent<unknown>);
    expect(leftReceived).toEqual([message]);
    expect(rightReceived).toEqual([message]);
    left.close(); right.close();
  });
  it('replays semantic events when the dashboard tab opens after a request', () => {
    const a = new FakeChannel();
    const b = new FakeChannel();
    a.peers = [b]; b.peers = [a];
    const patient = new BroadcastTransport(a);
    patient.send(message);
    const dashboard = new BroadcastTransport(b);
    const received: SignalMessage[] = [];
    dashboard.subscribe(value => received.push(value));
    expect(received).toEqual([message]);
    patient.close(); dashboard.close();
  });
});
