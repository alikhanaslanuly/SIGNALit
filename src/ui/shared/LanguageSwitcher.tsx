import type { Locale } from '../i18n';
import './controls.css';

export function LanguageSwitcher({ locale, onChange, label }: { locale: Locale; onChange: (locale: Locale) => void; label: string }) {
  return <div className="signal-control-group" role="group" aria-label={label}>
    <button type="button" className="signal-control-button" aria-pressed={locale === 'ru'} onClick={() => onChange('ru')}>RU</button>
    <button type="button" className="signal-control-button" aria-pressed={locale === 'en'} onClick={() => onChange('en')}>EN</button>
  </div>;
}
