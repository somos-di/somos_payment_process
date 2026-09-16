import { AppError, NotFoundError, ValidationError } from '../../errors.js';
import { unwrap, userClient } from '../../gateways/supabase.js';
import type {
  SupplierFields, SupplierRequestCreated, SupplierRequestInput, SupplierSendResult,
  SupplierTransitionOptions, SupplierTransitionResult, SupplierUauCheck,
} from '../../types/supplierRequests.js';
import { buildUauPayload, isValidCnpj, isValidCpf, onlyDigits } from './supplierDomain.js';
import { cnpjaLookup, n8nCreateSupplier, uauGetPerson } from './supplierGateways.js';

interface SupplierRow {
  uuid_sup: string;
  kind_sup: 'pj' | 'pf';
  document_sup: string;
  payload_sup: SupplierFields;
}

export class SupplierRequestsService {
  private readonly view = 'v_supplier_requests';

  list(token: string) {
    return unwrap(userClient(token).from(this.view).select('*').order('id_sup', { ascending: false }));
  }

  getByUuid(token: string, uuid: string) {
    return unwrap(userClient(token).from(this.view).select('*').eq('uuid_sup', uuid).single());
  }

  create(token: string, input: SupplierRequestInput): Promise<SupplierRequestCreated> {
    const document = onlyDigits(input.document);
    if (input.kind === 'pj' && !isValidCnpj(document)) throw new ValidationError('CNPJ inválido.');
    if (input.kind === 'pf' && !isValidCpf(document)) throw new ValidationError('CPF inválido.');
    const fields: SupplierFields = { ...input.fields };
    if (input.kind === 'pj') fields.cnpj = document; else fields.cpf = document;
    return unwrap(userClient(token).rpc('supplier_request_create', {
      p_kind: input.kind, p_document: document, p_name: input.name,
      p_fantasy: input.fantasy ?? null, p_payload: fields,
      p_company: input.company ?? null, p_building: input.building ?? null,
    })) as Promise<SupplierRequestCreated>;
  }

  transition(token: string, uuid: string, action: string, options: SupplierTransitionOptions = {}): Promise<SupplierTransitionResult> {
    return unwrap(userClient(token).rpc('supplier_request_transition', {
      p_uuid: uuid, p_action: action, p_note: options.note ?? null, p_erp_key: options.erpKey ?? null,
    })) as Promise<SupplierTransitionResult>;
  }

  comment(token: string, uuid: string, text: string): Promise<void> {
    return unwrap(userClient(token).rpc('supplier_add_comment', { p_uuid: uuid, p_text: text })) as Promise<void>;
  }

  async lookup(cnpj: string): Promise<SupplierFields | null> {
    const clean = onlyDigits(cnpj);
    if (!isValidCnpj(clean)) throw new ValidationError('CNPJ inválido.');
    return cnpjaLookup(clean);
  }

  async checkUau(document: string, kind: 'pj' | 'pf'): Promise<SupplierUauCheck> {
    const clean = onlyDigits(document);
    if (kind === 'pj' && !isValidCnpj(clean)) throw new ValidationError('CNPJ inválido.');
    if (kind === 'pf' && !isValidCpf(clean)) throw new ValidationError('CPF inválido.');
    const person = await uauGetPerson(clean);
    return { registered: person != null, person };
  }

  async send(token: string, uuid: string): Promise<SupplierSendResult> {
    const request = (await this.getByUuid(token, uuid)) as SupplierRow | null;
    if (!request) throw new NotFoundError('Solicitação não encontrada');
    const fields: SupplierFields = { ...(request.payload_sup || {}) };
    if (request.kind_sup === 'pj') fields.cnpj = request.document_sup; else fields.cpf = request.document_sup;

    const result = await n8nCreateSupplier(buildUauPayload(fields));
    if (result.ok) {
      const transitioned = await this.transition(token, uuid, 'integrate', { erpKey: result.erpKey ?? undefined });
      return { uuid_sup: uuid, erp_key: result.erpKey, status_step: transitioned.status_step };
    }
    await this.transition(token, uuid, 'fail', { note: result.message });
    throw new AppError('Envio ao UAU falhou: ' + result.message, 502, 'integration');
  }
}
