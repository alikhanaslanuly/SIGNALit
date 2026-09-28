import type { GestureId, HandFeatures, Hint, Recognition, RuntimeEngine, SignalMessage, Status } from '../contracts';
import { playFeedbackSound, speakFeedback } from '../audio/feedback';
import { classifyGesture } from '../core/gestures';
import { initialDialogState, transitionDialog, expectedDialogGestures, QUESTIONS, type DialogState } from '../modes/dialog';
import { CalibrationSession, TrainingSession, saveBestTrainingResult, type TrainingResult, type TrainingState } from '../modes/training';
import { applyDashboardMessage, emptyDashboardState, type DashboardState } from '../ui/dashboard/model';
import type { Locale } from '../ui/i18n';
import type { Transport } from '../transport';

export type PatientScreen = 'start' | 'calibration' | 'training' | 'results' | 'dialog';
export interface SessionSnapshot {
  screen: PatientScreen;
  cameraStarting: boolean;
  cameraError: string | null;
  calibration: { target: 'YES' | 'NO'; step: 1 | 2; progress: number } | null;
  training: TrainingState | null;
  result: TrainingResult | null;
  bestResult: boolean;
  dialog: DialogState;
  dashboard: DashboardState;
  recognition: Recognition;
  hint: Hint | null;
  corrected: boolean;
  feedback: GestureId | null;
  now: number;
}
export interface SessionOptions {
  engine: RuntimeEngine | null;
  transport: Transport;
  mode: 'real' | 'mock';
  room?: string;
  now?: () => number;
  makeId?: () => string;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
}

const noRecognition: Recognition = { gesture: null, confidence: 0, state: 'none', holdProgress: 0 };

/** Connects camera, Error Mode, training, FSM and semantic transport outside JSX. */
export class SignalSession {
  private readonly engine: RuntimeEngine | null;
  private readonly transport: Transport;
  private readonly mode: 'real' | 'mock';
  private readonly now: () => number;
  private readonly makeId: () => string;
  private readonly storage?: Pick<Storage, 'getItem' | 'setItem'>;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: (() => void)[] = [];
  private calibrationSession: CalibrationSession | null = null;
  private trainingSession: TrainingSession | null = null;
  private feedbackUntil = 0;
  private correctedUntil = 0;
  private locale: Locale = 'ru';
  private audioEnabled = false;
  private started = false;
  private startEpoch = 0;
  private currentCalibrationTarget: 'YES' | 'NO' | null = null;
  snapshot: SessionSnapshot;

  constructor(options: SessionOptions) {
    this.engine = options.engine;
    this.transport = options.transport;
    this.mode = options.mode;
    this.now = options.now ?? Date.now;
    this.makeId = options.makeId ?? (() => crypto.randomUUID());
    this.storage = options.storage;
    const room = options.room ?? '204';
    this.snapshot = { screen: 'start', cameraStarting: false, cameraError: null, calibration: null, training: null, result: null,
      bestResult: false, dialog: initialDialogState(room), dashboard: emptyDashboardState(),
      recognition: noRecognition, hint: null, corrected: false, feedback: null, now: this.now() };
    this.unsubscribe.push(this.transport.subscribe(message => this.receive(message)));
    if (this.engine) {
      this.unsubscribe.push(this.engine.onFrame((_frame, features) => this.onFrame(features)));
      this.unsubscribe.push(this.engine.onRecognition(value => this.onRecognition(value)));
      this.unsubscribe.push(this.engine.onHints(hints => {
        const hint = hints[0] ?? null;
        if (this.snapshot.hint?.code !== hint?.code || JSON.stringify(this.snapshot.hint?.params) !== JSON.stringify(hint?.params)) {
          this.update({ hint, corrected: false });
        }
      }));
      this.unsubscribe.push(this.engine.onError(error => this.handleEngineError(error)));
      if ('onHintDisplay' in this.engine && typeof this.engine.onHintDisplay === 'function') {
        const adapter = this.engine as RuntimeEngine & { onHintDisplay(cb: (display: { corrected: boolean }) => void): () => void };
        this.unsubscribe.push(adapter.onHintDisplay(display => {
          if (display.corrected) {
            this.correctedUntil = this.now() + 900;
            this.update({ corrected: true });
          }
        }));
      }
    }
  }

  subscribe(cb: () => void): () => void { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  private update(patch: Partial<SessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const cb of this.listeners) cb();
  }
  setLocale(locale: Locale): void { this.locale = locale; }
  setAudioEnabled(value: boolean): void { this.audioEnabled = value; }

  private handleEngineError(error: unknown): void {
    this.startEpoch++;
    this.started = false;
    this.calibrationSession = null;
    this.trainingSession = null;
    this.currentCalibrationTarget = null;
    this.update({ screen: 'start', cameraStarting: false,
      cameraError: error instanceof Error ? error.message : String(error),
      calibration: null, training: null, result: null, hint: null,
      recognition: noRecognition, feedback: null });
    this.engine?.stop();
  }

  async start(): Promise<void> {
    if (!this.engine || this.started || this.snapshot.cameraStarting) return;
    const attempt = ++this.startEpoch;
    this.update({ cameraStarting: true, cameraError: null });
    try {
      await this.engine.start();
      if (attempt !== this.startEpoch) return;
      this.started = true;
      if (this.mode === 'mock') this.enterDialog();
      else {
        this.calibrationSession = new CalibrationSession(this.now());
        this.currentCalibrationTarget = 'YES';
        this.engine.setContext({ target: 'YES', expected: ['YES'] });
        this.update({ screen: 'calibration', cameraError: null,
          calibration: { target: 'YES', step: 1, progress: 0 } });
      }
    } catch (error) {
      if (attempt === this.startEpoch) this.handleEngineError(error);
    } finally {
      if (attempt === this.startEpoch) this.update({ cameraStarting: false });
    }
  }

  private onFrame(features: HandFeatures | null): void {
    if (this.snapshot.screen !== 'calibration' || !this.calibrationSession) return;
    const gesture = features ? classifyGesture(features)?.gesture ?? null : null;
    this.advanceCalibration(features, gesture);
  }
  private advanceCalibration(features: HandFeatures | null, gesture: GestureId | null): void {
    if (!this.calibrationSession) return;
    this.calibrationSession.update(features, gesture, this.now());
    if (this.calibrationSession.completed) {
      const profile = this.calibrationSession.profile;
      if (this.engine && 'setHandSizeBaseline' in this.engine && typeof this.engine.setHandSizeBaseline === 'function') {
        (this.engine as RuntimeEngine & { setHandSizeBaseline(value: number): void }).setHandSizeBaseline(profile.handSizeBaseline);
      }
      this.startTraining();
      return;
    }
    if (this.currentCalibrationTarget !== this.calibrationSession.target) {
      this.currentCalibrationTarget = this.calibrationSession.target;
      this.engine?.setContext({ target: this.currentCalibrationTarget, expected: [this.currentCalibrationTarget] });
    }
    const progress = this.calibrationSession.progress;
    if (Math.abs(progress - (this.snapshot.calibration?.progress ?? 0)) > 0.03 || this.snapshot.calibration?.target !== this.calibrationSession.target) {
      this.update({ calibration: { target: this.calibrationSession.target, step: this.calibrationSession.target === 'YES' ? 1 : 2, progress } });
    }
  }

  startTraining(): void {
    this.trainingSession = new TrainingSession(this.now());
    const target = this.trainingSession.state.currentGesture;
    this.engine?.setContext({ target, expected: [target] });
    this.update({ screen: 'training', training: { ...this.trainingSession.state }, calibration: null,
      hint: null, recognition: noRecognition, feedback: null });
  }
  enterDialog(): void {
    this.engine?.setContext({ expected: expectedDialogGestures(this.snapshot.dialog) });
    this.update({ screen: 'dialog', hint: null, recognition: noRecognition, feedback: null });
  }

  private onRecognition(recognition: Recognition): void {
    const previous = this.snapshot.recognition;
    const meaningful = recognition.gesture !== previous.gesture || recognition.state !== previous.state ||
      Math.floor(recognition.holdProgress * 20) !== Math.floor(previous.holdProgress * 20);
    if (meaningful) this.update({ recognition });
    if (this.snapshot.screen === 'training' && this.trainingSession) {
      const previousIndex = this.trainingSession.state.currentIndex;
      const state = this.trainingSession.update(recognition, this.snapshot.hint, this.now());
      if (state.currentIndex !== previousIndex) {
        if (state.completed && this.trainingSession.result) {
          const result = this.trainingSession.result;
          const best = this.storage ? saveBestTrainingResult(result, this.storage) : result;
          this.engine?.setContext({});
          this.update({ screen: 'results', result, bestResult: best === result, training: { ...state }, hint: null });
        } else {
          this.engine?.setContext({ target: state.currentGesture, expected: [state.currentGesture] });
          this.update({ training: { ...state }, hint: null });
        }
      } else if (state.hintsShown !== this.snapshot.training?.hintsShown) this.update({ training: { ...state } });
    }
    if (recognition.state !== 'confirmed' || !recognition.gesture) return;
    const eventNow = this.now();
    this.feedbackUntil = eventNow + 900;
    this.update({ feedback: recognition.gesture, now: eventNow });
    if (this.audioEnabled && typeof window !== 'undefined') {
      playFeedbackSound(recognition.gesture === 'HELP' || recognition.gesture === 'PAIN' ? 'urgent' : 'success');
      speakFeedback(recognition.gesture, this.locale);
    }
    if (this.snapshot.screen !== 'dialog') return;
    const transition = transitionDialog(this.snapshot.dialog, { type: 'GESTURE', gesture: recognition.gesture,
      now: eventNow, messageId: this.makeId() });
    this.update({ dialog: transition.state });
    this.engine?.setContext({ expected: expectedDialogGestures(transition.state) });
    for (const message of transition.messages) this.transport.send(message);
    if (transition.messages.some(message => message.kind === 'REQUEST') && this.audioEnabled && typeof window !== 'undefined') {
      playFeedbackSound('request');
      speakFeedback(this.locale === 'ru' ? 'Запрос отправлен' : 'Request sent', this.locale);
    }
  }

  private receive(message: SignalMessage): void {
    if (message.room !== this.snapshot.dialog.room) return;
    const dashboard = applyDashboardMessage(this.snapshot.dashboard, message);
    let dialog = this.snapshot.dialog;
    if (message.kind === 'QUESTION' && typeof message.payload.questionId === 'string') {
      dialog = transitionDialog(dialog, { type: 'QUESTION', questionId: message.payload.questionId, now: message.ts }).state;
    }
    if (message.kind === 'STATUS' && typeof message.payload.requestId === 'string' &&
      (message.payload.status === 'PENDING' || message.payload.status === 'ACKNOWLEDGED' ||
        message.payload.status === 'COMPLETED' || message.payload.status === 'CANCELLED')) {
      dialog = transitionDialog(dialog, { type: 'STATUS', requestId: message.payload.requestId,
        status: message.payload.status, now: message.ts }).state;
    }
    const dialogChanged = dialog !== this.snapshot.dialog;
    this.update({ dashboard, dialog });
    if (dialogChanged && this.snapshot.screen === 'dialog') this.engine?.setContext({ expected: expectedDialogGestures(dialog) });
  }

  sendQuestion(questionId: string): void {
    if (!QUESTIONS.some(question => question.id === questionId)) return;
    this.transport.send({ id: this.makeId(), ts: this.now(), room: this.snapshot.dialog.room,
      kind: 'QUESTION', payload: { questionId } });
  }
  setRequestStatus(requestId: string, status: Extract<Status, 'ACKNOWLEDGED' | 'COMPLETED'>): void {
    if (!this.snapshot.dashboard.requests.some(request => request.id === requestId)) return;
    this.transport.send({ id: this.makeId(), ts: this.now(), room: this.snapshot.dialog.room,
      kind: 'STATUS', payload: { requestId, status } });
  }
  tick(): void {
    const now = this.now();
    if (this.snapshot.screen === 'calibration') this.advanceCalibration(null, null);
    const transition = transitionDialog(this.snapshot.dialog, { type: 'TICK', now });
    const dialogChanged = transition.state !== this.snapshot.dialog;
    const clearFeedback = this.snapshot.feedback && now >= this.feedbackUntil;
    const clearCorrected = this.snapshot.corrected && now >= this.correctedUntil;
    const refreshClock = Math.floor(now / 1000) !== Math.floor(this.snapshot.now / 1000);
    if (dialogChanged || clearFeedback || clearCorrected || refreshClock) {
      this.update({ dialog: transition.state, now, ...(clearFeedback ? { feedback: null } : {}),
        ...(clearCorrected ? { corrected: false } : {}) });
      if (dialogChanged && this.snapshot.screen === 'dialog') this.engine?.setContext({ expected: expectedDialogGestures(transition.state) });
    }
  }
  dispose(): void {
    this.startEpoch++;
    this.started = false;
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    if (this.engine && 'dispose' in this.engine && typeof this.engine.dispose === 'function') this.engine.dispose();
    else this.engine?.stop();
    this.transport.close();
    this.listeners.clear();
  }
}
