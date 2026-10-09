import type { FastifyInstance } from 'fastify';
import { getSettings } from '../../settings.js';
import { AnalyticsReportsController } from './analyticsReportsController.js';
import { SupabaseAnalyticsReportsGateway } from './analyticsReportsGateway.js';
import { AnalyticsReportsService } from './analyticsReportsService.js';
import { registerAnalyticsReportsRoutes } from './routes.js';

export function initAnalyticsReportsApp(app: FastifyInstance): void {
  const gateway = new SupabaseAnalyticsReportsGateway(getSettings().analyticsReportsBucket);
  const service = new AnalyticsReportsService(gateway);
  const controller = new AnalyticsReportsController(service);
  registerAnalyticsReportsRoutes(app, controller);
}
