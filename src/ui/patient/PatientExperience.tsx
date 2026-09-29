import type { CSSProperties, Ref } from 'react';
import { GESTURES, type GestureId, type Recognition } from '../../core/gestures';
import type { Hint } from '../../core/errors';
import type { TrainingResult, TrainingState } from '../../modes/training';
import { getHintText, getText, type Locale } from '../i18n';
import { GestureMark } from '../shared/GestureMark';
import { GestureInstructionCard } from '../shared/GestureInstructionCard';
import { LanguageSwitcher } from '../shared/LanguageSwitcher';
import { ThemeToggle, useTheme } from '../shared/ThemeToggle';
import { cameraCopy } from '../../app/SystemCheck';
import './patient.css';

type PatientRequest = { gesture: GestureId; status: 'PENDING' | 'ACKNOWLEDGED' | 'COMPLETED'; note?: 'COMING' | 'WAIT' };
type Active = { recognition: Recognition; hint?: Hint | null; corrected?: boolean; feedback?: GestureId | null };
export type PatientViewState =
  | { screen: 'start'; cameraError?: string; cameraStarting?: boolean; request?: PatientRequest }
  | ({ screen: 'calibration'; target: 'YES' | 'NO'; step: 1 | 2; progress: number; quality?: 'missing' | 'closer' | 'farther' | 'still' | 'pose' | 'good'; failed?: boolean; fallback?: boolean } & Active)
  | ({ screen: 'training'; training: TrainingState } & Active)
  | ({ screen: 'dialog'; question?: string; confirmation?: 'WATER' | 'TOILET';
      urgent?: { gesture: 'HELP' | 'PAIN'; secondsRemaining: number };
      request?: { gesture: GestureId; status: 'PENDING' | 'ACKNOWLEDGED' | 'COMPLETED'; note?: 'COMING' | 'WAIT' } } & Active)
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
  demoMode?: boolean;
  context?: string;
  connection?: 'connecting' | 'connected' | 'reconnecting' | 'offline';
  delivery?: 'idle' | 'sending' | 'error';
  loadError?: boolean;
  onRetryDelivery?: () => void;
  onRetryCalibration?: () => void;
}

const between01 = (value: number) => Math.max(0, Math.min(1, value));

export function PatientExperience({ state, locale, videoRef, canvasRef, speechEnabled = false,
  onStart, onStartDialog, onRepeatTraining, onLocaleChange, onSpeechToggle, demoMode = false, context, connection, delivery = 'idle', loadError, onRetryDelivery, onRetryCalibration }: PatientExperienceProps) {
  const t = getText(locale);
  const p = t.product;
  const [theme, setTheme] = useTheme();
  const active = state.screen !== 'start' && state.screen !== 'results';
  const recognition = active ? state.recognition : null;
  const visibleCamera = active;
  const bedside = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('bedside') === '1';
  const presentation = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';
  const failure = state.screen === 'start' && state.cameraError ? cameraCopy(state.cameraError, locale) : null;
  const hint = active ? state.hint : null;
  const feedback = active ? state.feedback : null;
  const progress = between01(recognition?.holdProgress ?? 0);

  const request = state.screen === 'dialog' || state.screen === 'start' ? state.request : undefined;
  // Keep ticking countdowns and future tracker steps out of live announcements.
  const requestStatus = request ? delivery === 'sending' ? p.deliveryPending : delivery === 'error' ? p.deliveryError
    : request.status === 'COMPLETED' ? t.requestCompleted : request.status === 'ACKNOWLEDGED' ? t.nurseSaw : t.requestSent : '';
  const requestAnnouncement = request ? `${t.gestures[request.gesture].label}. ${requestStatus}${request.note ? `. ${t.nurse}: ${request.note === 'COMING' ? t.nurseComing : t.nurseWait}` : ''}` : '';

  return <main className="signal-patient" data-active={active} data-bedside={bedside} lang={locale}>
    <header className="signal-header">
      <div className="signal-brand"><span className="signal-brand__mark" aria-hidden="true">✳</span><span>{t.brand}</span>{context && <small className="signal-patient-context">{context}</small>}</div>
      <div className="signal-controls">
        {connection && <span className={`connection connection--${connection}`} role="status">● {p[connection]}</span>}
        {onLocaleChange && <LanguageSwitcher locale={locale} onChange={onLocaleChange} label={t.language} />}
        <ThemeToggle locale={locale} theme={theme} onChange={setTheme} />
        {onSpeechToggle && <button type="button" className="signal-speech" aria-label={speechEnabled ? t.speechOff : t.speechOn} aria-pressed={speechEnabled} onClick={onSpeechToggle}>{speechEnabled ? '🔊' : '🔈'} <span>{speechEnabled ? p.soundOn : p.soundOff}</span></button>}
      </div>
    {presentation && !demoMode && <div className="signal-demo-badge">{p.presentation} · {p.presentationHelp}</div>}
    {demoMode && <div className="signal-demo-badge" role="status">{t.demoBadge}</div>}
    </header>

    <p className="sr-only patient-announcement" role="status" aria-atomic="true">{requestAnnouncement}</p>
    {(delivery === 'error' || loadError) && <div className="patient-delivery-error" role="alert">{delivery === 'error' ? p.deliveryError : p.loadError}<button onClick={onRetryDelivery}>{p.retry}</button></div>}
    {delivery === 'sending' && <p className="patient-delivery-error" role="status">{p.deliveryPending}</p>}
    {state.screen === 'start' && <section className="signal-intro">
      <p className="signal-eyebrow">{t.eyebrow}</p>
      <div className="signal-intro__symbol" aria-hidden="true">◎</div>
      <h1>{t.tagline}</h1>
      <p className="signal-intro__copy">{t.intro}</p>
      <button type="button" className="signal-primary" onClick={onStart} disabled={state.cameraStarting}>{state.cameraStarting ? t.startingCamera : state.cameraError ? p.retry : t.turnOnCamera}</button>
      <p className="signal-privacy"><span aria-hidden="true">⌑</span> {t.privacy}</p>
      {state.cameraError && <p role="alert" className="signal-error">{failure?.title}<br /><small>{failure?.help}</small></p>}

    </section>}

    {state.screen === 'calibration' && <section className="signal-task">
      <div className="signal-step"><span>{t.calibration}</span><span>{t.step} {state.step} {t.of} 2</span></div>
      {state.fallback && <p className="signal-fallback" role="status">{t.calibrationFallback}</p>}
      {state.failed && <p className="signal-error" role="alert">{p.calibrationFailed}<button className="signal-secondary" onClick={onRetryCalibration}>{p.retry}</button></p>}
      <h1>{t.show}</h1><div className="signal-gesture-token"><GestureInstructionCard gesture={state.target} locale={locale} /></div>
      <div className="signal-stepbar" role="progressbar" aria-label={t.calibration} aria-valuenow={Math.round(between01(state.progress) * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${between01(state.progress) * 100}%` }} /></div>
      <p className="calibration-quality" role="status">{p[({ good: 'calibrationGood', missing: 'calibrationMissing', closer: 'calibrationCloser', farther: 'calibrationFarther', still: 'calibrationStill', pose: 'calibrationPose' } as const)[state.quality ?? 'missing']]}</p><p className="patient-muted">{p.calibrationInfo}</p>
      <button className="signal-secondary" onClick={onStartDialog}>{p.practiceLater}</button>
    </section>}

    {state.screen === 'training' && <section className="signal-task">
      <div className="signal-step"><span>{t.training}</span><span>{t.gesture} {Math.min(state.training.currentIndex + 1, state.training.total)} {t.of} {state.training.total}</span></div>
      <h1>{t.show}</h1><div className="signal-gesture-token"><GestureInstructionCard gesture={state.training.currentGesture} locale={locale} /></div>
      <div className="signal-stepbar" role="progressbar" aria-label={t.training} aria-valuenow={state.training.currentIndex} aria-valuemin={0} aria-valuemax={state.training.total}><span style={{ width: `${state.training.currentIndex / state.training.total * 100}%` }} /></div>
    </section>}

    {state.screen === 'dialog' && <section className="signal-task signal-task--dialog">
      <div className="signal-step">{t.dialog}</div>
      {state.question && <div className="signal-question" aria-live="polite" aria-atomic="true"><p>{t.nurseAsks}</p><h1>{state.question}</h1><p>{t.answer}</p><div className="signal-options"><GestureMark gesture="YES" locale={locale} compact /><GestureMark gesture="NO" locale={locale} compact /></div></div>}
      {state.confirmation && <div className="signal-question" aria-live="polite" aria-atomic="true"><p>{t.selected}</p><GestureMark gesture={state.confirmation} locale={locale} /><h1>{t.confirmRequest}</h1><div className="signal-options"><GestureMark gesture="YES" locale={locale} compact /><GestureMark gesture="NO" locale={locale} compact /></div></div>}
      {state.urgent && <div className="signal-urgent"><GestureMark gesture={state.urgent.gesture} locale={locale} /><h1>{delivery === 'sending' ? p.deliveryPending : delivery === 'error' ? p.deliveryError : t.requestSent}</h1><p>{t.cancel} <GestureMark gesture="NO" locale={locale} compact /> <strong>{Math.max(0, Math.ceil(state.urgent.secondsRemaining))}</strong></p></div>}

      {!state.question && !state.confirmation && !state.urgent && <><h1>{recognition?.gesture ? recognition.state === 'confirmed' ? t.detected : recognition.state === 'holding' ? p.hold : p.candidate : p.cameraReady}</h1>{recognition?.gesture && <GestureInstructionCard gesture={recognition.gesture} locale={locale} />}{recognition?.gesture && ['HELP', 'PAIN', 'WATER', 'TOILET'].includes(recognition.gesture) && <p>{p[recognition.gesture.toLowerCase() as 'help' | 'pain' | 'water' | 'toilet']}</p>}</>}
    </section>}

    {(state.screen === 'dialog' || state.screen === 'start') && <>      {state.request && <div className={`signal-request signal-request--${state.request.status.toLowerCase()}`}><div className="signal-request__gesture"><GestureMark gesture={state.request.gesture} locale={locale} /></div><div className="signal-request__details"><div className="signal-request__status"><span className={state.request.status !== 'PENDING' ? 'is-complete' : 'is-current'}>{delivery === 'sending' ? p.deliveryPending : delivery === 'error' ? p.deliveryError : t.requestSent}</span><span className={state.request.status === 'COMPLETED' ? 'is-complete' : state.request.status === 'ACKNOWLEDGED' ? 'is-current' : ''}>{t.nurseSaw}</span>{state.request.note && <span className="is-complete">{p.responding}</span>}<span className={state.request.status === 'COMPLETED' ? 'is-current' : ''}>{t.requestCompleted}</span></div>{state.request.note && <p className="signal-nurse-note"><strong>{t.nurse}:</strong> {state.request.note === 'COMING' ? t.nurseComing : t.nurseWait}</p>}</div></div>}</>}

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

    <p className="sr-only patient-recognition-announcement" role="status" aria-atomic="true">{feedback ? `${t.detected}: ${t.gestures[feedback].label}` : ''}</p>
    {active && <div className="signal-guidance">
      {feedback ? <p className="signal-feedback"><strong>✓ {t.success}</strong> <GestureMark gesture={feedback} locale={locale} compact /></p>
        : state.corrected ? <p className="signal-feedback"><strong>✓ {t.success}</strong> {t.correct}</p>
        : hint ? <p className="signal-hint"><span className="signal-hint__title">{t.guidanceTitle}</span><span className="signal-hint__text">{getHintText(locale, hint)}</span></p>
        : recognition?.state === 'holding' ? <p>{t.hold}</p> : <p>{p.cameraReady}</p>}
    </div>}
    <section className={`signal-camera${visibleCamera ? '' : ' signal-camera--hidden'}${recognition?.state === 'holding' ? ' signal-camera--holding' : ''}${recognition?.state === 'confirmed' ? ' signal-camera--confirmed' : ''}`} aria-label={t.cameraPreview} aria-hidden={!visibleCamera}>
      <video ref={videoRef} autoPlay playsInline muted />
      <canvas ref={canvasRef} aria-hidden="true" />
      {demoMode && <div className="camera-placeholder"><span>◎</span><strong>{t.demoBadge}</strong><small>{p.cameraOff}</small></div>}
      {recognition?.gesture && <div className="signal-camera__recognized" ><GestureMark gesture={recognition.gesture} locale={locale} compact /></div>}
      {recognition && recognition.state !== 'none' && recognition.state !== 'confirmed' &&
        <div className="signal-hold" role="progressbar" aria-label={p.hold} aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} style={{ '--hold-progress': `${progress * 100}%` } as CSSProperties}><span>{p.hold}<strong>{Math.round(progress * 100)}%</strong></span></div>}
    </section>
    {active && <div className="patient-bottom"><p>{p.privacy}</p>{state.screen === 'dialog' && <button className="signal-secondary" onClick={onRepeatTraining}>{p.practice}</button>}{state.screen === 'training' && <button className="signal-secondary" onClick={onStartDialog}>{p.continue}</button>}</div>}
    <details className="signal-vocabulary"><summary>{p.vocabulary}</summary><div className="signal-vocabulary__grid">{GESTURES.map(gesture => <div className="signal-vocabulary__tile" key={gesture}><GestureInstructionCard gesture={gesture} locale={locale} /></div>)}</div></details>
  </main>;
}
