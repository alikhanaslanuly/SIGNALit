# Person 2 final software closure

The delivery is reconciled with official main; see [RECONCILIATION.md](RECONCILIATION.md) and [GIT_HANDOFF.md](GIT_HANDOFF.md).
This report distinguishes software checks from physical evidence. No human results were invented.

## Remaining-task audit

| Area | Class A: software closure | Class B: still requires a person/device |
| --- | --- | --- |
| Accessibility | Axe scans, duplicate IDs, headings/landmarks, contrast, keyboard workflow, focus outlines | Actual screen reader and OS/browser text settings |
| Patient semantics | Atomic current request/reply announcements; countdown and hold values excluded from live regions | Listen with assistive technology |
| Responsive | Normal six-width sweep and doubled-text Russian stress checks | Physical phone portrait use |
| Audio | Preference persistence, neutral RU/EN diagnostic, event-only speech, silent hydration/reconnect | Speaker audibility, installed RU/EN voices |
| Localization | Shared diagnostic copy, demo navigation, QA state/facing/gesture labels; preserved active state | Comprehension by new users |
| Error Mode | All five fingers: RU/EN text → ID → exact mirrored/unmirrored landmark drawing | Physical pinky/skeleton alignment |
| Urgent cancellation | HELP and PAIN → existing cancellation context → NO regression coverage | At least five trials per urgent gesture |
| Camera QA | Real model with synthetic stream, semantic metrics, JSON/CSV export, required human review | Six real hand gestures and phone front camera |
| Usability | Silent protocol and three blank tester templates | Two or three people outside the team |
| Demo/pitch | Labeled screenshots, 110-second recording script and spoken pitch | Actual backup video recording |
| Repository | Clean official clone, authenticated desnzja, safe main reconciliation | Required teammate review, if imposed by repository policy |
| Deployment | Existing deployment procedure reviewed | Team-managed public HTTPS deployment and cross-device check |

## Implemented changes

- Replaced the live countdown/request tracker with current-state announcements. Future tracker steps
  are still visually available but are not announced as completed. Confirmed gestures have a separate
  atomic announcement. Inline questions/confirmation instructions are polite live regions.
- Added a real footer landmark and removed artificial heading jumps in empty-state copy.
- Fixed dark fixture label contrast and enlarged Russian mobile navigation wrapping.
- Restored saved locale/sound preferences on the demo session; turning sound off cancels queued speech.
- Moved diagnostic and elapsed-time copy to existing i18n dictionaries; localized QA display values
  while leaving serialized gesture/state/error codes unchanged.
- Added development-only `@axe-core/playwright` 4.13.0 and its `axe-core` dependency. Existing library
  versions were not upgraded; npm also marked playwright-core as a peer dependency in the lock metadata.
- Extended browser checks for keyboard controls, locale preservation, speech deduplication, JSON/CSV,
  camera track preservation, and text enlargement. Added all-finger rendering and HELP/PAIN regression tests.
- Added usability, physical QA, pitch and backup recording materials; all physical result fields are blank.

## Previous local validation (29 September 2026)

Both `npm run verify` and the final `npm run preflight` passed on 29 September 2026. `npm ci` installed 206 packages
and audited 207, reporting zero vulnerabilities; the initial sandbox DNS restriction was resolved
by running the install with network permission. Browser servers similarly required permission to
bind local ports. No test assertions were skipped to handle these environment restrictions.

| Check | Actual result |
| --- | --- |
| Unit/integration | 147 passed / 34 files |
| Browser scenarios | 16 passed / 2 files |
| Axe accessibility | 76 scans, zero violations (11 routes + 8 patient states × 2 locales × 2 themes) |
| Duplicate DOM IDs | No duplicates in the same 76 scan states |
| Normal route/width sweep | 78 checks: 12 routes × 6 widths + active patient × 6 widths |
| Doubled-text stress | 20 checks: 5 route/states × 4 widths, Russian |
| Frontend / backend / browser-test typechecks | Passed |
| Frontend / compiled backend builds | Passed |
| Realtime | Passed: HTTP + Socket.IO, reconnect, lifecycle, idempotency, cancellation |
| Source submission audit | Passed: 202 files before packaging |
| Protected core | 31 / 31 files unchanged |
| Screenshot review | All 10 reviewed; sample data, explicit synthetic/mock labels |

The browser matrix includes names/labels, ARIA, landmarks, heading order and detectable contrast.
Keyboard tests use actual Tab/Enter/Space traversal and assert visible focus; they cover navigation,
locale, sound, camera retry, request selection, acknowledgement, reply and completion.
The camera test verifies the same media track survives a language change. Patient/staff tests
preserve active communication state and selection while switching RU/EN. A speech spy verifies
live action/reply calls and no old-message replay on reconnect/refresh.

Existing MediaPipe OpenGL/projection warnings appeared during synthetic-camera inference;
initialization, frame processing, interruption recovery and exports passed. No lint script exists,
so no lint result is claimed. All final browser scenarios passed without retries.

The text stress test doubles computed font sizes, including pixel-based rules. It checks document
width, element bounds and clipped text at 390, 430, 768 and 1024px. This is not OS-level zoom testing.
Axe results cover automated rules, not a full accessibility certification. Browser speech assertions
observe Web Speech API calls, not speaker output. Camera integration uses Chrome's synthetic stream.

The 31 source files under vision, gestures, contracts and dialog were SHA-256 compared with the
supplied archive before editing. Their contents remain unchanged, including their existing tests.
New regression tests live outside those frozen directories. That comparison describes the earlier local pass.
For the official reconciliation, newer main constructor fixes, brightness threshold and cancellation
timing take precedence; see the reconciliation record. No new threshold/hold-timing changes were introduced.

## Documentation

- [Usability rehearsal](USABILITY_TEST.md)
- [Physical device checklist](REAL_CAMERA_CHECKLIST.md)
- [110-second backup recording script](BACKUP_VIDEO_SCRIPT.md)
- [Two-minute spoken pitch](PITCH_2MIN.md)
- [Screenshot evidence and input limitations](assets/README.md)
- [Deployment procedure](DEPLOYMENT.md)
- [Git authentication and safe reconciliation handoff](GIT_HANDOFF.md)

No public deployment, physical laptop/phone trial, audible TTS check, new-user rehearsal or video
recording was completed. Previous QA reports remain historical; the official-clone results below supersede prior counts.

## Official clean-clone validation (30 September 2026)

`npm ci`, `npm run preflight` and `npm run verify` all passed in the separate official clone
based on main `2072bcaa3df2a21ae06560c28e1143e930e0f90f`. No test was skipped or weakened.

| Check | New official-clone result |
| --- | --- |
| Clean install | 206 packages installed / 207 audited; zero reported vulnerabilities |
| Unit/integration | 147 passed / 34 files |
| Browser scenarios | 17 passed / 2 files; no retries |
| Axe accessibility | 76 scans; zero violations |
| Duplicate DOM IDs | No duplicates across those 76 states |
| Normal route/width sweep | 78 passed: 12 routes × 6 widths + active patient × 6 widths |
| Doubled-text stress | 20 passed: 5 route/states × 4 widths, Russian |
| Frontend / backend / browser-test typechecks | Passed |
| Frontend / compiled backend builds | Passed |
| Realtime | Passed: HTTP + Socket.IO, lifecycle, reconnect, idempotency, cancellation |
| Official MediaPipe integration | 0.10.21 initialized and analyzed synthetic camera frames; stream recovery passed |
| Team simulated fallback | Production route remains labeled; mock requests stay in memory, with no API writes |
| Source submission audit | Passed: 205 source/assets/config/documentation files |
| Team preservation | No tracked deletions; classifier, hold logic and diagnostic configuration unchanged from main |
| Hygiene | No personal paths, credentials, databases, environment files or generated builds in the proposed Git changes |

The extra browser scenario covers the reconciled simulated fallback. Accessibility and width counts
come from the completed matrices in the passing browser tests. Ten documentation screenshots were
regenerated with sample data; mobile patient, Error Mode and request queue captures were visually
rechecked. Existing non-fatal MediaPipe OpenGL/projection warnings appeared again.

These results do not establish physical-camera accuracy, speaker audibility, screen-reader behavior,
outside-person usability, or public deployment. Those manual checks remain open.
