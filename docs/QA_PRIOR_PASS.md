# SIGNALit upgrade: verification record

Verified on 2026-09-29. The initial workspace had no Git metadata. Baseline: **24 test files, 91 tests passed**, frontend/server typechecks and production build passed.

## Automated checks after implementation

| Check | Result |
| --- | --- |
| `npm test` | **29 test files, 114 tests passed** |
| `npm run typecheck` | Passed |
| `npm run server:typecheck` | Passed |
| `npm run build` | Passed; 112 modules transformed |
| Real HTTP + Socket.IO smoke (`npm run test:realtime`) | Passed, disposable SQLite database |
| Lint | Not configured in the supplied repository |

The real socket smoke covers HELP → acknowledgement → reply → disconnect → completion while disconnected → reconnect recovery; WATER + YES → acknowledgement → completion; immediate HELP + NO cancellation; exactly three persisted requests and no duplicates. Socket.IO polling is explicitly exercised because the original server crashed on polling. The shared runtime used by the smoke test is also the production entrypoint runtime.

Regression additions include exact finger chains and mirrored canvas positions, absent/invalid correction targets, confirmed-state suppression, stable calibration samples and missing-hand pauses, monotonic/replayed statuses, request ID reconciliation, explicit idempotent retry, persisted cancellation, browser fetch binding, localized product key coverage, route rendering, and real telemetry counts. Existing classifier/hold/fixture regressions remain.

## Browser interactions actually performed

**Chrome:**

- Entry page and registration rendered. Created a clearly labeled demo patient through the UI.
- Patient session connected to the real backend with the development mock engine.
- HELP appeared in a separate staff tab. Acknowledgement, “I'm coming,” and completion were received and visibly rendered by the patient.
- WATER displayed YES/NO confirmation. YES created the routine request.
- Patient RU → EN switch preserved the active request/session. Staff EN/RU and light/dark controls rendered.
- Inspected the active patient at a 390 × 844 responsive viewport.
- Inspected staff queue populated/empty states and patient reply/status rendering.
- Browser console output visible during checks contained extension-origin warnings and React's development-tool notice; no app exception was observed in the verified flow after the integration fixes.

**Safari:**

- Directly inspected `/dashboard`, `/dashboard/patients`, `/dashboard/patients/:id`, `/dashboard/dialog`, `/dashboard/quality`, including the selected patient conversation.
- System check returned ready for secure context, camera API availability, local model asset, and backend reachability; realtime was connected.
- Verified honest no-measurements quality state with no invented values.

## Responsive route audit

A reproducible development harness is at `/src/app/dev/layout.html`. It renders actual application routes inside same-origin frames at controlled viewport widths and measures the frame document's `scrollWidth`. It is excluded from production build entries.

The observed aggregate result in Safari was:

> 40 checks; 0 overflows; 0 blank main regions; 0 observed errors. Widths: 390 / 768 / 1024 / 1440.

The ten audited routes were:

- `/`
- `/register`
- `/patient` (session chooser)
- `/patient?patientId=…` (camera-off state)
- `/dashboard`
- `/dashboard/requests`
- `/dashboard/patients`
- `/dashboard/patients/:id`
- `/dashboard/dialog`
- `/dashboard/quality`

Each was checked at **390, 768, 1024, 1440 CSS pixels**, with Russian content and the dark theme used during the sweep. The harness observes errors after frame load; this is not an exhaustive application error trace.

Separately, started the **active mock patient**, displayed 50% hold progress and an existing request, collapsed development controls, and visually inspected it at **all four widths**. At each width the document width equaled the viewport width and no horizontal overflow was reported. Mock input means this verifies layout and communication state, not real webcam behavior.

## Accessibility work and limits

Implemented semantic buttons/forms/labels, visible focus outlines, active navigation (`aria-current`), selected filters, status/error live regions, labeled progress bars, large patient text, status wording/symbols in addition to color, reduced-motion support, and generally 44px-or-larger interactive controls. Browser accessibility trees exposed the expected labels and progress values.

A full screen-reader audit, complete keyboard-only workflow, 200% text/zoom audit, measured contrast audit, and evaluation with people with motor impairments were **not** performed.

## Manual tests still required

- Real camera permission, startup, model inference, and sustained FPS on the actual demonstration laptop/phone.
- All six gestures across relevant hands, lighting, distances, and mobility differences.
- Real Error Mode text-to-finger alignment, corrected-color transition, and front-camera mirroring. Automated mapping/rendering tests do not replace this.
- Real calibration quality gating, timeout/retry, and training completion with hand input.
- Speaker/TTS output and repeated-action behavior on the intended browser/device.
- Cross-device HTTPS/CORS setup and interruptions on the actual network.
- Physical mobile portrait/landscape, enlarged text/zoom, and assistive technology checks.
- Reload during an unsent request: the retry queue is intentionally not durable across page reloads.

## Known product boundaries

No authentication, clinical validation, or durable offline outbox. The backend defaults to an in-memory database; configure `SIGNAL_DB_PATH` for persistence. Patient UI foregrounds the latest request. The backend stores the latest quick reply rather than a full reply history and does not timestamp replies/cancellations. Quality measurements are browser-local, not cross-device patient analytics. Session `active` does not claim live patient presence.

Browser automation experienced long stalls and intermittent unavailable-window errors. Successful checks above are recorded separately from checks that could not be performed. No real-webcam testing is claimed.
