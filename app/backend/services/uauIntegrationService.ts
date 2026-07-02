import { buildUauPayloadParams as P } from '../config/runtime.js';
import { AppError } from '../errors.js';
import { adminClient, unwrap, userClient } from '../gateways/supabase.js';

// ── Helpers de formatação do payload (puros, sem estado) ────────────────────
const fmtDateTime = (d?: string | null): string =>            // 'YYYY-MM-DD HH:mm:ss'
  !d ? '' : (String(d).includes('T') ? String(d) : String(d) + 'T00:00:00').slice(0, 19).replace('T', ' ');

const fmtDueNotPast = (d?: string | null): string => {        // vencimento nunca no passado
  const today = new Date().toISOString().slice(0, 10);
  const day = d ? String(d).slice(0, 10) : today;
  return (day < today ? today : day) + ' 00:00:00';
};

const fmtMonthYear = (d?: string | null): string => {         // 'MM/YYYY'
  if (!d) return '';
  const [y, m] = String(d).slice(0, 10).split('-');
  return (m || '') + '/' + (y || '');
};

// Integração UAU: monta o payload a partir do schema payment, valida pendências
// (espelha os alertas do Financeiro) e envia ao webhook de integração.
// Responsabilidade isolada do ProcessesService (persistência/domínio do processo).
export class UauIntegrationService {
  // ENVIAR UAU (botão Integrar): valida visibilidade + pendências, POSTa no webhook
  // e marca status 4 + histórico (via RPC send_to_uau, com auth.uid()).
  async sendToUau(token: string, uuid: string): Promise<{ uuid_prc: string; sent: true }> {
    // Visibilidade PELA RLS antes de tudo: buildUauPayload/pendingAlerts leem via
    // service_role (bypass de RLS), então sem este gate um usuário poderia disparar
    // a integração de um processo que não pode ver. Se a RLS esconde a linha, barra.
    const visible = await userClient(token)
      .from('processes').select('uuid_prc').eq('uuid_prc', uuid).maybeSingle();
    if (visible.error || !visible.data) {
      throw new AppError('Sem permissão sobre este processo', 403, 'forbidden');
    }

    const alerts = await this.pendingAlerts(uuid);
    if (alerts.length) {
      throw new AppError('Processo com pendência; resolva antes de integrar: ' + alerts.join(' '), 422, 'validation');
    }

    const webhookUrl = process.env.INTEGRATION_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new AppError('Integração não configurada: defina INTEGRATION_WEBHOOK_URL no ambiente.', 500, 'config');
    }

    const payload = await this.buildPayload(uuid);
    let resp: Response;
    try {
      resp = await fetch(webhookUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
    } catch (e) {
      throw new AppError('Não consegui chamar o webhook de integração: ' + ((e as { message?: string }).message || e), 502, 'integration');
    }
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new AppError('Webhook de integração retornou ' + resp.status + ': ' + body.slice(0, 200), 502, 'integration');
    }
    await unwrap(userClient(token).rpc('send_to_uau', { p_uuid: uuid }));   // status 4 + histórico (auth.uid())
    return { uuid_prc: uuid, sent: true };
  }

  // Recalcula no BACKEND os mesmos alertas da tela do Financeiro (espelha
  // financeiro.js → alertas()): sem parcelas, soma divergente do valor, ou
  // vencimentos fora de ordem. Não confia no front.
  private async pendingAlerts(uuid: string): Promise<string[]> {
    const a = adminClient();
    const p = await unwrap(a.from('processes').select('value_prc').eq('uuid_prc', uuid).single()) as { value_prc: number | null };
    const inst = await unwrap(a.from('installments')
      .select('due_date_ins,value_ins,number_ins').eq('process_ins', uuid).order('number_ins')) as Array<{ due_date_ins: string; value_ins: number; number_ins: number }>;
    const out: string[] = [];
    const total = Number(p.value_prc) || 0;
    const soma = inst.reduce((s, x) => s + (Number(x.value_ins) || 0), 0);
    const diff = Math.round((soma - total) * 100) / 100;
    if (inst.length === 0) out.push('Processo sem parcelas cadastradas.');
    if (inst.length > 0 && Math.abs(diff) >= 0.01) out.push('A soma das parcelas diverge do valor do processo.');
    for (let i = 1; i < inst.length; i++) {                          // ordenado por number_ins: vencimentos devem ser não-decrescentes
      if (String(inst[i].due_date_ins) < String(inst[i - 1].due_date_ins)) { out.push('Há parcelas com vencimento fora de ordem.'); break; }
    }
    return out;
  }

  // Monta o payload de integração a partir do schema payment (equivalente à query do Mitra).
  // Impostos (DescontoVinculado) ficam vazios por ora; Cap não existe no espelho.
  private async buildPayload(uuid: string): Promise<Record<string, unknown>> {
    const a = adminClient();
    const p = await unwrap(a.from('processes').select('*').eq('uuid_prc', uuid).single()) as any;
    const comp = ((await unwrap(a.from('compositions')
      .select('item_cins,prod_cins,contrato_cins,codigo_composicao,codigo_insumo,unidade_insumo')
      .eq('codigo_composicao', p.composition_prc).eq('codigo_insumo', p.supply_prc).limit(1)) as any[])[0]) || {};
    const doc = p.doc_kind_prc != null
      ? ((await unwrap(a.from('document_kinds').select('especie_dck,tipo_dck,modelo_dck,serie_dck')
        .eq('id_dck', p.doc_kind_prc).maybeSingle()) as any) || {})
      : {};
    const apprs = await unwrap(a.from('process_approvers')
      .select('approver_app,level_app').eq('process_app', uuid).order('level_app').limit(2)) as any[];
    const uau: Record<string, string | null> = {};
    if (apprs.length) {
      const us = await unwrap(a.from('users').select('id_usr,uau_user_usr')
        .in('id_usr', apprs.map((x) => x.approver_app))) as any[];
      us.forEach((u) => { uau[u.id_usr] = u.uau_user_usr; });
    }
    const inst = await unwrap(a.from('installments')
      .select('due_date_ins,value_ins,number_ins').eq('process_ins', uuid).order('number_ins')) as any[];

    return {
      Id: p.id_prc,
      Empresa: p.company_prc,
      Obra: p.building_prc,
      CodigoFornecedor: p.person_prc,
      TipoProcesso: P.tipoProcesso,
      ControlarEstoque: P.controlarEstoque,
      AcompanhaEntrega: P.acompanhaEntrega,
      DataPrevisaoEntrega: P.dataPrevisaoEntrega,
      TipoItem: P.tipoItem,
      HistoricoLancContabil: P.historicoLancContabil,
      HistoricoLancContabilPago: P.historicoLancContabilPago,
      aprovador1_uau: apprs[0] ? (uau[apprs[0].approver_app] ?? null) : null,
      aprovador2_uau: apprs[1] ? (uau[apprs[1].approver_app] ?? null) : null,
      anexo_boleto_url: p.attachment_url_prc || '',
      anexo_docfiscal_url: p.attachment_url2_prc || '',
      DocumentoFiscal: {
        NumeroNota: Number(p.fiscal_doc_prc) || 0,   // sempre numérico (fiscal_doc_prc é text; 0 quando vazio/inválido)
        SerieNota: doc.serie_dck ?? '',
        EspecieNota: doc.especie_dck ?? '',
        TipoNota: doc.tipo_dck ?? 0,
        DataEmissao: fmtDateTime(p.issue_date_prc),
        NFEletronica: P.nfEletronica,
        ChaveNFe: P.chaveNFe,
        Modelo: doc.modelo_dck ?? '',
      },
      Parametro: {},
      Parcelas: (inst || []).map((x) => ({ Datavencimento: fmtDueNotPast(x.due_date_ins), Valor: x.value_ins })),
      Itens: [{
        Item: p.supply_prc,
        Quantidade: P.quantidade,
        Preco: p.value_prc,
        Cap: '',
        Unidade: comp.unidade_insumo ?? '',
        VinculoPL: [{
          Item: comp.item_cins ?? '',
          CodigoProduto: comp.prod_cins ?? '',
          Contrato: comp.contrato_cins ?? '',
          Servico: comp.codigo_composicao ?? p.composition_prc,
          Insumo: comp.codigo_insumo ?? p.supply_prc,
          MesPlanejamento: fmtMonthYear(p.due_date_prc),
          Quantidade: P.quantidade,
          Preco: p.value_prc,
          numeroItemContrato: P.numeroItemContrato,
        }],
      }],
      DescontoVinculado: [],   // impostos ainda não tratados
    };
  }
}
