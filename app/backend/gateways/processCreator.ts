import { AppError } from '../errors.js';
import type { ProcessExtractResult } from '../types/processCreator.js';
import type { AppSettings } from '../types/settings.js';

export class ProcessCreatorGateway {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(settings: AppSettings) {
    this.baseUrl = settings.processCreator.baseUrl.replace(/\/+$/, '');
    this.token = settings.processCreator.token;
    this.timeoutMs = settings.processCreator.timeoutMs;
  }

  async extractFromDocument(content: string): Promise<ProcessExtractResult> {
    let response: Response;
    try {
      response = await fetch(this.baseUrl + '/rank/document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.token },
        body: JSON.stringify({ content }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new AppError('Não consegui chamar o Process Creator: ' + ((error as { message?: string }).message || error), 502, 'integration');
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AppError('Process Creator retornou ' + response.status + ': ' + body.slice(0, 300), 502, 'integration');
    }
    return await response.json() as ProcessExtractResult;
  }
}
