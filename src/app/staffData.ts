import { useCallback, useEffect, useRef, useState } from 'react';
import { playFeedbackSound } from '../audio/feedback';
import { io } from 'socket.io-client';
import { ApiClient, defaultApiUrl, getDialog, listPatients, listRequests, type PatientRecord, type RequestRecord, type DialogRecord } from '../api';
export const staffApi = new ApiClient({ baseUrl: defaultApiUrl() });
export type Connection = 'connecting' | 'connected' | 'reconnecting' | 'offline';
export function useStaffData() {
  const [notification, setNotification] = useState<RequestRecord | null>(null);
  const [alertSound, setAlertSound] = useState(() => { try { return localStorage.getItem('signal.staffSound') === 'true'; } catch { return false; } });
  const sound = useRef(alertSound); sound.current = alertSound;
  const seenRequests = useRef(new Set<string>()); const hydrated = useRef(false);
  const demoId = new URLSearchParams(window.location.search).get('demo') === '1' ? new URLSearchParams(window.location.search).get('patientId') : null;
  const toggleAlertSound = () => { const next = !alertSound; setAlertSound(next); try { localStorage.setItem('signal.staffSound', String(next)); } catch { /* Optional preference. */ } if (next) playFeedbackSound('success'); };
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [dialog, setDialog] = useState<DialogRecord[]>([]);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const socket = io(defaultApiUrl().replace(/\/api\/?$/, ''));
    let timer: ReturnType<typeof setTimeout>;
    const changed = () => { clearTimeout(timer); timer = setTimeout(refresh, 40); };
    socket.on('REQUEST_CREATED', (request: RequestRecord) => {
      if (demoId && request.patientId !== demoId) return;
      if (hydrated.current && !seenRequests.current.has(request.id)) { setNotification(request); if (sound.current) playFeedbackSound(isUrgent(request) ? 'urgent' : 'request'); }
      seenRequests.current.add(request.id);
    });
    socket.on('connect', () => { socket.emit('join:nurses', refresh); setConnection('connected'); refresh(); });
    socket.on('disconnect', () => setConnection('reconnecting'));
    socket.on('connect_error', () => setConnection('offline'));
    for (const event of ['PATIENT_CREATED', 'PATIENT_UPDATED', 'REQUEST_CREATED', 'REQUEST_UPDATED', 'QUICK_REPLY_CREATED', 'QUESTION_CREATED', 'ANSWER_CREATED']) socket.on(event, changed);
    return () => { clearTimeout(timer); socket.disconnect(); };
  }, [refresh, demoId]);
  useEffect(() => {
    let active = true;
    Promise.all([listPatients(staffApi), listRequests(staffApi, { status: 'all' })]).then(async ([nextPatients, nextRequests]) => {
      if (demoId) { nextPatients = nextPatients.filter(patient => patient.id === demoId); nextRequests = nextRequests.filter(request => request.patientId === demoId); }
      const histories = await Promise.all(nextPatients.map(patient => getDialog(staffApi, patient.id)));
      if (!active) return;
      for (const request of nextRequests) seenRequests.current.add(request.id);
      hydrated.current = true;
      setPatients(nextPatients); setRequests(nextRequests); setDialog(histories.flat()); setError(false);
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision, demoId]);
  return { patients, requests, dialog, connection, loading, error, refresh, notification, dismissNotification: () => setNotification(null), alertSound, toggleAlertSound };
}
export function useClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return now;
}
export const isOpen = (request: RequestRecord) => request.status === 'PENDING' || request.status === 'ACKNOWLEDGED';
export const isUrgent = (request: RequestRecord) => request.type === 'HELP' || request.type === 'PAIN';
export const elapsed = (from: string | number, to = Date.now()) => {
  const seconds = Math.max(0, Math.floor((to - (typeof from === 'string' ? Date.parse(from) : from)) / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
};
export function navigate(path: string) { if (path.startsWith('/dashboard')) { const query = new URLSearchParams(window.location.search); if (query.get('demo') === '1') { const next = new URL(path, window.location.origin); next.searchParams.set('demo', '1'); if (query.get('patientId') && !next.searchParams.has('patientId')) next.searchParams.set('patientId', query.get('patientId')!); path = next.pathname + next.search; } } window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); }
