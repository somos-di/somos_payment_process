import { unwrap, userClient } from '../gateways/supabase.js';

// Domínio de COMISSÃO (mini app isolado). Sem aprovação/parcelas: só o fluxo
// (validar → aguardando NF → anexar NF → validação financeira → finalizar) roteado
// por empreendimento (empresa + obra). Escreve EM NOME do usuário (userClient) -> RLS
// + auth.uid() valem nas RPCs. Comissões são criadas por automação externa (INSERT).
export class CommissionsService {
  private readonly view = 'v_commissions';

  list(token: string) {
    return unwrap(userClient(token).from(this.view).select('*').order('id_com', { ascending: false }));
  }

  getByUuid(token: string, uuid: string) {
    return unwrap(userClient(token).from(this.view).select('*').eq('uuid_com', uuid).single());
  }

  // Máquina de estados: a RPC valida ação × status + visibilidade/papel no banco.
  transition(
    token: string, uuid: string, action: string,
    opts: { note?: string; nfUrl?: string; boletoUrl?: string; sellerEmail?: string; sellerPhone?: string } = {},
  ): Promise<{ uuid_com: string; status_step: number }> {
    return unwrap(userClient(token).rpc('commission_transition', {
      p_uuid: uuid, p_action: action,
      p_note: opts.note ?? null,
      p_nf_url: opts.nfUrl ?? null, p_boleto_url: opts.boletoUrl ?? null,
      p_seller_email: opts.sellerEmail ?? null, p_seller_phone: opts.sellerPhone ?? null,
    })) as Promise<{ uuid_com: string; status_step: number }>;
  }

  // CRIAÇÃO MANUAL de comissão (trilha/admin). A RPC valida trilha/empreendimento e
  // grava author = auth.uid(); entra em "A validar" (status 1). Mesmo destino da automação.
  create(
    token: string,
    c: {
      company: string; building: string; value: number;
      sellerName: string; clientName: string;
      unit?: string; saleNum?: string; saleDate?: string; releaseDate?: string;
      sellerId?: number; sellerEmail?: string; sellerPhone?: string; note?: string;
    },
  ): Promise<{ uuid_com: string }> {
    return unwrap(userClient(token).rpc('commission_create', {
      p_company: c.company, p_building: c.building, p_value: c.value,
      p_seller_name: c.sellerName, p_client_name: c.clientName,
      p_unit: c.unit ?? null, p_sale_num: c.saleNum ?? null,
      p_sale_date: c.saleDate ?? null, p_release_date: c.releaseDate ?? null,
      p_seller_id: c.sellerId ?? null, p_seller_email: c.sellerEmail ?? null,
      p_seller_phone: c.sellerPhone ?? null, p_note: c.note ?? null,
    })) as Promise<{ uuid_com: string }>;
  }

  // CADASTRO de empreendimento (admin). A RPC exige is_admin e grava o author = auth.uid().
  upsertEmpreendimento(
    token: string,
    e: { id?: number | null; name: string; company: string; building: string; somos: boolean; active?: boolean },
  ): Promise<{ id_cem: number }> {
    return unwrap(userClient(token).rpc('comm_upsert_empreendimento', {
      p_id: e.id ?? null, p_name: e.name, p_company: e.company, p_building: e.building,
      p_somos: e.somos, p_active: e.active ?? true,
    })) as Promise<{ id_cem: number }>;
  }

  deleteEmpreendimento(token: string, id: number): Promise<void> {
    return unwrap(userClient(token).rpc('comm_delete_empreendimento', { p_id: id })) as Promise<void>;
  }
}
