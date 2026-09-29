# Screenshot evidence

Captured from actual Chrome UI by `npm run test:e2e`. Sample data is created through the registration UI; requests, acknowledgements and replies use the real local HTTP/Socket.IO backend. No camera images were generated or substituted.

| Image | What it shows | Input limitation |
| --- | --- | --- |
| [Entry](entry.png) | Patient/staff starting screen | No recognition claim |
| [Patient](patient-test-input.png) | Request status and staff reply | Explicit development mock gesture input; camera off |
| [Mobile patient](patient-mobile-test-input.png) | 390px bedside layout | Same labeled mock input |
| [Error Mode](error-mode-fixture.png) | Localized pinky correction and production canvas drawing | Clearly labeled synthetic landmark UI fixture; no camera recognition |
| [Overview](overview.png) | Nurse station totals and queue | Sample sessions |
| [Request queue](request-queue.png) | Selected request, timeline and actions | Sample request |
| [Patient profile](patient-profile.png) | Session and communication history | Sample patient |
| [Dialog](dialog.png) | Timestamped reply history | Real backend records for sample session |
| [Camera QA](camera-qa.png) | Blank six-gesture review/export tool | No physical trial results |
| [Quality](quality.png) | Honest empty measurements and separate checks | No made-up metrics; camera not started in capture |

The browser test can regenerate these images. They are presentation backups and layout evidence, not recognition-accuracy or clinical-validation evidence.

Patient and Error Mode captures crop to the product surface, excluding developer controls while retaining the explicit simulated-input labels. Staff captures use one scoped sample session.
