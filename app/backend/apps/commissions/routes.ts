import type { FastifyInstance } from 'fastify';
import type { CommissionsController } from './commissionsController.js';

export function registerCommissionsRoutes(app: FastifyInstance, commissions_center: CommissionsController): void {
  app.get('/commissions', commissions_center.list);
  app.post('/commissions/create', commissions_center.create);
  app.post('/commissions/empreendimentos', commissions_center.upsertEmpreendimento);
  app.post('/commissions/empreendimentos/remove', commissions_center.removeEmpreendimento);
  app.get('/commissions/:uuid', commissions_center.get);
  app.post('/commissions/:uuid/comment', commissions_center.comment);
  app.post('/commissions/:uuid/:action', commissions_center.action);
}
