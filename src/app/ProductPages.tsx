import { useEffect, useRef, useState } from 'react';
import { ApiClient, getPatient, defaultApiUrl, listPatients, type PatientRecord } from '../api';
import { BackendTransport } from '../transport';
import { VisionEngine } from '../core/vision';
import { MockEngine } from '../core/mock/mockEngine';
import { PatientExperience, type PatientViewState } from '../ui/patient';
import { SignalEngineAdapter } from './visionAdapter';
import { SignalSession, type SessionSnapshot } from './session';
import { toPatientView } from './viewModel';
import { useUiStore } from './uiStore';
import { getText } from '../ui/i18n';
import { LanguageSwitcher } from '../ui/shared/LanguageSwitcher';
import { PatientForm, SessionReady } from './StaffPages';
import { DebugPanel } from './DebugPanel';
import type { Connection } from './staffData';
import './product.css';
const api = () => new ApiClient({ baseUrl: defaultApiUrl() });
function EntryControls() { const locale = useUiStore(state => state.locale); const setLocale = useUiStore(state => state.setLocale); return <LanguageSwitcher locale={locale} onChange={setLocale} label={getText(locale).language} />; }
export function EntryPage() {
  const locale = useUiStore(state => state.locale); const t = getText(locale).product;
  return <main className="signal-entry" lang={locale}><header><a className="entry-brand" href="/">✳ SIGNALit</a><EntryControls /></header><section className="signal-entry__card"><p className="signal-entry__brand">SIGNALit / {t.communication}</p><h1>{t.entryTitle}</h1><p>{t.entryIntro}</p><div className="entry-options"><a href="/patient" onClick={event => { event.preventDefault(); window.open('/patient', '_blank', 'noopener,noreferrer'); }}><small>{t.patientLabel}</small><strong>{t.patientEntry} →</strong><span>{t.patientDescription}</span></a><a href="/dashboard"><small>{t.staffLabel}</small><strong>{t.staffEntry} →</strong><span>{t.staffDescription}</span></a></div><div className="entry-secondary"><a href="/register" onClick={event => { event.preventDefault(); window.open('/register', '_blank', 'noopener,noreferrer'); }}>+ {t.create}</a><a href="/patient?practice=1">{t.practice}</a><a href="/register?demo=1">{t.demoSetup}</a></div><details className="entry-how"><summary>{t.howWorks}</summary><p>{t.howWorksText}</p></details></section><footer>{t.disclaimer}</footer></main>;
}
export function RegisterPage() {
  const locale = useUiStore(state => state.locale); const t = getText(locale).product; const [patient, setPatient] = useState<PatientRecord | null>(null);
  return <main className="signal-register" lang={locale}><section className="signal-register__card"><div className="entry-bar"><a className="entry-brand" href="/">✳ SIGNALit</a><EntryControls /></div><h1>{t.create}</h1><p>{t.patientsSubtitle}</p>{new URLSearchParams(window.location.search).get('demo') === '1' && <div className="presentation-panel"><strong>{t.presentation}</strong><p>{t.presentationHelp}</p><p>{t.freshHelp}</p></div>}{patient ? <><SessionReady patient={patient} /><button onClick={() => setPatient(null)}>{t.another}</button></> : <PatientForm onSaved={setPatient} />}<a href="/dashboard/patients">← {t.back}</a></section></main>;
}
function PatientWorkspace({ patient }: { patient: PatientRecord }) {
  const videoRef = useRef<HTMLVideoElement>(null); const canvasRef = useRef<HTMLCanvasElement>(null); const sessionRef = useRef<SignalSession | null>(null); const transportRef = useRef<BackendTransport | null>(null);
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null); const [mockEngine, setMockEngine] = useState<MockEngine | null>(null); const [connection, setConnection] = useState<Connection>('connecting'); const [delivery, setDelivery] = useState<'idle' | 'sending' | 'error'>('idle'); const [loadError, setLoadError] = useState(false);
  const locale = useUiStore(state => state.locale); const speechEnabled = useUiStore(state => state.speechEnabled); const setLocale = useUiStore(state => state.setLocale); const setSpeechEnabled = useUiStore(state => state.setSpeechEnabled);
  useEffect(() => {
    let transport: BackendTransport;
    const reload = () => { void Promise.all([transport.loadRequests('all'), transport.loadDialog(patient.id)]).then(() => setLoadError(false)).catch(() => setLoadError(true)); };
    transport = new BackendTransport({ api: api(), patientId: patient.id, room: patient.room, audience: 'patient', socketUrl: defaultApiUrl().replace(/\/api\/?$/, ''), onReconnect: reload, onConnection: setConnection, onError: () => setDelivery('error'), onSending: () => setDelivery('sending'), onDelivered: () => setDelivery('idle') });
    transportRef.current = transport;
    const engine = import.meta.env.DEV && new URLSearchParams(window.location.search).get('debug') === '1' ? new MockEngine() : videoRef.current ? new SignalEngineAdapter(new VisionEngine(videoRef.current, { baseUrl: import.meta.env.BASE_URL, targetFps: 30 }), canvasRef.current) : null;
    const session = new SignalSession({ engine, transport, mode: engine instanceof MockEngine ? 'mock' : 'real', room: patient.room, storage: (() => { try { return window.localStorage; } catch { return undefined; } })() });
    session.setLocale(useUiStore.getState().locale); session.setAudioEnabled(useUiStore.getState().speechEnabled);
    sessionRef.current = session; setSnapshot(session.snapshot); setMockEngine(engine instanceof MockEngine ? engine : null); const unsubscribe = session.subscribe(() => setSnapshot(session.snapshot)); const timer = window.setInterval(() => session.tick(), 200); reload();
    return () => { window.clearInterval(timer); unsubscribe(); session.dispose(); sessionRef.current = null; transportRef.current = null; };
  }, [patient.id, patient.room]);
  const state: PatientViewState = snapshot ? toPatientView(snapshot, locale) : { screen: 'start' };
  return <><PatientExperience state={state} locale={locale} context={`${patient.displayName} · ${getText(locale).product.room} ${patient.room}`} connection={connection} delivery={delivery} loadError={loadError} onRetryDelivery={() => { transportRef.current?.retryFailed(); void Promise.all([transportRef.current?.loadRequests('all'), transportRef.current?.loadDialog(patient.id)]).then(() => setLoadError(false)).catch(() => setLoadError(true)); }} videoRef={videoRef} canvasRef={canvasRef} speechEnabled={speechEnabled} demoMode={Boolean(mockEngine)} onStart={() => { void sessionRef.current?.start(); }} onStartDialog={() => sessionRef.current?.enterDialog()} onRepeatTraining={() => sessionRef.current?.startTraining()} onRetryCalibration={() => sessionRef.current?.retryCalibration()} onLocaleChange={value => { setLocale(value); sessionRef.current?.setLocale(value); }} onSpeechToggle={() => { setSpeechEnabled(!speechEnabled); sessionRef.current?.setAudioEnabled(!speechEnabled); }} />{mockEngine && <DebugPanel engine={mockEngine} session={sessionRef.current} />}</>;
}
export function PatientPage() {
  const locale = useUiStore(state => state.locale); const t = getText(locale).product;
  const id = new URLSearchParams(window.location.search).get('patientId'); const [patient, setPatient] = useState<PatientRecord | null>(null); const [patients, setPatients] = useState<PatientRecord[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; setLoading(true); setError(false); (id ? getPatient(api(), id).then(value => { if (active) setPatient(value); }) : listPatients(api()).then(values => { if (active) setPatients(values.filter(value => value.active)); })).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [id, retry]);
  if (patient && id) return <PatientWorkspace patient={patient} />;
  return <main className="signal-register" lang={locale}><section className="signal-register__card"><div className="entry-bar"><a className="entry-brand" href="/">✳ SIGNALit</a><EntryControls /></div><h1>{t.selectPatient}</h1><p>{t.noPatientSelected}</p>{loading && <p role="status">{t.loading}</p>}{error && <p role="alert">{t.loadError} <button onClick={() => setRetry(value => value + 1)}>{t.retry}</button></p>}<div className="session-picker">{patients.map(value => <a key={value.id} href={`/patient?patientId=${encodeURIComponent(value.id)}${window.location.search.includes('practice=1') ? '&practice=1' : ''}`}><strong>{value.displayName}</strong><span>{t.room} {value.room} →</span></a>)}</div>{!loading && !error && !patients.length && <p>{t.noPatientsHelp}</p>}<a className="staff-primary" href="/register">+ {t.create}</a></section></main>;
}
