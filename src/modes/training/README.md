# Training and calibration (B)

Create `CalibrationSession(performance.now())` after camera start. Feed it `HandFeatures | null`, the unfiltered detected `GestureId | null`, and `performance.now()` on each frame. It asks for YES for five seconds and NO for five seconds, collecting only stable matching poses. Its `profile` provides a hand size baseline and thumb measurements; defaults remain available when either gesture was not captured. Calibration does not mutate Vision's classifier.

Create `TrainingSession(performance.now())`. Set Vision context to `{ target: state.currentGesture, expected: [state.currentGesture] }` at each step. Feed confirmed recognitions and the currently displayed hint to `update`. The default sequence covers all six gestures. `result` is set on completion. `saveBestTrainingResult(result, localStorage)` persists the faster completed result and tolerates unavailable storage.
