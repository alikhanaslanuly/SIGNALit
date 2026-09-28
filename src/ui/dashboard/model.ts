import type { GestureId, SignalMessage, Status } from '../../contracts';

export interface NurseRequest {
  id: string;
  ts: number;
  room: string;
  gesture: 'HELP' | 'PAIN' | 'TOILET' | 'WATER';
  status: Status | 'CANCELLED';
  completedAt?: number;
}
export interface DashboardState {
  requests: NurseRequest[];
  history: SignalMessage[];
  seenIds: string[];
}
export const emptyDashboardState = (): DashboardState => ({ requests: [], history: [], seenIds: [] });
const isRequest = (value: unknown): value is NurseRequest['gesture'] =>
  value === 'HELP' || value === 'PAIN' || value === 'TOILET' || value === 'WATER';
const isStatus = (value: unknown): value is NurseRequest['status'] =>
  value === 'PENDING' || value === 'ACKNOWLEDGED' || value === 'COMPLETED' || value === 'CANCELLED';
const statusRank = (value: Status | 'CANCELLED') => ({ PENDING: 0, ACKNOWLEDGED: 1, COMPLETED: 2, CANCELLED: 3 })[value];

export function applyDashboardMessage(state: DashboardState, message: SignalMessage): DashboardState {
  if (state.seenIds.includes(message.id)) return state;
  const seenIds = [...state.seenIds.slice(-499), message.id];
  if (message.kind === 'REQUEST' && isRequest(message.payload.request)) {
    return { ...state, seenIds, requests: [...state.requests, {
      id: message.id, ts: message.ts, room: message.room, gesture: message.payload.request, status: 'PENDING',
    }] };
  }
  if (message.kind === 'STATUS' && typeof message.payload.requestId === 'string' && isStatus(message.payload.status)) {
    return { ...state, seenIds, requests: state.requests.map(request =>
      request.id === message.payload.requestId && statusRank(message.payload.status as NurseRequest['status']) > statusRank(request.status)
        ? { ...request, status: message.payload.status as NurseRequest['status'],
            ...(message.payload.status === 'COMPLETED' ? { completedAt: Math.max(request.ts, message.ts) } : {}) } : request) };
  }
  if (message.kind === 'QUESTION' && typeof message.payload.questionId === 'string' ||
      message.kind === 'ANSWER' && typeof message.payload.questionId === 'string' &&
      (message.payload.answer === 'YES' || message.payload.answer === 'NO')) {
    return { ...state, seenIds, history: [...state.history, message].slice(-30) };
  }
  return { ...state, seenIds };
}

const priority: Record<NurseRequest['gesture'], number> = { HELP: 0, PAIN: 0, TOILET: 1, WATER: 2 };
export function sortedRequests(state: DashboardState): NurseRequest[] {
  return state.requests.filter(request => request.status !== 'CANCELLED')
    .sort((a, b) => Number(a.status === 'COMPLETED') - Number(b.status === 'COMPLETED') ||
      priority[a.gesture] - priority[b.gesture] || a.ts - b.ts);
}

export const REQUEST_GESTURES: readonly GestureId[] = ['HELP', 'PAIN', 'TOILET', 'WATER'];
