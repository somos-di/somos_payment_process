async function initView_relatorios() {
  var selectElement = function (id) { return document.getElementById(id); };
  var VIEWER = 'vendor/analytics-viewer/publicado.html';
  var reports = [];

  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function formatDateTime(d) {
    if (!d) return '-';
    try { return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (error) { return String(d); }
  }
  function formatDay(d) {
    try { return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch (error) { return String(d); }
  }
  function formatTime(d) {
    try { return new Date(d).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }); }
    catch (error) { return ''; }
  }
  function unique(values) { return values.filter(function (value, index) { return values.indexOf(value) === index; }); }
  function fill(select, items) {
    select.innerHTML = items.map(function (item) {
      return '<option value="' + escapeHtml(item.value) + '">' + escapeHtml(item.label) + '</option>';
    }).join('');
  }

  function developments() {
    return unique(reports.map(function (report) { return report.empreendimento; })).sort();
  }
  function reportsOf(development) {
    var seen = {};
    return reports.filter(function (report) {
      if (report.empreendimento !== development || seen[report.relatorio]) return false;
      seen[report.relatorio] = true;
      return true;
    });
  }
  function versionsOf(development, name) {
    return reports.filter(function (report) { return report.empreendimento === development && report.relatorio === name; });
  }

  function fillVersions() {
    var versions = versionsOf(selectElement('ar-development').value, selectElement('ar-report').value);
    fill(selectElement('ar-version'), versions.map(function (version, index) {
      var label = formatDay(version.created_at) + ', publicado às ' + formatTime(version.created_at);
      return { value: version.id, label: index === 0 ? label + ' (mais recente)' : label };
    }));
    openSelected();
  }
  function fillReports() {
    fill(selectElement('ar-report'), reportsOf(selectElement('ar-development').value).map(function (report) {
      return { value: report.relatorio, label: report.titulo };
    }));
    fillVersions();
  }

  function describe(id) {
    var chosen = reports.filter(function (report) { return String(report.id) === String(id); })[0];
    return chosen ? 'Publicado em ' + formatDateTime(chosen.created_at) + ', revisão ' + chosen.revisao + '.' : '';
  }

  async function openSelected() {
    var id = selectElement('ar-version').value;
    var body = selectElement('ar-body');
    var open = selectElement('ar-open');
    if (!id) return;
    open.hidden = true;
    body.innerHTML = '<div class="empty">Carregando relatório…</div>';
    try {
      var file = await window.API.get('/analytics-reports/' + encodeURIComponent(id) + '/file');
      var source = VIEWER + '?snapshot=' + encodeURIComponent(file.url);
      var frame = document.createElement('iframe');
      frame.className = 'ar-frame';
      frame.title = 'Relatório publicado';
      frame.src = source;
      body.innerHTML = '';
      body.appendChild(frame);
      open.href = source;
      open.hidden = false;
      selectElement('ar-meta').textContent = describe(id);
    } catch (error) { window.viewError(body, error); }
  }

  async function load() {
    try { reports = (await window.API.get('/analytics-reports')) || []; }
    catch (error) { window.viewError(selectElement('ar-body'), error); return; }
    if (!reports.length) {
      selectElement('ar-body').innerHTML = '<div class="empty">Nenhum relatório publicado para as empresas que você pode ver.</div>';
      return;
    }
    fill(selectElement('ar-development'), developments().map(function (name) { return { value: name, label: name }; }));
    fillReports();
  }

  selectElement('ar-development').addEventListener('change', fillReports);
  selectElement('ar-report').addEventListener('change', fillVersions);
  selectElement('ar-version').addEventListener('change', openSelected);
  await load();
}
