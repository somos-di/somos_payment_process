async function initView_consulta() {
  var p = window.routeParams;
  var getElement = function (key) { return p && typeof p.get === 'function' ? p.get(key) : (p ? p[key] : null); };
  var host = document.getElementById('consulta-host');
  var title = document.getElementById('consulta-title');
  var subject = document.getElementById('consulta-sub');

  if (getElement('view') === 'aprovacoes') {
    title.textContent = 'Minhas Aprovações';
    subject.textContent = 'Processos aguardando sua aprovação.';
    return window.mountPendingApprovals(host);
  }

  var kind = getElement('kind') ? Number(getElement('kind')) : null;
  var kinds = (window.CONFIG.PROCESS_KINDS) || {};
  var isReembolso = kind ? /reembolso/i.test(kinds[kind] || '') : false;
  title.textContent = kind ? (isReembolso ? 'Reembolso' : (kinds[kind] || 'Processos')) : 'Todos os Processos';
  subject.textContent = 'Consulta de processos de pagamento.';

  await window.ProcessList.mount(host, {
    emptyText: 'Nenhum processo encontrado para este tipo.',
    pageSize: 50,
    fetchCount: window.fetchProcessesCount(kind || null, isReembolso),
    fetchPage: window.fetchProcessesPage(kind || null, isReembolso),
  });
}
