async function initView_financeiro() {
  var selectElement = function (id) { return document.getElementById(id); };
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(value) { return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDate(d) { return d ? String(d).split('T')[0].split('-').reverse().join('/') : '-'; }
  function clip(text, maxPx) {
    if (text == null || text === '') return '<span style="color:var(--muted)">-</span>';
    var safe = escapeHtml(text);
    return '<span class="clip" style="max-width:' + maxPx + 'px" title="' + safe + '">' + safe + '</span>';
  }
  function toast(message, isSuccess) {
    var t = document.createElement('div'); t.textContent = message;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (isSuccess ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4000);
  }
  function confirmDialog(message) {
    return new Promise(function (resolve) {
      var o = document.createElement('div'); o.className = 'modal-overlay';
      o.innerHTML = '<div class="modal-box" style="width:440px"><div class="modal-title">Confirmação</div>'
        + '<div style="font-size:14px;color:var(--text-2);line-height:1.5">' + escapeHtml(message) + '</div>'
        + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button><button class="btn btn-danger" data-ok>Confirmar</button></div></div>';
      function close(value) { o.remove(); resolve(value); }
      o.addEventListener('click', function (event) { if (event.target === o) close(false); });
      o.querySelector('[data-x]').addEventListener('click', function () { close(false); });
      o.querySelector('[data-ok]').addEventListener('click', function () { close(true); });
      document.body.appendChild(o);
    });
  }

  function buildAlerts(p) {
    var output = [];
    var sum = Number(p.soma_parcelas) || 0, total = Number(p.value_prc) || 0, diff = Math.round((sum - total) * 100) / 100;
    if (p.qtd_parcelas > 0 && Math.abs(diff) >= 0.01) {
      output.push('A soma das parcelas (' + money(sum) + ') está ' + (diff > 0 ? 'ACIMA' : 'ABAIXO')
        + ' do valor do processo (' + money(total) + '). Diferença: ' + money(Math.abs(diff)) + '.');
    }
    if (p.parcelas_fora_ordem) output.push('Há parcelas com vencimento fora de ordem (uma parcela posterior vence antes de uma anterior).');
    if (p.qtd_parcelas === 0) output.push('Processo sem parcelas cadastradas.');
    return output;
  }

  var FIN_ICONS = {
    parcelas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    correcao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
    uau: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>',
    approvers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  };

  var rows = [];
  try { rows = await window.Store.get('financeiro'); }
  catch (error) { window.viewError(selectElement('fin-body'), error); return; }

  var filters = { company: '', building: '', from: '', to: '', status: '' };
  var processFilters = await window.ProcessFilters.mount(selectElement('fin-filters'), {
    storageKey: 'financeiro',
    multiStatus: true,
    onChange: function (values) { filters = values; render(); },
  });
  filters = processFilters.getValues();
  selectElement('fin-clear').addEventListener('click', function () { selectElement('fin-search').value = ''; processFilters.clear(); });
  selectElement('fin-refresh').addEventListener('click', async function () {
    var b = selectElement('fin-refresh'); b.disabled = true;
    try { window.Store.invalidate('financeiro'); await reloadAll(); } finally { b.disabled = false; }
  });

  function isoDay(value) { return value ? String(value).split('T')[0] : ''; }

  function statusCls(step) { return ((window.CONFIG && window.CONFIG.STATUS_COLORS) || {})[step] || ''; }
  function isActionable(p) { return p.status_step_prc === window.CONFIG.STATUS.financeiro || p.status_step_prc === window.CONFIG.STATUS.erro; }

  var FIN_COLS = [
    { col: 'id_prc', label: '#', type: 'num', width: 66 },
    { col: 'empresa_nome', label: 'Empresa', type: 'text', width: 150 },
    { col: 'obra_nome', label: 'Obra', type: 'text', width: 110 },
    { col: 'fornecedor_nome', label: 'Fornecedor', type: 'text', width: 130 },
    { col: 'description_prc', label: 'Descrição', type: 'text', width: 200 },
    { col: 'fiscal_doc_prc', label: 'Nota Fiscal', type: 'text', width: 110 },
    { col: 'uau_number_prc', label: 'Nº UAU', type: 'text', width: 90 },
    { col: 'status_nome', label: 'Status', type: 'text', width: 130, render: function (e) { return '<span class="badge ' + statusCls(e.status_step_prc) + '">' + escapeHtml(e.status_nome) + '</span>'; } },
    { col: 'due_date_prc', label: 'Vencimento', type: 'date', width: 110, render: function (e) { return fmtDate(e.due_date_prc); } },
    { col: 'value_prc', label: 'Valor Bruto', type: 'num', width: 120, render: function (e) { return money(e.value_prc); } },
  ];
  var FIN_SORT_TYPES = {}; FIN_COLS.forEach(function (c) { FIN_SORT_TYPES[c.col] = c.type; });
  var finSort = window.TableSort.load('sort:financeiro');
  var finCols = window.ColumnTools.create({ storageKey: 'financeiro', columns: FIN_COLS, onChange: render });
  var finActions = selectElement('fin-refresh').parentElement;
  if (finActions) { finActions.insertAdjacentHTML('afterbegin', finCols.menuButton()); finCols.wireMenu(finActions); }
  function filtered() {
    var output = rows;
    var t = (selectElement('fin-search').value || '').toLowerCase().trim();
    if (t) {
      output = output.filter(function (outItem) { return [outItem.id_prc, outItem.empresa_nome, outItem.obra_nome, outItem.description_prc, outItem.fornecedor_nome, outItem.fiscal_doc_prc, outItem.uau_number_prc].join(' ').toLowerCase().indexOf(t) >= 0; });
    }
    return output.filter(function (outItem) {
      if (filters.company && filters.company.length && filters.company.map(String).indexOf(String(outItem.company_prc)) < 0) return false;
      if (filters.building && filters.building.length
        && filters.building.map(function (buildingItem) { return String(buildingItem).toUpperCase(); }).indexOf(String(outItem.building_prc || '').toUpperCase()) < 0) return false;
      if (filters.status && filters.status.length && filters.status.map(Number).indexOf(Number(outItem.status_step_prc)) < 0) return false;
      if (filters.kind && filters.kind.length && filters.kind.map(Number).indexOf(Number(outItem.kind_prc)) < 0) return false;
      if (filters.urgent !== '' && !!outItem.is_urgent_prc !== (filters.urgent === '1')) return false;
      if (filters.fornecedor && String(outItem.fornecedor_nome || '').toLowerCase().indexOf(String(filters.fornecedor).toLowerCase()) < 0) return false;
      if (filters.descricao && String(outItem.description_prc || '').toLowerCase().indexOf(String(filters.descricao).toLowerCase()) < 0) return false;
      if (filters.uau && String(outItem.uau_number_prc || '').toLowerCase().indexOf(String(filters.uau).toLowerCase()) < 0) return false;
      if (filters.from || filters.to) {
        var d = isoDay(outItem.due_date_prc);
        if (!d) return false;
        if (filters.from && d < filters.from) return false;
        if (filters.to && d > filters.to) return false;
      }
      return true;
    });
  }
  function render() {
    var data = window.TableSort.sortRows(filtered(), finSort, FIN_SORT_TYPES);
    if (!data.length) { selectElement('fin-body').innerHTML = '<div class="empty">Nenhum processo.</div>'; return; }
    var head = finCols.head(function (col) { return window.TableSort.indicator(finSort, col); });
    var html = '<div class="table-scroll"><table class="ct-fixed" style="width:' + finCols.tableWidth([], [130, 190]) + 'px"><colgroup>'
      + finCols.colgroup([], [130, 190]) + '</colgroup><thead><tr>' + head
      + '<th class="ct-keep">Alertas</th><th class="ct-keep"></th></tr></thead><tbody>';
    data.forEach(function (entry, index) {
      var alerts = buildAlerts(entry);
      html += '<tr data-i="' + index + '" style="cursor:pointer">'
        + finCols.cells(entry)
        + '<td class="ct-keep">' + (alerts.length ? '<button class="badge warn fin-alert" data-i="' + index + '" style="border:0;cursor:pointer">● Ver alertas (' + alerts.length + ')</button>' : '<span style="color:var(--muted)">-</span>') + '</td>'
        + '<td class="fin-acts ct-keep"></td></tr>';
    });
    html += '</tbody></table></div>';
    selectElement('fin-body').innerHTML = html;
    finCols.wireResize(selectElement('fin-body').querySelector('table.ct-fixed'), 0);
    selectElement('fin-body').querySelectorAll('th[data-col]').forEach(function (item) {
      item.addEventListener('click', function (event) {
        if (event.target.classList.contains('ct-resizer')) return;
        finSort = window.TableSort.cycle(finSort, item.getAttribute('data-col'));
        window.TableSort.save('sort:financeiro', finSort);
        render();
      });
    });
    selectElement('fin-body').querySelectorAll('tr[data-i]').forEach(function (item) {
      var p = data[+item.getAttribute('data-i')], cell = item.lastElementChild;
      function iconBtn(svg, cssClass, title, fn) {
        var b = document.createElement('button'); b.className = 'btn btn-icon ' + cssClass;
        b.style.marginLeft = '6px'; b.title = title; b.setAttribute('aria-label', title);
        b.innerHTML = svg; b.addEventListener('click', function (event) { event.stopPropagation(); fn(); }); return b;
      }
      cell.appendChild(iconBtn(FIN_ICONS.approvers, 'btn-light', 'Aprovadores elegíveis', function () { window.openProcessApprovers(p); }));
      if (!isActionable(p)) { item.addEventListener('click', function () { window.openProcessDetail(p); }); return; }
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
        } catch (error) { toast('Erro: ' + error.message); reloadAll(); }
      }));
      cell.appendChild(iconBtn(FIN_ICONS.parcelas, 'btn-light', 'Parcelas', function () { window.openInstallments(p, reloadAll); }));
      var rowAlerts = buildAlerts(p);
      var uauBtn = iconBtn(FIN_ICONS.uau, 'btn-primary',
        rowAlerts.length ? 'Resolva os ' + rowAlerts.length + ' alerta(s) antes de integrar' : 'Enviar UAU',
        async function () {
          if (rowAlerts.length) { toast('Processo com ' + rowAlerts.length + ' alerta(s). Resolva antes de integrar.'); return; }
          if (!(await confirmDialog('Enviar este processo para integração com o UAU?'))) return;
          try {
            await window.API.post('/processes/' + p.uuid_prc + '/send-uau');
            window.invalidateFlowCaches();
            toast('Integração disparada. O status será atualizado pela integração externa.', true);
            reloadAll();
          } catch (error) { toast('Erro: ' + error.message); reloadAll(); }
        });
      if (rowAlerts.length) { uauBtn.disabled = true; uauBtn.style.opacity = '0.45'; uauBtn.style.cursor = 'not-allowed'; }
      cell.appendChild(uauBtn);
      item.addEventListener('click', function () { window.openProcessDetail(p); });
    });
    finCols.autofitTrail(selectElement('fin-body').querySelector('table.ct-fixed'), '.fin-acts');

    selectElement('fin-body').querySelectorAll('.fin-alert').forEach(function (alertElement) {
      alertElement.addEventListener('click', function (event) {
        event.stopPropagation();
        document.querySelectorAll('.fin-alert-pop').forEach(function (openPopup) { openPopup.remove(); });
        var p = data[+alertElement.getAttribute('data-i')], alerts = buildAlerts(p);
        var popupElement = document.createElement('div'); popupElement.className = 'fin-alert-pop';
        popupElement.innerHTML = '<b>Alertas do processo #' + escapeHtml(p.id_prc) + '</b><ul>' + alerts.map(function (alert) { return '<li>' + escapeHtml(alert) + '</li>'; }).join('') + '</ul>';
        document.body.appendChild(popupElement);
        var bounds = alertElement.getBoundingClientRect();
        popupElement.style.top = (bounds.bottom + 6) + 'px'; popupElement.style.left = Math.max(8, bounds.right - 380) + 'px';
        setTimeout(function () {
          document.addEventListener('click', function close() { popupElement.remove(); document.removeEventListener('click', close); });
        }, 0);
      });
    });
  }
  async function reloadAll() {
    selectElement('fin-body').innerHTML = '<div class="empty">Carregando…</div>';
    try { rows = await window.Store.get('financeiro'); render(); } catch (error) { window.viewError(selectElement('fin-body'), error); }
  }
  selectElement('fin-search').addEventListener('input', render);
  render();
}
