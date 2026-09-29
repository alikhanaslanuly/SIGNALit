import type { GestureId } from '../../core/gestures';
import { getText, type Locale } from '../i18n';
import { GestureMark } from './GestureMark';

export function GestureInstructionCard({ gesture, locale }: { gesture: GestureId; locale: Locale }) {
  const text = getText(locale);
  return <div className="signal-gesture-instruction">
    <GestureMark gesture={gesture} locale={locale} />
    <p className="signal-gesture-instruction__hint">{text.gestureHints[gesture]}</p>
  </div>;
}
