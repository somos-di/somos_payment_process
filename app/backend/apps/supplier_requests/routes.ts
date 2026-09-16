import type { FastifyInstance } from 'fastify';
import type { SupplierRequestsController } from './supplierRequestsController.js';

export function registerSupplierRequestsRoutes(app: FastifyInstance, supplier_center: SupplierRequestsController): void {
  app.get('/supplier-requests', supplier_center.list);
  app.get('/supplier-requests/lookup', supplier_center.lookup);
  app.get('/supplier-requests/check-uau', supplier_center.checkUau);
  app.post('/supplier-requests/create', supplier_center.create);
  app.get('/supplier-requests/:uuid', supplier_center.get);
  app.post('/supplier-requests/:uuid/comment', supplier_center.comment);
  app.post('/supplier-requests/:uuid/send', supplier_center.send);
  app.post('/supplier-requests/:uuid/:action', supplier_center.action);
}
