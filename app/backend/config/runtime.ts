// Parâmetros fixos não-env, agrupados por função/concern. Ponto único onde vivem
// as constantes que precisam existir no código (nada de números/strings soltos nos serviços).

export const RUNTIME = {
  uauGateway: { tokenTtlMs: 25 * 60 * 1000 }, // token UAU ~25min
  sync: { insertBatchSize: 500 },
  // caminho fixo do webhook de reaprovação no n8n (contrato do fluxo)
  reapproval: { webhookPath: '/39cde56e-2692-473f-82a1-b148069a8329' },
};

// Constantes fixas da montagem do payload de integração (UauIntegrationService.buildPayload).
// São regras do contrato UAU, iguais para todo processo.
export const buildUauPayloadParams = {
  tipoProcesso: 1,
  controlarEstoque: 0,
  acompanhaEntrega: 0,
  dataPrevisaoEntrega: '',
  tipoItem: 0,
  nfEletronica: 0,
  chaveNFe: '',
  quantidade: 1,
  numeroItemContrato: 0,
  historicoLancContabil: 'A PAGAR Fornecedor [pgto_NomeFornecedor] Número [pgto_NumNF]',
  historicoLancContabilPago: 'PAGO Fornecedor [pgto_NomeFornecedor] NF [pgto_NumNF] Cheque [pgto_Cheque]',
} as const;
