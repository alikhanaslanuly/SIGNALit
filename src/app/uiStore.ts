import { create } from 'zustand';
import type { Locale } from '../ui/i18n';

interface UiState {
  locale: Locale;
  speechEnabled: boolean;
  mobileTab: 'patient' | 'dashboard';
  setLocale: (locale: Locale) => void;
  setSpeechEnabled: (enabled: boolean) => void;
  setMobileTab: (tab: 'patient' | 'dashboard') => void;
}

/** Low-frequency UI preferences; hand frames stay outside React/Zustand. */
export const useUiStore = create<UiState>((set) => ({
  locale: (() => { try { return localStorage.getItem('signal.locale') === 'en' ? 'en' : 'ru'; } catch { return 'ru'; } })(), speechEnabled: (() => { try { return localStorage.getItem('signal.speech') === 'true'; } catch { return false; } })(), mobileTab: 'patient',
  setLocale: (locale: Locale) => { set({ locale }); try { localStorage.setItem('signal.locale', locale); } catch { /* Optional preference. */ } },
  setSpeechEnabled: (speechEnabled: boolean) => { set({ speechEnabled }); try { localStorage.setItem('signal.speech', String(speechEnabled)); } catch { /* Optional preference. */ } },
  setMobileTab: (mobileTab: 'patient' | 'dashboard') => set({ mobileTab }),
}));
