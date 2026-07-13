// Processos Integrados (financeiro): lista read-only dos processos em status
// Integrado (7). Gate de acesso (is_financeiro/admin) é feito no router; a RLS
// (v_financeiro_integrados com security_invoker) limita as linhas por grupo.
async function initView_financeiro_integrados() {
  await window.ProcessList.mount(document.getElementById('fin-integ-host'), {
    emptyText: 'Nenhum processo integrado.',
    storageKey: 'financeiro-integrados',
    dateField: 'due_date_prc',
    load: function () { return window.Store.get('financeiro_integrados'); },
    // sem ações: tela de acompanhamento (o processo já foi integrado)
  });
}
