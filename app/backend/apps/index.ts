import type { FastifyInstance } from 'fastify';
import { initAnalyticsReportsApp } from './analytics_reports/index.js';
import { initCommissionsApp } from './commissions/index.js';
import { initHiringsApp } from './hirings/index.js';
import { initReapprovalsApp } from './reapprovals/index.js';
import { initSupplierRequestsApp } from './supplier_requests/index.js';

export function initApps(app: FastifyInstance): void {
  initCommissionsApp(app);
  initReapprovalsApp(app);
  initSupplierRequestsApp(app);
  initHiringsApp(app);
  initAnalyticsReportsApp(app);
}
