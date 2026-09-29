import { Router } from 'express';
import { patientPatchSchema, patientSchema, questionSchema, answerSchema } from '../validation/schemas.js';
import { ApiError } from '../services/errors.js';
import type { Broadcast } from '../realtime/socket.js';

export function patientRoutes(services: { patients: ReturnType<typeof import('../services/patients.js').createPatientService>; requests: ReturnType<typeof import('../services/requests.js').createRequestService> }, broadcast: Broadcast): Router {
  const router = Router();
  router.post('/', (req, res, next) => {
    try {
      const input = patientSchema.parse(req.body);
      const patient = services.patients.create(input);
      broadcast('PATIENT_CREATED', patient);
      res.status(201).json(patient);
    } catch (error) { next(error); }
  });
  router.get('/', (_req, res) => res.json(services.patients.list()));
  router.get('/:id', (req, res, next) => {
    try { res.json(services.patients.find(req.params.id)); } catch (error) { next(error); }
  });
  router.patch('/:id', (req, res, next) => {
    try { const patient = services.patients.update(req.params.id, patientPatchSchema.parse(req.body)); broadcast('PATIENT_UPDATED', patient); res.json(patient); } catch (error) { next(error); }
  });
  router.post('/:id/questions', (req, res, next) => {
    try {
      const { questionId } = questionSchema.parse(req.body);
      const event = services.requests.addQuestion(req.params.id, questionId);
      broadcast('QUESTION_CREATED', event, req.params.id);
      res.status(201).json(event);
    } catch (error) { next(error); }
  });
  router.post('/:id/answers', (req, res, next) => {
    try {
      const { questionId, answer } = answerSchema.parse(req.body);
      const event = services.requests.addAnswer(req.params.id, questionId, answer);
      broadcast('ANSWER_CREATED', event, req.params.id);
      res.status(201).json(event);
    } catch (error) { next(error); }
  });
  router.get('/:id/dialog', (req, res, next) => {
    try { res.json(services.requests.dialog(req.params.id)); } catch (error) { next(error); }
  });
  return router;
}
