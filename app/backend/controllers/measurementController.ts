import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../errors.js';
import type { MeasurementGateway } from '../gateways/measurement.js';
import { unwrap, userClient } from '../gateways/supabase.js';

interface MedicaoContext { allowed?: boolean; uau_user?: string | null }

export class MeasurementController {
  constructor(private readonly gateway: MeasurementGateway) {
    this.proxy = this.proxy.bind(this);
  }

  async proxy(request: FastifyRequest, reply: FastifyReply) {
    const token = request.accessToken!;
    const context = await unwrap(userClient(token).rpc('my_medicao_context')) as MedicaoContext;
    if (!context?.allowed) throw new AppError('Acesso restrito ao grupo Medição', 403, 'forbidden');

    const upstreamPath = request.url.replace(/^\/api\/v1\/medicao/, '') || '/';
    const method = request.method.toUpperCase();
    const hasBody = method !== 'GET' && method !== 'HEAD' && request.body != null;
    const body = hasBody ? JSON.stringify(request.body) : undefined;

    const result = await this.gateway.forward(method, upstreamPath, body, context.uau_user || '');
    return reply.status(result.status).header('content-type', result.contentType).send(result.body);
  }
}
