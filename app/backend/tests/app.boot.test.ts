import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createContainer } from '../factories/container.js';
import { errorHandler } from '../middlewares/errorHandler.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { registerProtectedRoutes, registerPublicRoutes } from '../routes/index.js';
import './_env.js';

async function buildTestApp(): Promise<FastifyInstance> {
  const { controllers, authService } = createContainer();
  const app = Fastify({ bodyLimit: 20 * 1024 * 1024 });
  await app.register(cookie);
  app.setErrorHandler(errorHandler);
  app.get('/health', async () => ({ ok: true }));
  await app.register(async (scopedApp) => { registerPublicRoutes(scopedApp, controllers); }, { prefix: '/api/v1' });
  await app.register(async (scopedApp) => {
    scopedApp.addHook('preHandler', requireAuth(authService));
    registerProtectedRoutes(scopedApp, controllers);
  }, { prefix: '/api/v1' });
  await app.ready();
  return app;
}

test('app sobe (ready) e responde GET /health', async () => {
  const app = await buildTestApp();
  try {
    const response = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ok: true });
  } finally { await app.close(); }
});

test('todas as rotas registram sem erro (ready não lança)', async () => {
  const app = await buildTestApp();
  await app.close();
  assert.ok(true);
});

test('rota protegida sem sessão -> 401 (default-deny do preHandler)', async () => {
  const app = await buildTestApp();
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/commissions' });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error.code, 'unauthorized');
  } finally { await app.close(); }
});
