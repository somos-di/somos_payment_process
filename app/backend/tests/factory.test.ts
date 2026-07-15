import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createContainer } from '../factories/container.js';
import './_env.js';

test('createContainer: monta todos os controllers, o authService e o warmer', () => {
  const c = createContainer();
  assert.ok(c.controllers, 'controllers ausente');
  for (const k of ['processes', 'sync', 'auth', 'data', 'admin', 'catalog', 'commissions']) {
    assert.ok((c.controllers as unknown as Record<string, unknown>)[k], `controller ausente: ${k}`);
  }
  assert.ok(c.authService, 'authService ausente');
  assert.ok(c.warmer, 'warmer ausente');
});

test('createContainer: chamadas repetidas não lançam (idempotente p/ boot)', () => {
  assert.doesNotThrow(() => { createContainer(); createContainer(); });
});
