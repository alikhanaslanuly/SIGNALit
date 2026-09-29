import { useEffect, useState } from 'react';
import type { Locale } from '../i18n';
import './controls.css';

export type Theme = 'light' | 'dark';
const storageKey = 'signal-theme';
const systemTheme = (): Theme => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    try { const saved = window.localStorage.getItem(storageKey); return saved === 'dark' || saved === 'light' ? saved : systemTheme(); } catch { return systemTheme(); }
  });
  useEffect(() => {
    document.documentElement.dataset.signalTheme = theme;
    try { window.localStorage.setItem(storageKey, theme); } catch { /* Theme still works when storage is unavailable. */ }
    return () => { delete document.documentElement.dataset.signalTheme; };
  }, [theme]);
  return [theme, setTheme];
}

export function ThemeToggle({ locale, theme, onChange }: { locale: Locale; theme: Theme; onChange: (theme: Theme) => void }) {
  const labels = locale === 'ru' ? { group: 'Тема', light: 'Светлая', dark: 'Тёмная' } : { group: 'Theme', light: 'Light', dark: 'Dark' };
  return <div className="signal-control-group signal-theme-toggle" role="group" aria-label={labels.group}>
    <button type="button" className="signal-control-button" aria-pressed={theme === 'light'} onClick={() => onChange('light')}>☼ <span>{labels.light}</span></button>
    <button type="button" className="signal-control-button" aria-pressed={theme === 'dark'} onClick={() => onChange('dark')}>☾ <span>{labels.dark}</span></button>
  </div>;
}
