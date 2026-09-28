import type { GestureId } from '../../core/gestures';
import { getText, type Locale } from '../i18n';

export function GestureMark({ gesture, locale, compact = false }: { gesture: GestureId; locale: Locale; compact?: boolean }) {
  const { icon, label } = getText(locale).gestures[gesture];
  return <span className={compact ? 'signal-gesture signal-gesture--compact' : 'signal-gesture'}>
    <span className="signal-gesture__icon" aria-hidden="true">{icon}</span>
    <span className="signal-gesture__label">{label}</span>
  </span>;
}
