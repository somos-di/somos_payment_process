import { AppError } from '../errors.js';
import type { AppSettings } from '../types/settings.js';

export interface MeasurementResponse {
  status: number;
  contentType: string;
  body: string;
}

export class MeasurementGateway {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(settings: AppSettings) {
    this.baseUrl = settings.measurement.baseUrl.replace(/\/+$/, '');
    this.token = settings.measurement.token;
    this.timeoutMs = settings.measurement.timeoutMs;
  }

  async forward(method: string, path: string, body: string | undefined, uauUser: string): Promise<MeasurementResponse> {
    const headers: Record<string, string> = { Authorization: 'Bearer ' + this.token, 'X-UAU-User': uauUser };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
      response = await fetch(this.baseUrl + path, { method, headers, body, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (error) {
      throw new AppError('Não consegui chamar o serviço de Medição: ' + ((error as { message?: string }).message || error), 502, 'integration');
    }
    return {
      status: response.status,
      contentType: response.headers.get('content-type') || 'application/json',
      body: await response.text(),
    };
  }
}
