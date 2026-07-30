import type { FastifyInstance } from 'fastify';
import type { ProcessesController } from '../controllers/processesController.js';

export function registerProcessesRoutes(app: FastifyInstance, processes_center: ProcessesController): void {
  app.get('/processes', processes_center.list);
  app.get('/processes/pending-approvals', processes_center.pending);
  app.get('/processes/:uuid', processes_center.get);
  app.post('/processes/full', processes_center.createFull);
  app.post('/processes/bulk', processes_center.createBulk);
  app.post('/processes/approve-batch', processes_center.approveBatch);
  app.post('/processes/:uuid/log', processes_center.logEvent);
  app.post('/processes/:uuid/correct', processes_center.correct);
  app.post('/processes/:uuid/admin-edit', processes_center.adminEdit);
  app.post('/processes/:uuid/installments', processes_center.setInstallments);
  app.post('/processes/:uuid/:action', processes_center.action);
}
