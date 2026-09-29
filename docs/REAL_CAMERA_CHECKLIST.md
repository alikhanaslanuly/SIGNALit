# Physical camera check — print or use alongside the QA tool

Date/build: ____________________ Tester: ____________________
Device: ____________________ Browser/version: ____________________
Camera: laptop / front / rear    Hand: left / right
Light: good / medium / poor    Distance: close / normal / far

Use sample sessions only. Open `/dashboard/quality/camera-test` on **this device**.
Enter device/browser, select Fast check, good light, normal distance and one hand.
Start QA camera. For each gesture: remove hand → Start attempt → form pose →
Finish attempt → review recognition/alignment/false triggers → Save review.
For HELP, deliberately bend the pinky first, observe the correction, then straighten it.
Do not mark alignment Yes without actually seeing the corresponding highlight.

| Gesture | Recognized | No false confirmation | Correct finger / N/A | Confirmation (s) |
| --- | --- | --- | --- | --- |
| YES | [ ] | [ ] | __________ | ______ |
| NO | [ ] | [ ] | __________ | ______ |
| HELP | [ ] | [ ] | __________ | ______ |
| PAIN | [ ] | [ ] | __________ | ______ |
| TOILET | [ ] | [ ] | __________ | ______ |
| WATER | [ ] | [ ] | __________ | ______ |

- [ ] HELP bent pinky: “Straighten your little finger” targets the actual pinky.
- [ ] Correcting HELP gives the brief corrected-finger success state, then recognition.
- [ ] Fingertip labels match all five physical fingers; overlay follows the mirrored video.
- [ ] Camera remains stable throughout; no repeated false HELP/PAIN confirmations.
- [ ] Download JSON and CSV before leaving. No raw frames or landmarks are exported.

For Extended check, repeat all six with the other hand in good light/normal distance.
Then try selected difficult lighting/distances; each attempt retains its context.
Export unsuccessful runs too. Fix conditions and start a **new** run rather than hiding failures.
A READY summary is a small manual demo check, not an accuracy estimate or medical validation.

## Patient ↔ staff (two people)

Stop QA camera before starting the patient camera. Create a fresh session at
`/register?demo=1`. Open its exact Patient URL and Staff URL.

- [ ] HELP reaches staff once; ACK reaches patient.
- [ ] “I'm coming” appears on patient screen; Complete reaches patient.
- [ ] WATER requires YES; NO cancels as expected.
- [ ] Refresh restores saved status and timestamped replies.
- [ ] Restart backend using the same persistent database; history remains.
- [ ] Staff dashboard stays stable; both devices reconnect.

## Phone, audio and access

- [ ] Phone opens a reachable **trusted HTTPS** URL; camera permission succeeds.
- [ ] Front-camera overlay aligns with actual fingers; no horizontal overflow.
- [ ] Explicitly enable patient sound; speech is audible and understandable.
- [ ] Diagnostics “Enable test sound” → “Play test sound” is audible.
- [ ] Check actual screen-reader announcements with a user if claiming accessibility support.

## Decision

- [ ] All six gestures, HELP correction alignment, stable camera and full lifecycle pass.
- [ ] No blocking false triggers; reply clearly visible; staff screen stable.

GO / NO-GO: __________ Notes: ___________________________________________

NO-GO for camera startup failure, wrong finger, materially misaligned overlay,
disappearing requests, missing return actions or repeated false HELP/PAIN triggers.
Use the honestly labeled backup in [DEMO.md](DEMO.md) if needed.

## Final presentation checks — do not mark without observing

- [ ] Laptop camera opens; six-gesture table above completed.
- [ ] Wrong HELP → exact pinky hint → highlighted pinky → corrected pose → holding → confirmed HELP.
- [ ] Repeat urgent cancellation at least five times for HELP and five for PAIN: show urgent gesture,
      then NO inside the existing cancellation context. Verify cancellation on both screens.

| Gesture | Attempts (at least 5) | Successful cancellations | Notes / failures |
| --- | --- | --- | --- |
| HELP | ____ | ____ | ____ |
| PAIN | ____ | ____ | ____ |

Do not change timing based on assumptions. Record time/context when NO cannot be completed.

- [ ] Phone QR opens the exact paired patient session over trusted HTTPS.
- [ ] Phone front camera starts; skeleton and highlighted finger align; portrait UI is usable.
- [ ] English TTS is audible. [ ] Russian TTS is audible. [ ] Each new staff reply is spoken once.
- [ ] Refresh/reconnect does not replay an old reply; disabling sound stops speech.
- [ ] 200% OS/browser text: RU/EN camera guidance, Error Mode, status, reply and staff detail are readable.
- [ ] Screen reader: one meaningful status/reply announcement; no countdown/hold-percentage chatter.
- [ ] Keyboard-only staff navigation, language, sound, request selection, acknowledge, reply and complete.

Physical results remain blank. Record independent usability separately in [USABILITY_TEST.md](USABILITY_TEST.md).
