import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FastifyRequest } from 'fastify';
import { AppError } from '../errors.js';
import { restrictReportViewers } from '../middlewares/restrictReportViewers.js';
import { accountFlags, toAuthenticatedUser, withPasswordChanged } from '../models/accountFlags.js';
import type { AuthenticatedUser } from '../types/auth.js';
import './_env.js';

function request(url: string, user: AuthenticatedUser): FastifyRequest {
  return { routeOptions: { url }, user } as unknown as FastifyRequest;
}

const COMMON: AuthenticatedUser = { id: 'u1', email: 'a@b.c', reportViewer: false, mustChangePassword: false };
const VIEWER: AuthenticatedUser = { ...COMMON, reportViewer: true };
const FIRST_ACCESS: AuthenticatedUser = { ...VIEWER, mustChangePassword: true };

test('accountFlags: só a marca do Analytics torna a conta "só relatórios"', () => {
  assert.deepEqual(accountFlags({}), { reportViewer: false, mustChangePassword: false });
  assert.deepEqual(accountFlags({ provider: 'azure' }), { reportViewer: false, mustChangePassword: false });
  assert.deepEqual(
    accountFlags({ somos_analytics: { somente_relatorios: true, trocar_senha: true } }),
    { reportViewer: true, mustChangePassword: true },
  );
  assert.deepEqual(accountFlags({ somos_analytics: { trocar_senha: true } }), { reportViewer: false, mustChangePassword: false });
});

test('toAuthenticatedUser e withPasswordChanged: preservam o resto do app_metadata', () => {
  const user = toAuthenticatedUser({ id: 'u1', email: 'a@b.c', app_metadata: { somos_analytics: { somente_relatorios: true } } });
  assert.equal(user.reportViewer, true);
  const changed = withPasswordChanged({ provider: 'email', somos_analytics: { somente_relatorios: true, trocar_senha: true } });
  assert.deepEqual(changed, { provider: 'email', somos_analytics: { somente_relatorios: true, trocar_senha: false } });
});

test('restrictReportViewers: usuário comum passa em qualquer rota', async () => {
  await restrictReportViewers(request('/api/v1/processes', COMMON));
});

test('restrictReportViewers: "só relatórios" acessa relatórios e conta, e nada mais', async () => {
  await restrictReportViewers(request('/api/v1/analytics-reports', VIEWER));
  await restrictReportViewers(request('/api/v1/analytics-reports/:id/file', VIEWER));
  await restrictReportViewers(request('/api/v1/auth/password', VIEWER));
  await assert.rejects(
    () => restrictReportViewers(request('/api/v1/processes', VIEWER)),
    (error: unknown) => error instanceof AppError && error.httpStatus === 403,
  );
});

test('restrictReportViewers: no primeiro acesso, só troca de senha', async () => {
  await restrictReportViewers(request('/api/v1/auth/password', FIRST_ACCESS));
  await restrictReportViewers(request('/api/v1/auth/me', FIRST_ACCESS));
  await assert.rejects(
    () => restrictReportViewers(request('/api/v1/analytics-reports', FIRST_ACCESS)),
    (error: unknown) => error instanceof AppError && error.message.startsWith('Troque a senha'),
  );
});
