import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { acknowledgeRequest, completeRequest, sendQuickReply, askQuestion, createPatient, updatePatient, type PatientRecord, type RequestRecord } from '../api';
import { QUESTIONS, getQuestion } from '../modes/dialog';
import { getHintText, getText } from '../ui/i18n';
import { LanguageSwitcher } from '../ui/shared/LanguageSwitcher';
import { ThemeToggle, useTheme } from '../ui/shared/ThemeToggle';
import { useUiStore } from './uiStore';
import { useStaffData, useClock, staffApi, isOpen, isUrgent, elapsed, navigate } from './staffData';
import { CameraQaPage } from './CameraQaPage';
import { SessionLinks } from './SessionLinks';
import { SystemCheck } from './SystemCheck';
import { readQuality } from './quality';
import './staff.css';

type StaffData = ReturnType<typeof useStaffData>;
const Data = createContext<StaffData | null>(null);
const useData = () => useContext(Data)!;
const useCopy = () => { const locale = useUiStore(state => state.locale); return { locale, t: getText(locale).product, all: getText(locale) }; };
const date = (value: string | number, locale: string) => new Date(value).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const presentation = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';
const patientLink = (id: string) => `/patient?patientId=${encodeURIComponent(id)}${presentation() ? '&demo=1' : ''}`;
function Link({ href, children, className }: { href: string; children: ReactNode; className?: string }) { return <a href={href} className={className} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) { event.preventDefault(); navigate(href); } }}>{children}</a>; }
export function StaffShell({ active, children }: { active: 'overview' | 'requests' | 'patients' | 'dialog' | 'quality'; children: ReactNode }) {
  const { locale, t } = useCopy(); const setLocale = useUiStore(state => state.setLocale); const [theme, setTheme] = useTheme(); const data = useContext(Data);
  return <div className="signal-staff" lang={locale}>
    <a className="skip-link" href="#staff-content">{t.station}</a>
    <aside className="signal-staff__sidebar"><Link className="signal-staff__logo" href="/">✳ SIGNAL<span>it</span></Link><p className="sidebar-caption">{t.station}</p>
      <nav aria-label={t.station}>{(['overview', 'requests', 'patients', 'dialog', 'quality'] as const).map((key, index) => <a key={key} href={key === 'overview' ? '/dashboard' : `/dashboard/${key}`} aria-current={key === active ? 'page' : undefined} onClick={event => { if (!event.ctrlKey && !event.metaKey) { event.preventDefault(); navigate(key === 'overview' ? '/dashboard' : `/dashboard/${key}`); } }}><span className="nav-index" aria-hidden="true">0{index + 1}</span>{t[key]}{key === 'requests' && !!data?.requests.filter(isOpen).length && <b>{data.requests.filter(isOpen).length}</b>}</a>)}</nav>
      <footer className="signal-staff__footer"><Link href="/dashboard/patients/new">+ {t.addPatient}</Link><small>{t.prototype}</small></footer>
    </aside>
    <div className="staff-workspace"><header className="staff-topbar"><span>{t.station}</span><div>{data && <button aria-pressed={data.alertSound} onClick={data.toggleAlertSound}>{t.notificationSound}: {data.alertSound ? t.soundOn : t.soundOff}</button>}<span className={`connection connection--${data?.connection ?? 'connecting'}`} role="status">● {t[data?.connection ?? 'connecting']}</span><LanguageSwitcher locale={locale} onChange={setLocale} label={allLanguage(locale)} /><ThemeToggle locale={locale} theme={theme} onChange={setTheme} /></div></header>
      <main tabIndex={-1} id="staff-content" className="signal-staff__main">{presentation() && <div className="presentation-panel"><strong>{t.presentation}</strong><p>{t.presentationHelp}</p><a href="/register?demo=1">{t.freshDemo} →</a></div>}{children}</main>{data?.notification && <div className="request-toast" role="status"><button aria-label={t.dismiss} onClick={data.dismissNotification}>×</button><strong>{t.newRequest} · {t.room} {data.notification.room}</strong>{getText(locale).gestures[data.notification.type].label}</div>}<footer className="prototype-footer">{t.disclaimer}</footer>
    </div>
  </div>;
}
const allLanguage = (locale: 'en' | 'ru') => getText(locale).language;
export function StaffRoutes() {
  const data = useStaffData(); const path = window.location.pathname;
  const active = path.includes('/patients') ? 'patients' : path.endsWith('/dialog') ? 'dialog' : path.startsWith('/dashboard/quality') ? 'quality' : path.endsWith('/requests') ? 'requests' : 'overview';
  const detail = path.match(/^\/dashboard\/patients\/([^/]+)$/);
  return <Data.Provider value={data}><StaffShell active={active}>
    {active === 'quality' ? path.endsWith('/camera-test') ? <CameraQaPage /> : <QualityPage /> : <><DataState />{active === 'patients' ? detail && detail[1] !== 'new' ? <PatientDetailPage patientId={decodeURIComponent(detail[1])} /> : <PatientsPage /> : active === 'dialog' ? <DialogPage /> : <RequestsPage overview={active === 'overview'} />}</>}
  </StaffShell></Data.Provider>;
}
function Heading({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) { return <header className="signal-staff__heading"><div><p>SIGNALit / {useCopy().t.communication}</p><h1>{title}</h1><span>{subtitle}</span></div>{action}</header>; }
function Empty({ title, description }: { title: string; description?: string }) { return <div className="staff-empty"><span aria-hidden="true">—</span><p className="empty-title">{title}</p>{description && <p>{description}</p>}</div>; }
function DataState() { const data = useData(); const { t } = useCopy(); return <>{data.loading && <div className="loading-skeleton" role="status">{t.loading}</div>}{data.error && <div className="staff-error" role="alert">{t.loadError}<button onClick={data.refresh}>{t.retry}</button></div>}</>; }
function Status({ request }: { request: RequestRecord }) { const { all, t } = useCopy(); return <span className={`status-chip status-${request.status.toLowerCase()}`}>{request.status === 'CANCELLED' ? t.cancelled : all.dashboard.statuses[request.status]}</span>; }
function Metrics() { const { patients, requests } = useData(); const { t } = useCopy(); const open = requests.filter(isOpen); const acknowledged = requests.filter(request => request.acknowledgedAt); const average = acknowledged.length ? acknowledged.reduce((sum, request) => sum + Date.parse(request.acknowledgedAt!) - Date.parse(request.createdAt), 0) / acknowledged.length : null;
  return <dl className="staff-metrics">{[[t.activePatients, patients.filter(patient => patient.active).length], [t.openRequests, open.length], [t.urgentRequests, open.filter(isUrgent).length], [t.responseTime, average === null ? '—' : elapsed(0, average)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
function RequestsPage({ overview }: { overview: boolean }) {
  const { t, all } = useCopy(); const data = useData(); const [filter, setFilter] = useState('open'); const [search, setSearch] = useState(''); const [selected, setSelected] = useState<string | null>(null);
  const names = new Map(data.patients.map(patient => [patient.id, patient.displayName]));
  const visible = data.requests.filter(request => (filter === 'all' || filter === 'open' && request.status === 'PENDING' || filter === 'urgent' && request.status === 'PENDING' && isUrgent(request) || filter === 'acknowledged' && request.status === 'ACKNOWLEDGED' || filter === 'completed' && request.status === 'COMPLETED') && `${names.get(request.patientId) ?? ''} ${request.room} ${request.type} ${all.gestures[request.type].label}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => Number(b.status === 'PENDING') - Number(a.status === 'PENDING') || Number(isUrgent(b)) - Number(isUrgent(a)) || Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const current = data.requests.find(request => request.id === selected) ?? visible[0];
  useEffect(() => { if (!selected && current) setSelected(current.id); }, [selected, current?.id]);
  return <section><Heading title={overview ? t.station : t.requests} subtitle={overview ? t.stationSubtitle : t.queueSubtitle} action={<button onClick={data.refresh}>{t.refresh}</button>} />{overview && <><Metrics /><p className="muted">{t.noPresence}</p></>}
    <div className="queue-toolbar"><label className="search-field"><span>{t.searchRequests}</span><input type="search" placeholder={t.searchRequests} value={search} onChange={event => setSearch(event.target.value)} /></label><div className="filter-tabs" aria-label={t.requests}>{(['open', 'urgent', 'acknowledged', 'completed', 'all'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{t[value]}</button>)}</div></div>
    <div className="queue-workspace"><section className="request-list" aria-label={t.requests}><div className="panel-title"><h2>{t.requests}</h2><span>{visible.length}</span></div>{!visible.length && !data.loading && <Empty title={search ? t.noMatches : t.noRequests} description={t.noRequestsHelp} />}
      {visible.map(request => <button className={`queue-row ${current?.id === request.id ? 'is-selected' : ''}`} key={request.id} aria-pressed={current?.id === request.id} onClick={() => setSelected(request.id)}><div className="queue-row__identity"><strong>{t.room} {request.room}</strong><span>{names.get(request.patientId) ?? '—'}</span></div><div className="queue-row__intent"><strong>{all.gestures[request.type].label}</strong><span>{isUrgent(request) ? <b className="urgency">{t.urgent}</b> : t.routine}</span></div><div className="queue-row__state"><Status request={request} /><WaitTime request={request} /></div></button>)}
    </section><aside className="request-detail" aria-label={t.requestDetail}>{current ? <RequestDetail key={current.id} request={current} /> : <Empty title={t.selectRequest} />}</aside></div>
  </section>;
}
function WaitTime({ request }: { request: RequestRecord }) {
  const now = useClock(); const { t } = useCopy();
  const seconds = Math.max(0, Math.floor(((request.completedAt || request.cancelledAt) ? Date.parse((request.completedAt || request.cancelledAt)!) : now) - Date.parse(request.createdAt)) / 1000);
  return <time aria-label={t.timeSinceSent}>{Math.floor(seconds / 60)} {t.minutesShort} {Math.floor(seconds % 60)} {t.secondsShort}</time>;
}
function RequestDetail({ request }: { request: RequestRecord }) {
  const { t, all, locale } = useCopy(); const data = useData(); const patient = data.patients.find(value => value.id === request.patientId); const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const replyKeys = useRef<Partial<Record<'COMING' | 'WAIT', string>>>({});
  const reply = async (code: 'COMING' | 'WAIT') => { const key = replyKeys.current[code] ??= crypto.randomUUID(); await sendQuickReply(staffApi, request.id, code, key); delete replyKeys.current[code]; };
  const action = async (fn: () => Promise<unknown>) => { if (busy) return; setBusy(true); setError(false); try { await fn(); data.refresh(); } catch { setError(true); data.refresh(); } finally { setBusy(false); } };
  return <><div className="panel-title"><h2>{t.requestDetail}</h2><Status request={request} /></div><div className="detail-body"><span className={isUrgent(request) ? 'urgency' : 'muted'}>{isUrgent(request) ? t.urgency : t.routine}</span><h2 className="detail-intent">{all.gestures[request.type].icon} {all.gestures[request.type].label}</h2><Link href={`/dashboard/patients/${encodeURIComponent(request.patientId)}`}>{patient?.displayName ?? t.patient}</Link><p>{t.room} {request.room}</p>
    <ol className="request-timeline"><li className="reached"><strong>{t.sent}</strong><time>{date(request.createdAt, locale)}</time></li><li className={request.acknowledgedAt ? 'reached' : ''}><strong>{t.seen}</strong><time>{request.acknowledgedAt ? date(request.acknowledgedAt, locale) : '—'}</time></li>{request.replies?.map(reply => <li className="reached" key={reply.id}><strong>{reply.code === 'COMING' ? t.coming : t.wait}</strong><time>{date(reply.createdAt, locale)}</time></li>)}{!request.replies?.length && request.quickReply && <li className="reached"><strong>{request.quickReply === 'COMING' ? t.coming : t.wait}</strong><span>{t.legacyReply}</span></li>}<li className={request.completedAt ? 'reached' : ''}><strong>{request.status === 'CANCELLED' ? t.cancelled : t.done}</strong><time>{request.completedAt || request.cancelledAt ? date((request.completedAt || request.cancelledAt)!, locale) : '—'}</time></li></ol><div className="detail-recent">{data.dialog.filter(event => event.patientId === request.patientId).slice(-2).map(event => <p key={event.id}><small>{date(event.createdAt, locale)}</small><br />{event.kind === 'QUESTION' ? getQuestion(event.questionId, locale) : all.gestures[event.answer ?? 'YES'].label}</p>)}</div>
    {error && <p className="staff-error" role="alert">{t.actionError}</p>}<div className="detail-actions">{request.status === 'PENDING' && <button className="staff-primary" disabled={busy} onClick={() => void action(() => acknowledgeRequest(staffApi, request.id))}>{t.acknowledge}</button>}{isOpen(request) && <><span>{t.quickReply}</span><div><button disabled={busy} onClick={() => void action(() => reply('COMING'))}>{t.coming}</button><button disabled={busy} onClick={() => void action(() => reply('WAIT'))}>{t.wait}</button></div></>}{request.status === 'ACKNOWLEDGED' && <button className="staff-primary" disabled={busy} onClick={() => void action(() => completeRequest(staffApi, request.id))}>{t.complete}</button>}</div>
    <Link className="detail-conversation-link" href={`/dashboard/dialog?patientId=${encodeURIComponent(request.patientId)}`}>{t.dialog} →</Link></div></>;
}
function PatientsPage() {
  const { patients, requests, refresh } = useData(); const { t } = useCopy(); const [filter, setFilter] = useState('active'); const [search, setSearch] = useState(''); const [adding, setAdding] = useState(window.location.pathname.endsWith('/new')); const [created, setCreated] = useState<PatientRecord | null>(null);
  useEffect(() => { if (window.location.pathname.endsWith('/new')) setAdding(true); }, [window.location.pathname]);
  const visible = patients.filter(patient => (filter === 'all' || (filter === 'active' ? patient.active : !patient.active)) && `${patient.displayName} ${patient.room}`.toLowerCase().includes(search.toLowerCase()));
  return <section><Heading title={t.patients} subtitle={t.patientsSubtitle} action={<button className="staff-primary" onClick={() => setAdding(!adding)}>+ {t.addPatient}</button>} />{adding && <PatientForm onSaved={patient => { setAdding(false); setCreated(patient); refresh(); }} onCancel={() => setAdding(false)} />}{created && <SessionReady patient={created} />}
    <div className="queue-toolbar"><input aria-label={t.search} placeholder={t.search} value={search} onChange={event => setSearch(event.target.value)} /><div className="filter-tabs">{(['active', 'inactive', 'all'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{t[value]}</button>)}</div></div>
    <div className="patient-table">{visible.map(patient => <article className="patient-row" key={patient.id}><div className="room-tile">{patient.room}</div><div><Link href={`/dashboard/patients/${encodeURIComponent(patient.id)}`}>{patient.displayName}</Link><p>{t.room} {patient.room} · {patient.active ? t.active : t.inactive}</p></div><span>{requests.filter(request => request.patientId === patient.id && isOpen(request)).length} {t.openRequests.toLowerCase()}</span><a href={patientLink(patient.id)}>{t.openPatient} ↗</a></article>)}{!visible.length && <Empty title={t.noPatients} description={t.noPatientsHelp} />}</div>
  </section>;
}
export function PatientForm({ patient, onSaved, onCancel }: { patient?: PatientRecord; onSaved: (patient: PatientRecord) => void; onCancel?: () => void }) {
  const { t } = useCopy(); const [displayName, setDisplayName] = useState(patient?.displayName ?? (presentation() ? t.sampleName : '')); const [room, setRoom] = useState(patient?.room ?? (presentation() ? '204' : '')); const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (busy) return; setBusy(true); setError(false); try { const value = patient ? await updatePatient(staffApi, patient.id, { displayName: displayName.trim(), room: room.trim() }) : await createPatient(staffApi, { displayName: displayName.trim(), room: room.trim() }); onSaved(value); } catch { setError(true); } finally { setBusy(false); } };
  return <form className="signal-staff-form" onSubmit={submit}><label>{t.name}<input required maxLength={100} value={displayName} onChange={event => setDisplayName(event.target.value)} /></label><label>{t.room}<input required maxLength={30} value={room} onChange={event => setRoom(event.target.value)} /></label>{error && <p role="alert" className="staff-error">{t.actionError}</p>}<div><button className="staff-primary" disabled={busy}>{busy ? t.saving : patient ? t.save : t.create}</button>{onCancel && <button type="button" onClick={onCancel}>{t.cancel}</button>}</div></form>;
}
export function SessionReady({ patient }: { patient: PatientRecord }) {
  const { t } = useCopy(); const patientUrl = new URL(patientLink(patient.id), window.location.origin).href;
  const staffPath = `/dashboard/requests${presentation() ? `?demo=1&patientId=${encodeURIComponent(patient.id)}` : ''}`;
  return <section className="session-ready">
    <div className="session-ready__header">
      <strong>✓ {t.sessionReady}</strong>
      <p>{patient.displayName} · {t.room} {patient.room}</p>
    </div>
    <div>
      <a className="session-btn-main" href={patientLink(patient.id)}>{t.openPatient} ↗</a>
    </div>
    <SessionLinks patientUrl={patientUrl} />
    <div className="session-ready__actions">
      <a className="session-btn-action" href={staffPath}>{t.demoQueue} →</a>
      <a className="session-btn-action" href={`/dashboard/quality${presentation() ? `?demo=1&patientId=${encodeURIComponent(patient.id)}` : ''}`}>{t.demoCheck} →</a>
    </div>
  </section>;
}
function PatientDetailPage({ patientId }: { patientId: string }) {
  const data = useData(); const { t, all, locale } = useCopy(); const [editing, setEditing] = useState(false); const [error, setError] = useState(false); const [busy, setBusy] = useState(false); const patient = data.patients.find(value => value.id === patientId); const requests = data.requests.filter(request => request.patientId === patientId); const last = [...requests.flatMap(request => [request.createdAt, request.acknowledgedAt, request.completedAt].filter((value): value is string => Boolean(value))), ...data.dialog.filter(event => event.patientId === patientId).map(event => event.createdAt)].sort().at(-1);
  if (!patient) return data.loading ? null : <Empty title={t.noPatients} />;
  return <section><Link href="/dashboard/patients">← {t.back}</Link><Heading title={patient.displayName} subtitle={`${t.room} ${patient.room} · ${patient.active ? t.active : t.inactive}`} action={<a className="staff-primary" href={patientLink(patient.id)}>{t.openPatient}</a>} />
    <dl className="staff-metrics"><div><dt>{t.sessionStarted}</dt><dd className="metric-date">{date(patient.createdAt, locale)}</dd></div><div><dt>{t.openRequests}</dt><dd>{requests.filter(isOpen).length}</dd></div><div><dt>{t.lastInteraction}</dt><dd className="metric-date">{last ? date(last, locale) : '—'}</dd></div></dl>
    <div className="staff-actions"><button onClick={() => setEditing(!editing)}>{t.edit}</button>{patient.active && <button className="danger-action" disabled={busy} onClick={async () => { setBusy(true); try { await updatePatient(staffApi, patient.id, { active: false }); data.refresh(); } catch { setError(true); } finally { setBusy(false); } }}>{t.deactivate}</button>}</div>{error && <p role="alert" className="staff-error">{t.actionError}</p>}{editing && <PatientForm patient={patient} onSaved={() => { setEditing(false); data.refresh(); }} onCancel={() => setEditing(false)} />}
    <div className="profile-grid"><section className="staff-panel"><div className="panel-title"><h2>{t.requests}</h2></div>{requests.map(request => <div className="history-row" key={request.id}><strong>{all.gestures[request.type].label}</strong><time>{date(request.createdAt, locale)}</time><Status request={request} /></div>)}{!requests.length && <Empty title={t.noRequests} />}</section><section className="staff-panel"><Conversation patientId={patient.id} /></section></div>
  </section>;
}
function DialogPage() { const data = useData(); const { t } = useCopy(); const [selected, setSelected] = useState(new URLSearchParams(window.location.search).get('patientId') ?? ''); const [search, setSearch] = useState(''); const patient = data.patients.find(value => value.id === selected);
  return <section><Heading title={t.dialog} subtitle={t.dialogSubtitle} /><div className="conversation-workspace"><aside className="conversation-list"><input aria-label={t.search} placeholder={t.search} value={search} onChange={event => setSearch(event.target.value)} />{data.patients.filter(value => `${value.displayName} ${value.room}`.toLowerCase().includes(search.toLowerCase())).map(value => <button key={value.id} aria-pressed={value.id === selected} onClick={() => setSelected(value.id)}><strong>{value.displayName}</strong><span>{t.room} {value.room}</span></button>)}</aside><section className="staff-panel">{patient ? <><div className="panel-title"><h2>{patient.displayName}</h2><span>{t.room} {patient.room}</span></div><Conversation key={patient.id} patientId={patient.id} /></> : <Empty title={t.chooseConversation} description={t.noDialog} />}</section></div></section>;
}
function Conversation({ patientId }: { patientId: string }) {
  const data = useData(); const { t, all, locale } = useCopy(); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<'error' | 'sent' | null>(null); const [category, setCategory] = useState('basic');
  const events = data.dialog.filter(event => event.patientId === patientId).map(event => ({ id: event.id, time: event.createdAt, kind: event.kind === 'QUESTION' ? 'nurse' : 'patient', text: event.kind === 'QUESTION' ? getQuestion(event.questionId, locale) ?? t.questionLibrary : all.gestures[event.answer ?? 'YES'].label }));
  for (const request of data.requests.filter(request => request.patientId === patientId)) {
    events.push({ id: request.id, time: request.createdAt, kind: 'system', text: `${all.gestures[request.type].label} · ${t.sent}` });
    if (request.acknowledgedAt) events.push({ id: `${request.id}:ack`, time: request.acknowledgedAt, kind: 'system', text: `${all.gestures[request.type].label} · ${t.seen}` });
    if (request.completedAt) events.push({ id: `${request.id}:done`, time: request.completedAt, kind: 'system', text: `${all.gestures[request.type].label} · ${t.done}` });
    if (request.status === 'CANCELLED') events.push({ id: `${request.id}:cancel`, time: request.cancelledAt ?? '', kind: 'system', text: `${all.gestures[request.type].label} · ${t.cancelled}` });
    for (const reply of request.replies ?? []) events.push({ id: reply.id, time: reply.createdAt, kind: 'nurse', text: reply.code === 'COMING' ? t.coming : t.wait });
    if (!request.replies?.length && request.quickReply) events.push({ id: `${request.id}:reply`, time: '', kind: 'nurse', text: request.quickReply === 'COMING' ? t.coming : t.wait });
  }
  events.sort((a, b) => (a.time || 'z').localeCompare(b.time || 'z'));
  const groups: Record<string, string[]> = { basic: ['okay', 'help'], comfort: ['pain', 'cold', 'dizzy', 'breathe'], needs: ['water', 'toilet'] };
  return <div className="conversation"><h2>{t.communication}</h2><ol className="conversation-events" aria-live="polite">{events.map(event => <li key={event.id} className={`message message--${event.kind}`}><div><strong>{t[event.kind as 'nurse' | 'patient' | 'system']}</strong>{event.time && <time>{date(event.time, locale)}</time>}</div><p>{event.text}</p></li>)}</ol>{!events.length && <Empty title={t.noHistory} description={t.noDialog} />}<section className="question-library"><h3>{t.questionLibrary}</h3><div className="filter-tabs">{(['basic', 'comfort', 'needs'] as const).map(key => <button key={key} aria-pressed={category === key} onClick={() => setCategory(key)}>{t[key]}</button>)}</div><div className="question-buttons">{QUESTIONS.filter(question => groups[category].includes(question.id)).map(question => <button key={question.id} disabled={busy} onClick={async () => { setBusy(true); setNotice(null); try { await askQuestion(staffApi, patientId, question.id); setNotice('sent'); data.refresh(); } catch { setNotice('error'); } finally { setBusy(false); } }}>{question[locale]}</button>)}</div>{notice && <p role={notice === 'error' ? 'alert' : 'status'}>{notice === 'error' ? t.actionError : t.questionSent}</p>}</section></div>;
}
function QualityPage() {
  const { t, all, locale } = useCopy(); const now = useClock(); const [quality, setQuality] = useState(readQuality);
  useEffect(() => { setQuality(readQuality()); }, [now]);
  return <section><Heading title={t.quality} subtitle={t.qualitySubtitle} /><div className="quality-note"><strong>{t.localMetrics}</strong><p>{t.localMetricsHelp}</p>{quality && <button onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify({ source: 'real-camera-local-aggregates', ...quality }, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'signalit-measurements.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>{t.exportQuality}</button>}</div>{quality ? <><p className="muted">{t.updated}: {date(quality.updatedAt, locale)}</p><dl className="staff-metrics quality-metrics">{[[t.fps, now - quality.updatedAt > 5000 ? '—' : quality.fps.toFixed(1)], [t.visible, `${(quality.visibleFrames / quality.frames * 100).toFixed(1)}%`], [t.confirmed, quality.confirmed], [t.interrupted, quality.interruptedHolds], [t.confirmationTime, quality.timedConfirmations ? `${(quality.confirmationMs / quality.timedConfirmations / 1000).toFixed(2)} ${t.secondsShort}` : '—']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="profile-grid"><section className="staff-panel"><div className="panel-title"><h2>{t.corrections}</h2></div>{Object.entries(quality.corrections).map(([key, count]) => { const [code, finger] = key.split(':'); return <p className="history-row" key={key}><span>{getHintText(locale, { code, layer: 3, severity: 'info', params: { finger } })}</span><strong>{count}</strong></p>; })}</section><section className="staff-panel"><div className="panel-title"><h2>{t.gestureCounts}</h2></div>{Object.entries(quality.gestures).map(([gesture, count]) => <p className="history-row" key={gesture}><span>{all.gestures[gesture as keyof typeof all.gestures]?.label ?? gesture}</span><strong>{count}</strong></p>)}</section></div></> : <Empty title={t.noMeasurements} description={t.noMeasurementsHelp} />}
    <SystemCheck connection={useData().connection} />
  </section>;
}
