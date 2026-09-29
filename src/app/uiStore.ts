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
  locale: 'ru', speechEnabled: false, mobileTab: 'patient',
  setLocale: (locale: Locale) => set({ locale }),
  setSpeechEnabled: (speechEnabled: boolean) => set({ speechEnabled }),
  setMobileTab: (mobileTab: 'patient' | 'dashboard') => set({ mobileTab }),
}));
