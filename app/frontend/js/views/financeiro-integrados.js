async function initView_financeiro_integrados() {
  await window.ProcessList.mount(document.getElementById('fin-integ-host'), {
    emptyText: 'Nenhum processo integrado.',
    storageKey: 'financeiro-integrados',
    dateField: 'due_date_prc',
    pageSize: 50,
    fetchPage: window.fetchProcessesPage(null, false, 'v_financeiro_integrados'),
    refreshKeys: ['financeiro_integrados'],
    extraColumns: [{ label: 'Nº UAU', col: 'uau_number_prc', type: 'text' }],
  });
}
