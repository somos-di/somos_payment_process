import { AppError } from '../../errors.js';
import { adminClient, unwrap, userClient } from '../../gateways/supabase.js';
import type { AnalyticsReport } from '../../types/analyticsReports.js';

export interface AnalyticsReportsGateway {
  listVisible(token: string): Promise<AnalyticsReport[]>;
  visibleFilePath(token: string, id: number): Promise<string | null>;
  signFile(path: string, expiresInSeconds: number): Promise<string>;
}

export class SupabaseAnalyticsReportsGateway implements AnalyticsReportsGateway {
  constructor(private readonly bucket: string) {}

  async listVisible(token: string): Promise<AnalyticsReport[]> {
    const rows = await unwrap<AnalyticsReport[] | null>(userClient(token).rpc('analytics_reports'));
    return rows ?? [];
  }

  visibleFilePath(token: string, id: number): Promise<string | null> {
    return unwrap<string | null>(userClient(token).rpc('analytics_report_file', { p_id: id }));
  }

  async signFile(path: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await adminClient().storage.from(this.bucket).createSignedUrl(path, expiresInSeconds);
    if (error || !data) throw new AppError(error?.message || 'Não foi possível gerar o link do relatório', 400, 'storage');
    return data.signedUrl;
  }
}
