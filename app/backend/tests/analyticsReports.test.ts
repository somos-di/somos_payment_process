import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AnalyticsReportsGateway } from '../apps/analytics_reports/analyticsReportsGateway.js';
import { AnalyticsReportsService, FILE_LINK_SECONDS } from '../apps/analytics_reports/analyticsReportsService.js';
import { NotFoundError } from '../errors.js';
import type { AnalyticsReport } from '../types/analyticsReports.js';
import './_env.js';

const REPORT: AnalyticsReport = {
  id: 7,
  created_at: '2026-10-09T17:37:25Z',
  empreendimento: 'NATTO BUENO DESIGN -  T-28',
  relatorio: 'vendas_natto_bueno_design',
  titulo: 'Vendas — Natto Bueno Design',
  revisao: 67,
  empresas: ['3'],
};

function fakeGateway(visiblePath: string | null) {
  const signed: Array<{ path: string; seconds: number }> = [];
  const gateway: AnalyticsReportsGateway = {
    listVisible: async () => [REPORT],
    visibleFilePath: async () => visiblePath,
    signFile: async (path, seconds) => { signed.push({ path, seconds }); return `https://exemplo.supabase.co/assinado/${path}`; },
  };
  return { gateway, signed };
}

test('AnalyticsReportsService.list: devolve só o que o gateway (RLS do usuário) libera', async () => {
  const { gateway } = fakeGateway(null);
  assert.deepEqual(await new AnalyticsReportsService(gateway).list('tok'), [REPORT]);
});

test('AnalyticsReportsService.file: assina o caminho visível com validade curta', async () => {
  const { gateway, signed } = fakeGateway('natto/vendas/2026.json');
  const file = await new AnalyticsReportsService(gateway).file('tok', 7);
  assert.equal(file.url, 'https://exemplo.supabase.co/assinado/natto/vendas/2026.json');
  assert.equal(file.expires_in, FILE_LINK_SECONDS);
  assert.deepEqual(signed, [{ path: 'natto/vendas/2026.json', seconds: FILE_LINK_SECONDS }]);
});

test('AnalyticsReportsService.file: publicação de empresa sem permissão vira 404 e não assina nada', async () => {
  const { gateway, signed } = fakeGateway(null);
  await assert.rejects(() => new AnalyticsReportsService(gateway).file('tok', 7), (error: unknown) => error instanceof NotFoundError);
  assert.deepEqual(signed, []);
});
