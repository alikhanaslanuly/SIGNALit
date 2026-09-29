export const REQUEST_TYPES = ['YES', 'NO', 'HELP', 'PAIN', 'TOILET', 'WATER'] as const;
export type RequestType = typeof REQUEST_TYPES[number];
export const STATUSES = ['PENDING', 'ACKNOWLEDGED', 'COMPLETED', 'CANCELLED'] as const;
export type Status = typeof STATUSES[number];
export const QUICK_REPLIES = ['COMING', 'WAIT'] as const;
export type QuickReply = typeof QUICK_REPLIES[number];
export type Answer = 'YES' | 'NO';

export interface Patient {
  id: string;
  displayName: string;
  room: string;
  createdAt: string;
  active: boolean;
}

export interface Request {
  id: string;
  clientRequestId?: string;
  patientId: string;
  room: string;
  type: RequestType;
  status: Status;
  createdAt: string;
  acknowledgedAt: string | null;
  completedAt: string | null;
  quickReply: QuickReply | null;
  cancelledAt?: string | null;
  replies?: Array<{ id: string; code: 'COMING' | 'WAIT'; createdAt: string }>;
}

export interface DialogEvent {
  id: string;
  patientId: string;
  requestId: string | null;
  kind: 'QUESTION' | 'ANSWER';
  questionId: string;
  answer: Answer | null;
  createdAt: string;
}

export type RealtimeEvent = 'PATIENT_CREATED' | 'PATIENT_UPDATED' | 'REQUEST_CREATED' | 'REQUEST_UPDATED' | 'QUICK_REPLY_CREATED' | 'QUESTION_CREATED' | 'ANSWER_CREATED';
