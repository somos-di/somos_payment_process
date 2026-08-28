(function () {
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(value) { return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDate(d) { return d ? String(d).split('T')[0].split('-').reverse().join('/') : '-'; }
  function clip(text, maxPx) {
    if (text == null || text === '') return '<span style="color:var(--muted)">-</span>';
    var safe = escapeHtml(text);
    return '<span class="clip" style="max-width:' + maxPx + 'px" title="' + safe + '">' + safe + '</span>';
  }
  function statusBadge(step, name) {
    var steps = (window.CONFIG && window.CONFIG.STEPS) || {};

    var label = (name && name !== String(step)) ? name : (steps[step] || name || ('Status ' + step));

    var cssClass = ((window.CONFIG && window.CONFIG.STATUS_COLORS) || {})[step] || '';
    return '<span class="badge ' + cssClass + '">' + escapeHtml(label) + '</span>';
  }
  function button(label, cssClass, fn) { var buttonElement = document.createElement('button'); buttonElement.className = 'btn ' + cssClass; buttonElement.style.marginLeft = '6px'; buttonElement.textContent = label; buttonElement.addEventListener('click', fn); return buttonElement; }

  var ICONS = {
    aprovadores: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    Aprovar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>',
    Corrigir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    Cancelar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/></svg>',
  };
  var SVG_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';

  function iconBtn(svg, cssClass, title, fn) {
    var b = document.createElement('button');
    b.className = 'btn btn-icon ' + cssClass; b.style.marginLeft = '6px';
    b.title = title; b.setAttribute('aria-label', title);
    b.innerHTML = svg; b.addEventListener('click', fn); return b;
  }

  function uiConfirm(message, danger) {
    return new Promise(function (resolve) {
      var o = document.createElement('div'); o.className = 'modal-overlay';
      o.innerHTML = '<div class="modal-box" style="width:440px"><div class="modal-title">Confirmação</div>'
        + '<div style="font-size:14px;color:var(--text-2);line-height:1.5">' + escapeHtml(message) + '</div>'
        + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button>'
        + '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok>Confirmar</button></div></div>';
      function close(value) { o.remove(); resolve(value); }
      o.addEventListener('click', function (event) { if (event.target === o) close(false); });
      o.querySelector('[data-x]').addEventListener('click', function () { close(false); });
      o.querySelector('[data-ok]').addEventListener('click', function () { close(true); });
      document.body.appendChild(o); o.querySelector('[data-ok]').focus();
    });
  }
  function toast(message, isSuccess) {
    var t = document.createElement('div'); t.textContent = message;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (isSuccess ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4000);
  }

  function uiAlert(message, title) {
    return new Promise(function (resolve) {
      var o = document.createElement('div'); o.className = 'modal-overlay';
      o.innerHTML = '<div class="modal-box" style="width:460px"><div class="modal-title">' + escapeHtml(title || 'Não foi possível concluir') + '</div>'
        + '<div style="font-size:14px;color:var(--text-2);line-height:1.5">' + escapeHtml(message) + '</div>'
        + '<div class="modal-actions"><button class="btn btn-primary" data-ok>OK</button></div></div>';
      function close() { o.remove(); resolve(); }
      o.addEventListener('click', function (event) { if (event.target === o) close(); });
      o.querySelector('[data-ok]').addEventListener('click', close);
      document.body.appendChild(o); o.querySelector('[data-ok]').focus();
    });
  }
  window.uiAlert = uiAlert;

  function uiPrompt(message, danger) {
    return new Promise(function (resolve) {
      var o = document.createElement('div'); o.className = 'modal-overlay';
      o.innerHTML = '<div class="modal-box" style="width:480px"><div class="modal-title">Confirmação</div>'
        + '<div style="font-size:14px;color:var(--text-2);line-height:1.5">' + escapeHtml(message) + '</div>'
        + '<textarea data-reason rows="3" maxlength="500" style="margin-top:12px" '
        + 'placeholder="Explique o motivo (obrigatório - ficará registrado no histórico do processo)…"></textarea>'
        + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button>'
        + '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok disabled>Confirmar</button></div></div>';
      var reasonTextarea = o.querySelector('[data-reason]'), isSuccess = o.querySelector('[data-ok]');
      reasonTextarea.addEventListener('input', function () { isSuccess.disabled = !reasonTextarea.value.trim(); });
      function close(value) { o.remove(); resolve(value); }
      o.addEventListener('click', function (event) { if (event.target === o) close(null); });
      o.querySelector('[data-x]').addEventListener('click', function () { close(null); });
      isSuccess.addEventListener('click', function () { close(reasonTextarea.value.trim()); });
      document.body.appendChild(o); reasonTextarea.focus();
    });
  }
  window.uiPrompt = uiPrompt;

  window.TableSort = {
    cycle: function (sort, column) {
      if (sort.col !== column) return { col: column, asc: true };
      if (sort.asc) return { col: column, asc: false };
      return { col: '', asc: true };
    },
    indicator: function (sort, column) {
      var active = sort.col === column;
      return '<span class="sort-ind' + (active ? ' on' : '') + '">' + (active ? (sort.asc ? '▲' : '▼') : '↕') + '</span>';
    },
    sortRows: function (rows, sort, types) {
      if (!sort.col) return rows;
      var type = types[sort.col] || 'text', direction = sort.asc ? 1 : -1;
      return rows.slice().sort(function (item, index) {
        var leftValue = item[sort.col], rightValue = index[sort.col];
        var leftIsEmpty = leftValue == null || leftValue === '', rightIsEmpty = rightValue == null || rightValue === '';
        if (leftIsEmpty && rightIsEmpty) return 0; if (leftIsEmpty) return 1; if (rightIsEmpty) return -1;
        if (type === 'num') return (Number(leftValue) - Number(rightValue)) * direction;
        if (type === 'date') return String(leftValue).localeCompare(String(rightValue)) * direction;
        return String(leftValue).localeCompare(String(rightValue), 'pt-BR', { sensitivity: 'base' }) * direction;
      });
    },
    load: function (key) {
      try { var s = JSON.parse(localStorage.getItem(key) || 'null'); if (s && typeof s.col === 'string') return s; } catch (error) { }
      return { col: '', asc: true };
    },
    save: function (key, sort) {
      try { if (sort.col) localStorage.setItem(key, JSON.stringify(sort)); else localStorage.removeItem(key); } catch (error) { }
    },
  };

  window.ProcessList = {
    mount: async function (host, options) {
      var paged = typeof options.fetchPage === 'function';
      var pageSize = options.pageSize || 50;
      var dateField = options.dateField || 'due_date_prc';
      var showApprovers = !!options.showApprovers;

      host.innerHTML = '<div class="card" style="padding:0">'
        + '<div class="pl-toolbar">'
        + '<div class="pl-search">' + SVG_SEARCH + '<input id="pl-search" placeholder="Buscar…"></div>'
        + '<div class="pl-filters" id="pl-filters"></div>'
        + '<div class="pl-filters" id="pl-extra"></div>'
        + '<div class="pl-toolbar-actions">'
        + (options.batchAction ? '<button class="btn btn-primary" id="pl-batch" disabled>' + escapeHtml(options.batchAction.label || 'Aprovar selecionados') + '</button>' : '')
        + '<button class="btn btn-light" id="pl-refresh" title="Recarregar os dados desta tela">'
        + '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Atualizar</button>'
        + '<button class="btn btn-ghost" id="pl-clear">Limpar filtros</button></div>'
        + '</div>'
        + '<div id="pl-body" style="padding:6px 0"><div class="empty">Carregando…</div></div>'
        + (paged ? '<div class="pl-pager" id="pl-pager"></div>' : '')
        + '</div>';

      var bodyEl = host.querySelector('#pl-body');
      var search = host.querySelector('#pl-search');
      var pagerEl = host.querySelector('#pl-pager');

      var rows = [];
      var page = 0;
      var total = null;
      var hasMore = false;
      var term = '';
      var filters = { company: '', building: '', from: '', to: '', status: '', urgent: '' };
      var extraFilters = options.extraFilters || (options.extraFilter ? [options.extraFilter] : []);
      var extraValues = extraFilters.map(function () { return ''; });
      var batch = options.batchAction || null;
      var selected = {};
      var approversByUuid = {};

      var SORT_COLS = [
        { label: '#', col: 'id_prc', type: 'num' },
        { label: 'Empresa', col: 'empresa_nome', type: 'text' },
        { label: 'Obra', col: 'obra_nome', type: 'text' },
        { label: 'Fornecedor', col: 'fornecedor_nome', type: 'text' },
        { label: 'Descrição', col: 'description_prc', type: 'text' },
        { label: 'Tipo', col: 'tipo_nome', type: 'text' },
        { label: 'Valor', col: 'value_prc', type: 'num' },
        { label: 'Vencimento', col: 'due_date_prc', type: 'date' },
        { label: 'Status', col: 'status_nome', type: 'text' },
      ].concat(options.extraColumns || []);
      var SORT_TYPES = {}; SORT_COLS.forEach(function (SORT_COLSItem) { SORT_TYPES[SORT_COLSItem.col] = SORT_COLSItem.type || 'text'; });
      var sortKey = 'sort:' + (options.storageKey || (window.location.hash || 'view'));
      var sort = window.TableSort.load(sortKey);

      async function loadApprovers() {
        approversByUuid = {};
        var uuids = rows.map(function (row) { return row.uuid_prc; }).filter(Boolean);
        if (!uuids.length) return;
        try {
          var list = await window.SB.select('v_process_approvers', function (query) {
            return query.in('process_app', uuids).order('approved_at_app');
          });
          (list || []).forEach(function (item) {
            (approversByUuid[item.process_app] = approversByUuid[item.process_app] || []).push(item.approver_name || '-');
          });
        } catch (error) { }
      }

      function approversCell(process) {
        var names = approversByUuid[process.uuid_prc] || [];
        if (!names.length) return '<span style="color:var(--muted)">-</span>';
        var joined = names.join(', ');
        return '<span class="badge ok" title="' + escapeHtml(joined) + '">' + names.length + '</span> '
          + '<span class="pl-approvers" title="' + escapeHtml(joined) + '">' + escapeHtml(joined) + '</span>';
      }

      function isoDay(value) { return value ? String(value).split('T')[0] : ''; }

      function filtered() {
        if (paged) return rows;
        var output = rows;
        var t = (search.value || '').toLowerCase().trim();
        if (t) {
          output = output.filter(function (outItem) {
            return [outItem.empresa_nome, outItem.obra_nome, outItem.description_prc, outItem.fornecedor_nome, outItem.tipo_nome, outItem.id_prc].join(' ').toLowerCase().indexOf(t) >= 0;
          });
        }
        output = output.filter(function (outItem) {
          if (filters.company && filters.company.length && filters.company.map(String).indexOf(String(outItem.company_prc)) < 0) return false;
          if (filters.building && filters.building.length
            && filters.building.map(function (buildingItem) { return String(buildingItem).toUpperCase(); }).indexOf(String(outItem.building_prc || '').toUpperCase()) < 0) return false;
          if (filters.status && filters.status.length && filters.status.map(Number).indexOf(Number(outItem.status_step_prc)) < 0) return false;
          if (filters.kind && filters.kind.length && filters.kind.map(Number).indexOf(Number(outItem.kind_prc)) < 0) return false;
          if (filters.urgent !== '' && !!outItem.is_urgent_prc !== (filters.urgent === '1')) return false;
          if (filters.fornecedor && String(outItem.fornecedor_nome || '').toLowerCase().indexOf(String(filters.fornecedor).toLowerCase()) < 0) return false;
          if (filters.descricao && String(outItem.description_prc || '').toLowerCase().indexOf(String(filters.descricao).toLowerCase()) < 0) return false;
          if (filters.from || filters.to) {
            var d = isoDay(outItem[dateField]);
            if (!d) return false;
            if (filters.from && d < filters.from) return false;
            if (filters.to && d > filters.to) return false;
          }
          return true;
        });
        extraFilters.forEach(function (extraFilter, index) { if (extraValues[index]) output = extraFilter.apply(output, extraValues[index]); });
        return output;
      }

      function updateBatchBtn() {
        if (!batch) return;
        var b = host.querySelector('#pl-batch'); if (!b) return;
        var n = Object.keys(selected).length;
        b.disabled = n === 0;
        b.textContent = (batch.label || 'Aprovar selecionados') + (n ? ' (' + n + ')' : '');
      }

      function render() {

        var data = window.TableSort.sortRows(filtered(), sort, SORT_TYPES);
        if (!data.length) {
          bodyEl.innerHTML = '<div class="empty">' + escapeHtml(page > 0 ? 'Nada nesta página.' : (options.emptyText || 'Nenhum processo.')) + '</div>';
        } else {
          var head = SORT_COLS.map(function (SORT_COLSItem) {
            return '<th data-col="' + SORT_COLSItem.col + '">' + escapeHtml(SORT_COLSItem.label) + ' ' + window.TableSort.indicator(sort, SORT_COLSItem.col) + '</th>';
          }).join('');
          var checkTh = batch ? '<th style="width:34px;text-align:center"><input type="checkbox" data-check-all title="Selecionar todos"></th>' : '';
          var html = '<div class="table-scroll"><table><thead><tr>' + checkTh + head
            + (showApprovers ? '<th>Aprovações</th>' : '') + '<th></th></tr></thead><tbody>';
          data.forEach(function (entry, index) {
            html += '<tr data-i="' + index + '" style="cursor:pointer">'
              + (batch ? '<td class="pl-check" data-label="Selecionar" style="text-align:center"><input type="checkbox" data-check="' + escapeHtml(entry.uuid_prc) + '"' + (selected[entry.uuid_prc] ? ' checked' : '') + '></td>' : '')
              + '<td data-label="#"><span class="id-cell">' + escapeHtml(entry.id_prc)
              + (entry.is_urgent_prc ? '<span class="urgent-dot" title="Urgente" aria-label="Urgente"></span>' : '')
              + '</span></td><td data-label="Empresa">' + clip(entry.empresa_nome, 160) + '</td><td data-label="Obra">' + clip(entry.obra_nome, 110) + '</td>'
              + '<td data-label="Fornecedor">' + clip(entry.fornecedor_nome, 130) + '</td>'
              + '<td data-label="Descrição">' + clip(entry.description_prc, 220) + '</td>'
              + '<td data-label="Tipo">' + escapeHtml(entry.tipo_nome) + '</td>'
              + '<td data-label="Valor">' + money(entry.value_prc) + '</td><td data-label="Vencimento">' + fmtDate(entry.due_date_prc) + '</td>'
              + '<td data-label="Status">' + statusBadge(entry.status_step_prc, entry.status_nome) + '</td>'
              + (options.extraColumns || []).map(function (item) {
                var value = item.render ? item.render(entry) : (entry[item.col] == null || entry[item.col] === '' ? '<span style="color:var(--muted)">-</span>' : escapeHtml(entry[item.col]));
                return '<td data-label="' + escapeHtml(item.label || '') + '">' + value + '</td>';
              }).join('')
              + (showApprovers ? '<td data-label="Aprovações" style="white-space:nowrap">' + approversCell(entry) + '</td>' : '')
              + '<td class="pl-actions-cell" style="white-space:nowrap;text-align:right"></td></tr>';
          });
          html += '</tbody></table></div>';
          bodyEl.innerHTML = html;

          bodyEl.querySelectorAll('th[data-col]').forEach(function (item) {
            item.addEventListener('click', function () {
              sort = window.TableSort.cycle(sort, item.getAttribute('data-col'));
              window.TableSort.save(sortKey, sort);
              render();
            });
          });

          if (batch) {
            bodyEl.querySelectorAll('[data-check]').forEach(function (item) {
              item.addEventListener('click', function (event) { event.stopPropagation(); });
              item.addEventListener('change', function () {
                var id = item.getAttribute('data-check');
                if (item.checked) selected[id] = true; else delete selected[id];
                updateBatchBtn();
              });
            });
            var allBox = bodyEl.querySelector('[data-check-all]');
            if (allBox) allBox.addEventListener('change', function () {
              data.forEach(function (entry) { if (allBox.checked) selected[entry.uuid_prc] = true; else delete selected[entry.uuid_prc]; });
              bodyEl.querySelectorAll('[data-check]').forEach(function (item) { item.checked = allBox.checked; });
              updateBatchBtn();
            });
          }
          bodyEl.querySelectorAll('tr[data-i]').forEach(function (row) {
            var process = data[+row.getAttribute('data-i')], cell = row.lastElementChild;
            var approversBtn = iconBtn(ICONS.aprovadores, 'btn-light', 'Aprovadores', function (event) { event.stopPropagation(); window.openProcessApprovers(process); });

            var visibleActions = (options.actions || []).filter(function (action) { return typeof action.show !== 'function' || action.show(process); });
            var approversAt = Math.min(options.approversPosition != null ? options.approversPosition : 0, visibleActions.length);
            visibleActions.forEach(function (visibleAction, index) {
              if (index === approversAt) cell.appendChild(approversBtn);
              var handler = async function (event) {
                event.stopPropagation();
                var danger = (visibleAction.cls || '').indexOf('danger') >= 0;
                var reason;
                if (visibleAction.prompt) {
                  reason = await uiPrompt(visibleAction.prompt, danger);
                  if (reason == null) return;
                } else if (visibleAction.confirm && !(await uiConfirm(visibleAction.confirm, danger))) return;
                try {
                  await visibleAction.run(process, reason);
                  if (visibleAction.effect === 'none') return;
                  toast('Feito.', true);
                  await applyRowEffect(visibleAction, process.uuid_prc);
                }
                catch (error) {

                  await uiAlert(error.message);
                  await reload();
                }
              };
              var svg = visibleAction.icon || ICONS[visibleAction.label];
              cell.appendChild(svg
                ? iconBtn(svg, visibleAction.cls || 'btn-primary', visibleAction.label, handler)
                : button(visibleAction.label, visibleAction.cls || 'btn-primary', handler));
            });
            if (approversAt >= visibleActions.length) cell.appendChild(approversBtn);
            row.addEventListener('click', function () { window.openProcessDetail(process); });
          });
        }
        updatePager();
      }

      function pageSequence(current, totalPages) {
        var delta = 2, range = [], output = [], last;
        for (var index = 1; index <= totalPages; index++) {
          if (index === 1 || index === totalPages || (index >= current - delta && index <= current + delta)) range.push(index);
        }
        range.forEach(function (rangeItem) {
          if (last) {
            if (rangeItem - last === 2) output.push(last + 1);
            else if (rangeItem - last !== 1) output.push('…');
          }
          output.push(rangeItem); last = rangeItem;
        });
        return output;
      }

      function goto(p) { if (p !== page && p >= 0) { page = p; reload(); } }

      function updatePager() {
        if (!paged) return;
        var from = rows.length ? page * pageSize + 1 : 0;
        var lastRowNumber = page * pageSize + rows.length;
        var totalPages = total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;

        var info = total != null
          ? 'Mostrando ' + from + '–' + lastRowNumber + ' de ' + total
          : 'Página ' + (page + 1);

        var paginationHtml = '<span style="font-size:13px;color:var(--muted)">' + info + '</span>'
          + '<span style="flex:1"></span>';

        paginationHtml += '<button class="btn btn-light" data-pg="' + (page - 1) + '"' + (page === 0 ? ' disabled' : '') + '>‹</button>';

        if (totalPages != null) {
          pageSequence(page + 1, totalPages).forEach(function (item) {
            if (item === '…') { paginationHtml += '<span style="padding:0 4px;color:var(--muted-2)">…</span>'; return; }
            var active = (item === page + 1);
            paginationHtml += '<button class="btn ' + (active ? 'btn-primary' : 'btn-light') + '" data-pg="' + (item - 1) + '"'
              + (active ? ' disabled' : '') + ' style="min-width:38px">' + item + '</button>';
          });
        }

        var noNext = totalPages != null ? (page + 1 >= totalPages) : !hasMore;
        paginationHtml += '<button class="btn btn-light" data-pg="' + (page + 1) + '"' + (noNext ? ' disabled' : '') + '>›</button>';

        pagerEl.innerHTML = paginationHtml;
        pagerEl.querySelectorAll('button[data-pg]').forEach(function (item) {
          item.addEventListener('click', function () { goto(+item.getAttribute('data-pg')); });
        });
      }

      async function reload() {
        bodyEl.innerHTML = '<div class="empty">Carregando…</div>';
        if (paged) pagerEl.querySelectorAll('button').forEach(function (item) { item.disabled = true; });
        try {
          if (paged) {

            if (options.fetchCount && total === null) {
              total = await options.fetchCount({ term: term, filters: filters });
            }

            rows = (await options.fetchPage({ page: page, pageSize: pageSize, term: term, filters: filters })) || [];
            hasMore = total != null ? (page + 1) * pageSize < total : rows.length === pageSize;
          } else {
            rows = await options.load();
          }
          if (showApprovers) await loadApprovers();
          render();
        } catch (error) {
          window.viewError(bodyEl, error);
          updatePager();
        }
      }

      function indexOfUuid(uuid) {
        for (var index = 0; index < rows.length; index++) if (rows[index].uuid_prc === uuid) return index;
        return -1;
      }
      function removeRow(uuid) {
        var index = indexOfUuid(uuid);
        if (index < 0) return;
        rows.splice(index, 1);
        if (paged && total != null) total = Math.max(0, total - 1);
        render();
      }
      async function refreshRow(uuid) {
        var fetchRow = options.reloadRow || function (id) {
          return window.SB.select('v_processes', function (query) { return query.eq('uuid_prc', id).limit(1); })
            .then(function (rowsFound) { return (rowsFound && rowsFound[0]) || null; });
        };
        var fresh = await fetchRow(uuid);
        var index = indexOfUuid(uuid);
        if (index < 0) return;
        if (fresh) rows[index] = fresh; else rows.splice(index, 1);
        if (showApprovers) await loadApprovers();
        render();
      }
      async function applyRowEffect(a, uuid) {
        if (a.effect === 'remove') removeRow(uuid);
        else if (a.effect === 'update') await refreshRow(uuid);
        else await reload();
      }

      var debTimer = null;
      search.addEventListener('input', function () {
        if (!paged) { render(); return; }
        clearTimeout(debTimer);
        debTimer = setTimeout(function () { term = (search.value || '').trim(); page = 0; total = null; reload(); }, 350);
      });

      var processFilters = await window.ProcessFilters.mount(host.querySelector('#pl-filters'), {
        storageKey: options.storageKey || (window.location.hash || 'view'),
        multiStatus: true,
        onChange: function (values) {
          filters = values;
          if (paged) { page = 0; total = null; reload(); } else render();
        },
      });
      filters = processFilters.getValues();

      var extraEls = [], extraStorageKeys = [];
      async function populateExtraFilter(index) {
        var element = extraEls[index]; if (!element) return;
        var previous = extraValues[index] || '';
        var options = [];
        try { options = await extraFilters[index].load(); } catch (error) { options = []; }
        element.innerHTML = '<option value="">Todos</option>' + (options || []).map(function (item) {
          return '<option value="' + escapeHtml(item.value) + '">' + escapeHtml(item.label) + '</option>';
        }).join('');
        element.value = previous;
        if (element.value !== previous) extraValues[index] = '';
      }
      async function reloadExtraFilters() {
        for (var index = 0; index < extraFilters.length; index++) await populateExtraFilter(index);
      }
      if (extraFilters.length) {
        var extraHost = host.querySelector('#pl-extra');
        extraHost.innerHTML = extraFilters.map(function (extraFilter, index) {
          return '<label class="pf-field">' + escapeHtml(extraFilter.label || 'Filtro')
            + '<select data-extra="' + index + '"><option value="">Todos</option></select></label>';
        }).join('');
        for (var extraFilterIndex = 0; extraFilterIndex < extraFilters.length; extraFilterIndex++) {
          var key = 'filters-extra:' + extraFilterIndex + ':' + (options.storageKey || (window.location.hash || 'view'));
          extraStorageKeys[extraFilterIndex] = key;
          extraEls[extraFilterIndex] = extraHost.querySelector('[data-extra="' + extraFilterIndex + '"]');
          try { extraValues[extraFilterIndex] = localStorage.getItem(key) || ''; } catch (error) { extraValues[extraFilterIndex] = ''; }
          await populateExtraFilter(extraFilterIndex);
          (function (index, filterElement, key) {
            filterElement.addEventListener('change', function () {
              extraValues[index] = filterElement.value;
              try { localStorage.setItem(key, extraValues[index]); } catch (error) { }
              render();
            });
          })(extraFilterIndex, extraEls[extraFilterIndex], key);
        }
      }

      function removeRowLocal(uuid) {
        var index = indexOfUuid(uuid);
        if (index >= 0) { rows.splice(index, 1); if (paged && total != null) total = Math.max(0, total - 1); }
        delete selected[uuid];
      }

      function openProgress(title, count) {
        var o = document.createElement('div'); o.className = 'modal-overlay';
        o.innerHTML = '<div class="modal-box" style="width:420px"><div class="modal-title">' + escapeHtml(title) + '</div>'
          + '<div style="margin-top:10px;font-size:13px;color:var(--muted)" data-lbl>0 de ' + count + '</div>'
          + '<div style="height:10px;border-radius:6px;background:var(--surface-2);overflow:hidden;margin-top:8px">'
          + '<div data-bar style="height:100%;width:0;background:var(--accent);transition:width .2s"></div></div></div>';
        document.body.appendChild(o);
        return {
          update: function (done) {
            o.querySelector('[data-lbl]').textContent = done + ' de ' + count;
            o.querySelector('[data-bar]').style.width = Math.round((done / count) * 100) + '%';
          },
          close: function () { o.remove(); },
        };
      }

      if (batch) {
        var batchBtn = host.querySelector('#pl-batch');
        batchBtn.addEventListener('click', async function () {
          var picked = rows.filter(function (row) { return selected[row.uuid_prc]; });
          if (!picked.length) return;
          var message = (batch.confirm || 'Aprovar os {n} processos selecionados?').replace('{n}', picked.length);
          if (!(await uiConfirm(message, false))) return;
          batchBtn.disabled = true;
          var successCount = 0, failureCount = 0, firstError = '';

          if (typeof batch.runBatch === 'function') {
            var chunkSize = batch.chunkSize || 20;
            var prog = openProgress(batch.progressTitle || 'Aprovando processos…', picked.length);
            try {
              for (var innerIndex = 0; innerIndex < picked.length; innerIndex += chunkSize) {
                var chunk = picked.slice(innerIndex, innerIndex + chunkSize);
                var response = await batch.runBatch(chunk);
                (response || []).forEach(function (item) {
                  if (item.ok) { successCount++; removeRowLocal(item.uuid); }
                  else { failureCount++; if (!firstError) firstError = item.error || 'erro'; delete selected[item.uuid]; }
                });
                prog.update(Math.min(picked.length, innerIndex + chunkSize));
              }
            } catch (error) { failureCount += 1; if (!firstError) firstError = error.message; }
            finally {
              prog.close();
              if (typeof batch.afterAll === 'function') batch.afterAll();
              updateBatchBtn(); render();
            }
          } else {
            for (var index = 0; index < picked.length; index++) {
              try { await batch.run(picked[index]); successCount++; removeRowLocal(picked[index].uuid_prc); }
              catch (error) { failureCount++; if (!firstError) firstError = error.message; }
            }
            updateBatchBtn(); render();
          }

          toast(successCount + ' aprovado(s)' + (failureCount ? ' · ' + failureCount + ' com erro' : ''), failureCount === 0);
          if (failureCount) await uiAlert('Alguns processos não foram aprovados. Primeiro erro: ' + firstError);
        });
      }

      var refreshBtn = host.querySelector('#pl-refresh');
      if (refreshBtn) refreshBtn.addEventListener('click', async function () {
        refreshBtn.disabled = true;
        try {
          (options.refreshKeys || []).forEach(function (item) { window.Store.invalidate(item); });
          if (paged) { total = null; }
          await reloadExtraFilters();
          await reload();
        } finally { refreshBtn.disabled = false; }
      });

      host.querySelector('#pl-clear').addEventListener('click', function () {
        search.value = ''; term = '';
        if (paged) { page = 0; total = null; }
        extraEls.forEach(function (extraEl, index) {
          extraValues[index] = ''; if (extraEl) extraEl.value = '';
          try { localStorage.removeItem(extraStorageKeys[index]); } catch (error) { }
        });
        selected = {}; updateBatchBtn();
        processFilters.clear();
      });

      await reload();
      return { reload: reload };
    }
  };

  function applyProcessFilters(s, kind, term, filters, reembolso) {
    if (reembolso) {
      var pkinds = (window.CONFIG && window.CONFIG.PROCESS_KINDS) || {};
      var reembolsoIds = Object.keys(pkinds).filter(function (id) { return /reembolso/i.test(pkinds[id] || ''); }).map(Number);
      s = reembolsoIds.length ? s.in('kind_prc', reembolsoIds) : s.ilike('tipo_nome', '%reembolso%');
    } else if (kind) s = s.eq('kind_prc', Number(kind));
    var activeFilters = filters || {};
    var comps = Array.isArray(activeFilters.company) ? activeFilters.company : (activeFilters.company ? [activeFilters.company] : []);
    var builds = Array.isArray(activeFilters.building) ? activeFilters.building : (activeFilters.building ? [activeFilters.building] : []);
    if (comps.length) s = s.in('company_prc', comps);
    if (builds.length) s = s.in('building_prc', builds);
    var statuses = Array.isArray(activeFilters.status) ? activeFilters.status : (activeFilters.status !== '' && activeFilters.status != null ? [activeFilters.status] : []);
    if (statuses.length) s = s.in('status_step_prc', statuses.map(Number));
    var kindSel = Array.isArray(activeFilters.kind) ? activeFilters.kind : (activeFilters.kind ? [activeFilters.kind] : []);
    if (kindSel.length) s = s.in('kind_prc', kindSel.map(Number));
    if (activeFilters.urgent === '1' || activeFilters.urgent === '0') s = s.eq('is_urgent_prc', activeFilters.urgent === '1');
    if (activeFilters.from) s = s.gte('due_date_prc', activeFilters.from);
    if (activeFilters.to) s = s.lte('due_date_prc', activeFilters.to);
    var fornecedor = (activeFilters.fornecedor || '').replace(/[,()*%]/g, ' ').trim();
    if (fornecedor) s = s.ilike('fornecedor_nome', '%' + fornecedor + '%');
    var descricao = (activeFilters.descricao || '').replace(/[,()*%]/g, ' ').trim();
    if (descricao) s = s.ilike('description_prc', '%' + descricao + '%');
    term = (term || '').trim();
    if (term) {
      var safe = term.replace(/[,()*%]/g, ' ').trim();
      if (safe) {
        var orConditions = ['empresa_nome.ilike.%' + safe + '%', 'obra_nome.ilike.%' + safe + '%',
        'description_prc.ilike.%' + safe + '%', 'fornecedor_nome.ilike.%' + safe + '%', 'tipo_nome.ilike.%' + safe + '%'];
        if (/^\d+$/.test(safe)) orConditions.push('id_prc.eq.' + safe);
        s = s.or(orConditions.join(','));
      }
    }
    return s;
  }

  window.fetchProcessesPage = function (kind, reembolso) {
    return function (args) {
      var page = args.page, pageSize = args.pageSize;
      return window.SB.select('v_processes', function (s) {
        s = applyProcessFilters(s, kind, args.term, args.filters, reembolso);
        return s.order('id_prc', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1);
      });
    };
  };

  window.fetchProcessesCount = function (kind, reembolso) {
    return function (args) {
      return window.SB.count('v_processes', function (s) {
        return applyProcessFilters(s, kind, args.term, args.filters, reembolso);
      });
    };
  };

  function invalidateFlowCaches() {
    ['my_approvals', 'financeiro', 'financeiro_integrados', 'history', 'no_approver'].forEach(function (item) { window.Store.invalidate(item); });
  }
  window.invalidateFlowCaches = invalidateFlowCaches;

  window.mountPendingApprovals = async function (host) {

    var groupsByUuid = {};
    var approvedByUuid = {};
    function approveOne(p) {
      return window.Store.commit(
        function () {
          return window.API.post('/processes/' + p.uuid_prc + '/approve')
            .then(function (actionResult) { invalidateFlowCaches(); return actionResult; });
        },
        function () { window.Store.remove('pending_approvals', 'uuid_prc', p.uuid_prc); return ['pending_approvals']; });
    }
    return window.ProcessList.mount(host, {
      emptyText: 'Você não tem aprovações pendentes.',
      showApprovers: true,
      approversPosition: 1,
      refreshKeys: ['pending_approvals'],
      batchAction: {
        label: 'Aprovar selecionados',
        confirm: 'Aprovar os {n} processos selecionados? A aprovação segue as mesmas regras (nível/elegibilidade) de cada processo.',
        progressTitle: 'Aprovando processos…',
        chunkSize: 20,
        runBatch: function (chunk) {
          return window.API.post('/processes/approve-batch', { uuids: chunk.map(function (chunkItem) { return chunkItem.uuid_prc; }) });
        },
        afterAll: function () { invalidateFlowCaches(); window.Store.invalidate('pending_approvals'); },
        run: approveOne,
      },
      extraFilters: [
        {
          label: 'Aprovar como',
          load: async function () {
            var rows = await window.SB.rpc('my_pending_approval_groups', {});
            groupsByUuid = {};
            var names = {}, levels = {};
            (rows || []).forEach(function (item) {
              (groupsByUuid[item.uuid_prc] = groupsByUuid[item.uuid_prc] || []).push(item.group_id);
              names[item.group_id] = item.group_name; levels[item.group_id] = item.level;
            });

            var levelOf = function (id) { return levels[id] == null ? Infinity : levels[id]; };
            return Object.keys(names)
              .sort(function (item, index) { return (levelOf(index) - levelOf(item)) || String(names[item]).localeCompare(names[index]); })
              .map(function (item) {
                return { value: item, label: names[item] + (levels[item] != null ? ' (nível ' + levels[item] + ')' : ' (urgência)') };
              });
          },
          apply: function (rows, groupId) {
            return rows.filter(function (row) {
              return (groupsByUuid[row.uuid_prc] || []).indexOf(Number(groupId)) >= 0;
            });
          },
        },
        {
          label: 'Já aprovado por',
          load: async function () {
            var pend = await window.Store.get('pending_approvals');
            var uuids = (pend || []).map(function (item) { return item.uuid_prc; });
            approvedByUuid = {};
            var names = {};
            if (uuids.length) {
              var appr = await window.SB.select('v_process_approvers', function (query) { return query.in('process_app', uuids); });
              (appr || []).forEach(function (item) {
                (approvedByUuid[item.process_app] = approvedByUuid[item.process_app] || {})[item.approver_app] = true;
                names[item.approver_app] = item.approver_name || String(item.approver_app);
              });
            }
            return Object.keys(names)
              .sort(function (item, index) { return String(names[item]).localeCompare(names[index], 'pt-BR'); })
              .map(function (item) { return { value: item, label: names[item] }; });
          },
          apply: function (rows, approverId) {
            return rows.filter(function (row) {
              return approvedByUuid[row.uuid_prc] && approvedByUuid[row.uuid_prc][approverId];
            });
          },
        },
      ],
      load: async function () {
        var pend = await window.Store.get('pending_approvals');
        if (!pend.length) return [];
        var uuids = pend.map(function (pendItem) { return pendItem.uuid_prc; });
        var named = await window.SB.select('v_processes', function (query) { return query.in('uuid_prc', uuids); });
        var byUuid = {}; named.forEach(function (namedItem) { byUuid[namedItem.uuid_prc] = namedItem; });
        return pend.map(function (pendItem) { return byUuid[pendItem.uuid_prc] || pendItem; });
      },
      actions: [
        {
          label: 'Aprovar', cls: 'btn-primary', confirm: 'Confirmar aprovação deste processo?',
          effect: 'remove',
          run: approveOne,
        },
        {
          label: 'Corrigir', cls: 'btn-danger',
          prompt: 'Devolver o processo para correção?',
          effect: 'remove',
          run: function (p, reason) {
            return window.Store.commit(
              function () {
                return window.API.post('/processes/' + p.uuid_prc + '/reject', { reason: reason })
                  .then(function (actionResult) { invalidateFlowCaches(); return actionResult; });
              },
              function () { window.Store.remove('pending_approvals', 'uuid_prc', p.uuid_prc); return ['pending_approvals']; });
          }
        },
      ],
    });
  };
})();
