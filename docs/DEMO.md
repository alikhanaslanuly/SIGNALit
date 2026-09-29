# Competition demo runbook

Use sample data. The production presentation path is `/register?demo=1` → real patient camera → scoped staff queue. `debug=1` is a development backup, never a camera-recognition demonstration.

## Pre-demo — 30 minutes

- [ ] Use Node 24; run `npm ci`.
- [ ] Run `npm run verify` for all automated gates; `npm run preflight` is the fast type/test/build/config check.
- [ ] Run `npm run demo`; confirm `/health` and `/ready` through the frontend origin. Use a configured HTTPS deployment for phones.
- [ ] Complete [the physical camera checklist](REAL_CAMERA_CHECKLIST.md); export results from `/dashboard/quality/camera-test`.
- [ ] Verify `VITE_API_URL`, CORS and HTTPS from the actual phone/tablet. Phone localhost is not laptop localhost.
- [ ] Create a sample room 204 session at `/register?demo=1`; keep its patient link and **Open this demo queue** link.
- [ ] Open both presenting devices; confirm Connected.
- [ ] Open `/dashboard/quality` on the presenting camera device, start the real camera check, and wait for analyzed frames and readiness. Stop the check before opening another camera consumer.
- [ ] Start the actual patient camera and accept permission.
- [ ] Check video and skeleton alignment, especially the front phone camera. Keep one whole hand in frame.
- [ ] Check HELP. Deliberately bend the pinky, wait for **Straighten your little finger**, and verify the highlighted finger matches.
- [ ] Correct the pose, hold, and verify the brief success moment and request.
- [ ] Verify WATER, then YES confirmation. NO should dismiss an unconfirmed WATER request.
- [ ] Verify request arrival → acknowledgement → patient status → staff reply → patient reply → completion.
- [ ] Send WAIT then COMING and refresh the conversation: both replies retain timestamps.
- [ ] Refresh the patient after acknowledgement: its latest saved status appears before reopening the camera.
- [ ] Enable patient sound explicitly and check actual speech/volume. Reconnect should not repeat old speech.
- [ ] If using staff alert sounds, enable the toggle with a click on the staff device.
- [ ] Briefly disconnect/reconnect a device and verify recovery. Unsent commands need explicit retry; do not refresh an unsent request.
- [ ] Confirm the local SQLite file remains after a server restart. Use a persistent volume for a hosted backend.
- [ ] Open the [backup screenshots](assets/README.md) and rehearse the explanation below.

## Pre-demo — 2 minutes

- [ ] Use **Create a fresh demo session** for room 204. This scopes the queue away from rehearsal requests without deleting records.
- [ ] Open the **new** patient and queue links. Close old patient camera tabs.
- [ ] Refresh both screens; confirm Connected.
- [ ] Run system check on the camera device; stop it, then start the patient camera.
- [ ] Finish calibration or select standard settings deliberately; enter communication.
- [ ] Confirm camera framing, good light, language, readable theme and browser zoom at 100%.
- [ ] Set volume to a reasonable level. Keep staff quick replies in view.
- [ ] Keep backup images ready, with fixture/mock labels visible.

## Exact 60-second script

| Time | Say / do |
| --- | --- |
| 0–10s | “A patient may understand everything but temporarily struggle to speak.” Show the patient session. |
| 10–25s | “We help them form a request.” Show HELP with a bent pinky, point to the correction and aligned highlight, then straighten it. |
| 25–35s | Hold HELP. Show the recognized request arriving at the nurse station. |
| 35–45s | Staff clicks Acknowledge; show the patient's status. |
| 45–52s | Staff clicks “I'm coming”; show the patient reply. |
| 52–58s | Complete the request; show completion on both screens. |
| 58–60s | “Local hand landmarks become a tracked conversation.” |

## Two-minute version

Use the same 0–60s flow. From 60–100s explain: “MediaPipe produces 21 hand landmarks.
Our code extracts features, scores six poses, requires a stable hold, and chooses a corrective
hint. The dialog decides whether to request, confirm or cancel. HTTP persists semantic events
in SQLite; Socket.IO updates staff and patient. Video stays on the device.”

From 100–120s show the saved manual check **only if actually performed**: name device,
conditions and failures. Explain that automated tests cover the software lifecycle and synthetic
camera startup; six human checks demonstrate rehearsal readiness, not scientific accuracy.
If no physical report exists, state that manual testing is still required.

## GO / NO-GO

**GO** only when all six gestures work in the intended environment, there are no blocking false
triggers, HELP highlights the correct finger, the camera stays stable, the full lifecycle works,
patient replies are visible and the staff dashboard stays stable.

**NO-GO** if the camera will not initialize, the wrong finger is highlighted, the front-camera
overlay is materially misaligned, a request disappears, a staff action fails to return to the
patient, or HELP/PAIN falsely trigger repeatedly. Switch to the labeled backup; do not present
an automated READY badge as physical validation.

HELP is an open hand. Do not narrate “bend your pinky” for HELP; that correction belongs to WATER. The exact text depends on the observed pose and diagnostic priority. Rehearse under the actual lighting; do not promise a specific hint if the camera sees another problem first.

## Optional second interaction

Show WATER → YES → staff acknowledgement → completion. A WATER pose alone is not a sent request. Alternatively ask a short staff question and answer YES/NO by gesture.

## Honest backup plan

Fallback order: **A. live camera and network → B. local two-window demo → C. short recorded backup, if the team has recorded one.** This pass provides labeled screenshots, not a fabricated camera recording; prepare an honest short recording after the device rehearsal if desired.

1. **Camera permission failure:** read the recovery message, allow the camera or close the competing camera app, and retry once. Do not spend the whole presentation troubleshooting.
2. **Tracking failure:** reposition/light the hand once. If it still fails, say: “Camera recognition needs a device check. Here is the working communication flow with explicitly labeled test input.” On the local development build use `/patient?patientId=…&debug=1`, Start mock, and gesture buttons. HTTP and staff actions remain real; the gesture input is simulated.
3. **Backend/network failure:** say the live connection is unavailable and use the captured request-queue, patient and dialog images. Screenshots are not evidence of a currently connected session.
4. **Production has no mock buttons:** this is intentional. Use the prepared local development backup or the labeled screenshots. Never remove their labels or describe fixture landmarks as a real camera capture.

## After the presentation

Stop camera tabs and the diagnostic camera. Preserve demo data only if useful to the team; do not use real patient information. The prototype has no authentication and is not an emergency-call system.
