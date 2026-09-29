# Real hand-feature recordings

The target is at least 10 labeled recordings for each of `YES`, `NO`, `HELP`, `PAIN`, `TOILET`, and `WATER`, from different participants and both left and right hands. Synthetic unit-test poses are not a substitute.

`vision-anonymous-1.json` contains 11 stable poses from one consenting participant: one YES and two each of NO, HELP, PAIN, TOILET, and WATER. Both hands are represented. The participant code was replaced and exact recording times were removed, including normalization of `frame.timestampMs` to zero. Three captures made while switching poses were excluded. This small, single-participant set is useful for regression tests, not for estimating accuracy across people or tuning thresholds without a separate evaluation group.

Use `createDevFeatureRecorder(engine)` from `src/core/vision/recorder.ts` in a development-only control. Call `capture(gesture, participantId)` once for each stable pose, then `download()`. Review the exported JSON labels and place approved files here. The recorder saves a 21-landmark `HandFrame`, `HandFeatures`, expected gesture, participant ID, and time; it does not save video pixels.

Before changing thresholds, split recordings by participant so the same person does not appear in both tuning and evaluation sets.
