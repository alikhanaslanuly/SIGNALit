import { buildLabel } from './buildInfo';
import { useEffect, useRef, useState } from 'react';
import { VisionEngine } from '../core/vision';
import type { CameraState } from '../core/vision/engine';
import { cameraFailure, type CameraFailure } from '../core/vision/cameraFailure';
import { getText, type Locale } from '../ui/i18n';
import { useUiStore } from './uiStore';
import { staffApi, type Connection } from './staffData';

export function cameraCopy(code: string, locale: Locale) {
  const t = getText(locale).product;
  const keys = { blocked: ['cameraBlocked', 'allowCamera'], missing: ['cameraMissing', 'connectCamera'], busy: ['cameraBusy', 'closeCamera'], unsupported: ['cameraUnsupported', 'useSecure'], model: ['cameraModel', 'retryModel'], interrupted: ['cameraInterrupted', 'retryStream'], unknown: ['cameraUnknown', 'retryStream'] } as const;
  const [title, help] = keys[code as CameraFailure] ?? keys.unknown;
  return { title: t[title], help: t[help] };
}
export function SystemCheck({ connection }: { connection: Connection }) {
  const locale = useUiStore(state => state.locale); const t = getText(locale).product;
  const video = useRef<HTMLVideoElement>(null); const engine = useRef<VisionEngine | null>(null); const epoch = useRef(0);
  const [database, setDatabase] = useState<boolean | null>(null);
  const [sound, setSound] = useState(false); const [audioStatus, setAudioStatus] = useState<'speechUnavailable' | 'audioFailed' | 'audioConfirm' | null>(null);
  const ru = locale === 'ru';
  const [backend, setBackend] = useState<boolean | null>(null); const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false); const [failure, setFailure] = useState<string | null>(null);
  const [fps, setFps] = useState<number | null>(null); const frames = useRef(0); const [camera, setCamera] = useState<CameraState>({ permission: 'unknown', stream: false, model: false });
  const secure = typeof window !== 'undefined' && window.isSecureContext;
  const supported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  const ping = async () => {
    const results = await Promise.allSettled([staffApi.get<{ok:boolean}>('/health'), staffApi.get<{ok:boolean;database:boolean}>('/ready')]);
    setBackend(results[0].status==='fulfilled' && results[0].value?.ok===true);
    setDatabase(results[1].status==='fulfilled' && results[1].value?.ok===true && results[1].value?.database===true);
  };
  useEffect(() => { void ping(); const timer=setInterval(()=>void ping(),10000); return () => { clearInterval(timer); epoch.current++; engine.current?.stop(); }; }, []);
  useEffect(() => { if (!running) return; const timer = setInterval(() => { setFps(frames.current); frames.current = 0; }, 1000); return () => clearInterval(timer); }, [running]);
  const stop = () => { epoch.current++; engine.current?.stop(); engine.current = null; setRunning(false); setStarting(false); setFps(null); setCamera(previous => ({ ...previous, stream: false, model: false })); };
  const start = async () => {
    stop(); const attempt = ++epoch.current; setStarting(true); setFailure(null); frames.current = 0; void ping();
    const next = new VisionEngine(video.current!, { baseUrl: import.meta.env.BASE_URL, onState: state => { if (epoch.current === attempt) setCamera(state); } }); engine.current = next;
    next.onFrame(() => { frames.current++; });
    next.onError(error => { if (epoch.current !== attempt) return; setFailure(cameraFailure(error)); setRunning(false); setStarting(false); setFps(null); });
    try { await next.start(); if (epoch.current === attempt) { setRunning(true); } }
    catch { /* onError supplies the actionable message. */ }
    finally { if (epoch.current === attempt) setStarting(false); }
  };
  const error = failure ? cameraCopy(failure, locale) : null;
  const ready = running && camera.permission === 'granted' && camera.stream && camera.model && secure && backend && database && connection === 'connected' && fps !== null && fps > 0;
  const rows = [[t.frontendLoaded, true, ''], [t.database, database, t.backendHelp], [t.secure, secure, t.useSecure], [t.cameraSupport, supported, t.useSecure], [t.server, backend, t.backendHelp], [t.realtime, connection === 'connected', t.realtimeHelp]] as const;
  return <section className="staff-panel system-check"><div className="panel-title"><h2>{t.systemCheck}</h2><button onClick={() => void ping()}>{t.check}</button></div><p>{t.checkScope}</p><ul>{rows.map(([label, ready, help]) => <li key={label}><span>{label}{ready === false && <small>{help}</small>}</span><strong>{ready === null ? t.notChecked : ready ? `✓ ${t.ready}` : `— ${t.unavailable}`}</strong></li>)}
    <li><span>{t.cameraPermission}</span><strong>{camera.permission === 'granted' ? `✓ ${t.ready}` : camera.permission === 'denied' ? t.cameraBlocked : t.notChecked}</strong></li>
    <li><span>{t.cameraStream}</span><strong>{camera.stream ? `✓ ${t.ready}` : t.stopped}</strong></li><li><span>{t.modelLoaded}</span><strong>{camera.model ? `✓ ${t.ready}` : t.notChecked}</strong></li><li><span>{t.fps}</span><strong>{fps === null ? '—' : fps}</strong></li></ul>
    <video ref={video} muted playsInline className="check-video" hidden={!running && !starting} aria-label={t.cameraTest} />
    {error && <div className="staff-error" role="alert"><strong>{error.title}</strong><p>{error.help}</p></div>}
    <div className="staff-actions"><button disabled={starting} onClick={() => void start()}>{starting ? t.loading : t.runCameraCheck}</button>{(running || starting) && <button onClick={stop}>{t.stopCheck}</button>}</div>
    <p role="status">{ready ? `✓ ${t.demoReady}` : (t.notReady)}</p>
    <fieldset className="audio-check"><legend>{t.audioCheck}</legend><label><input type="checkbox" checked={sound} onChange={event=>{setSound(event.target.checked); if(!event.target.checked) window.speechSynthesis?.cancel();}}/>{t.enableTestSound}</label><button disabled={!sound} onClick={()=>{if(!window.speechSynthesis || !('SpeechSynthesisUtterance' in window)){setAudioStatus('speechUnavailable');return;} const utterance=new SpeechSynthesisUtterance(t.audioTestMessage); utterance.lang=ru?'ru-RU':'en-US'; utterance.onerror=()=>setAudioStatus('audioFailed'); window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);setAudioStatus('audioConfirm');}}>{t.playTestSound}</button><p role="status">{audioStatus ? t[audioStatus] : ''}</p></fieldset>
    <p><a href="/dashboard/quality/camera-test">{t.cameraQa} →</a></p><small>{buildLabel}</small>
  </section>;
}
