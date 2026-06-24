// Consulta — lista por Tipo de Processo (?kind=N) ou "Minhas Aprovações" (?view=aprovacoes).
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
  title.textContent = kind ? (kinds[kind] || 'Processos') : 'Todos os Processos';
  sub.textContent = 'Consulta de processos de pagamento.';

  await window.ProcessList.mount(host, {
    emptyText: 'Nenhum processo encontrado para este tipo.',
    pageSize: 50,
    fetchCount: window.fetchProcessesCount(kind || null),
    fetchPage: window.fetchProcessesPage(kind || null),
  });
}
