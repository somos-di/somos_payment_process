async function initView_com_aprovador() {
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function statusBadge(step, name) {
    var cls = ((window.CONFIG && window.CONFIG.STATUS_COLORS) || {})[step] || '';
    return '<span class="badge ' + cls + '">' + esc(name || ('Status ' + step)) + '</span>';
  }
  var SLOW_DAYS = ((window.CONFIG.PARAMS || {}).comAprovador || {}).slowDays || 5;
  var SVG_PEOPLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>';

  var pageSize = 50, page = 0, total = null, rows = [], term = '';
  var bodyEl = $('ca-body'), pagerEl = $('ca-pager'), countEl = $('ca-count');
  var search = $('ca-search');

  function applyFilters(s) {

    var t = (term || '').trim().replace(/[,()*%]/g, ' ').trim();
    if (t) {
      var ors = ['empresa_nome.ilike.%' + t + '%', 'obra_nome.ilike.%' + t + '%', 'fornecedor_nome.ilike.%' + t + '%'];
      if (/^\d+$/.test(t)) ors.push('id_prc.eq.' + t);
      s = s.or(ors.join(','));
    }
    return s;
  }

  function pagerHtml() {
    if (total === null) return '';
    var pages = Math.max(1, Math.ceil(total / pageSize));
    var from = total ? page * pageSize + 1 : 0, to = Math.min(total, (page + 1) * pageSize);
    return '<div class="pl-pager-info">' + from + '–' + to + ' de ' + total + ' · pág ' + (page + 1) + '/' + pages + '</div>'
      + '<div class="pl-pager-btns">'
      + '<button class="btn btn-light" id="ca-prev" ' + (page <= 0 ? 'disabled' : '') + '>‹ Anterior</button>'
      + '<button class="btn btn-light" id="ca-next" ' + ((page + 1) >= pages ? 'disabled' : '') + '>Próxima ›</button>'
      + '</div>';
  }

  function render() {
    if (!rows.length) {
      bodyEl.innerHTML = '<div class="empty">' + (page > 0 ? 'Nada nesta página.' : 'Nenhum processo com aprovador.') + '</div>';
    } else {
      var html = '<div class="table-scroll"><table><thead><tr>'
        + '<th>#</th><th>Empresa</th><th>Obra</th><th>Tipo</th><th>Valor</th><th>Status</th>'
        + '<th>Progresso</th><th>Parado há</th><th>Aprovadores</th><th></th></tr></thead><tbody>';
      rows.forEach(function (p, i) {
        var slow = p.status_step_prc === window.CONFIG.STATUS.aguardando && (p.dias_desde_criacao || 0) > SLOW_DAYS;
        var approverTotal = p.qtd_aprovadores || 0, requiredLevel = p.nivel_exigido || 1;
        var done = approverTotal >= requiredLevel;
        var approverNames = (p.aprovadores || []).map(function (a) { return a.nome; }).join(', ');
        html += '<tr data-i="' + i + '" class="' + (slow ? 'ca-slow' : '') + '" style="cursor:pointer">'
          + '<td><span class="id-cell">' + esc(p.id_prc) + (p.is_urgent_prc ? '<span class="urgent-dot" title="Urgente"></span>' : '') + '</span></td>'
          + '<td>' + esc(p.empresa_nome) + '</td><td>' + esc(p.obra_nome) + '</td>'
          + '<td>' + esc(p.tipo_nome) + '</td><td>' + money(p.value_prc) + '</td>'
          + '<td>' + statusBadge(p.status_step_prc, p.status_nome) + '</td>'
          + '<td><span class="ca-prog ' + (done ? 'done' : 'wait') + '">' + approverTotal + '/' + requiredLevel + '</span></td>'
          + '<td class="ca-dias">' + (p.dias_desde_criacao != null ? p.dias_desde_criacao + 'd' : '—') + '</td>'
          + '<td class="ca-aprovs" title="' + esc(approverNames) + '">' + esc(approverNames || '—') + '</td>'
          + '<td style="text-align:right;white-space:nowrap"></td></tr>';
      });
      html += '</tbody></table></div>';
      bodyEl.innerHTML = html;
      bodyEl.querySelectorAll('tr[data-i]').forEach(function (tr) {
        var p = rows[+tr.getAttribute('data-i')], cell = tr.lastElementChild;
        var b = document.createElement('button');
        b.className = 'btn btn-icon btn-light'; b.title = 'Aprovadores'; b.innerHTML = SVG_PEOPLE;
        b.addEventListener('click', function (e) { e.stopPropagation(); window.openProcessApprovers(p); });
        cell.appendChild(b);
        tr.addEventListener('click', function () { window.openProcessDetail(p); });
      });
    }
    pagerEl.innerHTML = pagerHtml();
    var prev = $('ca-prev'), next = $('ca-next');
    if (prev) prev.addEventListener('click', function () { if (page > 0) { page--; loadPage(); } });
    if (next) next.addEventListener('click', function () { page++; loadPage(); });
  }

  async function loadCount() {
    try { total = await window.SB.count('v_with_approver', applyFilters); }
    catch (e) { total = null; }
    countEl.textContent = (total != null ? total : '?') + ' processo(s) com aprovador';
  }
  async function loadPage() {
    bodyEl.innerHTML = '<div class="empty">Carregando…</div>';
    try {
      rows = await window.SB.select('v_with_approver', function (s) {
        return applyFilters(s).order('created_at_prc', { ascending: true }).range(page * pageSize, page * pageSize + pageSize - 1);
      }) || [];
    } catch (e) { window.viewError(bodyEl, e); return; }
    render();
  }

  var t;
  function refilter() { clearTimeout(t); t = setTimeout(function () { page = 0; loadCount(); loadPage(); }, 300); }
  search.addEventListener('input', function () { term = search.value; refilter(); });

  await loadCount();
  await loadPage();
}
