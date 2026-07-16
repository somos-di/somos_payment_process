
export const RUNTIME = {
  uauGateway: { tokenTtlMs: 25 * 60 * 1000 }, // token UAU ~25min
  sync: { insertBatchSize: 500 },
};

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
