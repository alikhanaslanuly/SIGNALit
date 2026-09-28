import type { Ref } from 'react';
import type { GestureId, Recognition } from '../../core/gestures';
import type { Hint } from '../../core/errors';
import type { TrainingResult, TrainingState } from '../../modes/training';
import { getHintText, getText, type Locale } from '../i18n';
import { GestureMark } from '../shared/GestureMark';
import './patient.css';

type Active = { recognition: Recognition; hint?: Hint | null; corrected?: boolean; feedback?: GestureId | null };
export type PatientViewState =
  | { screen: 'start'; cameraError?: string; cameraStarting?: boolean }
  | ({ screen: 'calibration'; target: 'YES' | 'NO'; step: 1 | 2; progress: number } & Active)
  | ({ screen: 'training'; training: TrainingState } & Active)
  | ({ screen: 'dialog'; question?: string; confirmation?: 'WATER' | 'TOILET';
      urgent?: { gesture: 'HELP' | 'PAIN'; secondsRemaining: number };
      request?: { gesture: GestureId; status: 'PENDING' | 'ACKNOWLEDGED' | 'COMPLETED' } } & Active)
  | { screen: 'results'; result: TrainingResult; best: boolean };

export interface PatientExperienceProps {
  state: PatientViewState;
  locale: Locale;
  videoRef?: Ref<HTMLVideoElement>;
  canvasRef?: Ref<HTMLCanvasElement>;
  speechEnabled?: boolean;
  onStart: () => void;
  onStartDialog?: () => void;
  onRepeatTraining?: () => void;
  onLocaleChange?: (locale: Locale) => void;
  onSpeechToggle?: () => void;
}

const between01 = (value: number) => Math.max(0, Math.min(1, value));

export function PatientExperience({ state, locale, videoRef, canvasRef, speechEnabled = false,
  onStart, onStartDialog, onRepeatTraining, onLocaleChange, onSpeechToggle }: PatientExperienceProps) {
  const t = getText(locale);
  const active = state.screen !== 'start' && state.screen !== 'results';
  const recognition = active ? state.recognition : null;
  const visibleCamera = active;
  const hint = active ? state.hint : null;
  const feedback = active ? state.feedback : null;
  const progress = between01(recognition?.holdProgress ?? 0);

  return <main className="signal-patient" lang={locale}>
    <header className="signal-header">
      <div className="signal-brand"><span className="signal-brand__mark" aria-hidden="true">✳</span>{t.brand}</div>
      <div className="signal-controls">
        {onLocaleChange && <div className="signal-languages" aria-label={t.language}>
          <button type="button" aria-pressed={locale === 'ru'} onClick={() => onLocaleChange('ru')}>RU</button>
          <button type="button" aria-pressed={locale === 'en'} onClick={() => onLocaleChange('en')}>EN</button>
        </div>}
        {onSpeechToggle && <button type="button" className="signal-speech" aria-label={speechEnabled ? t.speechOff : t.speechOn} aria-pressed={speechEnabled} onClick={onSpeechToggle}>{speechEnabled ? '🔊' : '🔈'}</button>}
      </div>
    </header>

    {state.screen === 'start' && <section className="signal-intro">
      <div className="signal-intro__symbol" aria-hidden="true">✋</div>
      <h1>{t.tagline}</h1>
      <button type="button" className="signal-primary" onClick={onStart} disabled={state.cameraStarting}>{state.cameraStarting ? t.startingCamera : t.turnOnCamera}</button>
      <p className="signal-privacy">{t.privacy}</p>
      {state.cameraError && <p role="alert" className="signal-error">{t.cameraError}</p>}
    </section>}

    {state.screen === 'calibration' && <section className="signal-task">
      <div className="signal-step">{t.calibration} · {t.step} {state.step} {t.of} 2</div>
      <h1>{t.show}</h1><GestureMark gesture={state.target} locale={locale} />
      <div className="signal-stepbar" role="progressbar" aria-label={t.calibration} aria-valuenow={Math.round(between01(state.progress) * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${between01(state.progress) * 100}%` }} /></div>
    </section>}

    {state.screen === 'training' && <section className="signal-task">
      <div className="signal-step">{t.training} · {t.gesture} {Math.min(state.training.currentIndex + 1, state.training.total)} {t.of} {state.training.total}</div>
      <h1>{t.show}</h1><GestureMark gesture={state.training.currentGesture} locale={locale} />
      <div className="signal-stepbar" role="progressbar" aria-label={t.training} aria-valuenow={state.training.currentIndex} aria-valuemin={0} aria-valuemax={state.training.total}><span style={{ width: `${state.training.currentIndex / state.training.total * 100}%` }} /></div>
    </section>}

    {state.screen === 'dialog' && <section className="signal-task signal-task--dialog">
      <div className="signal-step">{t.dialog}</div>
      {state.question && <div className="signal-question"><p>{t.nurseAsks}</p><h1>{state.question}</h1><p>{t.answer}</p><div className="signal-options"><GestureMark gesture="YES" locale={locale} compact /><GestureMark gesture="NO" locale={locale} compact /></div></div>}
      {state.confirmation && <div className="signal-question"><p>{t.selected}</p><GestureMark gesture={state.confirmation} locale={locale} /><h1>{t.confirmRequest}</h1><div className="signal-options"><GestureMark gesture="YES" locale={locale} compact /><GestureMark gesture="NO" locale={locale} compact /></div></div>}
      {state.urgent && <div className="signal-urgent" role="status"><GestureMark gesture={state.urgent.gesture} locale={locale} /><h1>{t.requestSent}</h1><p>{t.cancel} 👎 <strong>{Math.max(0, Math.ceil(state.urgent.secondsRemaining))}</strong></p></div>}
      {state.request && <div className="signal-request" role="status"><GestureMark gesture={state.request.gesture} locale={locale} compact /><p>{state.request.status === 'PENDING' ? t.requestSent : state.request.status === 'ACKNOWLEDGED' ? t.nurseSaw : t.requestCompleted}</p></div>}
      {!state.question && !state.confirmation && !state.urgent && !state.request && <h1>{t.awaitingGesture}</h1>}
    </section>}

    {state.screen === 'results' && <section className="signal-results">
      <div className="signal-results__icon" aria-hidden="true">✓</div><h1>{t.trainingComplete}</h1>
      <p className="signal-results__score">{state.result.completedGestures} / {state.result.totalGestures}</p>
      <dl><div><dt>{t.averageTime}</dt><dd>{(state.result.averageReactionMs / 1000).toFixed(1)} {locale === 'ru' ? 'сек' : 'sec'}</dd></div>
        <div><dt>{t.errorsCorrected}</dt><dd>{state.result.correctedErrors}</dd></div>
        <div><dt>{t.hintsShown}</dt><dd>{state.result.hintsShown}</dd></div></dl>
      {state.best && <p className="signal-best">{t.bestResult}</p>}
      <div className="signal-results__actions"><button type="button" className="signal-primary" onClick={onStartDialog}>{t.startDialog}</button>
        <button type="button" className="signal-secondary" onClick={onRepeatTraining}>{t.repeatTraining}</button></div>
    </section>}

    {active && <div className="signal-guidance" aria-live="polite">
      {feedback ? <p className="signal-feedback">✓ <GestureMark gesture={feedback} locale={locale} compact /></p>
        : state.corrected ? <p className="signal-feedback">✓ {t.correct}</p>
        : hint ? <p className="signal-hint"><span aria-hidden="true">↗</span> {getHintText(locale, hint)}</p>
        : recognition?.state === 'holding' ? <p>{t.hold}</p> : <p>{t.awaitingGesture}</p>}
    </div>}
    <section className={`signal-camera${visibleCamera ? '' : ' signal-camera--hidden'}`} aria-label="Camera preview" aria-hidden={!visibleCamera}>
      <video ref={videoRef} autoPlay playsInline muted />
      <canvas ref={canvasRef} aria-hidden="true" />
      {recognition?.gesture && <div className="signal-camera__recognized" aria-live="polite"><GestureMark gesture={recognition.gesture} locale={locale} compact /></div>}
      {recognition && recognition.state !== 'none' && recognition.state !== 'confirmed' &&
        <div className="signal-hold" role="progressbar" aria-label={t.hold} aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} style={{ background: `conic-gradient(var(--signal-accent) ${progress * 100}%, rgba(255,255,255,.2) 0)` }}><span>{Math.round(progress * 100)}%</span></div>}
    </section>
  </main>;
}
