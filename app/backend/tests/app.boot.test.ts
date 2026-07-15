import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createContainer } from '../factories/container.js';
import { errorHandler } from '../middlewares/errorHandler.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { registerProtectedRoutes, registerPublicRoutes } from '../routes/index.js';
import './_env.js';

// Monta o app do MESMO jeito que o main.ts (menos o app.listen) e valida via
// app.inject (sem porta real) que ele SOBE, registra as rotas e o default-deny vale.
async function buildTestApp(): Promise<FastifyInstance> {
  const { controllers, authService } = createContainer();
  const app = Fastify({ bodyLimit: 20 * 1024 * 1024 });
  await app.register(cookie);
  app.setErrorHandler(errorHandler);
  app.get('/health', async () => ({ ok: true }));
  await app.register(async (api) => { registerPublicRoutes(api, controllers); }, { prefix: '/api/v1' });
  await app.register(async (api) => {
    api.addHook('preHandler', requireAuth(authService));
    registerProtectedRoutes(api, controllers);
  }, { prefix: '/api/v1' });
  await app.ready(); // compila e valida TODAS as rotas — lança se algo estiver mal registrado
  return app;
}

test('app sobe (ready) e responde GET /health', async () => {
  const app = await buildTestApp();
  try {
    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { ok: true });
  } finally { await app.close(); }
});

test('todas as rotas registram sem erro (ready não lança)', async () => {
  const app = await buildTestApp();
  await app.close(); // se buildTestApp resolveu, o ready() passou
  assert.ok(true);
});

test('rota protegida sem sessão -> 401 (default-deny do preHandler)', async () => {
  const app = await buildTestApp();
  try {
    const res = await app.inject({ method: 'GET', url: '/api/v1/commissions' });
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error.code, 'unauthorized');
  } finally { await app.close(); }
});
