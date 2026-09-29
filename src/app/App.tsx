import { useEffect, useRef, useState } from 'react';
import { VisionEngine } from '../core/vision';
import { MockEngine } from '../core/mock/mockEngine';
import { BroadcastTransport, MemoryTransport } from '../transport';
import { NurseDashboard, emptyDashboardState } from '../ui/dashboard';
import { PatientExperience } from '../ui/patient';
import type { PatientViewState } from '../ui/patient';
import { DebugPanel } from './DebugPanel';
import { SignalSession, type SessionSnapshot } from './session';
import { useUiStore } from './uiStore';
import { SignalEngineAdapter } from './visionAdapter';
import { toPatientView } from './viewModel';
import './app.css';

type Route = 'split' | 'patient' | 'dashboard';
const routeFromPath = (path: string): Route => path.startsWith('/patient') ? 'patient' : path.startsWith('/dashboard') ? 'dashboard' : 'split';

export function App() {
  const route = routeFromPath(typeof window !== 'undefined' ? window.location.pathname : '/');
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const demo = urlParams.get('demo') === '1';
  const debug = demo || (import.meta.env.DEV && urlParams.get('debug') === '1');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<SignalSession | null>(null);
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [mockEngine, setMockEngine] = useState<MockEngine | null>(null);
  const locale = useUiStore((state) => state.locale);
  const speechEnabled = useUiStore((state) => state.speechEnabled);
  const mobileTab = useUiStore((state) => state.mobileTab);
  const setLocale = useUiStore((state) => state.setLocale);
  const setSpeechEnabled = useUiStore((state) => state.setSpeechEnabled);
  const setMobileTab = useUiStore((state) => state.setMobileTab);

  useEffect(() => {
    const transport = route === 'split' || typeof BroadcastChannel === 'undefined'
      ? new MemoryTransport() : new BroadcastTransport();
    let engine: MockEngine | SignalEngineAdapter | null = null;
    if (route !== 'dashboard') {
      if (debug) engine = new MockEngine();
      else if (videoRef.current) engine = new SignalEngineAdapter(
        new VisionEngine(videoRef.current, { baseUrl: import.meta.env.BASE_URL, targetFps: 30 }), canvasRef.current);
    }
    const session = new SignalSession({ engine, transport, mode: debug ? 'mock' : 'real',
      storage: (() => { try { return window.localStorage; } catch { return undefined; } })() });
    sessionRef.current = session;
    setSnapshot(session.snapshot);
    setMockEngine(engine instanceof MockEngine ? engine : null);
    const unsubscribe = session.subscribe(() => setSnapshot(session.snapshot));
    const timer = window.setInterval(() => session.tick(), 200);
    return () => {
      window.clearInterval(timer);
      unsubscribe();
      session.dispose();
      sessionRef.current = null;
    };
  }, [route, debug]);

  const handleStart = () => {
    if (sessionRef.current) {
      if (!debug && videoRef.current && !sessionRef.current['engine']) {
        const engine = new SignalEngineAdapter(
          new VisionEngine(videoRef.current, { baseUrl: import.meta.env.BASE_URL, targetFps: 30 }), canvasRef.current);
        (sessionRef.current as unknown as { engine: unknown }).engine = engine;
      }
      void sessionRef.current.start();
    }
  };

  const patientState: PatientViewState = snapshot ? toPatientView(snapshot, locale) : { screen: 'start' };
  const patient = <PatientExperience state={patientState} locale={locale} videoRef={videoRef} canvasRef={canvasRef}
    speechEnabled={speechEnabled} onStart={handleStart}
    onStartDialog={() => sessionRef.current?.enterDialog()} onRepeatTraining={() => sessionRef.current?.startTraining()}
    onLocaleChange={value => { setLocale(value); sessionRef.current?.setLocale(value); }}
    onSpeechToggle={() => { setSpeechEnabled(!speechEnabled); sessionRef.current?.setAudioEnabled(!speechEnabled); }} />;
  const dashboard = <NurseDashboard state={snapshot?.dashboard ?? emptyDashboardState()} now={snapshot?.now ?? Date.now()}
    onQuestion={questionId => sessionRef.current?.sendQuestion(questionId)}
    onStatus={(requestId, status) => sessionRef.current?.setRequestStatus(requestId, status)} />;

  return <>
    {route === 'split' ? <div className="signal-app">
      <nav className="signal-mobile-tabs" aria-label="Demo views">
        <button type="button" aria-pressed={mobileTab === 'patient'} onClick={() => setMobileTab('patient')}>Patient</button>
        <button type="button" aria-pressed={mobileTab === 'dashboard'} onClick={() => setMobileTab('dashboard')}>Nurse</button>
      </nav>
      <div className="signal-split">
        <div className="signal-split__patient" data-mobile-visible={mobileTab === 'patient'}>{patient}</div>
        <div className="signal-split__dashboard" data-mobile-visible={mobileTab === 'dashboard'}>{dashboard}</div>
      </div>
    </div> : route === 'patient' ? patient : dashboard}
    {debug && mockEngine && <DebugPanel engine={mockEngine} session={sessionRef.current} />}
  </>;
}
