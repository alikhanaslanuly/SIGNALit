import { describe, expect, it } from 'vitest';
import { MockEngine } from './mockEngine';

describe('MockEngine', () => {
  it('emits scripted recognition and hints only while running', async () => {
    const engine = new MockEngine();
    const states: string[] = [];
    const hints: string[] = [];
    engine.onRecognition(value => states.push(value.state));
    engine.onHints(value => hints.push(value[0]?.code ?? 'clear'));
    engine.emitConfirmed('YES');
    await engine.start();
    engine.emitCandidate('YES');
    engine.emitHolding('YES', 0.5);
    engine.emitConfirmed('YES');
    engine.emitHint('NEAR_EDGE');
    engine.stop();
    expect(states).toEqual(['candidate', 'holding', 'confirmed', 'none']);
    expect(hints).toContain('NEAR_EDGE');
  });

  it('scripts missing hand and all four error layers', async () => {
    const engine = new MockEngine();
    const frames: string[] = [];
    const layers: number[] = [];
    engine.onFrame(frame => frames.push(frame ? 'hand' : 'no hand'));
    engine.onHints(hints => { if (hints[0]) layers.push(hints[0].layer); });
    await engine.start();
    engine.emitNoHand();
    for (const code of ['HAND_MISSING', 'KEEP_STILL', 'FOLD_FINGER', 'EXPECTED_GESTURES']) engine.emitHint(code);
    expect(frames).toEqual(['no hand']);
    expect(layers).toEqual([1, 1, 2, 3, 4]);
  });
});
