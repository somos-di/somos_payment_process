import type { FastifyInstance } from 'fastify';
import type { CatalogController } from '../controllers/catalogController.js';

// Catálogos de domínio normalizados no backend (cacheados) para o front consumir no boot.
export function registerCatalogRoutes(app: FastifyInstance, catalog_center: CatalogController): void {
  app.get('/catalog/status', catalog_center.status);
  app.get('/catalog/bootstrap', catalog_center.bootstrap);
}
