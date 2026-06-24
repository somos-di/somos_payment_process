// Financeiro — processos em análise (v_financeiro): colunas + ALERTAS (soma/ordem)
// + ações: Detalhes, Parcelas (CRUD), Correção (devolve), Enviar UAU (stub, por último).
async function initView_financeiro() {
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function money(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDate(d) { return d ? String(d).split('T')[0].split('-').reverse().join('/') : '—'; }
  function toast(msg, ok) {
    var t = document.createElement('div'); t.textContent = msg;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (ok ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4000);
  }
  function confirmar(message) {
    return new Promise(function (resolve) {
      var o = document.createElement('div'); o.className = 'modal-overlay';
      o.innerHTML = '<div class="modal-box" style="width:440px"><div class="modal-title">Confirmação</div>'
        + '<div style="font-size:14px;color:var(--text-2);line-height:1.5">' + esc(message) + '</div>'
        + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button><button class="btn btn-danger" data-ok>Confirmar</button></div></div>';
      function close(v) { o.remove(); resolve(v); }
      o.addEventListener('click', function (e) { if (e.target === o) close(false); });
      o.querySelector('[data-x]').addEventListener('click', function () { close(false); });
      o.querySelector('[data-ok]').addEventListener('click', function () { close(true); });
      document.body.appendChild(o);
    });
  }

  // monta a lista de alertas de uma linha (soma divergente + ordem das parcelas)
  function alertas(p) {
    var out = [];
    var soma = Number(p.soma_parcelas) || 0, total = Number(p.value_prc) || 0, diff = Math.round((soma - total) * 100) / 100;
    if (p.qtd_parcelas > 0 && Math.abs(diff) >= 0.01) {
      out.push('A soma das parcelas (' + money(soma) + ') está ' + (diff > 0 ? 'ACIMA' : 'ABAIXO')
        + ' do valor do processo (' + money(total) + '). Diferença: ' + money(Math.abs(diff)) + '.');
    }
    if (p.parcelas_fora_ordem) out.push('Há parcelas com vencimento fora de ordem (uma parcela posterior vence antes de uma anterior).');
    if (p.qtd_parcelas === 0) out.push('Processo sem parcelas cadastradas.');
    return out;
  }

  var rows = [];
  try { rows = await window.Store.get('financeiro'); }
  catch (e) { $('fin-body').innerHTML = '<div class="view-error">' + esc(e.message) + '</div>'; return; }

  function filtered() {
    var t = ($('fin-search').value || '').toLowerCase().trim();
    if (!t) return rows;
    return rows.filter(function (p) { return [p.id_prc, p.empresa_nome, p.obra_nome, p.fornecedor_nome, p.fiscal_doc_prc].join(' ').toLowerCase().indexOf(t) >= 0; });
  }
  function render() {
    var data = filtered();
    if (!data.length) { $('fin-body').innerHTML = '<div class="empty">Nenhum processo em análise financeira.</div>'; return; }
    var html = '<table><thead><tr><th>#</th><th>Empresa</th><th>Obra</th><th>Fornecedor</th><th>Nota Fiscal</th><th>Status</th><th>Vencimento</th><th>Valor Bruto</th><th>Alertas</th><th></th></tr></thead><tbody>';
    data.forEach(function (p, i) {
      var al = alertas(p);
      html += '<tr data-i="' + i + '" style="cursor:pointer">'
        + '<td>' + esc(p.id_prc) + '</td><td>' + esc(p.empresa_nome) + '</td><td>' + esc(p.obra_nome) + '</td>'
        + '<td>' + esc(p.fornecedor_nome) + '</td><td>' + esc(p.fiscal_doc_prc || '—') + '</td>'
        + '<td><span class="badge blue">' + esc(p.status_nome) + '</span></td>'
        + '<td>' + fmtDate(p.due_date_prc) + '</td><td>' + money(p.value_prc) + '</td>'
        + '<td>' + (al.length ? '<button class="badge warn fin-alert" data-i="' + i + '" style="border:0;cursor:pointer">● Ver alertas (' + al.length + ')</button>' : '<span style="color:var(--muted)">—</span>') + '</td>'
        + '<td class="fin-acts"></td></tr>';
    });
    html += '</tbody></table>';
    $('fin-body').innerHTML = html;
    $('fin-body').querySelectorAll('tr[data-i]').forEach(function (tr) {
      var p = data[+tr.getAttribute('data-i')], cell = tr.lastElementChild;
      function btn(label, cls, fn) { var b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.addEventListener('click', function (e) { e.stopPropagation(); fn(); }); return b; }
      cell.appendChild(btn('Parcelas', 'btn-light', function () { window.openInstallments(p, reloadAll); }));
      cell.appendChild(btn('Correção', 'btn-danger', async function () {
        if (!(await confirmar('Devolver para correção? Isto remove parcelas e aprovações e volta o processo para "Pendente de Correção".'))) return;
        try {
          await window.Store.commit(
            function () { return window.API.post('/processes/' + p.uuid_prc + '/financeiro-reject'); },
            function () { window.Store.remove('financeiro', 'uuid_prc', p.uuid_prc); return ['financeiro']; });
          toast('Devolvido para correção.', true); reloadAll();
        } catch (e) { toast('Erro: ' + e.message); reloadAll(); }
      }));
      cell.appendChild(btn('Enviar UAU', 'btn-primary', async function () {
        if (!(await confirmar('Enviar este processo para integração com o UAU?'))) return;
        try {
          await window.Store.commit(
            function () { return window.API.post('/processes/' + p.uuid_prc + '/send-uau'); },
            function () { window.Store.remove('financeiro', 'uuid_prc', p.uuid_prc); return ['financeiro']; });
          toast('Enviado ao UAU.', true); reloadAll();
        } catch (e) { toast('Erro: ' + e.message); reloadAll(); }
      }));
      tr.addEventListener('click', function () { window.openProcessDetail(p); });
    });
    // popover de alertas
    $('fin-body').querySelectorAll('.fin-alert').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        document.querySelectorAll('.fin-alert-pop').forEach(function (x) { x.remove(); });
        var p = data[+b.getAttribute('data-i')], al = alertas(p);
        var pop = document.createElement('div'); pop.className = 'fin-alert-pop';
        pop.innerHTML = '<b>Alertas do processo #' + esc(p.id_prc) + '</b><ul>' + al.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
        document.body.appendChild(pop);
        var r = b.getBoundingClientRect();
        pop.style.top = (r.bottom + 6) + 'px'; pop.style.left = Math.max(8, r.right - 380) + 'px';
        setTimeout(function () {
          document.addEventListener('click', function close() { pop.remove(); document.removeEventListener('click', close); });
        }, 0);
      });
    });
  }
  async function reloadAll() {
    $('fin-body').innerHTML = '<div class="empty">Carregando…</div>';
    try { rows = await window.Store.get('financeiro'); render(); } catch (e) { $('fin-body').innerHTML = '<div class="view-error">' + esc(e.message) + '</div>'; }
  }
  function exportCsv() {
    var head = ['#', 'Empresa', 'Obra', 'Fornecedor', 'Nota Fiscal', 'Status', 'Vencimento', 'Valor', 'Alertas'];
    var lines = [head.join(';')].concat(filtered().map(function (p) {
      return [p.id_prc, p.empresa_nome, p.obra_nome, p.fornecedor_nome, p.fiscal_doc_prc, p.status_nome, p.due_date_prc, p.value_prc, alertas(p).join(' | ')]
        .map(function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; }).join(';');
    }));
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'financeiro.csv'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  $('fin-search').addEventListener('input', render);
  $('fin-xlsx').addEventListener('click', exportCsv);
  render();
}
