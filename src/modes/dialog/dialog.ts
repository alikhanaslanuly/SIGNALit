import type { GestureId, SignalMessage, Status } from '../../contracts';

export type DialogPhase = 'IDLE' | 'WAITING_YES_NO' | 'REQUEST_CONFIRMATION' | 'CANCEL_WINDOW';
export interface ActiveRequest { id: string; gesture: GestureId; status: Status; ts: number }
export interface DialogState {
  room: string;
  phase: DialogPhase;
  questionId: string | null;
  pendingRequest: 'WATER' | 'TOILET' | null;
  activeRequest: ActiveRequest | null;
  cancelUntil: number | null;
  lastAnswer: 'YES' | 'NO' | null;
}
export type DialogEvent =
  | { type: 'QUESTION'; questionId: string; now: number }
  | { type: 'GESTURE'; gesture: GestureId; now: number; messageId: string }
  | { type: 'STATUS'; requestId: string; status: Status | 'CANCELLED'; now: number }
  | { type: 'TICK'; now: number };
export interface DialogTransition { state: DialogState; messages: SignalMessage[] }

export const initialDialogState = (room: string): DialogState => ({
  room, phase: 'IDLE', questionId: null, pendingRequest: null,
  activeRequest: null, cancelUntil: null, lastAnswer: null,
});

const resumedPhase = (state: DialogState): DialogPhase => state.pendingRequest ? 'REQUEST_CONFIRMATION' : state.questionId ? 'WAITING_YES_NO' : 'IDLE';
const rank = (status: Status) => ({ PENDING: 0, ACKNOWLEDGED: 1, COMPLETED: 2 })[status];

/** Pure dialog FSM. All IDs and timestamps enter through the event. */
export function transitionDialog(state: DialogState, event: DialogEvent): DialogTransition {
  const noMessages: SignalMessage[] = [];
  if (event.type === 'TICK') {
    if (state.phase === 'CANCEL_WINDOW' && state.cancelUntil !== null && event.now >= state.cancelUntil) {
      return { state: { ...state, phase: resumedPhase(state), cancelUntil: null }, messages: noMessages };
    }
    return { state, messages: noMessages };
  }
  if (event.type === 'STATUS') {
    if (state.activeRequest?.id !== event.requestId) return { state, messages: noMessages };
    if (event.status === 'CANCELLED') {
      if (state.activeRequest.status === 'COMPLETED') return { state, messages: noMessages };
      return { state: { ...state, activeRequest: null, phase: state.phase === 'CANCEL_WINDOW' ? resumedPhase(state) : state.phase, cancelUntil: null }, messages: noMessages };
    }
    if (rank(event.status) <= rank(state.activeRequest.status)) return { state, messages: noMessages };
    return { state: { ...state, activeRequest: { ...state.activeRequest, status: event.status },
      ...(event.status === 'COMPLETED' && state.phase === 'CANCEL_WINDOW'
        ? { phase: resumedPhase(state), cancelUntil: null } : {}) }, messages: noMessages };
  }
  if (event.type === 'QUESTION') {
    if (state.phase === 'CANCEL_WINDOW' && state.cancelUntil !== null && event.now < state.cancelUntil) {
      return { state: { ...state, questionId: event.questionId, lastAnswer: null }, messages: noMessages };
    }
    return { state: { ...state, phase: 'WAITING_YES_NO', questionId: event.questionId,
      pendingRequest: null, cancelUntil: null, lastAnswer: null }, messages: noMessages };
  }

  const current = state.phase === 'CANCEL_WINDOW' && state.cancelUntil !== null && event.now >= state.cancelUntil
    ? { ...state, phase: resumedPhase(state), cancelUntil: null } : state;
  if (current.phase === 'CANCEL_WINDOW') {
    if (event.gesture !== 'NO' || !current.activeRequest) return { state: current, messages: noMessages };
    const message: SignalMessage = { id: event.messageId, ts: event.now, room: current.room, kind: 'STATUS',
      payload: { requestId: current.activeRequest.id, status: 'CANCELLED' } };
    return { state: { ...current, phase: resumedPhase(current), activeRequest: null, cancelUntil: null }, messages: [message] };
  }
  if (event.gesture === 'HELP' || event.gesture === 'PAIN') {
    const activeRequest: ActiveRequest = { id: event.messageId, gesture: event.gesture, status: 'PENDING', ts: event.now };
    const message: SignalMessage = { id: event.messageId, ts: event.now, room: current.room,
      kind: 'REQUEST', payload: { request: event.gesture } };
    return { state: { ...current, phase: 'CANCEL_WINDOW', activeRequest, cancelUntil: event.now + 3000 }, messages: [message] };
  }
  if (current.phase === 'WAITING_YES_NO') {
    if (event.gesture !== 'YES' && event.gesture !== 'NO') return { state: current, messages: noMessages };
    const message: SignalMessage = { id: event.messageId, ts: event.now, room: current.room,
      kind: 'ANSWER', payload: { questionId: current.questionId, answer: event.gesture } };
    return { state: { ...current, phase: 'IDLE', questionId: null, lastAnswer: event.gesture }, messages: [message] };
  }
  if (current.phase === 'REQUEST_CONFIRMATION') {
    if (event.gesture === 'NO') return { state: { ...current, phase: 'IDLE', pendingRequest: null }, messages: noMessages };
    if (event.gesture !== 'YES' || !current.pendingRequest) return { state: current, messages: noMessages };
    const activeRequest: ActiveRequest = { id: event.messageId, gesture: current.pendingRequest, status: 'PENDING', ts: event.now };
    const message: SignalMessage = { id: event.messageId, ts: event.now, room: current.room,
      kind: 'REQUEST', payload: { request: current.pendingRequest } };
    return { state: { ...current, phase: 'IDLE', pendingRequest: null, activeRequest }, messages: [message] };
  }
  if (event.gesture === 'WATER' || event.gesture === 'TOILET') {
    return { state: { ...current, phase: 'REQUEST_CONFIRMATION', pendingRequest: event.gesture, lastAnswer: null }, messages: noMessages };
  }
  return { state: current, messages: noMessages };
}

export function expectedDialogGestures(state: DialogState): GestureId[] | undefined {
  if (state.phase === 'WAITING_YES_NO' || state.phase === 'REQUEST_CONFIRMATION') return ['YES', 'NO', 'HELP', 'PAIN'];
  if (state.phase === 'CANCEL_WINDOW') return ['NO'];
  return undefined;
}
