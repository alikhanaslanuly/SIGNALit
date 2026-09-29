# Judge Q&A

**What did the team build?**
SIGNALit's feature extraction, six-gesture scoring, stable hold, corrective Error Mode, calibration/training flow, dialog state machine, semantic request API, realtime patient–staff loop and staff interface. MediaPipe supplies hand landmarks; we did not train that model.

**What is the main difference from showing a recognized gesture?**
The correction helps the user form the pose, then the request becomes a tracked conversation: sent, acknowledged, replied to, completed. The patient can see staff's response.

**Is this sign-language translation?**
No. It is a custom vocabulary of YES, NO, HELP, PAIN, WATER and TOILET.

**How does Error Mode choose a correction?**
It checks visibility/framing/lighting, pose quality, finger configuration and dialog context. One stable hint drives both the localized text and the highlighted landmark chain. A bent pinky during HELP needs straightening; WATER expects that pinky folded.

**What prevents accidental requests?**
The existing confidence and stable-hold rules. WATER and TOILET need YES confirmation. HELP and PAIN send immediately and retain a five-second NO cancellation window. These choices reduce some mistakes but do not establish clinical safety.

**What is your accuracy?**
We do not claim population recognition accuracy. The repository has 11 anonymous regression fixtures from one participant. The quality page measures frames, hand visibility, confirmations, correction hints and confirmation time. These counts have no ground-truth denominator and must not be called accuracy.

**What was tested automatically?**
Core gesture/hold/calibration/error logic; exact highlight mapping and mirroring; API validation; request/reply idempotency; status ordering; migration and database reopen; real HTTP/Socket.IO reconnects; and two isolated browsers driven through the patient/staff UI. Browser tests use explicitly controlled intent input. A separate synthetic-camera test initializes the actual MediaPipe model and analyzes frames, but does not validate physical-hand recognition. See QA_REPORT.md for final counts.

**Does video leave the device?**
The product processes video and landmarks locally. It sends semantic communication events. The backend stores display name/room, requests/status times, replies, questions and answers. Quality export contains local aggregates, not images or raw landmarks.

**What happens offline?**
The interface reports the lost connection and unconfirmed delivery. A failed command can be retried while the page is open; request and reply keys prevent duplicate records. Reconnect reads current server state. There is no durable offline outbox, so refreshing before delivery loses unsent commands.

**Can data survive refresh or restart?**
Server-saved data survives browser refresh. Normal local server startup uses `data/signalit.db` and survives server restart. Tests use memory databases. Hosted restart durability requires a persistent disk; a temporary serverless filesystem does not provide it.

**Can it run on Vercel?**
The checked-in configuration deploys the frontend only. The supported demo backend is one persistent Node process with Socket.IO and SQLite on persistent storage. This repository does not package that backend as serverless functions. See DEPLOYMENT.md for its supported topology.

**Are all replies saved?**
New replies are append-only, individually timestamped and protected against retries with the same key. The compatible `quickReply` field still provides the latest reply to older clients. Pre-migration replies cannot acquire a truthful timestamp retroactively and remain labeled accordingly.

**Does “active patient” mean online?**
No. It means the session is enabled. The connection indicator refers to the device showing it; patient presence is not implemented.

**Is it ready for clinical use?**
No. It needs authentication/authorization, clinical and accessibility evaluation, wider recognition studies, operational security and reliability work. It does not replace existing emergency or nurse-call channels.

**What is next?**
Ground-truth trials across users, cameras, lighting and mobility needs; testing with assistive-technology users; authenticated staff access; and a production persistence/deployment design. Device validation comes before any accuracy or safety claims.

**Why only six gestures, and why MediaPipe?**
Six intents keep the interaction easy to learn and the state machine understandable. MediaPipe supplies a practical existing hand-landmark model, allowing the team to focus on corrective guidance and communication rather than training a vision model.

**Why hold confirmation?**
A passing hand shape should not immediately become a request. The pose must persist through candidate and holding states. This trades some speed for intentional input; it does not eliminate all recognition errors.

**Who is the target user?**
People who temporarily find speech difficult and can comfortably perform this small gesture set. Users with different motor or visual needs require evaluation and alternative input methods; the current prototype does not serve everyone.

**Why not just use a nurse-call button?**
A button communicates that help is needed, but not always what the patient needs. SIGNALit explores HELP, PAIN, WATER, TOILET and YES/NO with a visible staff response. It does not replace established nurse-call systems.

**What accessibility work is present?**
English/Russian copy, readable status and replies, visible keyboard focus, a staff skip link, large controls, reduced motion, optional speech and sound, and visual feedback that remains usable with sound off. Real screen-reader and user testing are still outstanding.

**Can patient and staff use different devices?**
Yes, when both reach the same configured backend and the patient page uses HTTPS. A laptop browser test does not verify phone camera permission or mirroring; those must be checked on the actual device.

**What exactly does MediaPipe do?**
It detects a hand and estimates 21 landmark positions and handedness on the device. Our code interprets the geometric features; MediaPipe does not run our six-intent dialog or deliver staff requests.

**How are gestures scored?**
Finger extension, thumb orientation and other geometric features are compared with the existing six pose definitions. Confidence and stable-hold logic gate confirmation. This pass did not change definitions, thresholds or timing.

**Why SQLite?**
It keeps a single-process demo easy to start and preserves sessions, requests and replies without another database service. A persistent disk and one backend process are required; a larger deployment needs a deliberate shared-storage design.

**How do you measure recognition quality now?**
The team QA page pairs expected gestures and human recognition/alignment review with measured confirmations, timing, corrections, FPS and tracking. JSON/CSV exports contain no images or landmarks. Results are blank until actual device trials; a six-gesture rehearsal is not a population accuracy study.
