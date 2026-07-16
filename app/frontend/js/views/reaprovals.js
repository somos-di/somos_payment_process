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

  function clearForm() {
    ['ra-company', 'ra-costcenter', 'ra-process', 'ra-installment', 'ra-approver'].forEach(function (id) { $(id).value = ''; });
    $('ra-status').textContent = '';
  }
  $('ra-clear').addEventListener('click', clearForm);

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
    } catch (e) {
      $('ra-status').textContent = '';
      toast('Erro ao enviar: ' + e.message);
    } finally { btn.disabled = false; }
  });
}
