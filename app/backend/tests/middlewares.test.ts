import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { AppError, UnauthorizedError } from '../errors.js';
import { errorHandler } from '../middlewares/errorHandler.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { clearSessionCookies, refreshCookieName, setSessionCookies } from '../middlewares/sessionCookies.js';
import './_env.js';

function fakeReply() {
  const calls = { status: 0 as number, body: null as any, cookies: [] as any[], cleared: [] as any[] };
  const reply: any = {
    status(statusCode: number) { calls.status = statusCode; return reply; },
    send(payload: any) { calls.body = payload; return reply; },
    setCookie(name: string, value: string, options: any) { calls.cookies.push({ name, value, options }); return reply; },
    clearCookie(name: string, options: any) { calls.cleared.push({ name, options }); return reply; },
  };
  return { reply, calls };
}

test('errorHandler: ZodError -> 400 VALIDATION_ERROR', () => {
  const parsed = z.object({ a: z.string() }).safeParse({});
  assert.equal(parsed.success, false);
  const { reply, calls } = fakeReply();
  errorHandler((parsed as { error: z.ZodError }).error, { log: { error() { } } } as any, reply);
  assert.equal(calls.status, 400);
  assert.equal(calls.body.error.code, 'VALIDATION_ERROR');
});

test('errorHandler: AppError -> status/code próprios', () => {
  const { reply, calls } = fakeReply();
  errorHandler(new AppError('nope', 403, 'forbidden'), { log: { error() { } } } as any, reply);
  assert.equal(calls.status, 403);
  assert.equal(calls.body.error.code, 'forbidden');
  assert.equal(calls.body.error.message, 'nope');
});

test('errorHandler: statusCode 429 -> rate_limited', () => {
  const { reply, calls } = fakeReply();
  errorHandler({ statusCode: 429 } as any, { log: { error() { } } } as any, reply);
  assert.equal(calls.status, 429);
  assert.equal(calls.body.error.code, 'rate_limited');
});

test('errorHandler: statusCode < 500 -> BAD_REQUEST', () => {
  const { reply, calls } = fakeReply();
  errorHandler({ statusCode: 404, message: 'x' } as any, { log: { error() { } } } as any, reply);
  assert.equal(calls.status, 404);
  assert.equal(calls.body.error.code, 'BAD_REQUEST');
});

test('errorHandler: erro desconhecido -> 500 INTERNAL e loga', () => {
  const { reply, calls } = fakeReply();
  let logged = false;
  errorHandler(new Error('surpresa'), { log: { error() { logged = true; } } } as any, reply);
  assert.equal(calls.status, 500);
  assert.equal(calls.body.error.code, 'INTERNAL');
  assert.equal(logged, true);
});

test('refreshCookieName: derivado do cookie de sessão', () => {
  assert.equal(refreshCookieName(), 'pp_session_r');
});

test('setSessionCookies: grava sessão + refresh (httpOnly/lax/path)', () => {
  const { reply, calls } = fakeReply();
  setSessionCookies(reply, 'tok', 'ref');
  assert.equal(calls.cookies.length, 2);
  assert.equal(calls.cookies[0].name, 'pp_session');
  assert.equal(calls.cookies[0].value, 'tok');
  assert.equal(calls.cookies[0].options.httpOnly, true);
  assert.equal(calls.cookies[0].options.sameSite, 'lax');
  assert.equal(calls.cookies[0].options.path, '/');
  assert.equal(calls.cookies[1].name, 'pp_session_r');
});

test('setSessionCookies: sem refresh grava só a sessão', () => {
  const { reply, calls } = fakeReply();
  setSessionCookies(reply, 'tok');
  assert.equal(calls.cookies.length, 1);
});

test('clearSessionCookies: limpa os dois cookies', () => {
  const { reply, calls } = fakeReply();
  clearSessionCookies(reply);
  assert.deepEqual(calls.cleared.map((clearedCookie) => clearedCookie.name), ['pp_session', 'pp_session_r']);
});

test('requireAuth: sem credenciais -> limpa cookies e lança 401 (sem tocar no Supabase)', async () => {
  const sessionRefresher = { refresh: async () => { throw new Error('não deveria ser chamado'); } };
  const { reply, calls } = fakeReply();
  const middleware = requireAuth(sessionRefresher);
  await assert.rejects(
    () => middleware({ cookies: {} } as any, reply),
    (error: unknown) => error instanceof UnauthorizedError,
  );
  assert.equal(calls.cleared.length, 2);
});

test('requireAdmin: sem usuário -> 401 (antes de consultar o banco)', async () => {
  await assert.rejects(
    () => requireAdmin({ user: undefined } as any),
    (error: unknown) => error instanceof UnauthorizedError,
  );
});
