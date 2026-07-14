(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var body = document.getElementById('consulta-tabs');
    if (!body) return;
    var kinds = (window.CONFIG && window.CONFIG.PROCESS_KINDS) || {};
    var html = '';
    Object.keys(kinds).forEach(function (id) {
      // "Comissão" é um domínio próprio (menu Comissões), não um processo de pagamento —
      // não deve aparecer como aba da Consulta de pagamento.
      if (String(kinds[id] || '').trim().toLowerCase() === 'comissão') return;
      html += '<a class="menu-item" href="#/consulta?kind=' + id + '" data-tab="kind-' + id + '"><span class="mi-dot"></span><span class="label">' + kinds[id] + '</span></a>';
    });
    body.innerHTML = html;
  });
})();
