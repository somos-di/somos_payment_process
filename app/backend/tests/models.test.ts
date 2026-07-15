import assert from 'node:assert/strict';
import { test } from 'node:test';
import { statusKindSchema, toStatusCatalog } from '../models/statusKind.js';
import { uauTableSchema } from '../models/uauTable.js';

test('statusKindSchema: valida linha correta e aceita key nula', () => {
  assert.equal(statusKindSchema.safeParse({ id_skn: 1, descr_skn: 'Aguardando', key_skn: 'aguardando' }).success, true);
  assert.equal(statusKindSchema.safeParse({ id_skn: 3, descr_skn: 'Cancelado', key_skn: null }).success, true);
});

test('statusKindSchema: rejeita id não-inteiro / campos faltando', () => {
  assert.equal(statusKindSchema.safeParse({ id_skn: 1.5, descr_skn: 'x', key_skn: null }).success, false);
  assert.equal(statusKindSchema.safeParse({ id_skn: 1 }).success, false);
});

test('toStatusCatalog: monta byId/byKey e ignora key nula', () => {
  const cat = toStatusCatalog([
    { id_skn: 1, descr_skn: 'Aguardando', key_skn: 'aguardando' },
    { id_skn: 3, descr_skn: 'Cancelado', key_skn: null },
    { id_skn: 7, descr_skn: 'Integrado', key_skn: 'integrado' },
  ]);
  assert.deepEqual(cat.byId, { 1: 'Aguardando', 3: 'Cancelado', 7: 'Integrado' });
  assert.deepEqual(cat.byKey, { aguardando: 1, integrado: 7 }); // 3 (key null) não entra
});

test('toStatusCatalog: propaga erro de validação de linha inválida', () => {
  assert.throws(() => toStatusCatalog([{ id_skn: 'x', descr_skn: 'y', key_skn: null }]));
});

test('uauTableSchema: valida catálogo e rejeita campo errado', () => {
  assert.equal(uauTableSchema.safeParse({
    id_uat: 1, uau_table_uat: 'CAD_1038', uau_table_id_uat: 10, supabase_uau_table_uat: 'status_kind',
  }).success, true);
  assert.equal(uauTableSchema.safeParse({
    id_uat: 1, uau_table_uat: 'x', uau_table_id_uat: 'nan', supabase_uau_table_uat: 'y',
  }).success, false);
});
