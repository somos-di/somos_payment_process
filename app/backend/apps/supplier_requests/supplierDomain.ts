import type { SupplierFields } from '../../types/supplierRequests.js';

export function onlyDigits(value: string | null | undefined): string {
  return (value || '').replace(/\D/g, '');
}

export function isValidCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const check = (length: number): number => {
    let position = length - 7, sum = 0;
    for (let index = 0; index < length; index++) {
      sum += parseInt(cnpj[index], 10) * position--;
      if (position < 2) position = 9;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === parseInt(cnpj[12], 10) && check(13) === parseInt(cnpj[13], 10);
}

export function isValidCpf(cpf: string): boolean {
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  for (const size of [9, 10]) {
    let sum = 0;
    for (let index = 0; index < size; index++) sum += parseInt(cpf[index], 10) * (size + 1 - index);
    let digit = (sum * 10) % 11;
    if (digit === 10) digit = 0;
    if (digit !== parseInt(cpf[size], 10)) return false;
  }
  return true;
}

function nowSaoPaulo(): string {
  const formatted = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date());
  return formatted.replace(' ', 'T');
}

const text = (value: unknown): string => (value == null || value === '' ? '' : String(value).trim());

export function documentOf(fields: SupplierFields): { document: string; personKind: 0 | 1 } {
  const cnpj = text(fields.cnpj);
  if (cnpj) return { document: cnpj, personKind: 1 };
  return { document: text(fields.cpf), personKind: 0 };
}

export function buildUauPayload(fields: SupplierFields): Record<string, unknown> {
  const { document, personKind } = documentOf(fields);
  const name = text(fields.razao_social) || text(fields.nome);
  return {
    nao_validar_campos_obrigatorios: true,
    info_pes: {
      cod_pes: 0, nome_pes: name, tipo_pes: personKind, cpf_pes: document,
      dtcad_pes: nowSaoPaulo(), dtnasc_pes: '', intext_pes: 2, usrcad_pes: 'root', usralt_pes: null,
      status_pes: 1, tratamento_pes: null, siglaobr_pes: null, email_pes: text(fields.email),
      matricula_pes: null, atinat_pes: 0, dataalt_pes: null, nomefant_pes: text(fields.nome) || name,
      anexos_pes: null, inscrmunic_pes: '', inscrest_pes: text(fields.inscricao_estadual),
      siglaemp_pes: null, login_pes: null, senha_pes: null, cnae_pes: text(fields.atividade_principal),
      datacadportal_pes: null, cadastradoprefeituragyn_pes: false, habilitadoriscosacado_pes: false, cei_pes: null,
    },
    info_pesfis: {
      cod_pf: 0, lotacao_pf: null, cargo_pf: null, dtadm_pf: null, corresp_pf: null, estciv_pf: null,
      doc_pf: null, tdoc_pf: null, dtdoc_pf: null, sexo_pf: null, nacion_pf: null, numdep_pf: null,
      pai_pf: null, dtpai_pf: null, mae_pf: null, dtmae_pf: null, naturalid_pf: null, codnacao_pf: null,
      codgrau_pf: null, codraca_pf: null, codsmil_pf: null, ufnasc_pf: null, cidadenat_pf: null,
      fatorrh_pf: null, regcasamento_pf: null, cdi_pf: null, numpro_pf: null, uniaoestavel_pf: null,
      detalhanacao_pf: null, codnacaoorigem_pf: null, codmunicnasc_pf: null, indicativofiscal_pf: 0,
    },
    infopes_jur: {
      cod_pj: 0, contato_pj: '', contato2_pj: null, inssuframa_pj: null, natureza_pj: 0,
      optantesimples_pj: null, ans_pj: null,
    },
    dspes_tel_json: '',
    info_pesendereco_principal: {
      codpes_pend: 0, tipo_pend: 0, endereco_pend: text(fields.logradouro), bairro_pend: text(fields.bairro),
      cidade_pend: text(fields.municipio), uf_pend: text(fields.uf), cep_pend: text(fields.cep),
      numend_pend: text(fields.numero), complendereco_pend: text(fields.complemento), referend_pend: null,
      proprio_pend: null, numcid_pend: '', numbrr_pend: '', numlogr_pend: '', codemp_pend: null,
      nomeemp_pend: null, tipoendemp_pend: 0,
    },
    infopesendereco_cobranca: null,
    infopesendereco_comercial: null,
  };
}

interface CnpjaActivity { id?: number | string; text?: string }
interface CnpjaRegistration { number?: string; state?: string; enabled?: boolean; type?: unknown }
interface CnpjaOffice {
  taxId?: string;
  alias?: string;
  company?: { name?: string };
  address?: { street?: string; number?: string; district?: string; details?: string; city?: string; state?: string; zip?: string; municipality?: number | string };
  phones?: { area?: string; number?: string }[];
  emails?: { address?: string }[];
  mainActivity?: CnpjaActivity;
  sideActivities?: CnpjaActivity[];
  registrations?: CnpjaRegistration[];
}

export function flattenCnpja(office: CnpjaOffice): SupplierFields {
  const address = office.address || {};
  const phone = (office.phones || [])[0];
  const email = (office.emails || [])[0];
  const registrations = office.registrations || [];
  const inscription = registrations.find((registration) => registration.enabled && registration.number) || registrations[0];
  return {
    cnpj: onlyDigits(office.taxId),
    nome: text(office.alias) || text(office.company?.name),
    razao_social: text(office.company?.name),
    cep: onlyDigits(address.zip),
    city_id: address.municipality != null ? String(address.municipality) : '',
    municipio: text(address.city),
    uf: text(address.state).toUpperCase(),
    logradouro: text(address.street),
    numero: text(address.number),
    bairro: text(address.district),
    complemento: text(address.details),
    telefone: phone ? onlyDigits(`${phone.area || ''}${phone.number || ''}`) : '',
    email: text(email?.address),
    inscricao_estadual: text(inscription?.number),
    atividade_principal: office.mainActivity?.id != null ? String(office.mainActivity.id) : '',
    atividades_secundarias: (office.sideActivities || []).map((activity) => String(activity.id ?? '')).filter(Boolean).join(','),
  };
}
