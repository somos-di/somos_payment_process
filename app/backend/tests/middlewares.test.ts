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
  const r: any = {
    status(c: number) { calls.status = c; return r; },
    send(b: any) { calls.body = b; return r; },
    setCookie(n: string, v: string, o: any) { calls.cookies.push({ n, v, o }); return r; },
    clearCookie(n: string, o: any) { calls.cleared.push({ n, o }); return r; },
  };
  return { r, calls };
}

// ── errorHandler ──────────────────────────────────────────────────────────
test('errorHandler: ZodError -> 400 VALIDATION_ERROR', () => {
  const parsed = z.object({ a: z.string() }).safeParse({});
  assert.equal(parsed.success, false);
  const { r, calls } = fakeReply();
  errorHandler((parsed as { error: z.ZodError }).error, { log: { error() { } } } as any, r);
  assert.equal(calls.status, 400);
  assert.equal(calls.body.error.code, 'VALIDATION_ERROR');
});

test('errorHandler: AppError -> status/code próprios', () => {
  const { r, calls } = fakeReply();
  errorHandler(new AppError('nope', 403, 'forbidden'), { log: { error() { } } } as any, r);
  assert.equal(calls.status, 403);
  assert.equal(calls.body.error.code, 'forbidden');
  assert.equal(calls.body.error.message, 'nope');
});

test('errorHandler: statusCode 429 -> rate_limited', () => {
  const { r, calls } = fakeReply();
  errorHandler({ statusCode: 429 } as any, { log: { error() { } } } as any, r);
  assert.equal(calls.status, 429);
  assert.equal(calls.body.error.code, 'rate_limited');
});

test('errorHandler: statusCode < 500 -> BAD_REQUEST', () => {
  const { r, calls } = fakeReply();
  errorHandler({ statusCode: 404, message: 'x' } as any, { log: { error() { } } } as any, r);
  assert.equal(calls.status, 404);
  assert.equal(calls.body.error.code, 'BAD_REQUEST');
});

test('errorHandler: erro desconhecido -> 500 INTERNAL e loga', () => {
  const { r, calls } = fakeReply();
  let logged = false;
  errorHandler(new Error('surpresa'), { log: { error() { logged = true; } } } as any, r);
  assert.equal(calls.status, 500);
  assert.equal(calls.body.error.code, 'INTERNAL');
  assert.equal(logged, true);
});

// ── sessionCookies ────────────────────────────────────────────────────────
test('refreshCookieName: derivado do cookie de sessão', () => {
  assert.equal(refreshCookieName(), 'pp_session_r');
});

test('setSessionCookies: grava sessão + refresh (httpOnly/lax/path)', () => {
  const { r, calls } = fakeReply();
  setSessionCookies(r, 'tok', 'ref');
  assert.equal(calls.cookies.length, 2);
  assert.equal(calls.cookies[0].n, 'pp_session');
  assert.equal(calls.cookies[0].v, 'tok');
  assert.equal(calls.cookies[0].o.httpOnly, true);
  assert.equal(calls.cookies[0].o.sameSite, 'lax');
  assert.equal(calls.cookies[0].o.path, '/');
  assert.equal(calls.cookies[1].n, 'pp_session_r');
});

test('setSessionCookies: sem refresh grava só a sessão', () => {
  const { r, calls } = fakeReply();
  setSessionCookies(r, 'tok');
  assert.equal(calls.cookies.length, 1);
});

test('clearSessionCookies: limpa os dois cookies', () => {
  const { r, calls } = fakeReply();
  clearSessionCookies(r);
  assert.deepEqual(calls.cleared.map((c) => c.n), ['pp_session', 'pp_session_r']);
});

// ── requireAuth ───────────────────────────────────────────────────────────
test('requireAuth: sem credenciais -> limpa cookies e lança 401 (sem tocar no Supabase)', async () => {
  const auth = { refresh: async () => { throw new Error('não deveria ser chamado'); } };
  const { r, calls } = fakeReply();
  const mw = requireAuth(auth);
  await assert.rejects(
    () => mw({ cookies: {} } as any, r),
    (e: unknown) => e instanceof UnauthorizedError,
  );
  assert.equal(calls.cleared.length, 2);
});

// ── requireAdmin ──────────────────────────────────────────────────────────
test('requireAdmin: sem usuário -> 401 (antes de consultar o banco)', async () => {
  await assert.rejects(
    () => requireAdmin({ user: undefined } as any),
    (e: unknown) => e instanceof UnauthorizedError,
  );
});
