async function initView_consulta() {
  var p = window.routeParams;
  var get = function (k) { return p && typeof p.get === 'function' ? p.get(k) : (p ? p[k] : null); };
  var host = document.getElementById('consulta-host');
  var title = document.getElementById('consulta-title');
  var sub = document.getElementById('consulta-sub');

  if (get('view') === 'aprovacoes') {
    title.textContent = 'Minhas Aprovações';
    sub.textContent = 'Processos aguardando sua aprovação.';
    return window.mountPendingApprovals(host);
  }

  var kind = get('kind') ? Number(get('kind')) : null;
  var kinds = (window.CONFIG.PROCESS_KINDS) || {};
  // Reembolso agrupa todos os subtipos (Reembolso, Reembolso Alimentação, …): identifica
  // pela palavra "reembolso" no nome do tipo e filtra por nome em vez de kind exato.
  var isReembolso = kind ? /reembolso/i.test(kinds[kind] || '') : false;
  title.textContent = kind ? (isReembolso ? 'Reembolso' : (kinds[kind] || 'Processos')) : 'Todos os Processos';
  sub.textContent = 'Consulta de processos de pagamento.';

  await window.ProcessList.mount(host, {
    emptyText: 'Nenhum processo encontrado para este tipo.',
    pageSize: 50,
    fetchCount: window.fetchProcessesCount(kind || null, isReembolso),
    fetchPage: window.fetchProcessesPage(kind || null, isReembolso),
  });
}
