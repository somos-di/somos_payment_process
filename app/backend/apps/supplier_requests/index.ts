import type { FastifyInstance } from 'fastify';
import { registerSupplierRequestsRoutes } from './routes.js';
import { SupplierRequestsController } from './supplierRequestsController.js';
import { SupplierRequestsService } from './supplierRequestsService.js';

export function initSupplierRequestsApp(app: FastifyInstance): void {
  const service = new SupplierRequestsService();
  const controller = new SupplierRequestsController(service);
  registerSupplierRequestsRoutes(app, controller);
}
