import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createContainer } from '../factories/container.js';
import './_env.js';

test('createContainer: monta todos os controllers, o authService e o warmer', () => {
  const container = createContainer();
  assert.ok(container.controllers, 'controllers ausente');
  for (const controllerName of ['processes', 'sync', 'auth', 'data', 'admin', 'catalog']) {
    assert.ok((container.controllers as unknown as Record<string, unknown>)[controllerName], `controller ausente: ${controllerName}`);
  }
  assert.ok(container.authService, 'authService ausente');
  assert.ok(container.warmer, 'warmer ausente');
});

test('createContainer: chamadas repetidas não lançam (idempotente p/ boot)', () => {
  assert.doesNotThrow(() => { createContainer(); createContainer(); });
});
