import type { FastifyInstance } from 'fastify';
import { CommissionsController } from './commissionsController.js';
import { CommissionsService } from './commissionsService.js';
import { registerCommissionsRoutes } from './routes.js';

// Mini app COMISSÕES: DI própria (service + controller) e registro das rotas.
// Chamado pelo initApps dentro do plugin protegido (requireAuth). Visibilidade por
// trilha (RLS) já vem do banco; não depende do container central.
export function initCommissionsApp(app: FastifyInstance): void {
  const service = new CommissionsService();
  const controller = new CommissionsController(service);
  registerCommissionsRoutes(app, controller);
}
