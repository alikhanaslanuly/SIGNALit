import { describe, expect, it } from 'vitest';
import type { HandFeatures, HandFrame } from '../core/vision/types';
import type { Recognition } from '../core/gestures';
import { SignalEngineAdapter } from './visionAdapter';

class FakeVision {
  frame: ((frame: HandFrame | null, features: HandFeatures | null) => void) | null = null;
  recognition: ((recognition: Recognition) => void) | null = null;
  context: unknown = null;
  onFrame(cb: typeof this.frame) { this.frame = cb; return () => { this.frame = null; }; }
  onRecognition(cb: typeof this.recognition) { this.recognition = cb; return () => { this.recognition = null; }; }
  onError() { return () => {}; }
  setContext(context: unknown) { this.context = context; }
  start() { return Promise.resolve(); }
  stop() {}
}

const features: HandFeatures = { fingerExt: { thumb: 1, index: 0, middle: 0, ring: 0, pinky: 0 }, thumbAngleDeg: 10, palmFacing: 0.9, handSize: 0.2, center: { x: 0.5, y: 0.5 }, edgeMargin: 0.2, speed: 0, brightness: 0.5 };

describe('SignalEngineAdapter', () => {
  it('maps Vision frame fields and emits B hints through the shared contract', () => {
    const vision = new FakeVision();
    const adapter = new SignalEngineAdapter(vision);
    let timestamp = -1;
    let hintCode = '';
    adapter.onFrame(frame => { timestamp = frame?.t ?? -1; });
    adapter.onHints(hints => { hintCode = hints[0]?.code ?? ''; });
    const frame: HandFrame = { landmarks: Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 })), handedness: null, timestampMs: 123, width: 640, height: 480, brightness: 0.5 };
    vision.frame?.(frame, features);
    vision.recognition?.({ gesture: 'YES', confidence: 0.95, state: 'confirmed', holdProgress: 1 });
    expect(timestamp).toBe(123);
    expect(hintCode).toBe('');
    adapter.setContext({ target: 'NO' });
    vision.frame?.(frame, features);
    vision.recognition?.({ gesture: null, confidence: 0, state: 'none', holdProgress: 0 });
    expect(hintCode).toBe('THUMB_DOWN');
    adapter.dispose();
  });
});

it('keeps text and highlighted finger aligned through stable correction, success, holding and confirmation', async () => {
  const { vi } = await import('vitest'); let now = 0; vi.spyOn(performance, 'now').mockImplementation(() => now);
  const vision = new FakeVision();
  let color = ''; const colors: string[] = [];
  const context = { set strokeStyle(value: string) { color = value; }, fillStyle: '', lineWidth: 0, clearRect() { colors.length = 0; }, beginPath() {}, moveTo() {}, lineTo() {}, stroke() { colors.push(color); }, arc() {}, fill() {} };
  const canvas = { width:640, height:480, getContext: () => context } as unknown as HTMLCanvasElement;
  const adapter = new SignalEngineAdapter(vision, canvas); adapter.setContext({ target: 'HELP' });
  let hint: any = null; let corrected = false;
  adapter.onHints(hints => { hint = hints[0] ?? null; }); adapter.onHintDisplay(display => { corrected = display.corrected; });
  const frame: HandFrame = { landmarks: Array.from({length:21}, (_,index)=>({x:index/25,y:.5,z:0})), width:640,height:480,timestampMs:0,handedness:'Right',brightness:.5 };
  const none: Recognition = { gesture:null,state:'none',holdProgress:0,confidence:0 };
  try {
    vision.frame?.(frame, { ...features, fingerExt: { thumb:1,index:1,middle:1,ring:1,pinky:0 } }); vision.recognition?.(none);
    expect(hint?.params?.finger).toBe('pinky'); expect(colors.filter(color => color === '#ffbd45')).toHaveLength(3);
    now = 200; vision.frame?.(frame, {...features, fingerExt:{thumb:1,index:1,middle:1,ring:0,pinky:1}}); vision.recognition?.(none);
    expect(hint?.params?.finger).toBe('pinky'); // text and overlay retain the same stable instruction
    now = 1300; vision.frame?.(frame, {...features, fingerExt:{thumb:1,index:1,middle:1,ring:1,pinky:1}}); vision.recognition?.({ ...none,gesture:'HELP',state:'candidate' });
    now = 1900; vision.recognition?.({ ...none,gesture:'HELP',state:'holding',holdProgress:.6 });
    expect(hint).toBeNull(); expect(corrected).toBe(true); expect(colors.filter(color => color === '#53f4b7')).toHaveLength(3);
    now = 2100; vision.recognition?.({ ...none,gesture:'HELP',state:'confirmed',holdProgress:1 });
    expect(colors).not.toContain('#ffbd45'); expect(colors).not.toContain('#53f4b7');
  } finally { adapter.dispose(); vi.restoreAllMocks(); }
});
