async function initView_financeiro() {
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
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

  var FIN_ICONS = {
    parcelas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    correcao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
    uau: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>',
  };

  var rows = [];
  try { rows = await window.Store.get('financeiro'); }
  catch (e) { window.viewError($('fin-body'), e); return; }

  var filters = { company: '', building: '', from: '', to: '', status: '' };
  var pf = await window.ProcessFilters.mount($('fin-filters'), {
    storageKey: 'financeiro',
    onChange: function (values) { filters = values; render(); },
  });
  filters = pf.getValues();
  $('fin-clear').addEventListener('click', function () { $('fin-search').value = ''; pf.clear(); });

  function isoDay(v) { return v ? String(v).split('T')[0] : ''; }

  var FIN_SORT_COLS = [
    { label: '#', col: 'id_prc', type: 'num' },
    { label: 'Empresa', col: 'empresa_nome', type: 'text' },
    { label: 'Obra', col: 'obra_nome', type: 'text' },
    { label: 'Descrição', col: 'description_prc', type: 'text' },
    { label: 'Nota Fiscal', col: 'fiscal_doc_prc', type: 'text' },
    { label: 'Status', col: 'status_nome', type: 'text' },
    { label: 'Vencimento', col: 'due_date_prc', type: 'date' },
    { label: 'Valor Bruto', col: 'value_prc', type: 'num' },
  ];
  var FIN_SORT_TYPES = {}; FIN_SORT_COLS.forEach(function (c) { FIN_SORT_TYPES[c.col] = c.type; });
  var finSort = window.TableSort.load('sort:financeiro');
  function filtered() {
    var out = rows;
    var t = ($('fin-search').value || '').toLowerCase().trim();
    if (t) {
      out = out.filter(function (p) { return [p.id_prc, p.empresa_nome, p.obra_nome, p.description_prc, p.fornecedor_nome, p.fiscal_doc_prc].join(' ').toLowerCase().indexOf(t) >= 0; });
    }
    return out.filter(function (p) {
      if (filters.company && String(p.company_prc) !== String(filters.company)) return false;
      if (filters.building && String(p.building_prc || '').toUpperCase() !== String(filters.building).toUpperCase()) return false;
      if (filters.status !== '' && Number(p.status_step_prc) !== Number(filters.status)) return false;
      if (filters.urgent !== '' && !!p.is_urgent_prc !== (filters.urgent === '1')) return false;
      if (filters.from || filters.to) {
        var d = isoDay(p.due_date_prc);
        if (!d) return false;
        if (filters.from && d < filters.from) return false;
        if (filters.to && d > filters.to) return false;
      }
      return true;
    });
  }
  function render() {
    var data = window.TableSort.sortRows(filtered(), finSort, FIN_SORT_TYPES);
    if (!data.length) { $('fin-body').innerHTML = '<div class="empty">Nenhum processo em análise financeira.</div>'; return; }
    var head = FIN_SORT_COLS.map(function (c) {
      return '<th data-col="' + c.col + '">' + esc(c.label) + ' ' + window.TableSort.indicator(finSort, c.col) + '</th>';
    }).join('');
    var html = '<div class="table-scroll"><table><thead><tr>' + head + '<th>Alertas</th><th></th></tr></thead><tbody>';
    data.forEach(function (p, i) {
      var al = alertas(p);
      html += '<tr data-i="' + i + '" style="cursor:pointer">'
        + '<td>' + esc(p.id_prc) + '</td><td>' + esc(p.empresa_nome) + '</td><td>' + esc(p.obra_nome) + '</td>'
        + '<td>' + (p.description_prc ? esc(p.description_prc) : '<span style="color:var(--muted)">—</span>') + '</td>'
        + '<td>' + esc(p.fiscal_doc_prc || '—') + '</td>'
        + '<td><span class="badge ' + (p.status_step_prc === window.CONFIG.STATUS.erro ? 'red' : 'warn') + '">' + esc(p.status_nome) + '</span></td>'
        + '<td>' + fmtDate(p.due_date_prc) + '</td><td>' + money(p.value_prc) + '</td>'
        + '<td>' + (al.length ? '<button class="badge warn fin-alert" data-i="' + i + '" style="border:0;cursor:pointer">● Ver alertas (' + al.length + ')</button>' : '<span style="color:var(--muted)">—</span>') + '</td>'
        + '<td class="fin-acts"></td></tr>';
    });
    html += '</tbody></table></div>';
    $('fin-body').innerHTML = html;
    $('fin-body').querySelectorAll('th[data-col]').forEach(function (th) {
      th.addEventListener('click', function () {
        finSort = window.TableSort.cycle(finSort, th.getAttribute('data-col'));
        window.TableSort.save('sort:financeiro', finSort);
        render();
      });
    });
    $('fin-body').querySelectorAll('tr[data-i]').forEach(function (tr) {
      var p = data[+tr.getAttribute('data-i')], cell = tr.lastElementChild;
      function iconBtn(svg, cls, title, fn) {
        var b = document.createElement('button'); b.className = 'btn btn-icon ' + cls;
        b.style.marginLeft = '6px'; b.title = title; b.setAttribute('aria-label', title);
        b.innerHTML = svg; b.addEventListener('click', function (e) { e.stopPropagation(); fn(); }); return b;
      }
      cell.appendChild(iconBtn(FIN_ICONS.correcao, 'btn-danger', 'Correção', async function () {

        var reason = await window.uiPrompt('Devolver para correção? Isto remove parcelas e aprovações e volta o processo para "Pendente de Correção".', true);
        if (reason == null) return;
        try {
          await window.Store.commit(
            function () {
              return window.API.post('/processes/' + p.uuid_prc + '/financeiro-reject', { reason: reason })
                .then(function (r) { window.invalidateFlowCaches(); return r; });
            },
            function () { window.Store.remove('financeiro', 'uuid_prc', p.uuid_prc); return ['financeiro']; });
          toast('Devolvido para correção.', true); reloadAll();
        } catch (e) { toast('Erro: ' + e.message); reloadAll(); }
      }));
      cell.appendChild(iconBtn(FIN_ICONS.parcelas, 'btn-light', 'Parcelas', function () { window.openInstallments(p, reloadAll); }));
      var alRow = alertas(p);
      var uauBtn = iconBtn(FIN_ICONS.uau, 'btn-primary',
        alRow.length ? 'Resolva os ' + alRow.length + ' alerta(s) antes de integrar' : 'Enviar UAU',
        async function () {
          if (alRow.length) { toast('Processo com ' + alRow.length + ' alerta(s). Resolva antes de integrar.'); return; }
          if (!(await confirmar('Enviar este processo para integração com o UAU?'))) return;
          try {
            await window.Store.commit(
              function () {
                return window.API.post('/processes/' + p.uuid_prc + '/send-uau')
                  .then(function (r) { window.invalidateFlowCaches(); return r; });
              },
              function () { window.Store.remove('financeiro', 'uuid_prc', p.uuid_prc); return ['financeiro']; });
            toast('Enviado ao UAU.', true); reloadAll();
          } catch (e) { toast('Erro: ' + e.message); reloadAll(); }
        });
      if (alRow.length) { uauBtn.disabled = true; uauBtn.style.opacity = '0.45'; uauBtn.style.cursor = 'not-allowed'; }
      cell.appendChild(uauBtn);
      tr.addEventListener('click', function () { window.openProcessDetail(p); });
    });

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
    try { rows = await window.Store.get('financeiro'); render(); } catch (e) { window.viewError($('fin-body'), e); }
  }
  $('fin-search').addEventListener('input', render);
  render();
}
