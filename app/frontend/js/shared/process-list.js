// Tabela de processos reaproveitável (Consulta / Aprovar / Financeiro / Contabilidade).
// window.ProcessList.mount(hostEl, opts)
//   Modo PAGINADO (recomendado p/ v_processes — busca 50 por vez, página a página):
//     opts.fetchPage = async ({page,pageSize,term}) => { rows, count }  (count = total p/ páginas numeradas)
//   Modo simples (listas pequenas, ex.: minhas aprovações):
//     opts.load = async () => rows   (filtro/“busca” client-side)
//   opts.actions:[{label,cls,confirm,run(proc)}], opts.emptyText, opts.pageSize(=50)
(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function money(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDate(d) { return d ? String(d).split('T')[0].split('-').reverse().join('/') : '—'; }
  function statusBadge(step, name) {
    var cls = ({ 1: 'warn', 2: 'red', 3: 'red', 4: 'blue', 6: 'blue', 7: 'ok', 8: 'red', 9: 'ok' })[step] || '';
    return '<span class="badge ' + cls + '">' + esc(name) + '</span>';
  }
  function btn(label, cls, fn) { var b = document.createElement('button'); b.className = 'btn ' + cls; b.style.marginLeft = '6px'; b.textContent = label; b.addEventListener('click', fn); return b; }

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

  function exportCsv(rows) {
    var head = ['#', 'Empresa', 'Obra', 'Fornecedor', 'Tipo', 'Valor', 'Vencimento', 'Status'];
    var lines = [head.join(';')].concat(rows.map(function (p) {
      return [p.id_prc, p.empresa_nome, p.obra_nome, p.fornecedor_nome, p.tipo_nome, p.value_prc, p.due_date_prc, p.status_nome]
        .map(function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; }).join(';');
    }));
    var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'processos.csv'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  window.ProcessList = {
    mount: async function (host, opts) {
      var paged = typeof opts.fetchPage === 'function';
      var pageSize = opts.pageSize || 50;
      var dateFilter = !!opts.dateFilter;          // mostra filtro de range de data
      var dateField = opts.dateField || 'due_date_prc'; // coluna usada no range

      host.innerHTML = '<div class="card" style="padding:0">'
        + '<div class="pl-toolbar">'
        + '<input id="pl-search" class="pl-input" placeholder="Buscar por empresa, obra, fornecedor, tipo, nº…">'
        + (dateFilter
            ? '<div class="pl-dates">'
              + '<label>De<input type="date" id="pl-date-from"></label>'
              + '<label>Até<input type="date" id="pl-date-to"></label></div>'
            : '')
        + '<div class="pl-toolbar-actions">'
        + (dateFilter ? '<button class="btn btn-ghost" id="pl-clear">Limpar filtros</button>' : '')
        + '<button class="btn btn-excel" id="pl-xlsx">Exportar Excel</button></div>'
        + '</div>'
        + '<div id="pl-body" style="padding:6px 0"><div class="empty">Carregando…</div></div>'
        + (paged ? '<div class="pl-pager" id="pl-pager"></div>' : '')
        + '</div>';

      var bodyEl = host.querySelector('#pl-body');
      var search = host.querySelector('#pl-search');
      var pagerEl = host.querySelector('#pl-pager');
      var dFrom = host.querySelector('#pl-date-from');
      var dTo = host.querySelector('#pl-date-to');

      var rows = [];        // linhas atualmente exibidas (página atual no modo paginado)
      var page = 0;         // página 0-indexada (modo paginado)
      var total = null;     // total de registros (count exato) p/ páginas numeradas
      var hasMore = false;  // fallback se o total vier nulo
      var term = '';        // termo de busca corrente

      function isoDay(v) { return v ? String(v).split('T')[0] : ''; } // 'YYYY-MM-DD'

      // Filtro client-side (apenas no modo simples): busca textual + range de data.
      // O range é PERSISTENTE — só zera no "Limpar filtros".
      function filtered() {
        if (paged) return rows;
        var out = rows;
        var t = (search.value || '').toLowerCase().trim();
        if (t) {
          out = out.filter(function (p) {
            return [p.empresa_nome, p.obra_nome, p.fornecedor_nome, p.tipo_nome, p.id_prc].join(' ').toLowerCase().indexOf(t) >= 0;
          });
        }
        if (dateFilter) {
          var from = dFrom && dFrom.value, to = dTo && dTo.value;
          if (from || to) {
            out = out.filter(function (p) {
              var d = isoDay(p[dateField]);
              if (!d) return false;
              if (from && d < from) return false;
              if (to && d > to) return false;
              return true;
            });
          }
        }
        return out;
      }

      function render() {
        var data = filtered();
        if (!data.length) {
          bodyEl.innerHTML = '<div class="empty">' + esc(page > 0 ? 'Nada nesta página.' : (opts.emptyText || 'Nenhum processo.')) + '</div>';
        } else {
          var html = '<div class="table-scroll"><table><thead><tr><th>#</th><th>Empresa</th><th>Obra</th><th>Fornecedor</th><th>Tipo</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th></tr></thead><tbody>';
          data.forEach(function (p, i) {
            html += '<tr data-i="' + i + '" style="cursor:pointer">'
              + '<td>' + esc(p.id_prc) + '</td><td>' + esc(p.empresa_nome) + '</td><td>' + esc(p.obra_nome) + '</td>'
              + '<td>' + esc(p.fornecedor_nome) + '</td>'
              + '<td>' + esc(p.tipo_nome) + (p.is_urgent_prc ? ' <span class="badge red">Urgente</span>' : '') + '</td>'
              + '<td>' + money(p.value_prc) + '</td><td>' + fmtDate(p.due_date_prc) + '</td>'
              + '<td>' + statusBadge(p.status_step_prc, p.status_nome) + '</td>'
              + '<td style="white-space:nowrap;text-align:right"></td></tr>';
          });
          html += '</tbody></table></div>';
          bodyEl.innerHTML = html;
          bodyEl.querySelectorAll('tr[data-i]').forEach(function (tr) {
            var p = data[+tr.getAttribute('data-i')], cell = tr.lastElementChild;
            cell.appendChild(btn('Aprovadores', 'btn-light', function (e) { e.stopPropagation(); window.openProcessApprovers(p); }));
            (opts.actions || []).forEach(function (a) {
              cell.appendChild(btn(a.label, a.cls || 'btn-primary', async function (e) {
                e.stopPropagation();
                var danger = (a.cls || '').indexOf('danger') >= 0;
                if (a.confirm && !(await uiConfirm(a.confirm, danger))) return;
                try { await a.run(p); await reload(); toast('Feito.', true); } catch (err) { toast('Erro: ' + err.message); }
              }));
            });
            tr.addEventListener('click', function () { window.openProcessDetail(p); });
          });
        }
        updatePager();
      }

      // sequência de páginas a exibir (1-indexada) com reticências p/ listas longas
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

        // info à esquerda
        var info = total != null
          ? 'Mostrando ' + from + '–' + to + ' de ' + total
          : 'Página ' + (page + 1);

        var h = '<span style="font-size:13px;color:var(--muted)">' + info + '</span>'
          + '<span style="flex:1"></span>';

        // botão anterior
        h += '<button class="btn btn-light" data-pg="' + (page - 1) + '"' + (page === 0 ? ' disabled' : '') + '>‹</button>';

        if (totalPages != null) {
          pageSequence(page + 1, totalPages).forEach(function (it) {
            if (it === '…') { h += '<span style="padding:0 4px;color:var(--muted-2)">…</span>'; return; }
            var active = (it === page + 1);
            h += '<button class="btn ' + (active ? 'btn-primary' : 'btn-light') + '" data-pg="' + (it - 1) + '"'
              + (active ? ' disabled' : '') + ' style="min-width:38px">' + it + '</button>';
          });
        }

        // botão próxima
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
            // META: conta UMA vez por filtro (total === null). Trocar busca zera o
            // total p/ recontar; navegar entre páginas reusa o total (não reconta).
            if (opts.fetchCount && total === null) {
              total = await opts.fetchCount({ term: term });
            }
            // LIST: a página traz só as 50 linhas (sem recontar).
            rows = (await opts.fetchPage({ page: page, pageSize: pageSize, term: term })) || [];
            hasMore = total != null ? (page + 1) * pageSize < total : rows.length === pageSize;
          } else {
            rows = await opts.load();
          }
          render();
        } catch (e) {
          bodyEl.innerHTML = '<div class="view-error">' + esc(e.message) + '</div>';
          updatePager();
        }
      }

      // busca: server-side (paginado) com debounce, ou client-side (simples)
      var debTimer = null;
      search.addEventListener('input', function () {
        if (!paged) { render(); return; }
        clearTimeout(debTimer);
        debTimer = setTimeout(function () { term = (search.value || '').trim(); page = 0; total = null; reload(); }, 350);
      });

      // filtro de data (modo simples): re-renderiza ao mudar; persiste até "Limpar"
      if (dateFilter) {
        if (dFrom) dFrom.addEventListener('change', render);
        if (dTo) dTo.addEventListener('change', render);
        var clearBtn = host.querySelector('#pl-clear');
        if (clearBtn) clearBtn.addEventListener('click', function () {
          search.value = ''; if (dFrom) dFrom.value = ''; if (dTo) dTo.value = '';
          render();
        });
      }

      host.querySelector('#pl-xlsx').addEventListener('click', function () { exportCsv(filtered()); });
      await reload();
      return { reload: reload };
    }
  };

  // Filtros compartilhados entre contagem (META) e página (LIST) — mesmos critérios.
  function applyProcessFilters(s, kind, term) {
    if (kind) s = s.eq('kind_prc', Number(kind));
    term = (term || '').trim();
    if (term) {
      var safe = term.replace(/[,()*%]/g, ' ').trim();
      if (safe) {
        var ors = ['empresa_nome.ilike.%' + safe + '%', 'obra_nome.ilike.%' + safe + '%',
          'fornecedor_nome.ilike.%' + safe + '%', 'tipo_nome.ilike.%' + safe + '%'];
        if (/^\d+$/.test(safe)) ors.push('id_prc.eq.' + safe);
        s = s.or(ors.join(','));
      }
    }
    return s;
  }

  // LIST: a página traz só 50 linhas (range), sem contagem. kind opcional.
  window.fetchProcessesPage = function (kind) {
    return function (args) {
      var page = args.page, pageSize = args.pageSize;
      return window.SB.select('v_processes', function (s) {
        s = applyProcessFilters(s, kind, args.term);
        return s.order('id_prc', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1);
      });
    };
  };

  // META: total exato p/ o mesmo filtro, sem trafegar linhas (head). Chamado 1x.
  window.fetchProcessesCount = function (kind) {
    return function (args) {
      return window.SB.count('v_processes', function (s) {
        return applyProcessFilters(s, kind, args.term);
      });
    };
  };

  // Lista "Minhas Aprovações": rpc my_pending_approvals (autoridade). Enriquecemos os
  // nomes buscando SÓ os uuids pendentes em v_processes (.in) — nunca todos os processos.
  window.mountPendingApprovals = async function (host) {
    return window.ProcessList.mount(host, {
      emptyText: 'Você não tem aprovações pendentes.',
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
              function () { return window.API.post('/processes/' + p.uuid_prc + '/approve'); },
              function () { window.Store.remove('pending_approvals', 'uuid_prc', p.uuid_prc); return ['pending_approvals']; });
          }
        },
        {
          label: 'Corrigir', cls: 'btn-danger', confirm: 'Devolver o processo para correção?',
          run: function (p) {
            return window.Store.commit(
              function () { return window.API.post('/processes/' + p.uuid_prc + '/reject'); },
              function () { window.Store.remove('pending_approvals', 'uuid_prc', p.uuid_prc); return ['pending_approvals']; });
          }
        },
      ],
    });
  };
})();
