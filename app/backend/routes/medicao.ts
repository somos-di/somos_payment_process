import type { FastifyInstance } from 'fastify';
import type { MeasurementController } from '../controllers/measurementController.js';

export function registerMeasurementRoutes(app: FastifyInstance, measurement_center: MeasurementController): void {
  app.all('/medicao', measurement_center.proxy);
  app.all('/medicao/*', measurement_center.proxy);
}
