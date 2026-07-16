async function initView_minhas_aprovacoes() {
  await window.ProcessList.mount(document.getElementById('ma-host'), {
    emptyText: 'Você ainda não aprovou nenhum processo.',
    load: function () { return window.Store.get('my_approvals'); },
    refreshKeys: ['my_approvals'],
    dateField: 'due_date_prc',

  });
}
