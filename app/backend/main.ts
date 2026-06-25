import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { createContainer } from './factories/container.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { requireAuth } from './middlewares/requireAuth.js';
import { registerProtectedRoutes, registerPublicRoutes } from './routes/index.js';
import { getSettings } from './settings.js';

const s = getSettings();
const { controllers } = createContainer();

// bodyLimit alto p/ upload de anexo em base64 (boleto/NF)
const app = Fastify({ logger: { level: 'info' }, trustProxy: true, bodyLimit: 20 * 1024 * 1024 });

// CORS_ORIGIN aceita lista separada por vírgula (ex.: http://localhost:3000,http://localhost:5500)
const corsOrigins = s.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
await app.register(cors, { origin: corsOrigins.length ? corsOrigins : true, credentials: true });
await app.register(cookie);

// Rate limiting / anti-brute-force. Chaveia por USUÁRIO (sub do JWT no cookie),
// caindo pra IP quando anônimo — assim 1 usuário não derruba os outros e não dá
// pra burlar trocando de IP atrás de NAT. Global: 200 req/min (override por rota,
// ex.: /auth/login mais estrito). Registrado antes das rotas.
await app.register(rateLimit, {
  global: true,
  max: 200,
  timeWindow: '1 minute',
  keyGenerator: (req) => {
    const tok = req.cookies?.[s.cookieName];
    if (tok) {
      try { return JSON.parse(Buffer.from(tok.split('.')[1], 'base64').toString()).sub || req.ip; } catch { /* fallback */ }
    }
    return req.ip;
  },
});

app.setErrorHandler(errorHandler);
app.get('/health', async () => ({ ok: true }));

// públicas (sem auth)
await app.register(async (api) => { registerPublicRoutes(api, controllers); }, { prefix: '/api/v1' });

// protegidas (default-deny: requireAuth como preHandler do plugin)
await app.register(async (api) => {
  api.addHook('preHandler', requireAuth);
  registerProtectedRoutes(api, controllers);
}, { prefix: '/api/v1' });

const shutdown = async (sig: string) => {
  app.log.info({ sig }, 'shutdown'); try { await app.close(); } catch (e) { app.log.error(e); } process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

app.listen({ port: s.port, host: s.host })
  .then(() => app.log.info(`backend on http://${s.host}:${s.port}`))
  .catch((e) => { app.log.error(e); process.exit(1); });
