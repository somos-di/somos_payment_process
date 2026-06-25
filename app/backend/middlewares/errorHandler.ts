import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../errors.js';

export function errorHandler(error: Error | FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Falha de validação', details: error.flatten() },
    });
  }
  if (error instanceof AppError) {
    return reply.status(error.httpStatus).send({
      success: false,
      error: { code: error.code, message: error.message },
    });
  }
  if ('statusCode' in error && error.statusCode === 429) {
    return reply.status(429).send({
      success: false,
      error: { code: 'rate_limited', message: 'Muitas requisições. Aguarde um instante e tente novamente.' },
    });
  }
  if ('statusCode' in error && typeof error.statusCode === 'number' && error.statusCode < 500) {
    return reply.status(error.statusCode).send({
      success: false,
      error: { code: 'BAD_REQUEST', message: error.message },
    });
  }
  request.log.error({ err: error }, 'Erro não tratado');
  return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Erro interno' } });
}
