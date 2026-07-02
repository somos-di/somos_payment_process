import Redis from 'ioredis';
import { getSettings } from '../settings.js';

// Cliente Redis OPCIONAL: se REDIS_URL não estiver setado, devolve null (sem cache —
// o CacheManager vai direto ao banco em todo get). Se estiver setado mas o Redis cair,
// os comandos rejeitam rápido (enableOfflineQueue:false) e o CacheManager degrada pro
// banco — nunca derruba o request.
export function createRedisClient(): Redis | null {
  const { redisUrl } = getSettings();
  if (!redisUrl) return null;

  const client = new Redis(redisUrl, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  let loggedError = false;
  client.on('error', (err) => {
    if (!loggedError) { // loga 1x pra não spammar quando o Redis está fora
      loggedError = true;
      console.warn('[redis] indisponível, cache cai pra L1:', (err as Error).message);
    }
  });
  client.on('ready', () => { loggedError = false; });

  return client;
}
