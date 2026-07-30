(function () {
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function build() {
    var body = document.getElementById('consulta-tabs');
    if (!body) return;
    var kinds = (window.CONFIG && window.CONFIG.PROCESS_KINDS) || {};
    var html = '';
    Object.keys(kinds).forEach(function (item) {
      if (String(kinds[item] || '').trim().toLowerCase() === 'comissão') return;
      html += '<a class="menu-item" href="#/consulta?kind=' + escapeHtml(item) + '" data-tab="kind-' + escapeHtml(item) + '"><span class="mi-dot"></span><span class="label">' + escapeHtml(kinds[item]) + '</span></a>';
    });
    body.innerHTML = html;
  }
  window.buildConsultaTabs = build;
  document.addEventListener('DOMContentLoaded', build);
})();
