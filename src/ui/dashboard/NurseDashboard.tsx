import type { Status } from '../../contracts';
import { QUESTIONS, getQuestion } from '../../modes/dialog';
import { sortedRequests, type DashboardState, type NurseRequest } from './model';
import './dashboard.css';
import type { Locale } from '../i18n';
import { getText } from '../i18n';
import { ThemeToggle, useTheme } from '../shared/ThemeToggle';

export interface NurseDashboardProps {
  state: DashboardState;
  now: number;
  onQuestion: (questionId: string) => void;
  onStatus: (requestId: string, status: Extract<Status, 'ACKNOWLEDGED' | 'COMPLETED'>) => void;
  onQuickReply?: (requestId: string, code: 'COMING' | 'WAIT') => void;
  filter?: 'all' | 'active' | 'completed';
  onFilter?: (filter: 'all' | 'active' | 'completed') => void;
  loading?: boolean;
  error?: boolean;
  locale?: Locale;
  patientNames?: Record<string, string>;
  onLocaleChange?: (locale: Locale) => void;
  onRetry?: () => void;
  activePatients?: number;
}

const waitTime = (from: number, now: number) => {
  const seconds = Math.max(0, Math.floor((now - from) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};
const icon: Record<NurseRequest['gesture'], string> = { HELP: '✋', PAIN: '✊', TOILET: '🚻', WATER: '💧' };

export function NurseDashboard({ state, now, onQuestion, onStatus, onQuickReply, filter = 'all', onFilter, loading = false, error = false, locale = 'en', patientNames = {}, onLocaleChange, onRetry, activePatients }: NurseDashboardProps) {
  const t = getText(locale).dashboard;
  const [theme, setTheme] = useTheme();
  const requests = sortedRequests(state);
  return <main className="signal-dashboard">
    <header className="signal-dashboard__header"><div><p>SIGNAL</p><h1>{t.station}</h1></div><div className="signal-dashboard__header-actions">{onLocaleChange && <div className="signal-dashboard__locale"><button type="button" aria-pressed={locale === 'ru'} onClick={() => onLocaleChange('ru')}>RU</button><button type="button" aria-pressed={locale === 'en'} onClick={() => onLocaleChange('en')}>EN</button></div>}<ThemeToggle locale={locale} theme={theme} onChange={setTheme} /><span className="signal-dashboard__count" aria-live="polite">{requests.filter(request => request.status !== 'COMPLETED').length} {t.active}</span></div></header>
    {onFilter && <div className="signal-dashboard__filters" aria-label={t.requests}>{(['all', 'active', 'completed'] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => onFilter(value)}>{value === 'all' ? t.filterAll : value === 'active' ? t.filterActive : t.filterCompleted}</button>)}</div>}
    {loading && <p className="signal-dashboard__state" role="status">{locale === 'ru' ? 'Загрузка запросов…' : 'Loading requests…'}</p>}
    {error && <div className="signal-dashboard__state" role="alert"><strong>{locale === 'ru' ? 'Не удалось загрузить данные' : 'Could not load data'}</strong><span>{locale === 'ru' ? 'Проверьте соединение и повторите попытку.' : 'Check the connection and try again.'}</span>{onRetry && <button type="button" onClick={onRetry}>{locale === 'ru' ? 'Повторить' : 'Retry'}</button>}</div>}
    {typeof activePatients === 'number' && <div className="signal-dashboard__summary"><div><strong>{requests.filter(request => request.status !== 'COMPLETED').length}</strong><span>{locale === 'ru' ? 'Активных запросов' : 'Active requests'}</span></div><div><strong>{activePatients}</strong><span>{locale === 'ru' ? 'Активных пациентов' : 'Active patients'}</span></div></div>}
    <section className="signal-dashboard__section" aria-label={t.requests}>
      {requests.length === 0 && !loading && <p className="signal-dashboard__empty">{t.empty}</p>}
      {requests.map(request => <article key={request.id} className={`signal-request-card signal-request-card--${request.gesture.toLowerCase()}${request.status === 'COMPLETED' ? ' signal-request-card--completed' : ''}`}>
        <div className="signal-request-card__top"><span>{t.room.toUpperCase()} {request.room}</span><span className={`signal-request-card__status signal-request-card__status--${request.status.toLowerCase()}`} aria-live="polite">{request.status === 'CANCELLED' ? (locale === 'ru' ? 'Отменён' : 'Cancelled') : t.statuses[request.status]}</span></div>
        <div className="signal-request-card__main"><span aria-hidden="true">{icon[request.gesture]}</span><div><strong>{request.gesture}</strong>{request.patientId && patientNames[request.patientId] && <small>{patientNames[request.patientId]}</small>}</div></div>
        <div className="signal-request-card__foot"><span>{request.status === 'COMPLETED' ? `${t.resolvedIn} ${waitTime(request.ts, request.completedAt ?? now)}` : `${t.waiting} ${waitTime(request.ts, now)}`}</span>
          {request.status === 'PENDING' && <button type="button" onClick={() => onStatus(request.id, 'ACKNOWLEDGED')}>{t.acknowledge}</button>}
          {request.status === 'ACKNOWLEDGED' && <><button type="button" onClick={() => onQuickReply?.(request.id, 'COMING')}>{t.quickReplies.coming}</button><button type="button" onClick={() => onQuickReply?.(request.id, 'WAIT')}>{t.quickReplies.wait}</button><button type="button" onClick={() => onStatus(request.id, 'COMPLETED')}>{t.complete}</button></>}
        </div>
      </article>)}
    </section>
    <section className="signal-dashboard__section">
      <h2>{getText(locale).product.questionLibrary}</h2><p className="signal-dashboard__help">{t.questionHint}</p>
      <div className="signal-question-list">{QUESTIONS.map(question => <button type="button" key={question.id} onClick={() => onQuestion(question.id)}>{question[locale]}</button>)}</div>
    </section>
    <section className="signal-dashboard__section"><h2>{t.recentDialog}</h2>
      {state.history.length === 0 ? <p className="signal-dashboard__empty">{getText(locale).product.noDialog}</p> :
        <ol className="signal-history">{state.history.map(message => <li key={message.id}>
          <span>{t.room.toUpperCase()} {message.room}</span>
          <strong>{message.kind === 'QUESTION' ? t.nurse : t.patient}:</strong>
          <span>{message.kind === 'QUESTION' ? getQuestion(String(message.payload.questionId), locale) ?? t.questionLibrary : String(message.payload.answer)}</span>
        </li>)}</ol>}
    </section>
  </main>;
}
