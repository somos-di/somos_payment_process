// Minhas Aprovações — processos que o usuário já aprovou (view-only, sem ações).
async function initView_minhas_aprovacoes() {
  await window.ProcessList.mount(document.getElementById('ma-host'), {
    emptyText: 'Você ainda não aprovou nenhum processo.',
    load: function () { return window.Store.get('my_approvals'); },
    // sem actions => somente leitura (linha abre Detalhes; botão Aprovadores)
  });
}
