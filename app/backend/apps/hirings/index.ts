import type { FastifyInstance } from 'fastify';
import { HiringsController } from './hiringsController.js';
import { HiringsService } from './hiringsService.js';
import { registerHiringsRoutes } from './routes.js';

export function initHiringsApp(app: FastifyInstance): void {
  const service = new HiringsService();
  const controller = new HiringsController(service);
  registerHiringsRoutes(app, controller);
}
