import { VisionEngine, drawHandFrame, createDevFeatureRecorder } from '../index';
import { GESTURES, classifyGesture, scoreGesture, type GestureId } from '../../gestures';

const video = document.querySelector<HTMLVideoElement>('#video')!;
const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
const status = document.querySelector<HTMLOutputElement>('#status')!;
const metrics = document.querySelector<HTMLOutputElement>('#metrics')!;
const recognition = document.querySelector<HTMLOutputElement>('#recognition')!;
const scores = document.querySelector<HTMLOutputElement>('#scores')!;
const participant = document.querySelector<HTMLInputElement>('#participant')!;
const counts = document.querySelector<HTMLOutputElement>('#counts')!;
const engine = new VisionEngine(video, { targetFps: 30 });
const recorder = createDevFeatureRecorder(engine);
const frameTimes: number[] = [];
let observed = 0;

engine.onFrame((frame, features) => {
  drawHandFrame(canvas, frame, true);
  if (!frame || !features) {
    metrics.textContent = 'No hand detected';
    scores.textContent = '';
    return;
  }
  frameTimes.push(frame.timestampMs);
  while (frameTimes.length > 1 && frameTimes[0] < frame.timestampMs - 2000) frameTimes.shift();
  const fps = frameTimes.length > 1 ? (frameTimes.length - 1) * 1000 / (frameTimes.at(-1)! - frameTimes[0]) : 0;
  const best = classifyGesture(features);
  metrics.textContent = `${fps.toFixed(1)} FPS · ${++observed} frames · ${frame.width}×${frame.height} · ${frame.handedness ?? '?'} hand · brightness ${features.brightness.toFixed(2)}`;
  scores.textContent = GESTURES.map(g => `${g}: ${scoreGesture(features, g).toFixed(2)}`).join('   ') + `\naccepted: ${best?.gesture ?? 'none'}`;
});
engine.onRecognition(value => {
  recognition.textContent = `${value.state} ${value.gesture ?? ''} ${Math.round(value.holdProgress * 100)}%`;
});
engine.onError(error => { status.textContent = `Error: ${error.message}`; });

document.querySelector<HTMLButtonElement>('#start')!.onclick = () => {
  status.textContent = 'Opening camera and loading local model…';
  engine.start().then(() => { status.textContent = 'Camera running'; })
    .catch(error => { status.textContent = `Error: ${error.message}`; });
};
document.querySelector<HTMLButtonElement>('#stop')!.onclick = () => {
  engine.stop();
  status.textContent = 'Stopped';
};
document.querySelector<HTMLButtonElement>('#download')!.onclick = () => recorder.download();
document.querySelectorAll<HTMLButtonElement>('[data-gesture]').forEach(button => {
  button.onclick = () => {
    try {
      const gesture = button.dataset.gesture as GestureId;
      recorder.capture(gesture, participant.value);
      const samples = recorder.samples();
      counts.textContent = GESTURES.map(g => `${g}: ${samples.filter(s => s.gesture === g).length}`).join('  ');
      status.textContent = `Captured ${gesture} for ${participant.value}`;
    } catch (error) {
      status.textContent = `Error: ${(error as Error).message}`;
    }
  };
});
window.addEventListener('beforeunload', () => { recorder.dispose(); engine.stop(); });
