(function () {
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(value) { return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  var SVG_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
  var SVG_EMPTY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>';
  var SVG_DOC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
  var SVG_WAIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/></svg>';

  function personRow(approver) {
    var name = approver.name || approver.email || '—';
    var subject = (approver.name && approver.email && approver.name !== approver.email) ? approver.email : '';
    var tag = approver.group_name || ('Nível ' + approver.level);
    return '<div class="u-card">'
      + '<div class="u-id"><b>' + escapeHtml(name) + '</b>'
      + (subject ? '<span class="u-sub">' + escapeHtml(subject) + '</span>' : '') + '</div>'
      + '<span class="badge blue u-tag">' + escapeHtml(tag) + '</span></div>';
  }

  function emptyState() {
    return '<div class="apv-empty"><span class="apv-empty-ic">' + SVG_EMPTY + '</span>'
      + '<div class="apv-empty-t">Nenhum dado encontrado</div>'
      + '<div class="apv-empty-s">A sua consulta não retornou resultados.</div></div>';
  }

  function matches(a, term) {
    if (!term) return true;
    return [a.name, a.email, a.group_name].join(' ').toLowerCase().indexOf(term) >= 0;
  }

  window.openProcessApprovers = async function (process) {
    var uuid = process.uuid_prc;
    var steps = (window.CONFIG.STEPS || {});
    var statusTxt = process.status_nome || steps[process.status_step_prc] || ('Status ' + process.status_step_prc);

    var o = document.createElement('div'); o.className = 'modal-overlay';
    function column(key, title, subject) {
      return '<section class="apv-col">'
        + '<h3>' + title + '</h3><p class="apv-sub">' + subject + '</p>'
        + '<div class="apv-search">' + SVG_SEARCH + '<input data-search="' + key + '" placeholder="Buscar…"></div>'
        + '<div class="apv-body" data-col="' + key + '"><div class="apv-empty"><span class="apv-empty-ic">' + SVG_EMPTY + '</span><div class="apv-empty-t">Carregando…</div></div></div>'
        + '</section>';
    }
    o.innerHTML =
      '<div class="modal-box approvers"><button class="modal-x" aria-label="Fechar">×</button>'
      + '<h2>Aprovadores do Processo #' + escapeHtml(process.id_prc) + '</h2>'
      + '<div class="apv-proc"><span class="apv-proc-icon">' + SVG_DOC + '</span>'
      + '<div><div class="apv-proc-label">Processo #' + escapeHtml(process.id_prc) + '</div>'
      + '<div class="apv-proc-value">' + money(process.value_prc) + '</div>'
      + '<div class="apv-proc-status">' + escapeHtml(statusTxt) + '</div></div></div>'
      + '<div class="apv-cols">'
      + column('done', 'Aprovações Concluídas', 'Quem já aprovou este processo.')
      + column('elig', 'Aprovadores Elegíveis (Etapa Atual)', 'Quem pode aprovar o processo agora.')
      + column('next', 'Próximas Etapas Necessárias', 'Aprovações futuras para este processo.')
      + '</div></div>';
    o.addEventListener('click', function (event) { if (event.target === o || event.target.classList.contains('modal-x')) o.remove(); });
    document.body.appendChild(o);

    var data = { done: [], elig: [] };
    var isPending = process.status_step_prc === window.CONFIG.STATUS.aguardando;

    function renderCol(key) {
      var body = o.querySelector('[data-col="' + key + '"]'); if (!body) return;
      var input = o.querySelector('[data-search="' + key + '"]');
      var term = (input && input.value || '').toLowerCase().trim();
      if (key === 'next') {
        body.innerHTML = isPending
          ? '<div class="apv-next"><span class="apv-next-ic">' + SVG_WAIT + '</span>'
          + '<div><b>Aguardando aprovação</b><span>Todos os aprovadores</span></div></div>'
          : emptyState();
        return;
      }
      var list = (data[key] || []).filter(function (item) { return matches(item, term); });
      body.innerHTML = list.length ? list.map(personRow).join('') : emptyState();
    }

    o.querySelectorAll('[data-search]').forEach(function (item) {
      item.addEventListener('input', function () { renderCol(item.getAttribute('data-search')); });
    });
    renderCol('next');

    try {
      window.Store.invalidateKey('approvers', uuid);
      window.Store.invalidateKey('eligible_approvers', uuid);
      data.done = await window.Store.get('approvers', uuid);
      renderCol('done');
      data.elig = await window.Store.get('eligible_approvers', uuid);
      renderCol('elig');
    } catch (error) {
      console.error(error);
      ['done', 'elig'].forEach(function (item) { var columnButton = o.querySelector('[data-col="' + item + '"]'); if (columnButton) columnButton.innerHTML = '<div class="view-error">' + escapeHtml(error.message) + '</div>'; });
    }
  };
})();
