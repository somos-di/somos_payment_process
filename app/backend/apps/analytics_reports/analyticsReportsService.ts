import { NotFoundError } from '../../errors.js';
import type { AnalyticsReport, AnalyticsReportFile } from '../../types/analyticsReports.js';
import type { AnalyticsReportsGateway } from './analyticsReportsGateway.js';

export const FILE_LINK_SECONDS = 300;

export class AnalyticsReportsService {
  constructor(
    private readonly gateway: AnalyticsReportsGateway,
    private readonly linkSeconds: number = FILE_LINK_SECONDS,
  ) {}

  list(token: string): Promise<AnalyticsReport[]> {
    return this.gateway.listVisible(token);
  }

  async file(token: string, id: number): Promise<AnalyticsReportFile> {
    const path = await this.gateway.visibleFilePath(token, id);
    if (!path) throw new NotFoundError('Relatório não encontrado');
    const url = await this.gateway.signFile(path, this.linkSeconds);
    return { url, expires_in: this.linkSeconds };
  }
}
