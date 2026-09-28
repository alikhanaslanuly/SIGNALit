# SIGNAL vision module

This module owns camera capture, one-hand MediaPipe landmarks, smoothing, continuous hand features, gesture scores, and hold confirmation. The inference loop is independent of React. No UI, dialog, transport, or error-hint code is included.

The shared `src/contracts/` directory did not exist when this module was written, so its types are local to `src/core/vision/types.ts` and `src/core/gestures/types.ts`. Reconcile them with the agreed contracts before other modules import them. `onHints` belongs to the separate error layer and is not implemented here.

The app package owner should install `@mediapipe/tasks-vision@1.0.1`. The committed model and WASM files are served from `public/` by Vite/Vercel, so runtime inference makes no CDN request.

```ts
import { VisionEngine, drawHandFrame } from './core/vision';

const engine = new VisionEngine(videoElement, {
  baseUrl: import.meta.env.BASE_URL,
  targetFps: 30,
});
const offFrame = engine.onFrame(frame => drawHandFrame(canvasElement, frame, true));
const offRecognition = engine.onRecognition(recognition => {
  if (recognition.state === 'confirmed') {
    // Pass recognition to the dialog/transport owner.
  }
});
const offError = engine.onError(error => console.error(error));

await engine.start(); // Ask from a user action, so the browser can grant camera access.

// On unmount or session end:
offFrame();
offRecognition();
offError();
engine.stop();
```

Do not put `onFrame` results into React state on every inference. Draw the landmarks imperatively on canvas, and update React only for selected recognition changes. `drawHandFrame(..., true)` mirrors the overlay when the video preview is mirrored with CSS.

`Recognition.state` moves through `none → candidate → holding → confirmed`. Confirmation is emitted for one frame after roughly 1 second of stable classification. The detector requires a short release and a 1.5-second cooldown before it can confirm again. The classifier rejects weak or ambiguous frames.

To collect real data in Vite development mode, call `createDevFeatureRecorder(engine)`, then `capture(gesture, participantId)` while the pose is visible and `download()`. Each sample contains the expected gesture, a 21-landmark `HandFrame`, and `HandFeatures`. No camera pixels or video are saved. Move the JSON into `tests/fixtures/` after checking consent and labels.

Once the Vite app scaffold exists, run its dev server and open `/src/core/vision/dev/`. This development-only page shows the camera overlay, all six scores, accepted classification, hold progress, and measured inference FPS. Enter an anonymous participant code and capture several stable poses per gesture; download the JSON before closing the tab. The page is not included in a normal single-entry Vite production build.

Call `setContext()` when the expected gesture set or training target changes. Repeating an unchanged context is safe and preserves an in-progress hold. An actual context change resets the hold so a gesture from a previous mode cannot confirm in a new one.

The thresholds are initial heuristic values. They need tuning against real recordings from different people, lighting, cameras, and left/right hands. In particular, `palmFacing` estimates plane alignment and cannot prove that the palm rather than the back of the hand faces the camera.

Integration with the proposed shared `src/contracts/index.ts` needs an adapter from the platform owner. The local `HandFrame.timestampMs` corresponds to contract `t`, and `handednessScore` corresponds to `score`. The local frame also includes dimensions, brightness, and optional world landmarks; `handedness` can be null if the model omits its category. `onHints` belongs to the Error Mode owner. Do not cast between the interfaces without explicitly mapping these fields.
