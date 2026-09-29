# Person 2 reconciliation with official main

Official base: `2072bcaa3df2a21ae06560c28e1143e930e0f90f`.
Branch: `damir1`. Account: `desnzja`. This is a clean clone of `alikhanaslanuly/SIGNALit`.

Compared every tracked file with the completed Experience delivery and the shared historical
base `51a2c62`. Files changed only in main were retained. Files changed only in Experience were
imported. Overlapping changes were merged and the three textual conflicts reviewed individually.
No tracked team file was deleted. The original source archive and delivery package were preserved.

## Preserved teammate changes

- Official `@mediapipe/tasks-vision` range `^0.10.21` and locked version `0.10.21`; the older delivery
  package version was not restored. Existing model/WASM assets were initially identical on both sides.
- Main's `minBrightness: 0.15` and **five-second** urgent cancellation window. Experience test
  expectations and current explanatory docs now reflect main's timing; no thresholds or hold timing
  were changed by this reconciliation.
- Extra anonymous fixture files 2–4, their expanded classifier test, the development loader,
  vision latency display, recorder/smoother fixes and `docs/accuracy.md`.
- Explicit constructor fields and typed store callbacks from the team's TypeScript fixes.
- Terminal-request guards, lifecycle fixes and the complete main commit history.

The team accuracy report is retained as teammate-authored evidence. Its physical measurements were
not independently reproduced in this delivery; they are not claimed as new Person 2 test results.

## Combined overlapping changes

- Camera engine: preserved main's explicit video-field constructor while incorporating the already
  completed camera-state/error/recovery UX hooks. Inference/classifier/hold algorithms remain intact.
- Vision adapter: main's explicit fields coexist with finger-specific overlays and QA observations.
- Preferences: main's typed callbacks coexist with persisted language and sound settings.
- Dialog: retained main's cancellation duration and terminal guards while adding existing reply notes.
- Calibration: retained main's constructor fix and the delivery's already tested quality gating.
- App routing: real paired patient/staff routes and the entry page coexist with the team's explicit
  simulated fallback at `/?demo=1` and `/demo?demo=1`. Simulated views are visibly labeled and use
  in-memory transport. `/patient?...&demo=1` remains a real paired presentation session; its production
  build does not expose mock controls. Main's start-camera handler remains present.

The clean main previously lacked the delivery's backend, API, persistence and realtime modules.
Those completed dependencies are included because the patient/staff workflow and its tests need them.
This PR therefore imports the integrated Experience delivery, not only the last small accessibility patch.

## Hygiene and validation

No environment files, dependencies, build outputs, DBs, local QA exports, logs, OS metadata or
personal paths were imported. Environment settings are documented in [DEPLOYMENT.md](DEPLOYMENT.md).
No source archive/ZIP is committed. The only large binary assets are the pre-existing tracked
MediaPipe model/WASM assets; added screenshots are intentional, referenced sample-data captures.

Final clean-clone results are recorded in [PERSON2_FINAL_REPORT.md](PERSON2_FINAL_REPORT.md).
Before push, fetch main again; if it moves, integrate and rerun the relevant checks.
