import type { Locale } from '../ui/i18n';

export type FeedbackSound = 'success' | 'warning' | 'request' | 'urgent';

/** Short local tones. Call after a user gesture or action; no audio files are fetched. */
export function playFeedbackSound(kind: FeedbackSound): void {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime;
  const frequency = kind === 'urgent' ? 520 : kind === 'warning' ? 330 : kind === 'request' ? 670 : 790;
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.075, start + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + (kind === 'urgent' ? 0.28 : 0.16));
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + (kind === 'urgent' ? 0.3 : 0.18));
  oscillator.onended = () => { void context.close(); };
}

/** Optional Web Speech API output; the visual interface remains independent. */
export function speakFeedback(text: string, locale: Locale): void {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale === 'ru' ? 'ru-RU' : 'en-US';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
