import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { GestureId } from '../../../core/gestures';
import type { Hint } from '../../../core/errors';
import type { TrainingState } from '../../../modes/training';
import { PatientExperience, type PatientViewState } from '../PatientExperience';
import type { Locale } from '../../i18n';
import './preview.css';

const recognition = (gesture: GestureId | null, state: 'none' | 'holding' | 'confirmed' = 'none') =>
  ({ gesture, confidence: gesture ? 0.9 : 0, state, holdProgress: state === 'holding' ? 0.62 : state === 'confirmed' ? 1 : 0 });
const training: TrainingState = { currentGesture: 'WATER', currentIndex: 4, total: 6, startedAt: 0, gestureStartedAt: 0, hintsShown: 2, correctedErrors: 1, completed: false };
const pinkyHint: Hint = { code: 'FOLD_FINGER', layer: 3, severity: 'warn', params: { finger: 'pinky' }, targetGesture: 'WATER' };

function Preview() {
  const [locale, setLocale] = useState<Locale>('ru');
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [state, setState] = useState<PatientViewState>({ screen: 'start' });
  const examples: { label: string; state: PatientViewState }[] = [
    { label: 'Start', state: { screen: 'start' } },
    { label: 'Calibration', state: { screen: 'calibration', target: 'YES', step: 1, progress: 0.42, recognition: recognition('YES', 'holding') } },
    { label: 'Training + hint', state: { screen: 'training', training, recognition: recognition(null), hint: pinkyHint } },
    { label: 'Training + success', state: { screen: 'training', training, recognition: recognition('WATER', 'confirmed'), feedback: 'WATER' } },
    { label: 'Question', state: { screen: 'dialog', question: locale === 'ru' ? 'Вам больно?' : 'Are you in pain?', recognition: recognition(null) } },
    { label: 'Confirm request', state: { screen: 'dialog', confirmation: 'WATER', recognition: recognition(null) } },
    { label: 'Urgent request', state: { screen: 'dialog', urgent: { gesture: 'HELP', secondsRemaining: 3 }, recognition: recognition(null) } },
    { label: 'Acknowledged', state: { screen: 'dialog', request: { gesture: 'TOILET', status: 'ACKNOWLEDGED' }, recognition: recognition(null) } },
    { label: 'Results', state: { screen: 'results', result: { startedAt: 0, finishedAt: 8400, totalGestures: 6, completedGestures: 6, hintsShown: 4, correctedErrors: 3, averageReactionMs: 1400 }, best: true } },
  ];
  return <>
    <aside className="signal-preview-tools" aria-label="Development preview">
      <strong>UI preview</strong>
      {examples.map(example => <button type="button" key={example.label} onClick={() => setState(example.state)}>{example.label}</button>)}
    </aside>
    <PatientExperience state={state} locale={locale} speechEnabled={speechEnabled} onStart={() => setState(examples[1].state)}
      onLocaleChange={setLocale} onSpeechToggle={() => setSpeechEnabled(value => !value)}
      onStartDialog={() => setState(examples[4].state)} onRepeatTraining={() => setState(examples[2].state)} />
  </>;
}

createRoot(document.getElementById('root')!).render(<Preview />);
