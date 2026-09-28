# SIGNAL — FOR HOSPITAL

SIGNAL is a browser communication aid for a patient who temporarily cannot speak comfortably. The camera detects one hand, recognizes six simple poses, and turns confirmed gestures into requests or YES/NO answers for a nurse. It is an additional communication channel, not a medical diagnostic system or a replacement for a hospital call button.

## Problem and solution

A patient may need water, help, or the toilet while speaking is difficult. SIGNAL uses a small gesture vocabulary and dialog context instead of asking the patient to remember many gestures. The nurse sees requests, can acknowledge or complete them, and can ask questions that the patient answers with 👍 or 👎.

## User flow

1. The patient starts the camera from a button, allowing browser permission.
2. The app calibrates YES and NO for about ten seconds and practices all six gestures.
3. A confirmed HELP or PAIN sends a request immediately, with a three-second NO cancellation window. WATER and TOILET require a YES/NO confirmation.
4. The nurse dashboard displays requests in priority order and sends status updates back to the patient.
5. The nurse can ask a question; the patient answers by holding YES or NO until confirmation.

## Six gestures

| Gesture | Meaning |
| --- | --- |
| 👍 YES | Affirmative answer or request confirmation |
| 👎 NO | Negative answer or cancellation |
| ✋ HELP | Urgent help request |
| ✊ PAIN | Urgent pain request |
| ☝️ TOILET | Toilet request |
| Three raised fingers | WATER request |

## Error Mode

Diagnostics work in four layers: hand framing and lighting, palm pose and movement, finger corrections, and dialog context. The patient sees one stable, actionable hint at a time. The correction hints are derived from continuous finger measurements, not from raw camera frames in the UI.

## Architecture and tech stack

```text
Camera → MediaPipe Hand Landmarker → 21 landmarks → our features
       → our gesture scores → hold detection → recognition
       → Error Mode / training / dialog FSM → semantic transport
       → nurse dashboard → patient status
```

MediaPipe Hand Landmarker provides 21 hand landmark coordinates. Gesture classification, hold detection, error diagnostics, training logic, and dialog FSM are implemented by our team. The app uses React, TypeScript, Vite, Zustand for low-frequency UI preferences, Vitest, Web Speech API, and local MediaPipe assets. `@mediapipe/tasks-vision` is pinned to 1.0.1 to match the committed WASM files.

The shared types are in `src/contracts/`. `SignalEngineAdapter` maps Vision's local frame fields to the shared contract and adds B's hint stream. Shared `HandFrame.handedness` allows `null` because MediaPipe can omit that category; its score then defaults to zero.

## Demo and routes

- `/` — split patient and nurse view, connected through `MemoryTransport`.
- `/patient` and `/dashboard` — separate tabs connected through `BroadcastTransport`. Open both tabs in the same browser and origin. A newly opened tab asks an existing tab to replay recent semantic events.
- Add `?debug=1` during local development to use the mock engine and on-screen development controls. This switch is absent from production builds. Click **Start mock**, then choose confirmed gestures to run the complete dialog without camera permission.
- `/src/core/vision/dev/` — development-only camera diagnostics and feature recorder.
- `/src/ui/patient/dev/` — development-only preview of patient screens.

## Run locally

Requires a current Node.js installation.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. Camera access requires HTTPS or localhost and a browser permission. The model and WASM are served from `public/models/` and `public/wasm/`; runtime inference makes no CDN request.

## Testing and build

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

The unit tests cover hand features, gesture scoring and hold, real hand fixtures, error hints, calibration and training, transports, dialog, dashboard, and a mock end-to-end session. For browser verification, run a mock question/answer/request/status flow in `/`, then repeat with `/patient` and `/dashboard` in two tabs. Test real camera permission, model loading, and hand overlay in Chrome or Edge before presenting.

## Privacy and limitations

Camera video is processed locally in the browser for gesture detection. Video is not recorded or sent through the transport. Messages carry room, request, answer, question, and status data. Eleven consented hand-landmark fixtures from one participant are committed with the participant code and recording times removed; they do not establish accuracy across different people, lighting, or devices.

The classifier is heuristic and recognizes only these six poses. Brightness, camera angle, occlusion, and mobility differences can affect it. `BroadcastTransport` works between tabs on one browser origin; it is not a cloud service and does not reach another device. The app keeps session state in memory, except the best practice result in local storage.

## Deployment

Deployment is on hold while the team validates the real camera flow. `vercel.json` prepares the Vite build and SPA rewrites for `/patient` and `/dashboard`. Before sharing a public demo, verify camera permission, the model and WASM paths, a fresh private-browser session, and mobile layout on the final HTTPS URL.

## Team roles and hackathon notes

- A — camera, MediaPipe, hand features, gesture classification, hold, fixtures.
- B — Error Mode, calibration, training.
- C — patient interface, RU/EN copy, feedback.
- D — contracts, mock engine, dialog, transport, nurse dashboard, integration, deployment.

Built for Admit Hackathon, Motion case: camera instead of a joystick. The first demo path is a nurse question answered with 👍, followed by a confirmed patient request, nurse acknowledgement, and visible patient status.
