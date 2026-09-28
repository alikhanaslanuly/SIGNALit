# Real hand-feature recordings

The target is at least 10 labeled recordings for each of `YES`, `NO`, `HELP`, `PAIN`, `TOILET`, and `WATER`, preferably from different participants for each gesture. There are no real recordings in this repository yet; synthetic unit-test poses are not a substitute.

Use `createDevFeatureRecorder(engine)` from `src/core/vision/recorder.ts` in a development-only control. Call `capture(gesture, participantId)` once for each stable pose, then `download()`. Review the exported JSON labels and place approved files here. The recorder saves `HandFeatures`, label, participant ID, and time; it does not save video or landmarks.

Before changing thresholds, split recordings by participant so the same person does not appear in both tuning and evaluation sets.
