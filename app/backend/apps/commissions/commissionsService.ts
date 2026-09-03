import { unwrap, userClient } from '../../gateways/supabase.js';
import type {
  CommissionCreated, CommissionInput, CommissionTransitionOptions, CommissionTransitionResult,
  EmpreendimentoInput, EmpreendimentoUpserted,
} from '../../types/commissions.js';

export class CommissionsService {
  private readonly view = 'v_commissions';

  list(token: string) {
    return unwrap(userClient(token).from(this.view).select('*').order('id_com', { ascending: false }));
  }

  getByUuid(token: string, uuid: string) {
    return unwrap(userClient(token).from(this.view).select('*').eq('uuid_com', uuid).single());
  }

  transition(
    token: string, uuid: string, action: string,
    transitionOptions: CommissionTransitionOptions = {},
  ): Promise<CommissionTransitionResult> {
    return unwrap(userClient(token).rpc('commission_transition', {
      p_uuid: uuid, p_action: action,
      p_note: transitionOptions.note ?? null,
      p_nf_url: transitionOptions.nfUrl ?? null, p_boleto_url: transitionOptions.boletoUrl ?? null,
      p_seller_email: transitionOptions.sellerEmail ?? null, p_seller_phone: transitionOptions.sellerPhone ?? null,
    })) as Promise<CommissionTransitionResult>;
  }

  comment(token: string, uuid: string, text: string): Promise<void> {
    return unwrap(userClient(token).rpc('add_commission_comment', { p_uuid: uuid, p_text: text })) as Promise<void>;
  }

  create(token: string, commission: CommissionInput): Promise<CommissionCreated> {
    return unwrap(userClient(token).rpc('commission_create', {
      p_company: commission.company, p_building: commission.building, p_value: commission.value,
      p_seller_name: commission.sellerName, p_client_name: commission.clientName,
      p_unit: commission.unit ?? null, p_sale_num: commission.saleNum ?? null,
      p_sale_date: commission.saleDate ?? null, p_release_date: commission.releaseDate ?? null,
      p_seller_id: commission.sellerId ?? null, p_seller_email: commission.sellerEmail ?? null,
      p_seller_phone: commission.sellerPhone ?? null, p_note: commission.note ?? null,
    })) as Promise<CommissionCreated>;
  }

  upsertEmpreendimento(token: string, empreendimento: EmpreendimentoInput): Promise<EmpreendimentoUpserted> {
    return unwrap(userClient(token).rpc('comm_upsert_empreendimento', {
      p_id: empreendimento.id ?? null, p_name: empreendimento.name, p_company: empreendimento.company, p_building: empreendimento.building,
      p_somos: empreendimento.somos, p_active: empreendimento.active ?? true,
    })) as Promise<EmpreendimentoUpserted>;
  }

  deleteEmpreendimento(token: string, id: number): Promise<void> {
    return unwrap(userClient(token).rpc('comm_delete_empreendimento', { p_id: id })) as Promise<void>;
  }
}
