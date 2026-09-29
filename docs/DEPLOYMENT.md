# Deployment package

No public deployment was performed. `vercel.json` is a **frontend-only** SPA configuration.
The supported backend is one persistent Node 24 process with SQLite on a writable persistent disk.
The app has no authentication/authorization; use sample data in a controlled demo environment.

## Build and run

```bash
npm ci
npm run server:build
# On the frontend build host, set VITE_API_URL=https://api.your-domain.example
# Or leave it empty when a reverse proxy serves API and frontend at the same origin.
npm run build
```

Serve `dist/` using a static host with all application routes falling back to `index.html`.
On the Node host, configure runtime environment and run the compiled server:

```bash
FRONTEND_ORIGIN=https://your-frontend.example \
SIGNAL_DB_PATH=/var/lib/signalit/signalit.db \
PORT=4000 npm start
```

Replace the example hostname with the exact reachable HTTPS origin. `npm start` sets production
mode, runs `server/dist/index.js`, and needs a prior `npm run server:build`. It does not use tsx.
Install/build with development dependencies first; deployment runtime needs the production
dependencies, compiled `server/dist`, and `scripts/start-server.mjs`. SQLite's native package
must be installed for the host platform/Node version. Use a process manager for restarts.

| Variable | Scope | Meaning |
| --- | --- | --- |
| `VITE_API_URL` | Frontend build | Empty for same-origin, or public HTTPS API **origin**, without path |
| `FRONTEND_ORIGIN` | Backend runtime | Required in production; exact HTTPS origins, comma-separated, no wildcard/path |
| `SIGNAL_DB_PATH` | Backend runtime | Required persistent file in production; `:memory:` rejected |
| `PORT` | Backend runtime | Integer 1–65535; default 4000 |

The configuration examples above contain public settings only. The backend does not implicitly
load dotenv files; export variables or configure the host. Production rejects missing origin/disk,
invalid ports and non-HTTPS origins. Explicit production loopback/plain HTTP frontend API values fail
at build time. An implicit local `.env` loopback default is ignored with a build message, using
same-origin instead. `SIGNAL_ALLOW_LOCAL_API=1` is solely for disposable local browser previews.
Never enable that override for a public build. Vite variables need a rebuild; runtime variables need a restart.

## Reverse proxy and storage

Terminate trusted HTTPS at the proxy. Forward `/api/*`, `/health`, `/ready` and `/socket.io/*`
to the Node port. Support both WebSocket upgrades and long-polling. HTTP and Socket.IO use the same
exact origin allowlist; CORS is not authentication. A same-origin setup leaves `VITE_API_URL` empty.
A split-host setup builds with the HTTPS API origin and allows the exact frontend origin on Node.

`GET /health` returns `{ "ok": true }`. `GET /ready` runs a database query and returns
`{ "ok": true, "database": true }`, or HTTP 503 with false values. Neither exposes database paths.
After publishing, check both endpoints, direct navigation to `/register` and `/dashboard/quality`,
patient/staff socket connection, and a full request/reply lifecycle from two devices.

SQLite creates a missing directory and uses WAL. Keep DB/WAL/SHM together on persistent storage.
Do not put them in temporary serverless storage. One backend process is supported; replicas need
shared persistence and a Socket.IO adapter. Reopen tests validate local persistence, not your host's disk policy.
Staff diagnostics show the build SHA/time (archive builds use `local`) to detect stale frontend deployments.

## Laptop + phone on one network

`npm run demo` binds Vite to `0.0.0.0:5173` and proxies API/Socket.IO to Node. It starts both
processes and stops both with Ctrl+C. If a local dev server already uses that port, stop your old
server or choose another with `SIGNAL_DEMO_PORT=5187 PORT=4627 npm run demo`. On a trusted LAN, open the laptop's reachable address to
check layout and networking. A phone's `localhost` points to the phone, not the laptop.
**Plain LAN HTTP does not provide a secure camera context.**

For camera tests, use a trusted HTTPS reverse proxy or a team-managed HTTPS development tunnel
forwarding to port 5173. Do not bypass certificate warnings or browser camera protections.
Open that HTTPS origin in the registration screen **before** creating the session; copied URLs
and QR codes then contain that origin. The demo proxy keeps frontend/API/socket requests on the
same browser origin. Do not point a phone build at laptop `localhost:4000`.

On the phone, run diagnostics and camera QA, stop their camera, then open the patient link.
On the laptop open the paired Staff URL. Test HELP → ACK → reply → complete and refresh.
A desktop system check does not validate phone mirroring, camera permissions or audible speech.
