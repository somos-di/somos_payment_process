(function () {
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(value) { return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function toast(message, isSuccess) {
    var t = document.createElement('div'); t.textContent = message;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (isSuccess ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3500);
  }

  window.openInstallments = async function (process, onSaved) {
    var uuid = process.uuid_prc, total = Number(process.value_prc) || 0;
    var rows = [];
    try { rows = await window.Store.get('installments', uuid); } catch (error) { rows = []; }
    var installments = (rows || []).map(function (item) { return { vencimento: (item.due_date_ins || '').split('T')[0], valor: Number(item.value_ins) || 0 }; });

    var o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML =
      '<div class="modal-box lg"><button class="modal-x" aria-label="Fechar">×</button>'
      + '<div class="modal-title">Parcelas — Processo #' + escapeHtml(process.id_prc) + '</div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">'
      + '<button class="btn btn-light" id="pm-add">+ Adicionar parcela</button>'
      + '<div id="pm-soma" class="section-sub" style="margin:0"></div></div>'
      + '<div id="pm-rows"></div>'
      + '<div class="modal-actions"><button class="btn btn-light" id="pm-cancel">Cancelar</button>'
      + '<button class="btn btn-primary" id="pm-save">Salvar parcelas</button></div></div>';
    document.body.appendChild(o);
    o.addEventListener('click', function (event) { if (event.target === o || event.target.classList.contains('modal-x')) o.remove(); });
    o.querySelector('#pm-cancel').addEventListener('click', function () { o.remove(); });

    function sumInstallments() { return installments.reduce(function (accumulated, installment) { return accumulated + (Number(installment.valor) || 0); }, 0); }
    function renderSum() {
      var s = sumInstallments(), diff = Math.round((s - total) * 100) / 100;
      var cssClass = Math.abs(diff) < 0.01 ? 'ok' : 'red';
      o.querySelector('#pm-soma').innerHTML = 'Soma: <b>' + money(s) + '</b> · Processo: <b>' + money(total) + '</b> '
        + '<span class="badge ' + cssClass + '">' + (Math.abs(diff) < 0.01 ? 'OK' : (diff > 0 ? 'acima ' : 'abaixo ') + money(Math.abs(diff))) + '</span>';
    }
    function render() {
      var box = o.querySelector('#pm-rows');
      if (!installments.length) { box.innerHTML = '<div class="empty">Sem parcelas. Adicione uma.</div>'; renderSum(); return; }
      box.innerHTML = '<table><thead><tr><th>#</th><th>Vencimento</th><th>Valor</th><th></th></tr></thead><tbody>'
        + installments.map(function (installment, index) {
          return '<tr><td>' + (index + 1) + '</td>'
            + '<td><input type="date" data-i="' + index + '" data-f="vencimento" value="' + escapeHtml(installment.vencimento) + '"></td>'
            + '<td><input type="number" step="0.01" data-i="' + index + '" data-f="valor" value="' + escapeHtml(installment.valor) + '" style="width:140px"></td>'
            + '<td style="text-align:right"><button class="btn btn-danger" data-del="' + index + '">Remover</button></td></tr>';
        }).join('') + '</tbody></table>';
      box.querySelectorAll('input').forEach(function (item) {
        item.addEventListener('input', function () { installments[+item.getAttribute('data-i')][item.getAttribute('data-f')] = item.value; renderSum(); });
      });
      box.querySelectorAll('[data-del]').forEach(function (item) {
        item.addEventListener('click', function () { installments.splice(+item.getAttribute('data-del'), 1); render(); });
      });
      renderSum();
    }
    o.querySelector('#pm-add').addEventListener('click', function () {
      var last = installments[installments.length - 1];
      var nextDueDate = ''; if (last && last.vencimento) { var d = new Date(last.vencimento + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); nextDueDate = d.toISOString().split('T')[0]; }
      installments.push({ vencimento: nextDueDate, valor: 0 }); render();
    });
    o.querySelector('#pm-save').addEventListener('click', async function () {
      var button = this; button.disabled = true; button.textContent = 'Salvando…';
      try {
        var payload = installments.filter(function (installment) { return installment.vencimento; }).map(function (installment) { return { due_date_ins: installment.vencimento, value_ins: Number(installment.valor) || 0 }; });
        var payloadSum = payload.reduce(function (accumulated, installment) { return accumulated + (installment.value_ins || 0); }, 0);
        var outOfOrder = false; for (var index = 1; index < payload.length; index++) { if (payload[index].due_date_ins < payload[index - 1].due_date_ins) { outOfOrder = true; break; } }
        await window.Store.commit(
          function () { return window.API.post('/processes/' + uuid + '/installments', { installments: payload }); },
          function () {
            window.Store.invalidateKey('installments', uuid);
            window.Store.patch('financeiro', 'uuid_prc', uuid, { soma_parcelas: payloadSum, qtd_parcelas: payload.length, parcelas_fora_ordem: outOfOrder });
            return ['installments'];
          });
        toast('Parcelas salvas.', true); o.remove(); if (typeof onSaved === 'function') onSaved();
      } catch (error) { button.disabled = false; button.textContent = 'Salvar parcelas'; toast('Erro: ' + error.message); }
    });
    render();
  };
})();
