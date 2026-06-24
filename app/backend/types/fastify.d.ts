import '@fastify/cookie';
import 'fastify';
declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; email: string };
    accessToken?: string;
  }
}
