import '@fastify/cookie';
import 'fastify';
import type { AuthenticatedUser } from './auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    accessToken?: string;
  }
}
