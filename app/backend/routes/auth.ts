import type { FastifyInstance } from 'fastify';
import type { AuthController } from '../controllers/authController.js';

// públicas: login/logout. (me é protegida — registrada no plugin com requireAuth)
export function registerPublicAuthRoutes(app: FastifyInstance, c: AuthController): void {
  app.post('/auth/login', c.login);
  app.post('/auth/logout', c.logout);
}
// protegidas: /auth/me é essencial (o front lê a sessão por ela no Auth.init).
// /auth/whoami era só diagnóstico (auth.uid() visto pelo Postgres) — removido.
export function registerProtectedAuthRoutes(app: FastifyInstance, c: AuthController): void {
  app.get('/auth/me', c.me);
}
