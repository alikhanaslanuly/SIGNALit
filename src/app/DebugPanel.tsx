import type { GestureId } from '../contracts';
import { MockEngine } from '../core/mock/mockEngine';
import type { SignalSession } from './session';

const gestures: GestureId[] = ['YES', 'NO', 'HELP', 'PAIN', 'TOILET', 'WATER'];

/** Only mounted when Vite is in development mode and ?debug=1 is present. */
export function DebugPanel({ engine, session }: { engine: MockEngine; session: SignalSession | null }) {
  return <aside className="signal-debug" aria-label="Development controls">
    <strong>Debug · mock engine</strong>
    <button type="button" onClick={() => { void session?.start(); }}>Start mock</button>
    <div><button type="button" onClick={() => engine.emitCandidate('YES')}>YES candidate</button>
      <button type="button" onClick={() => engine.emitHolding('YES', 0.5)}>YES holding</button></div>
    <div>{gestures.map(gesture => <button type="button" key={gesture} onClick={() => engine.emitConfirmed(gesture)}>{gesture} confirmed</button>)}</div>
    <div><button type="button" onClick={() => engine.emitNoHand()}>No hand</button>
      <button type="button" onClick={() => engine.emitHint('HAND_MISSING')}>Frame hint</button>
      <button type="button" onClick={() => engine.emitHint('KEEP_STILL')}>Pose hint</button>
      <button type="button" onClick={() => engine.emitHint('FOLD_FINGER')}>Finger hint</button>
      <button type="button" onClick={() => engine.emitHint('EXPECTED_GESTURES')}>Context hint</button></div>
    <div><button type="button" onClick={() => session?.startTraining()}>Practice mode</button>
      <button type="button" onClick={() => session?.enterDialog()}>Live dialog</button></div>
  </aside>;
}
