// Modal de Parcelas — visualizar / adicionar / editar / deletar. window.openInstallments(proc, onSaved)
// Salva a lista inteira via POST /processes/:uuid/installments. Mostra soma x valor do processo.
(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function money(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function toast(msg, ok) {
    var t = document.createElement('div'); t.textContent = msg;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (ok ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3500);
  }

  window.openInstallments = async function (proc, onSaved) {
    var uuid = proc.uuid_prc, total = Number(proc.value_prc) || 0;
    var rows = [];
    try { rows = await window.Store.get('installments', uuid); } catch (e) { rows = []; }
    var parcelas = (rows || []).map(function (r) { return { vencimento: (r.due_date_ins || '').split('T')[0], valor: Number(r.value_ins) || 0 }; });

    var o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML =
      '<div class="modal-box lg"><button class="modal-x" aria-label="Fechar">×</button>'
      + '<div class="modal-title">Parcelas — Processo #' + esc(proc.id_prc) + '</div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">'
      + '<button class="btn btn-light" id="pm-add">+ Adicionar parcela</button>'
      + '<div id="pm-soma" class="section-sub" style="margin:0"></div></div>'
      + '<div id="pm-rows"></div>'
      + '<div class="modal-actions"><button class="btn btn-light" id="pm-cancel">Cancelar</button>'
      + '<button class="btn btn-primary" id="pm-save">Salvar parcelas</button></div></div>';
    document.body.appendChild(o);
    o.addEventListener('click', function (e) { if (e.target === o || e.target.classList.contains('modal-x')) o.remove(); });
    o.querySelector('#pm-cancel').addEventListener('click', function () { o.remove(); });

    function soma() { return parcelas.reduce(function (a, p) { return a + (Number(p.valor) || 0); }, 0); }
    function renderSoma() {
      var s = soma(), diff = Math.round((s - total) * 100) / 100;
      var cls = Math.abs(diff) < 0.01 ? 'ok' : 'red';
      o.querySelector('#pm-soma').innerHTML = 'Soma: <b>' + money(s) + '</b> · Processo: <b>' + money(total) + '</b> '
        + '<span class="badge ' + cls + '">' + (Math.abs(diff) < 0.01 ? 'OK' : (diff > 0 ? 'acima ' : 'abaixo ') + money(Math.abs(diff))) + '</span>';
    }
    function render() {
      var box = o.querySelector('#pm-rows');
      if (!parcelas.length) { box.innerHTML = '<div class="empty">Sem parcelas. Adicione uma.</div>'; renderSoma(); return; }
      box.innerHTML = '<table><thead><tr><th>#</th><th>Vencimento</th><th>Valor</th><th></th></tr></thead><tbody>'
        + parcelas.map(function (p, i) {
          return '<tr><td>' + (i + 1) + '</td>'
            + '<td><input type="date" data-i="' + i + '" data-f="vencimento" value="' + esc(p.vencimento) + '"></td>'
            + '<td><input type="number" step="0.01" data-i="' + i + '" data-f="valor" value="' + esc(p.valor) + '" style="width:140px"></td>'
            + '<td style="text-align:right"><button class="btn btn-danger" data-del="' + i + '">Remover</button></td></tr>';
        }).join('') + '</tbody></table>';
      box.querySelectorAll('input').forEach(function (inp) {
        inp.addEventListener('input', function () { parcelas[+inp.getAttribute('data-i')][inp.getAttribute('data-f')] = inp.value; renderSoma(); });
      });
      box.querySelectorAll('[data-del]').forEach(function (b) {
        b.addEventListener('click', function () { parcelas.splice(+b.getAttribute('data-del'), 1); render(); });
      });
      renderSoma();
    }
    o.querySelector('#pm-add').addEventListener('click', function () {
      var last = parcelas[parcelas.length - 1];
      var venc = ''; if (last && last.vencimento) { var d = new Date(last.vencimento + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); venc = d.toISOString().split('T')[0]; }
      parcelas.push({ vencimento: venc, valor: 0 }); render();
    });
    o.querySelector('#pm-save').addEventListener('click', async function () {
      var btn = this; btn.disabled = true; btn.textContent = 'Salvando…';
      try {
        var payload = parcelas.filter(function (p) { return p.vencimento; }).map(function (p) { return { due_date_ins: p.vencimento, value_ins: Number(p.valor) || 0 }; });
        var somaP = payload.reduce(function (a, p) { return a + (p.value_ins || 0); }, 0);
        var fora = false; for (var i = 1; i < payload.length; i++) { if (payload[i].due_date_ins < payload[i - 1].due_date_ins) { fora = true; break; } }
        await window.Store.commit(
          function () { return window.API.post('/processes/' + uuid + '/installments', { installments: payload }); },
          function () {
            window.Store.invalidateKey('installments', uuid); // só as parcelas deste processo
            window.Store.patch('financeiro', 'uuid_prc', uuid, { soma_parcelas: somaP, qtd_parcelas: payload.length, parcelas_fora_ordem: fora });
            return ['installments'];
          });
        toast('Parcelas salvas.', true); o.remove(); if (typeof onSaved === 'function') onSaved();
      } catch (e) { btn.disabled = false; btn.textContent = 'Salvar parcelas'; toast('Erro: ' + e.message); }
    });
    render();
  };
})();
