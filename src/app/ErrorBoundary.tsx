import { Component, type ReactNode } from 'react';
import { getText } from '../ui/i18n';
import { useUiStore } from './uiStore';
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    const locale = useUiStore.getState().locale; const t = getText(locale).product;
    return <main className="signal-register" lang={locale}><section className="signal-register__card" role="alert"><p className="entry-brand">✳ SIGNALit</p><h1>{t.recoveryTitle}</h1><p>{t.recoveryHelp}</p><button className="staff-primary" onClick={() => window.location.reload()}>{t.reload}</button> <a href="/">{t.returnHome}</a></section></main>;
  }
}
