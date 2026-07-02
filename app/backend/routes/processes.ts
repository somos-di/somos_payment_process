import type { FastifyInstance } from 'fastify';
import type { ProcessesController } from '../controllers/processesController.js';

export function registerProcessesRoutes(app: FastifyInstance, processes_center: ProcessesController): void {
  app.get('/processes', processes_center.list);
  app.get('/processes/pending-approvals', processes_center.pending);
  app.get('/processes/:uuid', processes_center.get);
  app.post('/processes/full', processes_center.createFull); // processo + parcelas (Solicitar)
  app.post('/processes/bulk', processes_center.createBulk); // lançamento em massa
  app.post('/processes/:uuid/log', processes_center.logEvent); // registra evento no histórico (static > :action)
  app.post('/processes/:uuid/correct', processes_center.correct); // correção: edita dados/parcelas (+reenviar)
  app.post('/processes/:uuid/installments', processes_center.setInstallments); // CRUD de parcelas (financeiro)
  // ações: approve | reject | close | financeiro-reject | send-uau
  app.post('/processes/:uuid/:action', processes_center.action);
}
