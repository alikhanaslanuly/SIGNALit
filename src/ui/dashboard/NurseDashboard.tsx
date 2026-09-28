import type { Status } from '../../contracts';
import { QUESTIONS, getQuestion } from '../../modes/dialog';
import { sortedRequests, type DashboardState, type NurseRequest } from './model';
import './dashboard.css';

export interface NurseDashboardProps {
  state: DashboardState;
  now: number;
  onQuestion: (questionId: string) => void;
  onStatus: (requestId: string, status: Extract<Status, 'ACKNOWLEDGED' | 'COMPLETED'>) => void;
}

const waitTime = (from: number, now: number) => {
  const seconds = Math.max(0, Math.floor((now - from) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};
const icon: Record<NurseRequest['gesture'], string> = { HELP: '✋', PAIN: '✊', TOILET: '🚻', WATER: '💧' };

export function NurseDashboard({ state, now, onQuestion, onStatus }: NurseDashboardProps) {
  const requests = sortedRequests(state);
  return <main className="signal-dashboard">
    <header className="signal-dashboard__header"><div><p>Nurse station</p><h1>Patient requests</h1></div><span className="signal-dashboard__count">{requests.filter(request => request.status !== 'COMPLETED').length} active</span></header>
    <section className="signal-dashboard__section" aria-label="Patient requests" aria-live="polite">
      {requests.length === 0 && <p className="signal-dashboard__empty">No requests yet. New patient signals appear here.</p>}
      {requests.map(request => <article key={request.id} className={`signal-request-card signal-request-card--${request.gesture.toLowerCase()}`}>
        <div className="signal-request-card__top"><span>ROOM {request.room}</span><span className="signal-request-card__status">{request.status}</span></div>
        <div className="signal-request-card__main"><span aria-hidden="true">{icon[request.gesture]}</span><strong>{request.gesture}</strong></div>
        <div className="signal-request-card__foot"><span>Waiting {waitTime(request.ts, now)}</span>
          {request.status === 'PENDING' && <button type="button" onClick={() => onStatus(request.id, 'ACKNOWLEDGED')}>Acknowledge</button>}
          {request.status === 'ACKNOWLEDGED' && <button type="button" onClick={() => onStatus(request.id, 'COMPLETED')}>Complete</button>}
        </div>
      </article>)}
    </section>
    <section className="signal-dashboard__section">
      <h2>Question library</h2><p className="signal-dashboard__help">Ask a question the patient can answer with 👍 or 👎.</p>
      <div className="signal-question-list">{QUESTIONS.map(question => <button type="button" key={question.id} onClick={() => onQuestion(question.id)}>{question.en}</button>)}</div>
    </section>
    <section className="signal-dashboard__section"><h2>Recent dialog</h2>
      {state.history.length === 0 ? <p className="signal-dashboard__empty">Questions and answers will appear here.</p> :
        <ol className="signal-history">{state.history.map(message => <li key={message.id}>
          <span>ROOM {message.room}</span>
          <strong>{message.kind === 'QUESTION' ? 'Nurse:' : 'Patient:'}</strong>
          <span>{message.kind === 'QUESTION' ? getQuestion(String(message.payload.questionId), 'en') ?? 'Question' : String(message.payload.answer)}</span>
        </li>)}</ol>}
    </section>
  </main>;
}
