import { getQuestion } from '../modes/dialog';
import type { Locale } from '../ui/i18n';
import type { PatientViewState } from '../ui/patient';
import type { SessionSnapshot } from './session';

export function toPatientView(snapshot: SessionSnapshot, locale: Locale): PatientViewState {
  if (snapshot.screen === 'start') return { screen: 'start', cameraStarting: snapshot.cameraStarting,
    ...(snapshot.cameraError ? { cameraError: snapshot.cameraError } : {}) };
  if (snapshot.screen === 'calibration' && snapshot.calibration) {
    return { screen: 'calibration', ...snapshot.calibration, recognition: snapshot.recognition,
      hint: snapshot.hint, corrected: snapshot.corrected, feedback: snapshot.feedback };
  }
  if (snapshot.screen === 'training' && snapshot.training) {
    return { screen: 'training', training: snapshot.training, recognition: snapshot.recognition,
      hint: snapshot.hint, corrected: snapshot.corrected, feedback: snapshot.feedback };
  }
  if (snapshot.screen === 'results' && snapshot.result) {
    return { screen: 'results', result: snapshot.result, best: snapshot.bestResult };
  }
  if (snapshot.screen === 'dialog') {
    const dialog = snapshot.dialog;
    const active = { screen: 'dialog' as const, recognition: snapshot.recognition,
      hint: snapshot.hint, corrected: snapshot.corrected, feedback: snapshot.feedback };
    if (dialog.phase === 'CANCEL_WINDOW' && dialog.activeRequest && dialog.cancelUntil !== null &&
      (dialog.activeRequest.gesture === 'HELP' || dialog.activeRequest.gesture === 'PAIN')) {
      return { ...active, urgent: { gesture: dialog.activeRequest.gesture,
        secondsRemaining: Math.max(0, (dialog.cancelUntil - snapshot.now) / 1000) } };
    }
    if (dialog.phase === 'REQUEST_CONFIRMATION' && dialog.pendingRequest) {
      return { ...active, confirmation: dialog.pendingRequest };
    }
    if (dialog.phase === 'WAITING_YES_NO' && dialog.questionId) {
      return { ...active, question: getQuestion(dialog.questionId, locale) ?? undefined };
    }
    if (dialog.activeRequest) return { ...active, request: { gesture: dialog.activeRequest.gesture, status: dialog.activeRequest.status } };
    return active;
  }
  return { screen: 'start' };
}
