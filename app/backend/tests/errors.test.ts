import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError, NotFoundError, UnauthorizedError, ValidationError } from '../errors.js';

test('AppError: defaults 400/app_error e é Error', () => {
  const e = new AppError('boom');
  assert.ok(e instanceof Error);
  assert.equal(e.message, 'boom');
  assert.equal(e.httpStatus, 400);
  assert.equal(e.code, 'app_error');
});

test('AppError: status/code customizados', () => {
  const e = new AppError('nope', 418, 'teapot');
  assert.equal(e.httpStatus, 418);
  assert.equal(e.code, 'teapot');
});

test('NotFoundError: 404/not_found e herda AppError', () => {
  const e = new NotFoundError();
  assert.ok(e instanceof AppError);
  assert.equal(e.httpStatus, 404);
  assert.equal(e.code, 'not_found');
});

test('UnauthorizedError: 401/unauthorized', () => {
  const e = new UnauthorizedError();
  assert.equal(e.httpStatus, 401);
  assert.equal(e.code, 'unauthorized');
});

test('ValidationError: 400/validation_error', () => {
  const e = new ValidationError();
  assert.equal(e.httpStatus, 400);
  assert.equal(e.code, 'validation_error');
});
