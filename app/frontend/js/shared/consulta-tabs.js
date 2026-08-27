(function () {
  function build() {
    var body = document.getElementById('consulta-tabs');
    if (!body) return;
    body.innerHTML = '<a class="menu-item" href="#/consulta" data-route="consulta">'
      + '<span class="mi-dot"></span><span class="label">Processos</span></a>';
  }
  window.buildConsultaTabs = build;
  document.addEventListener('DOMContentLoaded', build);
})();
