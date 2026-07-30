import type { FastifyInstance } from 'fastify';
import { initCommissionsApp } from './commissions/index.js';
import { initReapprovalsApp } from './reapprovals/index.js';

export function initApps(app: FastifyInstance): void {
  initCommissionsApp(app);
  initReapprovalsApp(app);
}
