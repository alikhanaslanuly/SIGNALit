import express from 'express';
import { serverConfig } from './config.js';
import cors from 'cors';
import type Database from 'better-sqlite3';
import { createDatabase } from './db/database.js';
import { createPatientService } from './services/patients.js';
import { createRequestService } from './services/requests.js';
import { ApiError } from './services/errors.js';
import { patientRoutes } from './routes/patients.js';
import { requestRoutes } from './routes/requests.js';
import type { Broadcast } from './realtime/socket.js';

export function createApp(options: { db?: Database.Database; broadcast?: Broadcast } = {}) {
  const db = options.db ?? createDatabase();
  const patients = createPatientService(db);
  const requests = createRequestService(db, patients);
  const broadcast = options.broadcast ?? (() => undefined);
  const app = express();
  const allowedOrigins = serverConfig().origins;
  app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)) }));
  app.use(express.json({ limit: '32kb' }));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/ready', (_req, res) => { try { db.prepare('SELECT 1 FROM patients LIMIT 1').get(); res.json({ ok: true, database: true }); } catch { res.status(503).json({ ok: false, database: false }); } });
  app.use('/api/patients', patientRoutes({ patients, requests }, broadcast));
  app.use('/api/requests', requestRoutes(requests, broadcast));
  app.use((_req, _res, next) => next(new ApiError('NOT_FOUND', 'Route not found', 404)));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error && typeof error === 'object' && 'type' in error) {
      if (error.type === 'entity.too.large') return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
      if (error.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } });
    }
    if (error instanceof ApiError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    if (error && typeof error === 'object' && 'issues' in error) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } });
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  });
  return { app, db, services: { patients, requests } };
}
