import type { FastifyInstance } from 'fastify';
import { initCommissionsApp } from './commissions/index.js';
import { initReapprovalsApp } from './reapprovals/index.js';
import { initSupplierRequestsApp } from './supplier_requests/index.js';

export function initApps(app: FastifyInstance): void {
  initCommissionsApp(app);
  initReapprovalsApp(app);
  initSupplierRequestsApp(app);
}
