import type { FastifyInstance } from 'fastify';
import type { AnalyticsReportsController } from './analyticsReportsController.js';

export function registerAnalyticsReportsRoutes(app: FastifyInstance, analytics_report_center: AnalyticsReportsController): void {
  app.get('/analytics-reports', analytics_report_center.list);
  app.get('/analytics-reports/:id/file', analytics_report_center.file);
}
