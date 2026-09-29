> This file describes the earlier upgrade pass. See [competition QA](QA_REPORT.md), [deployment](DEPLOYMENT.md), and the current README for the subsequent persistence, reply-history and diagnostic changes.

# SIGNALit implementation and compatibility notes

## Preserved

Existing project, MediaPipe integration, local model/WASM assets, classifier and six gestures, classifier thresholds, hold timing, shared `src/contracts/`, dialog semantics, training, audio, backend API routes, memory/broadcast transports, SQLite data, and all existing regression coverage remain.

## Product modules

- `src/app/StaffPages.tsx`, `staffData.ts`, `staff.css`: persistent staff shell, overview, searchable priority queue and detail actions, patient/session creation and editing, profiles, targeted conversation and question categories, and local quality view.
- `src/app/ProductPages.tsx`, `product.css`: entry, registration, patient chooser, camera-session lifecycle and visible connection/delivery failures.
- `src/ui/patient/PatientExperience.tsx`, `patient.css`: distinct bedside layout, large camera, single correction, hold indicator, timeline, visible nurse reply, training/calibration, collapsible gesture guide.
- `src/app/design.css`, shared controls: surface/type/color tokens, buttons, inputs, status chips, keyboard focus, reduced motion and responsive layouts.
- `src/ui/i18n/product.ts`: matched English/Russian product strings consumed through existing `getText`.
- `src/core/vision/correction.ts`, `draw.ts`, `src/app/visionAdapter.ts`: exact MediaPipe finger targets, debounced-hint-driven rendering, success interval, safe missing data and consistent mirroring.
- `src/modes/training/calibration.ts`: valid-time accumulation, minimum samples, invalid-frame pauses, bounded frame gaps, timeout/retry. The prior wall-clock test was replaced with stronger equivalent and regression coverage for the requested behavior.
- `src/app/quality.ts`: lightweight aggregate diagnostics, no images/landmarks/patient identifiers, once-per-second persistence.

## Realtime fixes

1. Bind browser-native `fetch` to `globalThis`. The original method-property invocation failed in Chrome with an invalid receiver; live registration verified the fix.
2. Attach Express **before** Socket.IO wraps the HTTP request handler. The original order crashed on polling with `ERR_HTTP_HEADERS_SENT`. `server/src/runtime.ts` provides one testable setup for production and the real socket smoke test.
3. Correlate the local gesture request ID with the canonical backend request ID so subsequent status messages reach the active patient request.
4. Deduplicate statuses by request ID, status, reply and server timestamps instead of event name alone. ACK must not suppress COMPLETE.
5. On reconnect, rejoin the room and ingest both request identity and its current status/reply. Never resend a request merely because the socket reconnects.
6. Restrict patient request hydration to the configured patient ID, including same-room sessions.
7. Persist urgent cancellation; previously the frontend FSM emitted `CANCELLED` but the backend transport silently ignored it.
8. Expose sending/failure/retry and connection states; preserve errors instead of swallowing them. Keep status progression monotonic.
9. Replayed answered questions no longer remain pending in the patient dialog.

## Additive backend/API changes

- Optional `clientRequestId` on `POST /api/requests` and request responses. New callers reuse it on explicit retry; older callers may omit it.
- Additive SQLite `client_request_id TEXT` column and unique `(patient_id, client_request_id)` index. Existing records have NULL keys; no data rewrite or deletion.
- `POST /api/requests/:id/cancel`; response/status events may use `CANCELLED`. This extends the backend's old three-status vocabulary to match the existing frontend cancellation FSM. Updated consumers: server types/services/routes, request API records, backend transport, dashboard model, staff statuses and conversation.
- Shared `src/contracts/Status` stays unchanged; cancellation continues as the existing explicit extension at the relevant boundaries.
- No new authentication, third-party service, or package dependency.

## Data honesty

Counts and response times come from persisted requests. `active` is session enablement, not online presence. Replies currently persist only their latest code; no reply timestamp is invented. Quality data is local browser telemetry, not an accuracy score. Recognition calibration changes no classifier thresholds.

This supplied workspace has no `.git` directory, so no commits or history changes were made.
