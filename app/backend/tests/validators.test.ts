import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  IdParamSchema, MAX_FILE_BYTES, MAX_TEXT_FIELD, MAX_UPLOAD_BASE64,
  PaginationQuerySchema, UuidParamSchema, boundedRecord,
} from '../validators/common.js';

test('boundedRecord: aceita objeto com strings dentro do limite', () => {
  const result = boundedRecord.safeParse({ description_prc: 'ok', value_prc: 123, is_urgent_prc: true });
  assert.equal(result.success, true);
});

test('boundedRecord: rejeita string acima de MAX_TEXT_FIELD', () => {
  const result = boundedRecord.safeParse({ description_prc: 'x'.repeat(MAX_TEXT_FIELD + 1) });
  assert.equal(result.success, false);
});

test('boundedRecord: aceita string exatamente no limite', () => {
  const result = boundedRecord.safeParse({ description_prc: 'x'.repeat(MAX_TEXT_FIELD) });
  assert.equal(result.success, true);
});

test('MAX_UPLOAD_B64 cobre o base64 de um arquivo de MAX_FILE_BYTES', () => {
  const b64LenForMax = Math.ceil(MAX_FILE_BYTES / 3) * 4;
  assert.ok(MAX_UPLOAD_BASE64 >= b64LenForMax);
});

test('IdParamSchema: coage string numérica e exige inteiro positivo', () => {
  assert.equal(IdParamSchema.parse({ id: '5' }).id, 5);
  assert.equal(IdParamSchema.safeParse({ id: '0' }).success, false);
  assert.equal(IdParamSchema.safeParse({ id: '-2' }).success, false);
  assert.equal(IdParamSchema.safeParse({ id: 'abc' }).success, false);
});

test('UuidParamSchema: aceita uuid válido, rejeita inválido', () => {
  assert.equal(UuidParamSchema.safeParse({ uuid: '11111111-1111-1111-1111-111111111111' }).success, true);
  assert.equal(UuidParamSchema.safeParse({ uuid: 'não-é-uuid' }).success, false);
});

test('PaginationQuerySchema: defaults e limites', () => {
  const defaults = PaginationQuerySchema.parse({});
  assert.equal(defaults.limit, 50);
  assert.equal(defaults.offset, 0);
  assert.equal(PaginationQuerySchema.parse({ limit: '10', offset: '20' }).limit, 10);
  assert.equal(PaginationQuerySchema.safeParse({ limit: 5000 }).success, false);
  assert.equal(PaginationQuerySchema.safeParse({ offset: -1 }).success, false);
});
