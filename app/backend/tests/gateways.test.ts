import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../errors.js';
import { createRedisClient } from '../gateways/redis.js';
import { adminClient, anonClient, unwrap, userClient } from '../gateways/supabase.js';
import { UauGateway } from '../gateways/uau.js';
import { getSettings } from '../settings.js';
import './_env.js';

// ── unwrap ────────────────────────────────────────────────────────────────
test('unwrap: devolve data quando não há erro', async () => {
  const data = await unwrap(Promise.resolve({ data: [{ a: 1 }], error: null }));
  assert.deepEqual(data, [{ a: 1 }]);
});

test('unwrap: lança AppError (code supabase) quando há erro', async () => {
  await assert.rejects(
    () => unwrap(Promise.resolve({ data: null, error: { message: 'falhou' } })),
    (e: unknown) => e instanceof AppError && (e as AppError).code === 'supabase' && (e as AppError).message === 'falhou',
  );
});

// ── clients (criação preguiçosa, sem conectar) ────────────────────────────
test('adminClient/anonClient/userClient: retornam client com .from', () => {
  for (const c of [adminClient(), anonClient(), userClient('tok-fake')]) {
    assert.ok(c);
    assert.equal(typeof c.from, 'function');
  }
});

// ── redis opcional ────────────────────────────────────────────────────────
test('createRedisClient: null quando REDIS_URL ausente (cache desligado)', () => {
  assert.equal(createRedisClient(), null);
});

// ── UAU gateway (instancia sem chamar rede) ───────────────────────────────
test('UauGateway: instancia a partir das settings', () => {
  const g = new UauGateway(getSettings());
  assert.ok(g instanceof UauGateway);
  assert.equal(typeof g.executeQuery, 'function');
});
