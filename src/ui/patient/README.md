# Patient experience (C)

`PatientExperience` is a presentational React component. Pass a `PatientViewState`, locale, and callbacks. Its `videoRef` and `canvasRef` remain mounted across screens; the integration layer owns camera start/stop, `drawHandFrame`, dialog transitions, timing, and sound calls. The camera element is only hidden during start and results.

`PatientViewState` covers start, calibration, training, dialog, and results. Dialog fields represent a nurse question, WATER/TOILET confirmation, HELP/PAIN cancel window, and request status. Pass only the currently active dialog field. The UI shows `Hint` codes through RU/EN translations. `playFeedbackSound` and `speakFeedback` from `src/audio/feedback.ts` are optional functions for the integration layer to call on semantic events.

The Vite-only preview at `src/ui/patient/dev/index.html` has local debug buttons for reviewing all screens without camera or transport. It is not a patient route.
