// Popula a sidebar da Consulta: 1 item por tipo de processo (#/consulta?kind=N)
// + "Minhas Aprovações" (#/consulta?view=aprovacoes).
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var body = document.getElementById('consulta-tabs');
    if (!body) return;
    var kinds = (window.CONFIG && window.CONFIG.PROCESS_KINDS) || {};
    var html = '';
    Object.keys(kinds).forEach(function (id) {
      html += '<a class="menu-item" href="#/consulta?kind=' + id + '" data-tab="kind-' + id + '"><span class="mi-dot"></span><span class="label">' + kinds[id] + '</span></a>';
    });
    body.innerHTML = html;
  });
})();
