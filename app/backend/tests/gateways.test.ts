import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../errors.js';
import { createRedisClient } from '../gateways/redis.js';
import { adminClient, anonClient, unwrap, userClient } from '../gateways/supabase.js';
import { UauGateway } from '../gateways/uau.js';
import { getSettings } from '../settings.js';
import './_env.js';

test('unwrap: devolve data quando não há erro', async () => {
  const data = await unwrap(Promise.resolve({ data: [{ a: 1 }], error: null }));
  assert.deepEqual(data, [{ a: 1 }]);
});

test('unwrap: lança AppError (code supabase) quando há erro', async () => {
  await assert.rejects(
    () => unwrap(Promise.resolve({ data: null, error: { message: 'falhou' } })),
    (error: unknown) => error instanceof AppError && (error as AppError).code === 'supabase' && (error as AppError).message === 'falhou',
  );
});

test('adminClient/anonClient/userClient: retornam client com .from', () => {
  for (const client of [adminClient(), anonClient(), userClient('tok-fake')]) {
    assert.ok(client);
    assert.equal(typeof client.from, 'function');
  }
});

test('createRedisClient: null quando REDIS_URL ausente (cache desligado)', () => {
  assert.equal(createRedisClient(), null);
});

test('UauGateway: instancia a partir das settings', () => {
  const gateway = new UauGateway(getSettings());
  assert.ok(gateway instanceof UauGateway);
  assert.equal(typeof gateway.executeQuery, 'function');
});
