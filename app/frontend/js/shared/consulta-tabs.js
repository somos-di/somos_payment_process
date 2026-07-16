(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function build() {
    var body = document.getElementById('consulta-tabs');
    if (!body) return;
    var kinds = (window.CONFIG && window.CONFIG.PROCESS_KINDS) || {};
    var html = '';
    Object.keys(kinds).forEach(function (id) {
      if (String(kinds[id] || '').trim().toLowerCase() === 'comissão') return;
      html += '<a class="menu-item" href="#/consulta?kind=' + esc(id) + '" data-tab="kind-' + esc(id) + '"><span class="mi-dot"></span><span class="label">' + esc(kinds[id]) + '</span></a>';
    });
    body.innerHTML = html;
  }
  window.buildConsultaTabs = build;
  document.addEventListener('DOMContentLoaded', build);
})();
