import type { Finger, GestureId, Hint, Recognition } from '../contracts';
import { correctionFinger } from '../core/vision/correction';
export const QA_GESTURES: GestureId[] = ['YES', 'NO', 'HELP', 'PAIN', 'TOILET', 'WATER'];
export interface QaContext {
  device: string; browser: string; camera: 'laptop' | 'front' | 'rear' | 'unknown'; detectedCamera: string;
  hand: 'Left' | 'Right'; lighting: 'good' | 'medium' | 'poor'; distance: 'close' | 'normal' | 'far';
}
export interface ManualReview { correctRecognition: boolean; fingerAlignment: 'yes' | 'no' | 'na'; falseConfirmation: boolean; notes: string }
export interface QaMeasurement {
  expected: GestureId; startedAt: string; finishedAt: string; durationMs: number; context: QaContext;
  candidate: GestureId | null; confirmations: Array<{ gesture: GestureId; elapsedMs: number; candidateMs: number | null }>;
  corrections: Array<{ code: string; finger: Finger | null; count: number }>;
  frames: number; visibleFrames: number; fps: number | null; handVisibleRatio: number | null;
  detectedHand: 'Left' | 'Right' | null; interrupted: boolean;
}
export interface QaResult extends QaMeasurement { review: ManualReview }
/** Numeric counters and semantic events only. This class never accepts landmarks or images. */
export class QaAttempt {
  private frames = 0; private visibleFrames = 0; private previous: Recognition['state'] = 'none';
  private candidate: GestureId | null = null; private candidateStart: number | null = null;
  private detectedHand: 'Left' | 'Right' | null = null; private lastHint = '';
  private confirmations: QaMeasurement['confirmations'] = []; private corrections: QaMeasurement['corrections'] = [];
  private interrupted = false;
  constructor(private expected: GestureId, private context: QaContext, private startMs: number, private startedAt = new Date().toISOString()) {}
  frame(visible: boolean, handedness: 'Left' | 'Right' | null) { this.frames++; if (visible) this.visibleFrames++; if (handedness) this.detectedHand = handedness; }
  recognition(value: Recognition, now: number) {
    if (value.state === 'candidate' || value.state === 'holding') {
      if (this.candidate !== value.gesture || this.candidateStart === null) this.candidateStart = now;
      this.candidate = value.gesture;
    }
    if (value.state === 'confirmed' && this.previous !== 'confirmed' && value.gesture) {
      this.confirmations.push({ gesture: value.gesture, elapsedMs: Math.max(0, now - this.startMs), candidateMs: this.candidateStart === null ? null : Math.max(0, now - this.candidateStart) });
    }
    if (value.state === 'none' || value.state === 'confirmed') this.candidateStart = null;
    this.previous = value.state;
  }
  hint(hint: Hint | null) {
    const finger = correctionFinger(hint, 'none'); const key = hint ? `${hint.code}:${finger ?? ''}` : '';
    if (hint && key !== this.lastHint) {
      const prior = this.corrections.find(value => value.code === hint.code && value.finger === finger);
      if (prior) prior.count++; else this.corrections.push({ code: hint.code, finger, count: 1 });
    }
    this.lastHint = key;
  }
  interrupt() { this.interrupted = true; }
  snapshot(now: number): QaMeasurement {
    const durationMs = Math.max(0, now - this.startMs);
    return { expected: this.expected, context: { ...this.context }, startedAt: this.startedAt, finishedAt: new Date().toISOString(), durationMs,
      candidate: this.candidate, confirmations: this.confirmations.map(value => ({ ...value })), corrections: this.corrections.map(value => ({ ...value })),
      frames: this.frames, visibleFrames: this.visibleFrames, fps: durationMs > 0 && this.frames ? this.frames * 1000 / durationMs : null,
      handVisibleRatio: this.frames ? this.visibleFrames / this.frames : null, detectedHand: this.detectedHand, interrupted: this.interrupted };
  }
}
export const confirmation = (row: QaMeasurement) => row.confirmations.find(value => value.gesture === row.expected);
export const falseCount = (row: QaResult) => Math.max(row.confirmations.filter(value => value.gesture !== row.expected).length, Number(row.review.falseConfirmation));
export const passed = (row: QaResult) => row.review.correctRecognition && Boolean(confirmation(row)) && !falseCount(row) && row.review.fingerAlignment !== 'no' && !row.interrupted && row.visibleFrames > 0;
export function qaSummary(rows: QaResult[], mode: 'fast' | 'extended', hand: 'Left' | 'Right') {
  const required = (mode === 'extended' ? ['Left', 'Right'] : [hand]).flatMap(value => QA_GESTURES.map(gesture => `${value}:${gesture}`));
  const normal = rows.filter(row => row.context.lighting === 'good' && row.context.distance === 'normal');
  const covered = new Set(normal.filter(passed).map(row => `${row.context.hand}:${row.expected}`));
  const alignment = rows.filter(row => row.review.fingerAlignment !== 'na');
  const durations = rows.flatMap(row => { const value = confirmation(row)?.candidateMs; return value == null ? [] : [value]; });
  const measured = rows.filter(row => row.fps !== null);
  const helpAligned = normal.some(row => row.expected === 'HELP' && passed(row) && row.review.fingerAlignment === 'yes' && row.corrections.some(hint => hint.code === 'EXTEND_FINGER' && hint.finger === 'pinky'));
  return { attempts: rows.length, checked: required.filter(key => normal.some(row => `${row.context.hand}:${row.expected}` === key)).length, required: required.length,
    confirmed: rows.filter(row => row.review.correctRecognition && confirmation(row)).length, falseConfirmations: rows.reduce((sum, row) => sum + falseCount(row), 0),
    alignmentPassed: alignment.filter(row => row.review.fingerAlignment === 'yes').length, alignmentChecks: alignment.length,
    averageConfirmationMs: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null,
    averageFps: measured.length ? measured.reduce((sum, row) => sum + row.frames, 0) * 1000 / measured.reduce((sum, row) => sum + row.durationMs, 0) : null,
    ready: required.every(key => covered.has(key)) && rows.every(passed) && helpAligned, helpAligned };
}
export function exportQa(rows: QaResult[], mode: 'fast' | 'extended', hand: 'Left' | 'Right', build: string) {
  return { schemaVersion: 1, source: 'manual-camera-demo-check', exportedAt: new Date().toISOString(), build, mode, summary: qaSummary(rows, mode, hand), attempts: rows };
}
const csvCell = (value: unknown) => { const text = value == null ? '' : String(value); return `"${(/^[\s]*[=+@-]|^[\t\r\n]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`; };
export function qaCsv(rows: QaResult[]): string {
  const header = ['timestamp','device','browser','camera','detected_camera','hand','detected_hand','lighting','distance','expected_gesture','candidate','confirmed_gestures','human_success','demo_check_pass','candidate_to_confirmation_ms','attempt_to_confirmation_ms','correction_count','corrections','finger_alignment','false_confirmations','fps','hand_visible_ratio','interrupted','notes'];
  return [header, ...rows.map(row => [row.startedAt,row.context.device,row.context.browser,row.context.camera,row.context.detectedCamera,row.context.hand,row.detectedHand,row.context.lighting,row.context.distance,row.expected,row.candidate,row.confirmations.map(value => value.gesture).join('|'),row.review.correctRecognition,passed(row),confirmation(row)?.candidateMs,confirmation(row)?.elapsedMs,row.corrections.reduce((sum,value)=>sum+value.count,0),row.corrections.map(value=>`${value.code}:${value.finger ?? ''}:${value.count}`).join('|'),row.review.fingerAlignment,falseCount(row),row.fps,row.handVisibleRatio,row.interrupted,row.review.notes])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
export function downloadQa(content: string, extension: 'json' | 'csv') {
  const url = URL.createObjectURL(new Blob([content], { type: extension === 'json' ? 'application/json' : 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `signalit-camera-qa-${new Date().toISOString().replaceAll(':','-')}.${extension}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
