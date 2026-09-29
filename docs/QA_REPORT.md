> Historical pre-closure report. See [the final Experience report](PERSON2_FINAL_REPORT.md) for the latest checks and Git delivery status.

# Final submission hardening — 29 September 2026

The baseline was rerun before editing: 129 tests / 31 files, both type checks, production build,
realtime smoke and 7 browser scenarios passed. There is no `.git` directory in this source archive.
SHA-256 comparison confirms **31 files** in vision, gestures, contracts and dialog match their
pre-edit contents. Classifier definitions, thresholds, hold timing and dialog semantics are frozen.
The [earlier report](QA_PRIOR_PASS.md) remains historical evidence.

## Automated gates

| Check | Result |
| --- | --- |
| Unit/integration suite | 139 passed / 33 files |
| Frontend and server type checks | Passed |
| Compiled Node server build | Passed |
| Production frontend build | Passed; default production API is same-origin |
| Realtime lifecycle smoke | Passed; real HTTP + Socket.IO, disposable DB |
| Browser scenarios | 10 passed, including the judge lifecycle and QA export |
| Route/width sweep | 78 checks across six widths |
| Source submission audit | Passed; links, screenshot references, path/credential patterns, file sizes |

`npm run preflight` runs types, all fast unit/integration tests, both builds and the source audit.
`npm run verify` adds realtime and browser suites. `npm run test:judge` selects the named judge
lifecycle. No lint script exists; lint is not claimed.

## Browser evidence

1. **judge demo lifecycle**: independent patient/staff contexts, sample session, labeled mock HELP,
   acknowledgement, WAIT + COMING replies, completion, refresh and timestamped history.
2. Offline delivery/retry, delayed HTTP/socket overlap, missed-event recovery and no duplicate requests.
3. Controlled camera permission denial and actionable retry.
4. 12 routes × six widths, plus six active patient widths; screenshot capture, no horizontal overflow
   or page errors in that sweep. Widths: 390, 430, 768, 1024, 1440, 1920.
5. Real MediaPipe model with Chrome's **synthetic camera**, followed by interruption, QA attempt,
   honest failed human review and JSON export. This does not validate physical hand recognition.
6. Russian, dark theme, reduced motion and keyboard skip-link navigation.
7. Production preview with real backend and no mock controls even with `debug=1`.
8. Exact paired URLs, rendered QR and clipboard-denial fallback.
9. Separate team QA route: initially incomplete, export/start attempt disabled as appropriate.
10. Malformed JSON (400), oversized body (413), and script-like patient text rendered as text.

The route sweep adds `/dashboard/quality/camera-test` to the prior 11 routes. The
[nine screenshots](assets/README.md) include eight README product surfaces plus a mobile patient
capture. Patient debug controls are hidden only during screenshot capture; the visible simulated-input
labels remain. Error Mode is clearly a landmark fixture. Staff data is scoped to one sample session.
MediaPipe emits its existing OpenGL/projection warnings during synthetic-camera inference.

## Camera QA and readiness

The team route uses the existing engine/adapter. Fast mode requires six normal-condition checks;
Extended requires both hands, with optional lighting/distance attempts. Human review is mandatory.
READY requires passing coverage, no failed saved attempt, and observed aligned HELP pinky correction.
Results are semantic events and numeric counters only, held in page memory; download before leaving.
CSV formula-like text is escaped. No generated manual results have been inserted into README.

System READY requires live camera permission/stream/model and positive analyzed FPS, secure context,
backend health, a database query and realtime connection. Backend/database checks refresh every ten
seconds; camera interruption removes readiness. The sound test is explicit and requires human hearing
confirmation; software cannot establish speaker volume or audibility.

## Startup, persistence and security checks

- `npm run demo` was smoke-tested on unused ports with a disposable DB: frontend, proxied `/ready`,
  and both ports released on Ctrl+C. Existing developer processes were left running.
- Compiled `npm start` opened a temporary file-backed DB, returned readiness, permitted the configured
  HTTPS origin and omitted CORS permission for an unlisted origin. Missing production config failed clearly.
- File-backed integration tests create/ack/reply/complete, close and reopen SQLite, verify timestamps,
  append-only replies and idempotency; legacy migration remains covered.
- Database-closed `/ready` returns 503 without paths; `/health` still reports process liveness.
- Display names are limited to 100 characters; rooms to 30. Replies use a fixed enum, not raw HTML/freeform
  strings. Script-like and oversized reply codes are rejected. React renders metadata as text.
- JSON bodies are capped at 32 KB; malformed/oversized parser errors have safe 400/413 responses.
- Production requires exact HTTPS frontend origins and a file database; configured production frontend
  API must be HTTPS/non-loopback. The only added dependency is pinned qrcode-generator 2.0.4.
  Installation reported zero audited vulnerabilities; no force upgrades were performed.

## Submission audit and limits

Application/source docs contain no detected personal filesystem paths or credential patterns. Local
env variants, database files, exports, logs, dependencies and builds are ignored. The archive has no
Git index, so **tracked-file cleanliness cannot be certified**. Local ignored files were not destroyed.
Large MediaPipe model/WASM assets are intentional and have provenance docs.

The remaining development URLs are classified as test fixtures, local startup/proxy configuration,
build validation, secure-context guidance, or upstream vendor/provenance links. No production API silently
points at localhost. The lone application-repository `console.log` outside vendor code is the realtime
test's intentional PASS output. No unresolved application TODO/FIXME was found; vendored sources and
frozen development harnesses are retained. Source scanning is a sanity check, not a full security audit.

There is no authentication, patient online presence, durable offline outbox, multi-server coordination,
clinical validation or measured population accuracy. No public deployment, real laptop/phone hand trial,
audible speech test or screen-reader validation was performed.

**Software demo: READY — YES.** Automated gates described above passed.
**Physical camera:** MANUAL CHECK REQUIRED using [REAL_CAMERA_CHECKLIST.md](REAL_CAMERA_CHECKLIST.md).
Fill the [blank results template](CAMERA_QA_RESULTS.md) only after actual trials.
