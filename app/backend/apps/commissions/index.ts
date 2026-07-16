import type { FastifyInstance } from 'fastify';
import { CommissionsController } from './commissionsController.js';
import { CommissionsService } from './commissionsService.js';
import { registerCommissionsRoutes } from './routes.js';

export function initCommissionsApp(app: FastifyInstance): void {
  const service = new CommissionsService();
  const controller = new CommissionsController(service);
  registerCommissionsRoutes(app, controller);
}
