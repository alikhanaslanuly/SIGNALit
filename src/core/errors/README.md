# Error Mode (B)

`diagnose(features, recognition, context)` returns the highest priority `Hint` by checking frame, pose, finger shape, then dialog context. `null` features means no visible hand. Thresholds live in `config.ts`; `handSizeBaseline` from calibration can adjust distance hints. The finger patterns in `patterns.ts` mirror Vision's six gesture definitions and should be reviewed if those definitions change.

Run each raw hint through one `HintController` per patient session. Call `update(hints, performance.now())` when Vision produces a frame; render its `hint` and optional `corrected` event. Reset on camera stop or session reset. The controller keeps hints visible for at least 1.2 s and waits 0.5 s of correction before clearing.

`Hint` carries a code and parameters. The patient UI translates these through `getHintText(locale, hint)`; core logic has no display strings.
