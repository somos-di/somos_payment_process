import { buildUauPayloadParams as payloadParams } from '../config/runtime.js';
import { AppError } from '../errors.js';
import { adminClient, unwrap, userClient } from '../gateways/supabase.js';
import { getSettings } from '../settings.js';
import type { InstallmentRow, ProcessValueRow } from '../types/process.js';
import type { UauIntegrationResult, UauPayload } from '../types/uau.js';

function joinUrl(base: string, endpoint: string): string {
  return base.replace(/\/+$/, '') + '/' + endpoint.replace(/^\/+/, '');
}

const formatDateTime = (date?: string | null): string =>
  !date ? '' : (String(date).includes('T') ? String(date) : String(date) + 'T00:00:00').slice(0, 19).replace('T', ' ');

const formatDueDateNotPast = (date?: string | null): string => {
  const today = new Date().toISOString().slice(0, 10);
  const day = date ? String(date).slice(0, 10) : today;
  return (day < today ? today : day) + ' 00:00:00';
};

const formatMonthYear = (date?: string | null): string => {
  if (!date) return '';
  const [year, month] = String(date).slice(0, 10).split('-');
  return (month || '') + '/' + (year || '');
};

export class UauIntegrationService {
  async sendToUau(token: string, uuid: string): Promise<UauIntegrationResult> {
    const visible = await userClient(token)
      .from('processes').select('uuid_prc').eq('uuid_prc', uuid).maybeSingle();
    if (visible.error || !visible.data) {
      throw new AppError('Sem permissão sobre este processo', 403, 'forbidden');
    }

    const alerts = await this.pendingAlerts(uuid);
    if (alerts.length) {
      throw new AppError('Processo com pendência; resolva antes de integrar: ' + alerts.join(' '), 422, 'validation');
    }

    const settings = getSettings();
    if (!settings.n8nBaseUrl || !settings.integration.webhookEndpoint) {
      throw new AppError('Integração não configurada: defina N8N_BASE_URL e INTEGRATION_WEBHOOK_ENDPOINT no ambiente.', 500, 'config');
    }
    const webhookUrl = joinUrl(settings.n8nBaseUrl, settings.integration.webhookEndpoint);

    const payload = await this.buildPayload(uuid);
    let response: Response;
    try {
      response = await fetch(webhookUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
    } catch (error) {
      throw new AppError('Não consegui chamar o webhook de integração: ' + ((error as { message?: string }).message || error), 502, 'integration');
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AppError('Webhook de integração retornou ' + response.status + ': ' + body.slice(0, 200), 502, 'integration');
    }
    await unwrap(userClient(token).rpc('send_to_uau', { p_uuid: uuid }));
    return { uuid_prc: uuid, sent: true };
  }

  private async pendingAlerts(uuid: string): Promise<string[]> {
    const client = adminClient();
    const processRow = await unwrap(client.from('processes').select('value_prc').eq('uuid_prc', uuid).single()) as ProcessValueRow;
    const installments = await unwrap(client.from('installments')
      .select('due_date_ins,value_ins,number_ins').eq('process_ins', uuid).order('number_ins')) as InstallmentRow[];
    const alerts: string[] = [];
    const total = Number(processRow.value_prc) || 0;
    const installmentsSum = installments.reduce((accumulated, installment) => accumulated + (Number(installment.value_ins) || 0), 0);
    const difference = Math.round((installmentsSum - total) * 100) / 100;
    if (installments.length === 0) alerts.push('Processo sem parcelas cadastradas.');
    if (installments.length > 0 && Math.abs(difference) >= 0.01) alerts.push('A soma das parcelas diverge do valor do processo.');
    for (let index = 1; index < installments.length; index++) {
      if (String(installments[index].due_date_ins) < String(installments[index - 1].due_date_ins)) { alerts.push('Há parcelas com vencimento fora de ordem.'); break; }
    }
    return alerts;
  }

  private async buildPayload(uuid: string): Promise<UauPayload> {
    const client = adminClient();
    const processRow = await unwrap(client.from('processes').select('*').eq('uuid_prc', uuid).single()) as any;
    const composition = ((await unwrap(client.from('compositions')
      .select('item_cins,prod_cins,contrato_cins,codigo_composicao,codigo_insumo,unidade_insumo')
      .eq('empresa_cins', Number(processRow.company_prc))
      .ilike('obra_cins', processRow.building_prc)
      .eq('codigo_composicao', processRow.composition_prc).eq('codigo_insumo', processRow.supply_prc).limit(1)) as any[])[0]) || {};
    const documentKind = processRow.doc_kind_prc != null
      ? ((await unwrap(client.from('document_kinds').select('especie_dck,tipo_dck,modelo_dck,serie_dck')
        .eq('id_dck', processRow.doc_kind_prc).maybeSingle()) as any) || {})
      : {};
    const approvers = await unwrap(client.from('process_approvers')
      .select('approver_app,level_app').eq('process_app', uuid).order('level_app').limit(2)) as any[];
    const uauUserById: Record<string, string | null> = {};
    if (approvers.length) {
      const users = await unwrap(client.from('users').select('id_usr,uau_user_usr')
        .in('id_usr', approvers.map((approver) => approver.approver_app))) as any[];
      users.forEach((user) => { uauUserById[user.id_usr] = user.uau_user_usr; });
    }
    const installments = await unwrap(client.from('installments')
      .select('due_date_ins,value_ins,number_ins').eq('process_ins', uuid).order('number_ins')) as any[];

    return {
      Id: processRow.id_prc,
      Empresa: processRow.company_prc,
      Obra: processRow.building_prc,
      CodigoFornecedor: processRow.person_prc,
      TipoProcesso: payloadParams.tipoProcesso,
      ControlarEstoque: payloadParams.controlarEstoque,
      AcompanhaEntrega: payloadParams.acompanhaEntrega,
      DataPrevisaoEntrega: payloadParams.dataPrevisaoEntrega,
      TipoItem: payloadParams.tipoItem,
      HistoricoLancContabil: payloadParams.historicoLancContabil,
      HistoricoLancContabilPago: payloadParams.historicoLancContabilPago,
      aprovador1_uau: approvers[0] ? (uauUserById[approvers[0].approver_app] ?? null) : null,
      aprovador2_uau: approvers[1] ? (uauUserById[approvers[1].approver_app] ?? null) : null,
      anexo_boleto_url: processRow.attachment_url_prc || '',
      anexo_docfiscal_url: processRow.attachment_url2_prc || '',
      DocumentoFiscal: {
        NumeroNota: Number(processRow.fiscal_doc_prc) || 0,
        SerieNota: documentKind.serie_dck ?? '',
        EspecieNota: documentKind.especie_dck ?? '',
        TipoNota: documentKind.tipo_dck ?? 0,
        DataEmissao: formatDateTime(processRow.issue_date_prc),
        NFEletronica: payloadParams.nfEletronica,
        ChaveNFe: payloadParams.chaveNFe,
        Modelo: documentKind.modelo_dck ?? '',
      },
      Parametro: {},
      Parcelas: (installments || []).map((installment) => ({ Datavencimento: formatDueDateNotPast(installment.due_date_ins), Valor: installment.value_ins })),
      Itens: [{
        Item: processRow.supply_prc,
        Quantidade: payloadParams.quantidade,
        Preco: processRow.value_prc,
        Cap: '',
        Unidade: composition.unidade_insumo ?? '',
        VinculoPL: [{
          Item: composition.item_cins ?? '',
          CodigoProduto: composition.prod_cins ?? '',
          Contrato: composition.contrato_cins ?? '',
          Servico: composition.codigo_composicao ?? processRow.composition_prc,
          Insumo: composition.codigo_insumo ?? processRow.supply_prc,
          MesPlanejamento: formatMonthYear(processRow.due_date_prc),
          Quantidade: payloadParams.quantidade,
          Preco: processRow.value_prc,
          numeroItemContrato: payloadParams.numeroItemContrato,
        }],
      }],
      DescontoVinculado: [],
    };
  }
}
