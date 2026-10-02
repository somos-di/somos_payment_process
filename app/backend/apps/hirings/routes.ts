import type { FastifyInstance } from 'fastify';
import type { HiringsController } from './hiringsController.js';

export function registerHiringsRoutes(app: FastifyInstance, hiring_center: HiringsController): void {
  app.get('/hirings', hiring_center.list);
  app.get('/hirings/departments', hiring_center.departments);
  app.get('/hirings/users', hiring_center.users);
  app.get('/hirings/options', hiring_center.options);
  app.post('/hirings/create', hiring_center.create);
  app.get('/hirings/:uuid', hiring_center.get);
  app.get('/hirings/:uuid/history', hiring_center.history);
  app.post('/hirings/:uuid/update', hiring_center.update);
  app.post('/hirings/:uuid/approve', hiring_center.approve);
  app.post('/hirings/:uuid/finalize', hiring_center.finalize);
  app.post('/hirings/:uuid/reject', hiring_center.reject);
  app.post('/hirings/:uuid/resubmit', hiring_center.resubmit);
  app.post('/hirings/:uuid/cancel', hiring_center.cancel);
  app.post('/departments/:id/managers', hiring_center.deptSetManagers);
}
