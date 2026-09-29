import { z } from 'zod';
import { QUICK_REPLIES, REQUEST_TYPES } from '../types.js';

export const patientSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  room: z.string().trim().min(1).max(30),
}).strict();
export const patientPatchSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  room: z.string().trim().min(1).max(30).optional(),
  active: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0);

export const requestSchema = z.object({
  patientId: z.string().trim().min(1).max(100),
  type: z.enum(REQUEST_TYPES),
  clientRequestId: z.string().trim().min(1).max(100).optional(),
}).strict();

export const replySchema = z.object({ code: z.enum(QUICK_REPLIES), clientReplyId: z.string().trim().min(1).max(100).optional() }).strict();
export const QUESTION_IDS = ['pain', 'water', 'help', 'toilet', 'okay', 'cold', 'dizzy', 'breathe'] as const;
export const questionSchema = z.object({ questionId: z.enum(QUESTION_IDS) }).strict();
export const answerSchema = z.object({
  questionId: z.string().trim().min(1).max(80),
  answer: z.enum(['YES', 'NO']),
}).strict();

export type PatientInput = z.infer<typeof patientSchema>;
export type PatientPatchInput = z.infer<typeof patientPatchSchema>;
export type RequestInput = z.infer<typeof requestSchema>;
