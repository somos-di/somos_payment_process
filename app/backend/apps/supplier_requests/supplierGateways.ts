import { AppError } from '../../errors.js';
import { getSettings } from '../../settings.js';
import type { SupplierFields } from '../../types/supplierRequests.js';
import { flattenCnpja } from './supplierDomain.js';

const UAU_NOT_FOUND = 'Não foi encontrado nenhuma pessoa com os dados informados.';
const AUTHENTICATE_PATH = '/api/v1.0/Autenticador/AutenticarUsuario';
const PERSON_PATH = '/api/v1.0/Pessoas/ConsultarDadosPessoaPorCpfCnpjEStatus';
const RECORD_KEYS = [
  'erp_key', 'chave', 'codigo', 'CodigoPessoa', 'codigoPessoa', 'codigo_pessoa',
  'cod_pes', 'supplier_code', 'person_code', 'NumeroPessoa',
];
const ERROR_KEYS = ['error', 'erro', 'mensagem', 'descricao', 'Descricao', 'message'];

function joinUrl(base: string, endpoint: string): string {
  return base.replace(/\/+$/, '') + '/' + endpoint.replace(/^\/+/, '');
}

function parseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

function firstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

export async function cnpjaLookup(cnpj: string): Promise<SupplierFields | null> {
  const settings = getSettings();
  if (!settings.cnpja.baseUrl) {
    throw new AppError('Consulta à Receita (CNPJA) não configurada.', 500, 'config');
  }
  const url = joinUrl(settings.cnpja.baseUrl, `/office/${cnpj}?registrations=ALL`);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: settings.cnpja.token ? { Authorization: settings.cnpja.token } : {},
      signal: AbortSignal.timeout(settings.cnpja.timeoutMs),
    });
  } catch (error) {
    throw new AppError('Não consegui consultar a Receita: ' + ((error as { message?: string }).message || error), 502, 'cnpja');
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new AppError('A Receita (CNPJA) retornou ' + response.status + '.', 502, 'cnpja');
  }
  return flattenCnpja((await response.json()) as never);
}

async function uauAuthToken(): Promise<string> {
  const settings = getSettings();
  const response = await fetch(joinUrl(settings.uau.baseUrl, AUTHENTICATE_PATH), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-INTEGRATION-Authorization': settings.uau.xIntegration },
    body: JSON.stringify({ login: settings.uau.user, senha: settings.uau.password }),
    signal: AbortSignal.timeout(settings.uau.timeoutMs),
  });
  if (!response.ok) throw new AppError('Falha ao autenticar no UAU (' + response.status + ').', 502, 'uau');
  const token = await response.json();
  return typeof token === 'string' ? token : String(token);
}

export async function uauGetPerson(document: string): Promise<unknown> {
  const settings = getSettings();
  const token = await uauAuthToken();
  let response: Response;
  try {
    response = await fetch(joinUrl(settings.uau.baseUrl, PERSON_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-INTEGRATION-Authorization': settings.uau.xIntegration, Authorization: token },
      body: JSON.stringify({ cpf_cnpj: document, status: 2 }),
      signal: AbortSignal.timeout(settings.uau.timeoutMs),
    });
  } catch (error) {
    throw new AppError('Não consegui consultar o UAU: ' + ((error as { message?: string }).message || error), 502, 'uau');
  }
  const bodyText = await response.text();
  const parsed = parseJson(bodyText);
  if (response.status >= 400) {
    const message = (parsed && typeof parsed === 'object' ? firstString(parsed as Record<string, unknown>, ERROR_KEYS) : '') || bodyText;
    if (message.includes(UAU_NOT_FOUND)) return null;
    throw new AppError('O UAU recusou a consulta (' + response.status + '): ' + message.slice(0, 300), 502, 'uau');
  }
  if (Array.isArray(parsed) && parsed.length) return parsed[0];
  if (parsed && typeof parsed === 'object' && (parsed as Record<string, unknown>).Descricao === UAU_NOT_FOUND) return null;
  return null;
}

export interface N8nSupplierResult { ok: boolean; erpKey: string | null; message: string }

export async function n8nCreateSupplier(payload: Record<string, unknown>): Promise<N8nSupplierResult> {
  const settings = getSettings();
  if (!settings.n8nBaseUrl || !settings.integration.supplierCreateEndpoint) {
    throw new AppError('Integração de fornecedor não configurada (N8N_BASE_URL / SUPPLIER_CREATE_ENDPOINT).', 500, 'config');
  }
  const url = joinUrl(settings.n8nBaseUrl, settings.integration.supplierCreateEndpoint);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.integration.authToken) headers[settings.integration.authHeader] = settings.integration.authToken;

  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(120000) });
  } catch (error) {
    return { ok: false, erpKey: null, message: 'Não consegui chamar o n8n: ' + ((error as { message?: string }).message || error) };
  }
  const bodyText = await response.text();
  const parsed = parseJson(bodyText);
  if (response.status >= 400) {
    return { ok: false, erpKey: null, message: 'n8n retornou ' + response.status + ': ' + bodyText.slice(0, 300) };
  }
  const record = (Array.isArray(parsed) ? parsed[0] : parsed) as Record<string, unknown> | null;
  if (record && typeof record === 'object') {
    const erpKey = firstString(record, RECORD_KEYS) || null;
    const errorMessage = firstString(record, ERROR_KEYS);
    if (record.success === false || record.ok === false || (errorMessage && !erpKey)) {
      return { ok: false, erpKey: null, message: errorMessage || 'Fornecedor recusado pelo UAU.' };
    }
    return { ok: true, erpKey, message: 'ok' };
  }
  return { ok: true, erpKey: null, message: 'ok' };
}
