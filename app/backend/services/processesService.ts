import { unwrap, userClient } from '../gateways/supabase.js';

// Domínio do PROCESSO. Age EM NOME do usuário (userClient(token)) -> RLS + auth.uid()
// valem nas RPCs. Escritas passam por RPC SECURITY DEFINER (autorização no banco);
// a integração UAU vive no UauIntegrationService.
export class ProcessesService {
  private readonly table = 'processes';

  list(token: string, kind?: number) {
    let q = userClient(token).from(this.table).select('*').eq('active_prc', true);
    if (kind) q = q.eq('kind_prc', kind);
    return unwrap(q.order('id_prc', { ascending: false }));
  }

  getByUuid(token: string, uuid: string) {
    return unwrap(userClient(token).from(this.table).select('*').eq('uuid_prc', uuid).single());
  }

  // cria o processo + parcelas (uma "solicitação" completa), em nome do usuário.
  // RPC SECURITY DEFINER via userClient: atômico, author = auth.uid() no banco.
  createWithInstallments(
    token: string,
    process: Record<string, unknown>,
    installments: Array<{ due_date_ins: string; value_ins: number }>,
  ): Promise<{ uuid_prc: string }> {
    return unwrap(userClient(token).rpc('create_process_with_installments', {
      p_process: process, p_installments: installments ?? [],
    })) as Promise<{ uuid_prc: string }>;
  }

  // CRUD de parcelas (financeiro): substitui a lista inteira de parcelas do processo.
  // Gate can_see_process + histórico no próprio RPC (auth.uid()).
  setInstallments(
    token: string, uuid: string,
    installments: Array<{ due_date_ins: string; value_ins: number }>,
  ): Promise<{ uuid_prc: string; count: number }> {
    return unwrap(userClient(token).rpc('set_installments', {
      p_uuid: uuid, p_installments: installments ?? [],
    })) as Promise<{ uuid_prc: string; count: number }>;
  }

  // correção (processo em status 2): autor edita os dados + parcelas e, opcionalmente,
  // reenvia para aprovação (status 2 -> 1). Autoria/etapa validadas no RPC (auth.uid()),
  // não mais no TS. installments undefined => não mexe nas parcelas (passa null ao banco).
  correct(
    token: string, uuid: string,
    process: Record<string, unknown>,
    installments: Array<{ due_date_ins: string; value_ins: number }> | undefined,
    resend: boolean,
  ): Promise<{ uuid_prc: string; resent: boolean }> {
    return unwrap(userClient(token).rpc('correct_process', {
      p_uuid: uuid, p_process: process,
      p_installments: installments ?? null, p_resend: resend,
    })) as Promise<{ uuid_prc: string; resent: boolean }>;
  }

  // GESTÃO (admin): edita qualquer processo em god-mode, com motivo obrigatório.
  // A autorização (is_admin) e a whitelist de colunas vivem na RPC admin_edit_process.
  adminEdit(
    token: string, uuid: string,
    process: Record<string, unknown>,
    installments: Array<{ due_date_ins: string; value_ins: number }> | undefined,
    reason: string,
  ): Promise<{ uuid_prc: string }> {
    return unwrap(userClient(token).rpc('admin_edit_process', {
      p_uuid: uuid, p_process: process,
      p_installments: installments ?? null, p_reason: reason,
    })) as Promise<{ uuid_prc: string }>;
  }

  // lançamento em massa: cada item = { process, installments }. Não aborta o lote
  // se uma linha falhar — devolve o resultado por linha.
  async createBulk(
    token: string,
    items: Array<{ process: Record<string, unknown>; installments: Array<{ due_date_ins: string; value_ins: number }> }>,
  ): Promise<Array<{ ok: boolean; uuid_prc?: string; error?: string }>> {
    const out: Array<{ ok: boolean; uuid_prc?: string; error?: string }> = [];
    for (const it of items) {
      try {
        const r = await this.createWithInstallments(token, it.process, it.installments || []);
        out.push({ ok: true, uuid_prc: r.uuid_prc });
      } catch (e) {
        out.push({ ok: false, error: (e as { message?: string }).message || 'erro' });
      }
    }
    return out;
  }

  pending(token: string) {
    return unwrap(userClient(token).rpc('my_pending_approvals', {}));
  }

  // APROVAÇÃO EM LOTE: aprova vários processos numa única requisição do navegador.
  // Cada aprovação é a MESMA RPC approve_process (valida elegibilidade/nível no banco,
  // por processo). Roda em PARALELO com concorrência limitada (perto do Supabase, sem
  // os N round-trips do navegador). Devolve resultado por processo (ordem preservada).
  async approveBatch(
    token: string, uuids: string[],
  ): Promise<Array<{ uuid: string; ok: boolean; error?: string }>> {
    const CONCURRENCY = 8;
    const out: Array<{ uuid: string; ok: boolean; error?: string }> = new Array(uuids.length);
    const runOne = async (uuid: string, i: number): Promise<void> => {
      try {
        await this.action(token, 'approve_process', uuid);
        out[i] = { uuid, ok: true };
      } catch (e) {
        out[i] = { uuid, ok: false, error: (e as { message?: string }).message || 'erro' };
      }
    };
    for (let start = 0; start < uuids.length; start += CONCURRENCY) {
      await Promise.all(uuids.slice(start, start + CONCURRENCY).map((u, j) => runOne(u, start + j)));
    }
    return out;
  }

  // Ações de fluxo (approve/close): a RPC valida a autorização no banco
  // (elegibilidade/visibilidade) — ver seção 6 do SQL.
  action(token: string, fn: string, uuid: string) {
    return unwrap(userClient(token).rpc(fn, { p_uuid: uuid }));
  }

  // Ações de DEVOLUÇÃO para correção (reject/financeiro-reject): exigem MOTIVO,
  // que a RPC grava no histórico do processo junto da ação.
  actionWithReason(token: string, fn: string, uuid: string, reason: string) {
    return unwrap(userClient(token).rpc(fn, { p_uuid: uuid, p_reason: reason }));
  }

  // CANCELAR (autor): a função SQL cancel_process valida autor + status ∈ {1,2}
  // atomicamente (SECURITY DEFINER). Motivo OBRIGATÓRIO -> histórico do processo.
  cancel(token: string, uuid: string, reason: string) {
    return unwrap(userClient(token).rpc('cancel_process', { p_uuid: uuid, p_reason: reason }));
  }

  // registra um evento no histórico (visualizar/etc.) — RPC carrega auth.uid().
  log(token: string, uuid: string, action: string) {
    return unwrap(userClient(token).rpc('log_process_event', { p_uuid: uuid, p_action: action }));
  }
}
