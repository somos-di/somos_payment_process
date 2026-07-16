// Mini app REAPROVAÇÕES (admin): envia a solicitação ao backend, que repassa ao
// webhook do n8n. Tudo passa pelo backend (POST /reapprovals, gated a admin no servidor).
async function initView_reaprovals() {
  var $ = function (id) { return document.getElementById(id); };
  function toast(msg, ok) {
    var t = document.createElement('div'); t.textContent = msg;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10000;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (ok ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4500);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function fmtDateTime(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return String(d); }
  }

  function clearForm() {
    ['ra-company', 'ra-costcenter', 'ra-process', 'ra-installment', 'ra-approver'].forEach(function (id) { $(id).value = ''; });
    $('ra-status').textContent = '';
  }
  $('ra-clear').addEventListener('click', clearForm);

  // ── Histórico ──────────────────────────────────────────────────────────
  var histRows = [];
  function renderHist() {
    var t = ($('ra-search').value || '').toLowerCase().trim();
    var data = histRows.filter(function (r) {
      return !t || [r.company_rap, r.cost_center_rap, r.process_rap, r.installment_rap, r.approver_rap, r.author_nome].join(' ').toLowerCase().indexOf(t) >= 0;
    });
    if (!data.length) { $('ra-hist').innerHTML = '<div class="empty">Nenhuma reaprovação enviada.</div>'; return; }
    var html = '<div class="table-scroll"><table><thead><tr>'
      + '<th>#</th><th>Data</th><th>Empresa</th><th>Obra</th><th>Processo</th><th>Parcela</th><th>Aprovador</th><th>Mensagem</th><th>Autor</th>'
      + '</tr></thead><tbody>';
    data.forEach(function (r) {
      html += '<tr>'
        + '<td>' + esc(r.id_rap) + '</td>'
        + '<td>' + esc(fmtDateTime(r.created_at_rap)) + '</td>'
        + '<td>' + esc(r.company_rap) + '</td>'
        + '<td>' + esc(r.cost_center_rap || '—') + '</td>'
        + '<td>' + esc(r.process_rap) + '</td>'
        + '<td>' + esc(r.installment_rap) + '</td>'
        + '<td>' + esc(r.approver_rap || '—') + '</td>'
        + '<td>' + esc(r.message_rap || '—') + '</td>'
        + '<td>' + esc(r.author_nome || '—') + '</td></tr>';
    });
    html += '</tbody></table></div>';
    $('ra-hist').innerHTML = html;
  }
  async function loadHist() {
    $('ra-hist').innerHTML = '<div class="empty">Carregando…</div>';
    try { histRows = (await window.API.get('/reapprovals')) || []; renderHist(); }
    catch (e) { window.viewError($('ra-hist'), e); }
  }
  $('ra-search').addEventListener('input', renderHist);
  $('ra-refresh').addEventListener('click', loadHist);

  $('ra-send').addEventListener('click', async function () {
    var company = parseInt($('ra-company').value, 10);
    var process = parseInt($('ra-process').value, 10);
    var installment = parseInt($('ra-installment').value, 10);
    var costCenter = $('ra-costcenter').value.trim();
    var approver = $('ra-approver').value.trim();

    if (!(company > 0)) { toast('Informe a empresa (código válido).'); return; }
    if (!costCenter) { toast('Informe o centro de custo / obra.'); return; }
    if (!(process > 0)) { toast('Informe o Id do processo.'); return; }
    if (!(installment > 0)) { toast('Informe o Id da parcela.'); return; }
    if (!approver) { toast('Informe o aprovador.'); return; }

    var btn = this; btn.disabled = true; $('ra-status').textContent = 'Enviando…';
    try {
      var res = await window.API.post('/reapprovals', {
        approverId: approver,
        companyId: company,
        costCenterId: costCenter,
        processId: process,
        installmentId: installment,
      });
      $('ra-status').textContent = '';
      toast((res && res.message) || 'Reaprovação enviada com sucesso!', true);
      clearForm();
      loadHist();   // atualiza o histórico com o envio recém-feito
    } catch (e) {
      $('ra-status').textContent = '';
      toast('Erro ao enviar: ' + e.message);
    } finally { btn.disabled = false; }
  });

  await loadHist();
}
