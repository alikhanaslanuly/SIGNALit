import { Router } from 'express';
import { requestSchema, replySchema } from '../validation/schemas.js';
import { ApiError } from '../services/errors.js';
import type { Broadcast } from '../realtime/socket.js';

type RequestService = ReturnType<typeof import('../services/requests.js').createRequestService>;
export function requestRoutes(requests: RequestService, broadcast: Broadcast): Router {
  const router = Router();
  router.post('/', (req, res, next) => {
    try {
      const input = requestSchema.parse(req.body);
      const request = requests.create(input.patientId, input.type, input.clientRequestId);
      broadcast('REQUEST_CREATED', request, request.patientId);
      res.status(201).json(request);
    } catch (error) { next(error); }
  });
  router.get('/', (req, res, next) => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : 'all';
      if (!['all', 'active', 'completed'].includes(status)) throw new ApiError('INVALID_FILTER', 'Invalid request status filter');
      const patientId = typeof req.query.patientId === 'string' ? req.query.patientId : undefined;
      const room = typeof req.query.room === 'string' ? req.query.room : undefined;
      res.json(requests.list({ status, patientId, room }));
    } catch (error) { next(error); }
  });
  router.get('/:id', (req, res, next) => {
    try { res.json(requests.find(req.params.id)); } catch (error) { next(error); }
  });
  router.post('/:id/acknowledge', (req, res, next) => {
    try {
      const request = requests.acknowledge(req.params.id);
      broadcast('REQUEST_UPDATED', request, request.patientId);
      res.json(request);
    } catch (error) { next(error); }
  });
  router.post('/:id/complete', (req, res, next) => {
    try {
      const request = requests.complete(req.params.id);
      broadcast('REQUEST_UPDATED', request, request.patientId);
      res.json(request);
    } catch (error) { next(error); }
  });
  router.post('/:id/cancel', (req, res, next) => {
    try { const request = requests.cancel(req.params.id); broadcast('REQUEST_UPDATED', request, request.patientId); res.json(request); } catch (error) { next(error); }
  });
  router.post('/:id/replies', (req, res, next) => {
    try {
      const { code, clientReplyId } = replySchema.parse(req.body);
      const request = requests.reply(req.params.id, code, clientReplyId);
      broadcast('QUICK_REPLY_CREATED', request, request.patientId);
      res.json(request);
    } catch (error) { next(error); }
  });
  return router;
}
