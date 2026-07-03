(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDate(d) { return d ? String(d).split('T')[0].split('-').reverse().join('/') : '—'; }
  function statusBadge(step, name) {
    var steps = (window.CONFIG && window.CONFIG.STEPS) || {};

    var label = (name && name !== String(step)) ? name : (steps[step] || name || ('Status ' + step));

    var cls = ({ 0: 'red', 1: 'blue', 2: 'violet', 3: 'red', 4: 'blue', 6: 'warn', 7: 'ok', 8: 'red', 9: 'ok' })[step] || '';
    return '<span class="badge ' + cls + '">' + esc(label) + '</span>';
  }
  function btn(label, cls, fn) { var b = document.createElement('button'); b.className = 'btn ' + cls; b.style.marginLeft = '6px'; b.textContent = label; b.addEventListener('click', fn); return b; }

  var ICONS = {
    aprovadores: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    Aprovar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>',
    Corrigir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    Cancelar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/></svg>',
  };
  var SVG_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';

  function iconBtn(svg, cls, title, fn) {
    var b = document.createElement('button');
    b.className = 'btn btn-icon ' + cls; b.style.marginLeft = '6px';
    b.title = title; b.setAttribute('aria-label', title);
    b.innerHTML = svg; b.addEventListener('click', fn); return b;
  }

  function uiConfirm(message, danger) {
    return new Promise(function (resolve) {
      var o = document.createElement('div'); o.className = 'modal-overlay';
      o.innerHTML = '<div class="modal-box" style="width:440px"><div class="modal-title">Confirmação</div>'
        + '<div style="font-size:14px;color:var(--text-2);line-height:1.5">' + esc(message) + '</div>'
        + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button>'
        + '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok>Confirmar</button></div></div>';
      function close(v) { o.remove(); resolve(v); }
      o.addEventListener('click', function (e) { if (e.target === o) close(false); });
      o.querySelector('[data-x]').addEventListener('click', function () { close(false); });
      o.querySelector('[data-ok]').addEventListener('click', function () { close(true); });
      document.body.appendChild(o); o.querySelector('[data-ok]').focus();
    });
  }
  function toast(msg, ok) {
    var t = document.createElement('div'); t.textContent = msg;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (ok ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4000);
  }

  function uiAlert(message, title) {
    return new Promise(function (resolve) {
      var o = document.createElement('div'); o.className = 'modal-overlay';
      o.innerHTML = '<div class="modal-box" style="width:460px"><div class="modal-title">' + esc(title || 'Não foi possível concluir') + '</div>'
        + '<div style="font-size:14px;color:var(--text-2);line-height:1.5">' + esc(message) + '</div>'
        + '<div class="modal-actions"><button class="btn btn-primary" data-ok>OK</button></div></div>';
      function close() { o.remove(); resolve(); }
      o.addEventListener('click', function (e) { if (e.target === o) close(); });
      o.querySelector('[data-ok]').addEventListener('click', close);
      document.body.appendChild(o); o.querySelector('[data-ok]').focus();
    });
  }
  window.uiAlert = uiAlert;

  function uiPrompt(message, danger) {
    return new Promise(function (resolve) {
      var o = document.createElement('div'); o.className = 'modal-overlay';
      o.innerHTML = '<div class="modal-box" style="width:480px"><div class="modal-title">Confirmação</div>'
        + '<div style="font-size:14px;color:var(--text-2);line-height:1.5">' + esc(message) + '</div>'
        + '<textarea data-reason rows="3" maxlength="500" style="margin-top:12px" '
        + 'placeholder="Explique o motivo (obrigatório — ficará registrado no histórico do processo)…"></textarea>'
        + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button>'
        + '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok disabled>Confirmar</button></div></div>';
      var ta = o.querySelector('[data-reason]'), ok = o.querySelector('[data-ok]');
      ta.addEventListener('input', function () { ok.disabled = !ta.value.trim(); });
      function close(v) { o.remove(); resolve(v); }
      o.addEventListener('click', function (e) { if (e.target === o) close(null); });
      o.querySelector('[data-x]').addEventListener('click', function () { close(null); });
      ok.addEventListener('click', function () { close(ta.value.trim()); });
      document.body.appendChild(o); ta.focus();
    });
  }
  window.uiPrompt = uiPrompt;

  window.TableSort = {
    cycle: function (sort, col) {
      if (sort.col !== col) return { col: col, asc: true };
      if (sort.asc) return { col: col, asc: false };
      return { col: '', asc: true };
    },
    indicator: function (sort, col) {
      var active = sort.col === col;
      return '<span class="sort-ind' + (active ? ' on' : '') + '">' + (active ? (sort.asc ? '▲' : '▼') : '↕') + '</span>';
    },
    sortRows: function (rows, sort, types) {
      if (!sort.col) return rows;
      var type = types[sort.col] || 'text', dir = sort.asc ? 1 : -1;
      return rows.slice().sort(function (a, b) {
        var x = a[sort.col], y = b[sort.col];
        var xe = x == null || x === '', ye = y == null || y === '';
        if (xe && ye) return 0; if (xe) return 1; if (ye) return -1;
        if (type === 'num') return (Number(x) - Number(y)) * dir;
        if (type === 'date') return String(x).localeCompare(String(y)) * dir;
        return String(x).localeCompare(String(y), 'pt-BR', { sensitivity: 'base' }) * dir;
      });
    },
    load: function (key) {
      try { var s = JSON.parse(localStorage.getItem(key) || 'null'); if (s && typeof s.col === 'string') return s; } catch (e) {  }
      return { col: '', asc: true };
    },
    save: function (key, sort) {
      try { if (sort.col) localStorage.setItem(key, JSON.stringify(sort)); else localStorage.removeItem(key); } catch (e) {  }
    },
  };

  window.ProcessList = {
    mount: async function (host, opts) {
      var paged = typeof opts.fetchPage === 'function';
      var pageSize = opts.pageSize || 50;
      var dateField = opts.dateField || 'due_date_prc';
      var showApprovers = !!opts.showApprovers;

      host.innerHTML = '<div class="card" style="padding:0">'
        + '<div class="pl-toolbar">'
        + '<div class="pl-search">' + SVG_SEARCH + '<input id="pl-search" placeholder="Buscar…"></div>'
        + '<div class="pl-filters" id="pl-filters"></div>'
        + (opts.extraFilter ? '<div class="pl-filters" id="pl-extra"></div>' : '')
        + '<div class="pl-toolbar-actions"><button class="btn btn-ghost" id="pl-clear">Limpar filtros</button></div>'
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
      var extraValue = '';
      var approversByUuid = {};

      var SORT_COLS = [
        { label: '#', col: 'id_prc', type: 'num' },
        { label: 'Empresa', col: 'empresa_nome', type: 'text' },
        { label: 'Obra', col: 'obra_nome', type: 'text' },
        { label: 'Descrição', col: 'description_prc', type: 'text' },
        { label: 'Tipo', col: 'tipo_nome', type: 'text' },
        { label: 'Valor', col: 'value_prc', type: 'num' },
        { label: 'Vencimento', col: 'due_date_prc', type: 'date' },
        { label: 'Status', col: 'status_nome', type: 'text' },
      ];
      var SORT_TYPES = {}; SORT_COLS.forEach(function (c) { SORT_TYPES[c.col] = c.type; });
      var sortKey = 'sort:' + (opts.storageKey || (window.location.hash || 'view'));
      var sort = window.TableSort.load(sortKey);

      async function loadApprovers() {
        approversByUuid = {};
        var uuids = rows.map(function (p) { return p.uuid_prc; }).filter(Boolean);
        if (!uuids.length) return;
        try {
          var list = await window.SB.select('v_process_approvers', function (q) {
            return q.in('process_app', uuids).order('approved_at_app');
          });
          (list || []).forEach(function (a) {
            (approversByUuid[a.process_app] = approversByUuid[a.process_app] || []).push(a.approver_name || '—');
          });
        } catch (e) {  }
      }

      function approversCell(p) {
        var names = approversByUuid[p.uuid_prc] || [];
        if (!names.length) return '<span style="color:var(--muted)">—</span>';
        var joined = names.join(', ');
        return '<span class="badge ok" title="' + esc(joined) + '">' + names.length + '</span> '
          + '<span class="pl-approvers" title="' + esc(joined) + '">' + esc(joined) + '</span>';
      }

      function isoDay(v) { return v ? String(v).split('T')[0] : ''; }

      function filtered() {
        if (paged) return rows;
        var out = rows;
        var t = (search.value || '').toLowerCase().trim();
        if (t) {
          out = out.filter(function (p) {
            return [p.empresa_nome, p.obra_nome, p.description_prc, p.fornecedor_nome, p.tipo_nome, p.id_prc].join(' ').toLowerCase().indexOf(t) >= 0;
          });
        }
        out = out.filter(function (p) {
          if (filters.company && String(p.company_prc) !== String(filters.company)) return false;
          if (filters.building && String(p.building_prc || '').toUpperCase() !== String(filters.building).toUpperCase()) return false;
          if (filters.status !== '' && Number(p.status_step_prc) !== Number(filters.status)) return false;
          if (filters.urgent !== '' && !!p.is_urgent_prc !== (filters.urgent === '1')) return false;
          if (filters.from || filters.to) {
            var d = isoDay(p[dateField]);
            if (!d) return false;
            if (filters.from && d < filters.from) return false;
            if (filters.to && d > filters.to) return false;
          }
          return true;
        });
        if (opts.extraFilter && extraValue) out = opts.extraFilter.apply(out, extraValue);
        return out;
      }

      function render() {

        var data = window.TableSort.sortRows(filtered(), sort, SORT_TYPES);
        if (!data.length) {
          bodyEl.innerHTML = '<div class="empty">' + esc(page > 0 ? 'Nada nesta página.' : (opts.emptyText || 'Nenhum processo.')) + '</div>';
        } else {
          var head = SORT_COLS.map(function (c) {
            return '<th data-col="' + c.col + '">' + esc(c.label) + ' ' + window.TableSort.indicator(sort, c.col) + '</th>';
          }).join('');
          var html = '<div class="table-scroll"><table><thead><tr>' + head
            + (showApprovers ? '<th>Aprovações</th>' : '') + '<th></th></tr></thead><tbody>';
          data.forEach(function (p, i) {
            html += '<tr data-i="' + i + '" style="cursor:pointer">'
              + '<td><span class="id-cell">' + esc(p.id_prc)
              + (p.is_urgent_prc ? '<span class="urgent-dot" title="Urgente" aria-label="Urgente"></span>' : '')
              + '</span></td><td>' + esc(p.empresa_nome) + '</td><td>' + esc(p.obra_nome) + '</td>'
              + '<td>' + (p.description_prc ? esc(p.description_prc) : '<span style="color:var(--muted)">—</span>') + '</td>'
              + '<td>' + esc(p.tipo_nome) + '</td>'
              + '<td>' + money(p.value_prc) + '</td><td>' + fmtDate(p.due_date_prc) + '</td>'
              + '<td>' + statusBadge(p.status_step_prc, p.status_nome) + '</td>'
              + (showApprovers ? '<td style="white-space:nowrap">' + approversCell(p) + '</td>' : '')
              + '<td style="white-space:nowrap;text-align:right"></td></tr>';
          });
          html += '</tbody></table></div>';
          bodyEl.innerHTML = html;

          bodyEl.querySelectorAll('th[data-col]').forEach(function (th) {
            th.addEventListener('click', function () {
              sort = window.TableSort.cycle(sort, th.getAttribute('data-col'));
              window.TableSort.save(sortKey, sort);
              render();
            });
          });
          bodyEl.querySelectorAll('tr[data-i]').forEach(function (tr) {
            var p = data[+tr.getAttribute('data-i')], cell = tr.lastElementChild;
            var approversBtn = iconBtn(ICONS.aprovadores, 'btn-light', 'Aprovadores', function (e) { e.stopPropagation(); window.openProcessApprovers(p); });

            var visibleActions = (opts.actions || []).filter(function (a) { return typeof a.show !== 'function' || a.show(p); });
            var approversAt = Math.min(opts.approversPosition != null ? opts.approversPosition : 0, visibleActions.length);
            visibleActions.forEach(function (a, idx) {
              if (idx === approversAt) cell.appendChild(approversBtn);
              var handler = async function (e) {
                e.stopPropagation();
                var danger = (a.cls || '').indexOf('danger') >= 0;
                var reason;
                if (a.prompt) {
                  reason = await uiPrompt(a.prompt, danger);
                  if (reason == null) return;
                } else if (a.confirm && !(await uiConfirm(a.confirm, danger))) return;
                try { await a.run(p, reason); await reload(); toast('Feito.', true); }
                catch (err) {

                  await uiAlert(err.message);
                  await reload();
                }
              };
              var svg = a.icon || ICONS[a.label];
              cell.appendChild(svg
                ? iconBtn(svg, a.cls || 'btn-primary', a.label, handler)
                : btn(a.label, a.cls || 'btn-primary', handler));
            });
            if (approversAt >= visibleActions.length) cell.appendChild(approversBtn);
            tr.addEventListener('click', function () { window.openProcessDetail(p); });
          });
        }
        updatePager();
      }

      function pageSequence(cur, totalPages) {
        var delta = 2, range = [], out = [], last;
        for (var i = 1; i <= totalPages; i++) {
          if (i === 1 || i === totalPages || (i >= cur - delta && i <= cur + delta)) range.push(i);
        }
        range.forEach(function (i) {
          if (last) {
            if (i - last === 2) out.push(last + 1);
            else if (i - last !== 1) out.push('…');
          }
          out.push(i); last = i;
        });
        return out;
      }

      function goto(p) { if (p !== page && p >= 0) { page = p; reload(); } }

      function updatePager() {
        if (!paged) return;
        var from = rows.length ? page * pageSize + 1 : 0;
        var to = page * pageSize + rows.length;
        var totalPages = total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;

        var info = total != null
          ? 'Mostrando ' + from + '–' + to + ' de ' + total
          : 'Página ' + (page + 1);

        var h = '<span style="font-size:13px;color:var(--muted)">' + info + '</span>'
          + '<span style="flex:1"></span>';

        h += '<button class="btn btn-light" data-pg="' + (page - 1) + '"' + (page === 0 ? ' disabled' : '') + '>‹</button>';

        if (totalPages != null) {
          pageSequence(page + 1, totalPages).forEach(function (it) {
            if (it === '…') { h += '<span style="padding:0 4px;color:var(--muted-2)">…</span>'; return; }
            var active = (it === page + 1);
            h += '<button class="btn ' + (active ? 'btn-primary' : 'btn-light') + '" data-pg="' + (it - 1) + '"'
              + (active ? ' disabled' : '') + ' style="min-width:38px">' + it + '</button>';
          });
        }

        var noNext = totalPages != null ? (page + 1 >= totalPages) : !hasMore;
        h += '<button class="btn btn-light" data-pg="' + (page + 1) + '"' + (noNext ? ' disabled' : '') + '>›</button>';

        pagerEl.innerHTML = h;
        pagerEl.querySelectorAll('button[data-pg]').forEach(function (b) {
          b.addEventListener('click', function () { goto(+b.getAttribute('data-pg')); });
        });
      }

      async function reload() {
        bodyEl.innerHTML = '<div class="empty">Carregando…</div>';
        if (paged) pagerEl.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
        try {
          if (paged) {

            if (opts.fetchCount && total === null) {
              total = await opts.fetchCount({ term: term, filters: filters });
            }

            rows = (await opts.fetchPage({ page: page, pageSize: pageSize, term: term, filters: filters })) || [];
            hasMore = total != null ? (page + 1) * pageSize < total : rows.length === pageSize;
          } else {
            rows = await opts.load();
          }
          if (showApprovers) await loadApprovers();
          render();
        } catch (e) {
          window.viewError(bodyEl, e);
          updatePager();
        }
      }

      var debTimer = null;
      search.addEventListener('input', function () {
        if (!paged) { render(); return; }
        clearTimeout(debTimer);
        debTimer = setTimeout(function () { term = (search.value || '').trim(); page = 0; total = null; reload(); }, 350);
      });

      var pf = await window.ProcessFilters.mount(host.querySelector('#pl-filters'), {
        storageKey: opts.storageKey || (window.location.hash || 'view'),
        onChange: function (values) {
          filters = values;
          if (paged) { page = 0; total = null; reload(); } else render();
        },
      });
      filters = pf.getValues();

      var extraEl = null, extraStorageKey = null;
      if (opts.extraFilter) {
        extraStorageKey = 'filters-extra:' + (opts.storageKey || (window.location.hash || 'view'));
        var extraHost = host.querySelector('#pl-extra');
        extraHost.innerHTML = '<label class="pf-field">' + esc(opts.extraFilter.label || 'Filtro')
          + '<select data-extra><option value="">Todos</option></select></label>';
        extraEl = extraHost.querySelector('[data-extra]');
        try {
          var options = await opts.extraFilter.load();
          extraEl.innerHTML = '<option value="">Todos</option>' + (options || []).map(function (op) {
            return '<option value="' + esc(op.value) + '">' + esc(op.label) + '</option>';
          }).join('');
        } catch (e) {  }
        try { extraValue = localStorage.getItem(extraStorageKey) || ''; } catch (e) { extraValue = ''; }
        extraEl.value = extraValue;
        if (extraEl.value !== extraValue) { extraValue = ''; }
        extraEl.addEventListener('change', function () {
          extraValue = extraEl.value;
          try { localStorage.setItem(extraStorageKey, extraValue); } catch (e) {  }
          render();
        });
      }

      host.querySelector('#pl-clear').addEventListener('click', function () {
        search.value = ''; term = '';
        if (paged) { page = 0; total = null; }
        if (extraEl) {
          extraValue = ''; extraEl.value = '';
          try { localStorage.removeItem(extraStorageKey); } catch (e) {  }
        }
        pf.clear();
      });

      await reload();
      return { reload: reload };
    }
  };

  function applyProcessFilters(s, kind, term, filters) {
    if (kind) s = s.eq('kind_prc', Number(kind));
    var f = filters || {};
    if (f.company) s = s.eq('company_prc', f.company);
    if (f.building) s = s.eq('building_prc', f.building);
    if (f.status !== '' && f.status != null) s = s.eq('status_step_prc', Number(f.status));
    if (f.urgent === '1' || f.urgent === '0') s = s.eq('is_urgent_prc', f.urgent === '1');
    if (f.from) s = s.gte('due_date_prc', f.from);
    if (f.to) s = s.lte('due_date_prc', f.to);
    term = (term || '').trim();
    if (term) {
      var safe = term.replace(/[,()*%]/g, ' ').trim();
      if (safe) {
        var ors = ['empresa_nome.ilike.%' + safe + '%', 'obra_nome.ilike.%' + safe + '%',
        'description_prc.ilike.%' + safe + '%', 'fornecedor_nome.ilike.%' + safe + '%', 'tipo_nome.ilike.%' + safe + '%'];
        if (/^\d+$/.test(safe)) ors.push('id_prc.eq.' + safe);
        s = s.or(ors.join(','));
      }
    }
    return s;
  }

  window.fetchProcessesPage = function (kind) {
    return function (args) {
      var page = args.page, pageSize = args.pageSize;
      return window.SB.select('v_processes', function (s) {
        s = applyProcessFilters(s, kind, args.term, args.filters);
        return s.order('id_prc', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1);
      });
    };
  };

  window.fetchProcessesCount = function (kind) {
    return function (args) {
      return window.SB.count('v_processes', function (s) {
        return applyProcessFilters(s, kind, args.term, args.filters);
      });
    };
  };

  function invalidateFlowCaches() {
    ['my_approvals', 'financeiro', 'history', 'dashboard', 'no_approver'].forEach(function (e) { window.Store.invalidate(e); });
  }
  window.invalidateFlowCaches = invalidateFlowCaches;

  window.mountPendingApprovals = async function (host) {

    var groupsByUuid = {};
    return window.ProcessList.mount(host, {
      emptyText: 'Você não tem aprovações pendentes.',
      showApprovers: true,
      approversPosition: 1,
      extraFilter: {
        label: 'Aprovar como',
        load: async function () {
          var rows = await window.SB.rpc('my_pending_approval_groups', {});
          groupsByUuid = {};
          var names = {}, levels = {};
          (rows || []).forEach(function (r) {
            (groupsByUuid[r.uuid_prc] = groupsByUuid[r.uuid_prc] || []).push(r.group_id);
            names[r.group_id] = r.group_name; levels[r.group_id] = r.level;
          });

          var lv = function (id) { return levels[id] == null ? Infinity : levels[id]; };
          return Object.keys(names)
            .sort(function (a, b) { return (lv(b) - lv(a)) || String(names[a]).localeCompare(names[b]); })
            .map(function (id) {
              return { value: id, label: names[id] + (levels[id] != null ? ' (nível ' + levels[id] + ')' : ' (urgência)') };
            });
        },
        apply: function (rows, groupId) {
          return rows.filter(function (p) {
            return (groupsByUuid[p.uuid_prc] || []).indexOf(Number(groupId)) >= 0;
          });
        },
      },
      load: async function () {
        var pend = await window.Store.get('pending_approvals');
        if (!pend.length) return [];
        var uuids = pend.map(function (r) { return r.uuid_prc; });
        var named = await window.SB.select('v_processes', function (q) { return q.in('uuid_prc', uuids); });
        var byUuid = {}; named.forEach(function (r) { byUuid[r.uuid_prc] = r; });
        return pend.map(function (r) { return byUuid[r.uuid_prc] || r; });
      },
      actions: [
        {
          label: 'Aprovar', cls: 'btn-primary', confirm: 'Confirmar aprovação deste processo?',
          run: function (p) {
            return window.Store.commit(
              function () {
                return window.API.post('/processes/' + p.uuid_prc + '/approve')
                  .then(function (r) { invalidateFlowCaches(); return r; });
              },
              function () { window.Store.remove('pending_approvals', 'uuid_prc', p.uuid_prc); return ['pending_approvals']; });
          }
        },
        {
          label: 'Corrigir', cls: 'btn-danger',
          prompt: 'Devolver o processo para correção?',
          run: function (p, reason) {
            return window.Store.commit(
              function () {
                return window.API.post('/processes/' + p.uuid_prc + '/reject', { reason: reason })
                  .then(function (r) { invalidateFlowCaches(); return r; });
              },
              function () { window.Store.remove('pending_approvals', 'uuid_prc', p.uuid_prc); return ['pending_approvals']; });
          }
        },
      ],
    });
  };
})();
