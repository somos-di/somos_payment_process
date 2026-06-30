import { AppError } from '../errors.js';
import { adminClient, userClient } from '../gateways/supabase.js';
import type { ProcessInsert, ProcessRow, ProcessUpdate } from '../models/process.js';
import { CrudService } from './base/crudService.js';

// Age EM NOME do usuário (userClient(token)) -> RLS + auth.uid() valem nas RPCs.
export class ProcessesService extends CrudService<ProcessRow, ProcessInsert, ProcessUpdate> {
  protected readonly tableName = 'processes';
  protected readonly idColumn = 'uuid_prc';

  private async run<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
    const { data, error } = await p;
    if (error) throw new AppError((error as { message?: string }).message || 'Erro Supabase', 400, 'supabase');
    return data;
  }

  list(token: string, kind?: number) {
    let q = userClient(token).from(this.tableName).select('*').eq('active_prc', true);
    if (kind) q = q.eq('kind_prc', kind);
    return this.run(q.order('id_prc', { ascending: false }));
  }
  getByUuid(token: string, uuid: string) {
    return this.run(userClient(token).from(this.tableName).select('*').eq('uuid_prc', uuid).single());
  }
  create(token: string, userId: string, body: ProcessInsert) {
    return this.insertOne(userClient(token), { ...body, author_prc: userId } as ProcessInsert);
  }
  // cria o processo + parcelas (uma "solicitação" completa), em nome do usuário.
  async createWithInstallments(
    token: string, userId: string,
    process: Record<string, unknown>,
    installments: Array<{ due_date_ins: string; value_ins: number }>,
  ): Promise<{ uuid_prc: string }> {
    // Escrita pelo service_role (camada confiável): o backend FIXA o author no
    // usuário já autenticado (requireAuth), então a RLS de insert é redundante aqui.
    // Leituras/aprovações continuam via userClient (RLS + auth.uid()).
    const admin = adminClient();
    const proc = await this.run(
      admin.from('processes').insert({ ...process, author_prc: userId }).select('uuid_prc').single(),
    ) as { uuid_prc: string };
    const uuid = proc.uuid_prc;
    if (installments?.length) {
      const rows = installments.map((p, i) => ({
        process_ins: uuid, number_ins: i + 1, due_date_ins: p.due_date_ins, value_ins: p.value_ins,
      }));
      await this.run(admin.from('installments').insert(rows));
    }
    await this.run(admin.from('process_history').insert({ process_hst: uuid, action_hst: 'Processo criado', user_hst: userId }));
    return { uuid_prc: uuid };
  }

  // CRUD de parcelas (financeiro): substitui a lista inteira de parcelas do processo.
  async setInstallments(
    token: string, userId: string, uuid: string,
    installments: Array<{ due_date_ins: string; value_ins: number }>,
  ): Promise<{ uuid_prc: string; count: number }> {
    const admin = adminClient();
    await this.run(admin.from('installments').delete().eq('process_ins', uuid));
    if (installments?.length) {
      await this.run(admin.from('installments').insert(installments.map((p, i) => ({
        process_ins: uuid, number_ins: i + 1, due_date_ins: p.due_date_ins, value_ins: p.value_ins,
      }))));
    }
    await this.run(admin.from('process_history').insert({
      process_hst: uuid, action_hst: 'Parcelas ajustadas (' + (installments?.length || 0) + ')', user_hst: userId,
    }));
    return { uuid_prc: uuid, count: installments?.length || 0 };
  }

  // correção (processo em status 2): autor edita os dados + parcelas e, opcionalmente,
  // reenvia para aprovação (status 2 -> 1). service_role + checagem de autoria/etapa.
  async correct(
    token: string, userId: string, uuid: string,
    process: Record<string, unknown>,
    installments: Array<{ due_date_ins: string; value_ins: number }> | undefined,
    resend: boolean,
  ): Promise<{ uuid_prc: string; resent: boolean }> {
    const admin = adminClient();
    const cur = await this.run(
      admin.from('processes').select('author_prc,status_step_prc').eq('uuid_prc', uuid).single(),
    ) as { author_prc: string | null; status_step_prc: number };
    if (cur.author_prc && cur.author_prc !== userId) throw new AppError('Você não é o autor deste processo', 403, 'auth');
    if (cur.status_step_prc !== 2) throw new AppError('Processo não está em correção (status 2)', 400, 'state');
    // nunca deixa o front sobrescrever colunas de controle
    const clean = { ...process } as Record<string, unknown>;
    ['id_prc', 'uuid_prc', 'author_prc', 'status_step_prc', 'approving_status_prc', 'created_at_prc'].forEach((k) => delete clean[k]);
    clean.updated_at_prc = new Date().toISOString();
    await this.run(admin.from('processes').update(clean).eq('uuid_prc', uuid));
    // só mexe nas parcelas se vierem (auto-save de campos NÃO apaga as parcelas)
    if (installments !== undefined) {
      await this.run(admin.from('installments').delete().eq('process_ins', uuid));
      if (installments.length) {
        await this.run(admin.from('installments').insert(installments.map((p, i) => ({
          process_ins: uuid, number_ins: i + 1, due_date_ins: p.due_date_ins, value_ins: p.value_ins,
        }))));
      }
    }
    // histórico só no reenviar (auto-save não floda o histórico)
    if (resend) {
      await this.run(admin.from('processes').update({ status_step_prc: 1, approving_status_prc: 1 }).eq('uuid_prc', uuid));
      await this.run(admin.from('process_history').insert({
        process_hst: uuid, action_hst: 'Corrigido e reenviado para aprovação', user_hst: userId,
      }));
    }
    return { uuid_prc: uuid, resent: !!resend };
  }

  // lançamento em massa: cada item = { process, installments }. Não aborta o lote
  // se uma linha falhar — devolve o resultado por linha.
  async createBulk(
    token: string, userId: string,
    items: Array<{ process: Record<string, unknown>; installments: Array<{ due_date_ins: string; value_ins: number }> }>,
  ): Promise<Array<{ ok: boolean; uuid_prc?: string; error?: string }>> {
    const out: Array<{ ok: boolean; uuid_prc?: string; error?: string }> = [];
    for (const it of items) {
      try {
        const r = await this.createWithInstallments(token, userId, it.process, it.installments || []);
        out.push({ ok: true, uuid_prc: r.uuid_prc });
      } catch (e) {
        out.push({ ok: false, error: (e as { message?: string }).message || 'erro' });
      }
    }
    return out;
  }
  pending(token: string) {
    return this.run(userClient(token).rpc('my_pending_approvals', {}));
  }
  action(token: string, fn: string, uuid: string) {
    return this.run(userClient(token).rpc(fn, { p_uuid: uuid }));
  }
  // CANCELAR (autor): verificação de status/autoria no BACKEND, não só no front —
  // alguém chamando o endpoint direto com outro uuid é barrado aqui (e de novo na
  // função SQL cancel_process, que valida atomicamente author + status ∈ {1,2}).
  async cancel(token: string, userId: string, uuid: string) {
    const cur = await this.run(
      userClient(token).from('processes').select('status_step_prc, author_prc').eq('uuid_prc', uuid).single(),
    ) as { status_step_prc: number; author_prc: string | null };
    if (cur.author_prc && cur.author_prc !== userId) {
      throw new AppError('Você não é o autor deste lançamento', 403, 'auth');
    }
    if (![1, 2].includes(cur.status_step_prc)) {
      throw new AppError('Só é possível cancelar em Aguardando aprovação ou Em correção', 400, 'state');
    }
    return this.run(userClient(token).rpc('cancel_process', { p_uuid: uuid }));
  }
  // registra um evento no histórico (visualizar/etc.) — RPC carrega auth.uid().
  log(token: string, uuid: string, action: string) {
    return this.run(userClient(token).rpc('log_process_event', { p_uuid: uuid, p_action: action }));
  }

  // ── Integração UAU ──────────────────────────────────────────────────────
  private readonly webhookUrl = process.env.INTEGRATION_WEBHOOK_URL
    || 'http://24.144.66.163:5678/webhook-test/payment_process';

  private static dt(d?: string | null): string {           // 'YYYY-MM-DD HH:mm:ss'
    if (!d) return '';
    return (String(d).includes('T') ? String(d) : String(d) + 'T00:00:00').slice(0, 19).replace('T', ' ');
  }
  private static maxToday(d?: string | null): string {     // vencimento nunca no passado
    const today = new Date().toISOString().slice(0, 10);
    const day = d ? String(d).slice(0, 10) : today;
    return (day < today ? today : day) + ' 00:00:00';
  }
  private static mesAno(d?: string | null): string {       // 'MM/YYYY'
    if (!d) return '';
    const [y, m] = String(d).slice(0, 10).split('-');
    return (m || '') + '/' + (y || '');
  }

  // Monta o payload de integração a partir do schema payment (equivalente à query do Mitra).
  // Impostos (DescontoVinculado) ficam vazios por ora; Cap não existe no espelho.
  async buildUauPayload(uuid: string): Promise<Record<string, unknown>> {
    const a = adminClient();
    const p = await this.run(a.from('processes').select('*').eq('uuid_prc', uuid).single()) as any;
    const comp = ((await this.run(a.from('compositions')
      .select('item_cins,prod_cins,contrato_cins,codigo_composicao,codigo_insumo,unidade_insumo')
      .eq('codigo_composicao', p.composition_prc).eq('codigo_insumo', p.supply_prc).limit(1)) as any[])[0]) || {};
    const doc = p.doc_kind_prc != null
      ? ((await this.run(a.from('document_kinds').select('especie_dck,tipo_dck,modelo_dck,serie_dck')
          .eq('id_dck', p.doc_kind_prc).maybeSingle()) as any) || {})
      : {};
    const apprs = await this.run(a.from('process_approvers')
      .select('approver_app,level_app').eq('process_app', uuid).order('level_app').limit(2)) as any[];
    const uau: Record<string, string | null> = {};
    if (apprs.length) {
      const us = await this.run(a.from('users').select('id_usr,uau_user_usr')
        .in('id_usr', apprs.map((x) => x.approver_app))) as any[];
      us.forEach((u) => { uau[u.id_usr] = u.uau_user_usr; });
    }
    const inst = await this.run(a.from('installments')
      .select('due_date_ins,value_ins,number_ins').eq('process_ins', uuid).order('number_ins')) as any[];

    const D = ProcessesService;
    return {
      Id: p.id_prc,
      Empresa: p.company_prc,
      Obra: p.building_prc,
      CodigoFornecedor: p.person_prc,
      TipoProcesso: 1,
      ControlarEstoque: 0,
      AcompanhaEntrega: 0,
      DataPrevisaoEntrega: '',
      TipoItem: 0,
      HistoricoLancContabil: 'A PAGAR Fornecedor [pgto_NomeFornecedor] Número [pgto_NumNF]',
      HistoricoLancContabilPago: 'PAGO Fornecedor [pgto_NomeFornecedor] NF [pgto_NumNF] Cheque [pgto_Cheque]',
      aprovador1_uau: apprs[0] ? (uau[apprs[0].approver_app] ?? null) : null,
      aprovador2_uau: apprs[1] ? (uau[apprs[1].approver_app] ?? null) : null,
      anexo_boleto_url: p.attachment_url_prc || '',
      anexo_docfiscal_url: p.attachment_url2_prc || '',
      DocumentoFiscal: {
        NumeroNota: p.fiscal_doc_prc ?? 0,
        SerieNota: doc.serie_dck ?? '',
        EspecieNota: doc.especie_dck ?? '',
        TipoNota: doc.tipo_dck ?? 0,
        DataEmissao: D.dt(p.issue_date_prc),
        NFEletronica: 0,
        ChaveNFe: '',
        Modelo: doc.modelo_dck ?? '',
      },
      Parametro: {},
      Parcelas: (inst || []).map((x) => ({ Datavencimento: D.maxToday(x.due_date_ins), Valor: x.value_ins })),
      Itens: [{
        Item: p.supply_prc,
        Quantidade: 1,
        Preco: p.value_prc,
        Cap: '',
        Unidade: comp.unidade_insumo ?? '',
        VinculoPL: [{
          Item: comp.item_cins ?? '',
          CodigoProduto: comp.prod_cins ?? '',
          Contrato: comp.contrato_cins ?? '',
          Servico: comp.codigo_composicao ?? p.composition_prc,
          Insumo: comp.codigo_insumo ?? p.supply_prc,
          MesPlanejamento: D.mesAno(p.due_date_prc),
          Quantidade: 1,
          Preco: p.value_prc,
          numeroItemContrato: 0,
        }],
      }],
      DescontoVinculado: [],   // impostos ainda não tratados
    };
  }

  // ENVIAR UAU (botão Integrar): monta o payload, POSTa no webhook e marca status 4 + histórico.
  async sendToUau(token: string, _userId: string, uuid: string): Promise<{ uuid_prc: string; sent: true }> {
    const payload = await this.buildUauPayload(uuid);
    let resp: Response;
    try {
      resp = await fetch(this.webhookUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
    } catch (e) {
      throw new AppError('Não consegui chamar o webhook de integração: ' + ((e as { message?: string }).message || e), 502, 'integration');
    }
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new AppError('Webhook de integração retornou ' + resp.status + ': ' + body.slice(0, 200), 502, 'integration');
    }
    await this.run(userClient(token).rpc('send_to_uau', { p_uuid: uuid }));   // status 4 + histórico (auth.uid())
    return { uuid_prc: uuid, sent: true };
  }
}
