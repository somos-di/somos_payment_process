import type { FastifyInstance } from 'fastify';
import type { ProcessesController } from '../controllers/processesController.js';

export function registerProcessesRoutes(app: FastifyInstance, c: ProcessesController): void {
  app.get('/processes', c.list);
  app.get('/processes/pending-approvals', c.pending);
  app.get('/processes/:uuid', c.get);
  app.post('/processes', c.create);
  app.post('/processes/full', c.createFull); // processo + parcelas (Solicitar)
  app.post('/processes/bulk', c.createBulk); // lançamento em massa
  app.post('/processes/:uuid/log', c.logEvent); // registra evento no histórico (static > :action)
  app.post('/processes/:uuid/correct', c.correct); // correção: edita dados/parcelas (+reenviar)
  app.post('/processes/:uuid/installments', c.setInstallments); // CRUD de parcelas (financeiro)
  // ações: approve | reject | close | financeiro-reject | send-uau
  app.post('/processes/:uuid/:action', c.action);
}
