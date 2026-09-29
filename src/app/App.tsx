import { useEffect, useRef, useState } from 'react';
import { VisionEngine } from '../core/vision';
import { MockEngine } from '../core/mock/mockEngine';
import { BackendTransport, BroadcastTransport, MemoryTransport } from '../transport';
import { ApiClient, defaultApiUrl } from '../api';
import { NurseDashboard, emptyDashboardState } from '../ui/dashboard';
import { PatientExperience } from '../ui/patient';
import type { PatientViewState } from '../ui/patient';
import { DebugPanel } from './DebugPanel';
import { SignalSession, type SessionSnapshot } from './session';
import { getText } from '../ui/i18n';
import { useUiStore } from './uiStore';
import { SignalEngineAdapter } from './visionAdapter';
import { toPatientView } from './viewModel';
import './app.css';
import { EntryPage, PatientPage, RegisterPage } from './ProductPages';
import { ErrorBoundary } from './ErrorBoundary';
import { StaffRoutes } from './StaffPages';

type Route = 'split' | 'patient' | 'dashboard';
const routeFromPath = (path: string): Route => path.startsWith('/patient') ? 'patient' : path.startsWith('/dashboard') ? 'dashboard' : 'split';

function DemoApp() {
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
    const apiUrl = defaultApiUrl();
    const backendEnabled = !demo && import.meta.env.VITE_TRANSPORT === 'backend';
    const patientId = import.meta.env.VITE_PATIENT_ID as string | undefined;
    const transport = backendEnabled
      ? new BackendTransport({ api: new ApiClient({ baseUrl: apiUrl }), patientId, room: '204',
        audience: route === 'patient' ? 'patient' : route === 'dashboard' ? 'nurse' : 'both',
        socketUrl: apiUrl.replace(/\/api\/?$/, '') })
      : route === 'split' || typeof BroadcastChannel === 'undefined'
        ? new MemoryTransport() : new BroadcastTransport();
    let engine: MockEngine | SignalEngineAdapter | null = null;
    if (route !== 'dashboard') {
      if (debug) engine = new MockEngine();
      else if (videoRef.current) engine = new SignalEngineAdapter(
        new VisionEngine(videoRef.current, { baseUrl: import.meta.env.BASE_URL, targetFps: 30 }), canvasRef.current);
    }
    const session = new SignalSession({ engine, transport, mode: debug ? 'mock' : 'real',
      storage: (() => { try { return window.localStorage; } catch { return undefined; } })() });
    session.setLocale(useUiStore.getState().locale); session.setAudioEnabled(useUiStore.getState().speechEnabled);
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
    speechEnabled={speechEnabled} demoMode={Boolean(mockEngine)} onStart={handleStart}
    onStartDialog={() => sessionRef.current?.enterDialog()} onRepeatTraining={() => sessionRef.current?.startTraining()}
    onLocaleChange={value => { setLocale(value); sessionRef.current?.setLocale(value); }}
    onSpeechToggle={() => { setSpeechEnabled(!speechEnabled); sessionRef.current?.setAudioEnabled(!speechEnabled); }} />;
  const dashboard = <NurseDashboard state={snapshot?.dashboard ?? emptyDashboardState()} now={snapshot?.now ?? Date.now()}
    locale={locale} onQuestion={questionId => sessionRef.current?.sendQuestion(questionId)}
    onQuickReply={(requestId, note) => sessionRef.current?.setRequestReply(requestId, note)}
    onStatus={(requestId, status) => sessionRef.current?.setRequestStatus(requestId, status)} />;

  return <>
    {route === 'split' ? <div className="signal-app">
      <nav className="signal-mobile-tabs" aria-label={getText(locale).product.demoViews}>
        <button type="button" aria-pressed={mobileTab === 'patient'} onClick={() => setMobileTab('patient')}>{getText(locale).product.patient}</button>
        <button type="button" aria-pressed={mobileTab === 'dashboard'} onClick={() => setMobileTab('dashboard')}>{getText(locale).product.nurse}</button>
      </nav>
      <div className="signal-split">
        <div className="signal-split__patient" data-mobile-visible={mobileTab === 'patient'}>{patient}</div>
        <div className="signal-split__dashboard" data-mobile-visible={mobileTab === 'dashboard'}>{dashboard}</div>
      </div>
    </div> : route === 'patient' ? patient : dashboard}
    {debug && mockEngine && <DebugPanel engine={mockEngine} session={sessionRef.current} />}
  </>;
}

function RoutedApp() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => { const changed = () => setPath(window.location.pathname); window.addEventListener('popstate', changed); return () => window.removeEventListener('popstate', changed); }, []);
  if (path === '/register') return <RegisterPage />;
  if (path === '/patient') return <PatientPage />;
  if (path === '/dashboard' || path.startsWith('/dashboard/')) return <StaffRoutes />;
  if (path === '/demo' || path === '/' && new URLSearchParams(window.location.search).get('demo') === '1') return <DemoApp />;
  return <EntryPage />;
}

/** Development-only layout evidence; never mounted in a production build. */
function LayoutProbe() {
  const [measurement, setMeasurement] = useState('');
  useEffect(() => {
    const measure = () => setMeasurement(`QA viewport ${window.innerWidth}px · document ${document.documentElement.scrollWidth}px · ${document.documentElement.scrollWidth <= window.innerWidth ? 'no horizontal overflow' : 'OVERFLOW'}`);
    const timer = window.setInterval(measure, 500); measure();
    return () => window.clearInterval(timer);
  }, []);
  return <output style={{ position: 'fixed', left: 0, bottom: 0, zIndex: 99, padding: 6, background: '#fff', color: '#102b38', maxWidth: '100%', fontSize: 10 }}>{measurement}</output>;
}
export function App() {
  return <><ErrorBoundary><RoutedApp /></ErrorBoundary>{import.meta.env.DEV && new URLSearchParams(window.location.search).get('layout') === '1' && <LayoutProbe />}</>;
}
