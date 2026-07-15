import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CacheManager } from '../cache/cacheManager.js';
import { CacheWarmer } from '../cache/cacheWarmer.js';
import { CACHEABLE_RESOURCES, UAU_RESOURCES, cacheKey, resourcePrefix } from '../cache/cacheableResources.js';

// ── cacheableResources (chaves puras) ─────────────────────────────────────
test('cacheKey: formato base e variação por count/head/ops', () => {
  assert.equal(cacheKey('v_obras', []), 'data:v_obras::[]');
  assert.notEqual(cacheKey('v_obras', [], true), cacheKey('v_obras', []));
  assert.notEqual(cacheKey('v_obras', [], false, true), cacheKey('v_obras', []));
  assert.notEqual(cacheKey('v_obras', [['eq', 'a', 1]]), cacheKey('v_obras', []));
});

test('resourcePrefix casa o recurso', () => {
  assert.equal(resourcePrefix('v_obras'), 'data:v_obras:');
  assert.ok(cacheKey('v_obras', []).startsWith(resourcePrefix('v_obras')));
});

test('UAU_RESOURCES é subconjunto de CACHEABLE_RESOURCES', () => {
  for (const r of UAU_RESOURCES) assert.ok(CACHEABLE_RESOURCES.has(r), `${r} deveria ser cacheável`);
});

// ── CacheManager sem Redis ────────────────────────────────────────────────
test('CacheManager(null): enabled=false, wrap chama fetcher, set/invalidate são no-op', async () => {
  const cm = new CacheManager(null, 1000);
  assert.equal(cm.enabled, false);
  let calls = 0;
  const v = await cm.wrap('k', async () => { calls++; return 42; });
  assert.equal(v, 42);
  assert.equal(calls, 1);
  await cm.set('k', 1);
  await cm.invalidatePrefix('data:');
});

// ── CacheManager com Redis (fake em memória) ──────────────────────────────
test('CacheManager: miss chama fetcher e popula; hit não refaz', async () => {
  const store: Record<string, string> = {};
  const redis: any = {
    get: async (k: string) => (k in store ? store[k] : null),
    set: async (k: string, v: string) => { store[k] = v; },
  };
  const cm = new CacheManager(redis, 1000);
  assert.equal(cm.enabled, true);
  let calls = 0;
  assert.deepEqual(await cm.wrap('x', async () => { calls++; return { n: 1 }; }), { n: 1 });
  assert.deepEqual(await cm.wrap('x', async () => { calls++; return { n: 999 }; }), { n: 1 }); // hit
  assert.equal(calls, 1);
});

test('CacheManager: resiliente — erro no Redis cai pro fetcher', async () => {
  const redis: any = { get: async () => { throw new Error('down'); }, set: async () => { throw new Error('down'); } };
  const cm = new CacheManager(redis, 1000);
  assert.equal(await cm.wrap('k', async () => 7), 7);
});

test('CacheManager.invalidatePrefix: usa scanStream + del', async () => {
  const deleted: string[] = [];
  const redis: any = {
    get: async () => null, set: async () => { },
    scanStream: () => (async function* () { yield ['data:v_obras:a', 'data:v_obras:b']; })(),
    del: async (...keys: string[]) => { deleted.push(...keys); },
  };
  await new CacheManager(redis, 1000).invalidatePrefix('data:v_obras:');
  assert.deepEqual(deleted, ['data:v_obras:a', 'data:v_obras:b']);
});

// ── CacheWarmer ───────────────────────────────────────────────────────────
test('CacheWarmer: no-op quando o cache está desabilitado (não toca no Supabase)', async () => {
  const warmer = new CacheWarmer(new CacheManager(null, 1000));
  await warmer.warmAll();
  await warmer.refreshUau();
});
