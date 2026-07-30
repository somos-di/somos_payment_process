import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError, NotFoundError, UnauthorizedError, ValidationError } from '../errors.js';

test('AppError: defaults 400/app_error e é Error', () => {
  const error = new AppError('boom');
  assert.ok(error instanceof Error);
  assert.equal(error.message, 'boom');
  assert.equal(error.httpStatus, 400);
  assert.equal(error.code, 'app_error');
});

test('AppError: status/code customizados', () => {
  const error = new AppError('nope', 418, 'teapot');
  assert.equal(error.httpStatus, 418);
  assert.equal(error.code, 'teapot');
});

test('NotFoundError: 404/not_found e herda AppError', () => {
  const error = new NotFoundError();
  assert.ok(error instanceof AppError);
  assert.equal(error.httpStatus, 404);
  assert.equal(error.code, 'not_found');
});

test('UnauthorizedError: 401/unauthorized', () => {
  const error = new UnauthorizedError();
  assert.equal(error.httpStatus, 401);
  assert.equal(error.code, 'unauthorized');
});

test('ValidationError: 400/validation_error', () => {
  const error = new ValidationError();
  assert.equal(error.httpStatus, 400);
  assert.equal(error.code, 'validation_error');
});
