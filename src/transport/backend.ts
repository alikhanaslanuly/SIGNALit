import { io, type Socket } from 'socket.io-client';
import type { GestureId, SignalMessage, Status } from '../contracts';
import { acknowledgeRequest, cancelRequest, completeRequest, createRequest, listRequests, sendQuickReply, type RequestRecord } from '../api/requests';
import { answerQuestion, askQuestion, getDialog, listPatients, type DialogRecord } from '../api/patients';
import type { ApiClient } from '../api/client';
import type { Transport } from './types';

type Audience = 'patient' | 'nurse' | 'both';
interface SocketLike {
  on(event: string, handler: (...args: any[]) => void): SocketLike;
  off(event: string, handler: (...args: any[]) => void): SocketLike;
  emit(event: string, ...args: any[]): SocketLike;
  disconnect(): void;
}
type SocketFactory = (url: string) => SocketLike;

export interface BackendTransportOptions {
  api: ApiClient;
  patientId?: string;
  room?: string;
  audience: Audience;
  socketUrl: string;
  socketFactory?: SocketFactory;
  onReconnect?: () => void;
  onConnection?: (state: 'connected' | 'reconnecting' | 'offline') => void;
  onError?: (error: unknown) => void;
  onDelivered?: () => void;
  onSending?: () => void;
}

const requestTypes: readonly GestureId[] = ['YES', 'NO', 'HELP', 'PAIN', 'TOILET', 'WATER'];
const statusValues = ['PENDING', 'ACKNOWLEDGED', 'COMPLETED', 'CANCELLED'] as const;
const isGesture = (value: unknown): value is GestureId => typeof value === 'string' && requestTypes.includes(value as GestureId);
const isStatus = (value: unknown): value is RequestRecord['status'] => typeof value === 'string' && statusValues.includes(value as RequestRecord['status']);
const timeOf = (value: unknown): number => typeof value === 'string' ? Date.parse(value) : Date.now();

export class BackendTransport implements Transport {
  private readonly listeners = new Set<(message: SignalMessage) => void>();
  private readonly seen = new Set<string>();
  private readonly localToBackend = new Map<string, string>();
  private readonly backendToLocal = new Map<string, string>();
  private readonly pendingByType = new Map<GestureId, string[]>();
  private readonly socket: SocketLike;
  private readonly pendingCreates = new Map<string, Promise<void>>();
  private readonly versions = new Map<string, RequestRecord>();
  private readonly failed = new Map<string, SignalMessage>();
  private closed = false;
  private readonly patientId?: string;
  private readonly audience: Audience;

  constructor(private readonly options: BackendTransportOptions) {
    this.patientId = options.patientId;
    this.audience = options.audience;
    this.socket = (options.socketFactory ?? (url => io(url) as unknown as SocketLike))(options.socketUrl);
    this.socket.on('connect', () => { options.onConnection?.('connected'); this.joinRooms(true); });
    this.socket.on('disconnect', () => options.onConnection?.('reconnecting'));
    this.socket.on('connect_error', () => options.onConnection?.('offline'));
    for (const event of ['REQUEST_CREATED', 'REQUEST_UPDATED', 'QUICK_REPLY_CREATED', 'QUESTION_CREATED', 'ANSWER_CREATED'] as const) {
      this.socket.on(event, payload => this.receiveEvent(event, payload));
    }
    this.joinRooms(false);
  }

  private readonly joinRooms = (reconnected: boolean): void => {
    if (this.audience === 'nurse' || this.audience === 'both') this.socket.emit('join:nurses', () => { if (reconnected && !this.closed) this.options.onReconnect?.(); });
    if ((this.audience === 'patient' || this.audience === 'both') && this.patientId) this.socket.emit('join:patient', this.patientId, () => { if (reconnected && !this.closed) this.options.onReconnect?.(); });
    if (reconnected) this.options.onReconnect?.();
  };

  private deliver(message: SignalMessage, eventKey: string): void {
    if (this.closed || this.seen.has(eventKey)) return;
    this.seen.add(eventKey);
    if (this.seen.size > 1000) this.seen.delete(this.seen.values().next().value as string);
    for (const listener of this.listeners) listener(message);
  }

  private localRequestId(backendId: string): string {
    return backendId;
  }

  private requestMessage(request: RequestRecord, kind: 'REQUEST' | 'STATUS', eventKey: string, hydrated = false): SignalMessage {
    const requestId = this.localRequestId(request.id);
    const timestamp = kind === 'STATUS' ? request.cancelledAt ?? request.completedAt ?? request.replies?.at(-1)?.createdAt ?? request.acknowledgedAt ?? request.createdAt : request.createdAt;
    return { id: kind === 'REQUEST' ? requestId : `${eventKey}:message`, ts: timeOf(timestamp), room: request.room, kind,
      payload: kind === 'REQUEST'
        ? { hydrated, request: request.type, requestId, patientId: request.patientId, status: request.status, backendRequestId: request.id, localRequestId: this.backendToLocal.get(request.id), ...(request.quickReply ? { note: request.quickReply } : {}) }
        : { hydrated, requestId, patientId: request.patientId, status: request.status, backendRequestId: request.id, ...(request.quickReply ? { note: request.quickReply } : {}) } };
  }

  private dialogMessage(event: DialogRecord, kind: 'QUESTION' | 'ANSWER', eventKey: string): SignalMessage {
    return { id: event.id, ts: timeOf(event.createdAt), room: this.options.room ?? '', kind, payload: {
      questionId: event.questionId, patientId: event.patientId, ...(event.answer ? { answer: event.answer } : {}), eventKey,
    } };
  }

  private receiveEvent(event: string, payload: unknown): void {
    if (!payload || typeof payload !== 'object') return;
    const value = payload as Record<string, unknown>;
    if (event === 'REQUEST_CREATED' && typeof value.id === 'string' && typeof value.patientId === 'string' && isGesture(value.type) && typeof value.room === 'string' && isStatus(value.status)) {
      if (this.patientId && value.patientId !== this.patientId) return;
      const pending = typeof value.clientRequestId === 'string' ? value.clientRequestId : !this.seen.has(`request:${value.id}:created`) ? this.pendingByType.get(value.type)?.shift() : undefined;
      if (pending) { this.localToBackend.set(pending, value.id); this.backendToLocal.set(value.id, pending); }
      this.deliver(this.requestMessage(value as unknown as RequestRecord, 'REQUEST', `request:${value.id}:created`), `request:${value.id}:created`);
      return;
    }
    if ((event === 'REQUEST_UPDATED' || event === 'QUICK_REPLY_CREATED') && typeof value.id === 'string' && typeof value.patientId === 'string' && typeof value.room === 'string' && isStatus(value.status)) {
      if (this.patientId && value.patientId !== this.patientId) return;
      if (!this.seen.has(`request:${value.id}:created`)) this.ingestRequest(value as unknown as RequestRecord, false);
      else this.ingestStatus(value as unknown as RequestRecord);
      return;
    }
    if ((event === 'QUESTION_CREATED' || event === 'ANSWER_CREATED') && typeof value.id === 'string' && typeof value.patientId === 'string' && typeof value.questionId === 'string' && typeof value.createdAt === 'string') {
      const kind = event === 'QUESTION_CREATED' ? 'QUESTION' : 'ANSWER';
      if (kind === 'ANSWER' && value.answer !== 'YES' && value.answer !== 'NO') return;
      const room = typeof value.room === 'string' ? value.room : '';
      const message = this.dialogMessage(value as unknown as DialogRecord, kind, `dialog:${value.id}`);
      this.deliver({ ...message, room }, `dialog:${value.id}`);
    }
  }

  private ingestStatus(request: RequestRecord, hydrated = false): void {
    const prior = this.versions.get(request.id);
    const rank = { PENDING: 0, ACKNOWLEDGED: 1, COMPLETED: 2, CANCELLED: 2 };
    if (prior && (rank[request.status] < rank[prior.status] || (prior.replies?.length ?? 0) > (request.replies?.length ?? 0))) return;
    this.versions.set(request.id, request);
    const key = `request:${request.id}:${request.status}:${request.quickReply ?? ''}:${request.acknowledgedAt ?? ''}:${request.completedAt ?? ''}:${request.replies?.at(-1)?.id ?? ''}`;
    this.deliver(this.requestMessage(request, 'STATUS', key, hydrated), key);
  }

  ingestRequest(request: RequestRecord, hydrated = true): void {
    if (this.patientId && request.patientId !== this.patientId) return;
    if (request.clientRequestId) { this.localToBackend.set(request.clientRequestId, request.id); this.backendToLocal.set(request.id, request.clientRequestId); }
    this.deliver(this.requestMessage(request, 'REQUEST', `request:${request.id}:created`, hydrated), `request:${request.id}:created`);
    this.ingestStatus(request, hydrated);
  }

  async loadRequests(status: 'all' | 'active' | 'completed' = 'all'): Promise<void> {
    const requests = await listRequests(this.options.api, { status, ...(this.patientId ? { patientId: this.patientId } : {}) });
    for (const request of requests) this.ingestRequest(request);
  }

  async loadDialog(patientId: string): Promise<void> {
    const events = await getDialog(this.options.api, patientId);
    for (const event of events) {
      const message = this.dialogMessage(event, event.kind, `dialog:${event.id}`);
      this.deliver({ ...message, payload: { ...message.payload, hydrated: true }, room: this.options.room ?? '' }, `dialog:${event.id}`);
    }
  }

  async loadDialogs(): Promise<void> {
    const patients = await listPatients(this.options.api);
    for (const patient of patients.filter(value => value.active)) await this.loadDialog(patient.id);
  }

  send(message: SignalMessage): void {
    this.options.onSending?.();
    const pending = this.dispatch(message).then(() => {
      this.failed.delete(message.id);
      if (!this.closed) this.options.onDelivered?.();
    }).catch(error => {
      this.failed.set(message.id, message);
      if (!this.closed) this.options.onError?.(error);
    });
    if (message.kind === 'REQUEST') this.pendingCreates.set(message.id, pending);
  }
  retryFailed(): void { for (const message of this.failed.values()) this.send(message); }

  private async targetPatientId(): Promise<string | undefined> {
    if (this.patientId) return this.patientId;
    if (!this.options.room) return undefined;
    const patients = await listPatients(this.options.api);
    return patients.find(patient => patient.room === this.options.room && patient.active)?.id;
  }

  private async dispatch(message: SignalMessage): Promise<void> {
    if (message.kind === 'REQUEST') {
      if (!this.patientId || !isGesture(message.payload.request)) return;
      const type = message.payload.request;
      const pending = this.pendingByType.get(type) ?? [];
      if (!pending.includes(message.id)) pending.push(message.id); this.pendingByType.set(type, pending);
      const request = await createRequest(this.options.api, this.patientId, type, message.id);
      this.pendingByType.set(type, (this.pendingByType.get(type) ?? []).filter(id => id !== message.id));
      this.localToBackend.set(message.id, request.id); this.backendToLocal.set(request.id, message.id);
      this.deliver(this.requestMessage(request, 'REQUEST', `request:${request.id}:created`), `request:${request.id}:created`);
      return;
    }
    if (message.kind === 'QUESTION') {
      const patientId = typeof message.payload.patientId === 'string' ? message.payload.patientId : await this.targetPatientId();
      if (!patientId || typeof message.payload.questionId !== 'string') return;
      const event = await askQuestion(this.options.api, patientId, message.payload.questionId);
      this.deliver(this.dialogMessage({ ...event }, 'QUESTION', `dialog:${event.id}`), `dialog:${event.id}`);
      return;
    }
    if (message.kind === 'ANSWER') {
      if (!this.patientId || typeof message.payload.questionId !== 'string' || (message.payload.answer !== 'YES' && message.payload.answer !== 'NO')) return;
      const event = await answerQuestion(this.options.api, this.patientId, message.payload.questionId, message.payload.answer);
      this.deliver(this.dialogMessage({ ...event }, 'ANSWER', `dialog:${event.id}`), `dialog:${event.id}`);
      return;
    }
    if (message.kind === 'STATUS' && typeof message.payload.requestId === 'string') {
      await this.pendingCreates.get(message.payload.requestId);
      const backendId = this.localToBackend.get(message.payload.requestId) ?? message.payload.requestId;
      let request: RequestRecord;
      if (message.payload.status === 'CANCELLED') request = await cancelRequest(this.options.api, backendId);
      else if (message.payload.status === 'ACKNOWLEDGED') request = await acknowledgeRequest(this.options.api, backendId);
      else if (message.payload.status === 'COMPLETED') request = await completeRequest(this.options.api, backendId);
      else if (message.payload.note === 'COMING' || message.payload.note === 'WAIT') request = await sendQuickReply(this.options.api, backendId, message.payload.note, message.id);
      else return;
      this.ingestStatus(request);
    }
  }

  subscribe(cb: (message: SignalMessage) => void): () => void { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  close(): void { this.closed = true; this.listeners.clear(); this.socket.off('connect', this.joinRooms); this.socket.disconnect(); }
}
