import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PatientExperience, type PatientViewState } from './PatientExperience';

const render = (state: PatientViewState, locale: 'ru' | 'en' = 'ru') =>
  renderToStaticMarkup(<PatientExperience state={state} locale={locale} onStart={() => {}} />);
const recognition = { gesture: null, confidence: 0, state: 'none' as const, holdProgress: 0 };

describe('PatientExperience', () => {
  it('keeps a video element mounted on start and exposes one primary action', () => {
    const html = render({ screen: 'start' });
    expect(html).toContain('Включить камеру');
    expect(html.match(/<video/g)).toHaveLength(1);
    expect(html).toContain('Видео обрабатывается на вашем устройстве');
  });
  it('shows calibration target and hold progress without debug values', () => {
    const html = render({ screen: 'calibration', target: 'YES', step: 1, progress: 0.5, recognition: { gesture: 'YES', confidence: 0.9, state: 'holding', holdProgress: 0.5 } });
    expect(html).toContain('Покажите');
    expect(html).toContain('ДА');
    expect(html).toContain('Шаг 1 из 2');
    expect(html).not.toContain('confidence');
  });
  it('shows the current training gesture and a useful finger hint', () => {
    const html = render({ screen: 'training', training: { currentGesture: 'WATER', currentIndex: 4, total: 6, startedAt: 0, gestureStartedAt: 0, hintsShown: 1, correctedErrors: 0, completed: false }, recognition,
      hint: { code: 'FOLD_FINGER', layer: 3, severity: 'warn', params: { finger: 'pinky' } } });
    expect(html).toContain('Жест 5 из 6');
    expect(html).toContain('Согните мизинец');
  });
  it('shows question, confirmation, urgent countdown, and acknowledged status', () => {
    expect(render({ screen: 'dialog', recognition, question: 'Вам больно?' })).toContain('Вам больно?');
    expect(render({ screen: 'dialog', recognition, confirmation: 'WATER' })).toContain('Отправить запрос?');
    expect(render({ screen: 'dialog', recognition, urgent: { gesture: 'HELP', secondsRemaining: 3 } })).toContain('Отмена: 👎');
    expect(render({ screen: 'dialog', recognition, request: { gesture: 'TOILET', status: 'ACKNOWLEDGED' } })).toContain('Медсестра увидела запрос');
  });
  it('renders results and English copy', () => {
    const result = { startedAt: 0, finishedAt: 9000, totalGestures: 6, completedGestures: 6, hintsShown: 4, correctedErrors: 3, averageReactionMs: 1400 };
    expect(render({ screen: 'results', result, best: true })).toContain('6 / 6');
    expect(render({ screen: 'start' }, 'en')).toContain('Turn on camera');
  });
});
