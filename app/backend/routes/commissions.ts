import type { FastifyInstance } from 'fastify';
import type { CommissionsController } from '../controllers/commissionsController.js';

export function registerCommissionsRoutes(app: FastifyInstance, commissions_center: CommissionsController): void {
  app.get('/commissions', commissions_center.list);
  // criação manual (trilha/admin) — rota ESTÁTICA antes da paramétrica :uuid
  app.post('/commissions/create', commissions_center.create);
  // cadastro de empreendimentos (admin) — rotas ESTÁTICAS antes da paramétrica :uuid
  app.post('/commissions/empreendimentos', commissions_center.upsertEmpreendimento);
  app.post('/commissions/empreendimentos/remove', commissions_center.removeEmpreendimento);
  app.get('/commissions/:uuid', commissions_center.get);
  // ações do fluxo: validate | set-nf | finalize | pendency | resolve | cancel
  app.post('/commissions/:uuid/:action', commissions_center.action);
}
