import type { FastifyInstance } from 'fastify';
import type { AuthController } from '../controllers/authController.js';

// públicas: login/logout. (me é protegida — registrada no plugin com requireAuth)
export function registerPublicAuthRoutes(app: FastifyInstance, c: AuthController): void {
  // brute-force: login bem mais estrito que o global (10/min por IP)
  app.post('/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, c.login);
  app.post('/auth/logout', c.logout);
  // SSO Microsoft (Azure via Supabase) — fluxo por redirect, sem auth prévia
  app.get('/auth/oauth/microsoft', c.oauthStart);
  app.get('/auth/callback', c.oauthCallback);
}
// protegidas: /auth/me é essencial (o front lê a sessão por ela no Auth.init).
// /auth/whoami era só diagnóstico (auth.uid() visto pelo Postgres) — removido.
export function registerProtectedAuthRoutes(app: FastifyInstance, c: AuthController): void {
  app.get('/auth/me', c.me);
}
