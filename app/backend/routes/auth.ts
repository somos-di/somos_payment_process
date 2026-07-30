import type { FastifyInstance } from 'fastify';
import type { AuthController } from '../controllers/authController.js';

export function registerPublicAuthRoutes(app: FastifyInstance, auth_center: AuthController): void {
  app.post('/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, auth_center.login);
  app.post('/auth/logout', auth_center.logout);
  app.get('/auth/oauth/microsoft', auth_center.oauthStart);
  app.get('/auth/callback', auth_center.oauthCallback);
}
export function registerProtectedAuthRoutes(app: FastifyInstance, auth_center: AuthController): void {
  app.get('/auth/me', auth_center.me);
}
