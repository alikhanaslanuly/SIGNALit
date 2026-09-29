# Real camera results — blank template, not measured results

No physical-device results are supplied by this engineering pass.
Run [the checklist](REAL_CAMERA_CHECKLIST.md), export both JSON and CSV from
`/dashboard/quality/camera-test`, and preserve the original files locally.
Exports contain device/browser labels, conditions, expected/candidate/confirmed gestures,
semantic corrections and counts, confirmation times, FPS, visible-hand ratio and human review.
They contain no camera images, video or landmark coordinates. Do not enter patient details.

Record build, date, device/browser, camera facing, hand, lighting and distance above a table.
Fill cells only from completed attempts. Keep failures in the denominator. Separate devices
and conditions rather than blending them into an “accuracy” claim. CSV is quoted and
formula-like text is prefixed with an apostrophe for spreadsheet safety.

| Gesture | Attempts | Confirmed as intended | False confirmations | Mean candidate-to-confirmation (s) |
| --- | --- | --- | --- | --- |
| YES | | | | |
| NO | | | | |
| HELP | | | | |
| PAIN | | | | |
| TOILET | | | | |
| WATER | | | | |

For JSON: group `attempts` by `expected`; count all attempts; count intended confirmations
only when `review.correctRecognition` is true and `confirmations` includes `expected`.
For each attempt count the larger of non-expected confirmations and the human false-confirmation
flag. Average the first intended confirmation's non-null `candidateMs`, divided by 1000.
Report the number of timed attempts separately if any values are missing. An interrupted attempt
remains a failure even if recognition occurred before interruption.

Add aligned/relevant finger checks and FPS as observations. Include failed attempts and notes.
Paste only the compact table and context into README after review; do not commit private exports.
The tool's READY means all required normal-condition checks passed, every saved attempt passed,
and HELP included a visually aligned pinky extension correction. Extended mode requires both hands.
The broader GO decision also requires the real patient/staff lifecycle and stable camera.
