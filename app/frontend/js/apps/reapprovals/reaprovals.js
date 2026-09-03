async function initView_reaprovals() {
  var selectElement = function (id) { return document.getElementById(id); };
  function toast(message, isSuccess) {
    var t = document.createElement('div'); t.textContent = message;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10000;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (isSuccess ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4500);
  }

  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function formatDateTime(d) {
    if (!d) return '-';
    try { return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (error) { return String(d); }
  }

  function clearForm() {
    ['ra-company', 'ra-costcenter', 'ra-process', 'ra-installment', 'ra-approver'].forEach(function (item) { selectElement(item).value = ''; });
    selectElement('ra-status').textContent = '';
  }
  selectElement('ra-clear').addEventListener('click', clearForm);

  var histRows = [];
  var raPage = 0;
  function renderHist() {
    var t = (selectElement('ra-search').value || '').toLowerCase().trim();
    var full = histRows.filter(function (histRow) {
      return !t || [histRow.company_rap, histRow.cost_center_rap, histRow.process_rap, histRow.installment_rap, histRow.approver_rap, histRow.author_nome].join(' ').toLowerCase().indexOf(t) >= 0;
    });
    if (!full.length) { selectElement('ra-hist').innerHTML = '<div class="empty">Nenhuma reaprovação enviada.</div>'; return; }
    var cp = window.ClientPager(full.length, raPage, 50); raPage = cp.page;
    var data = cp.slice(full);
    var html = '<div class="table-scroll"><table><thead><tr>'
      + '<th>#</th><th>Data</th><th>Empresa</th><th>Obra</th><th>Processo</th><th>Parcela</th><th>Aprovador</th><th>Mensagem</th><th>Autor</th>'
      + '</tr></thead><tbody>';
    data.forEach(function (entry) {
      html += '<tr>'
        + '<td>' + escapeHtml(entry.id_rap) + '</td>'
        + '<td>' + escapeHtml(formatDateTime(entry.created_at_rap)) + '</td>'
        + '<td>' + escapeHtml(entry.company_rap) + '</td>'
        + '<td>' + escapeHtml(entry.cost_center_rap || '-') + '</td>'
        + '<td>' + escapeHtml(entry.process_rap) + '</td>'
        + '<td>' + escapeHtml(entry.installment_rap) + '</td>'
        + '<td>' + escapeHtml(entry.approver_rap || '-') + '</td>'
        + '<td>' + escapeHtml(entry.message_rap || '-') + '</td>'
        + '<td>' + escapeHtml(entry.author_nome || '-') + '</td></tr>';
    });
    html += '</tbody></table></div>' + cp.html();
    selectElement('ra-hist').innerHTML = html;
    cp.wire(selectElement('ra-hist'), function (p) { raPage = p; renderHist(); });
  }
  async function loadHist() {
    selectElement('ra-hist').innerHTML = '<div class="empty">Carregando…</div>';
    try { histRows = (await window.API.get('/reapprovals')) || []; renderHist(); }
    catch (error) { window.viewError(selectElement('ra-hist'), error); }
  }
  selectElement('ra-search').addEventListener('input', function () { raPage = 0; renderHist(); });
  selectElement('ra-refresh').addEventListener('click', loadHist);

  selectElement('ra-send').addEventListener('click', async function () {
    var company = parseInt(selectElement('ra-company').value, 10);
    var process = parseInt(selectElement('ra-process').value, 10);
    var installment = parseInt(selectElement('ra-installment').value, 10);
    var costCenter = selectElement('ra-costcenter').value.trim();
    var approver = selectElement('ra-approver').value.trim();

    if (!(company > 0)) { toast('Informe a empresa (código válido).'); return; }
    if (!costCenter) { toast('Informe o centro de custo / obra.'); return; }
    if (!(process > 0)) { toast('Informe o Id do processo.'); return; }
    if (!(installment > 0)) { toast('Informe o Id da parcela.'); return; }
    if (!approver) { toast('Informe o aprovador.'); return; }

    var button = this; button.disabled = true; selectElement('ra-status').textContent = 'Enviando…';
    try {
      var response = await window.API.post('/reapprovals', {
        approverId: approver,
        companyId: company,
        costCenterId: costCenter,
        processId: process,
        installmentId: installment,
      });
      selectElement('ra-status').textContent = '';
      toast((response && response.message) || 'Reaprovação enviada com sucesso!', true);
      loadHist();
    } catch (error) {
      selectElement('ra-status').textContent = '';
      toast('Erro ao enviar: ' + error.message);
    } finally { button.disabled = false; }
  });

  await loadHist();
}
