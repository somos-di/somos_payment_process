// Modal "Aprovadores do Processo" — window.openProcessApprovers(proc)
// Card-resumo + 3 colunas (Concluídas / Elegíveis / Próximas Etapas), cada uma
// com busca própria e empty-state. Lê do Store por uuid.
(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function money(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  var SVG_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
  var SVG_EMPTY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>';
  var SVG_DOC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
  var SVG_WAIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/></svg>';

  // cartão de pessoa: nome (ou email) em destaque, email secundário, grupo×nível em badge
  function personRow(a) {
    var name = a.name || a.email || '—';
    var sub = (a.name && a.email && a.name !== a.email) ? a.email : '';
    var tag = a.group_name || ('Nível ' + a.level);
    return '<div class="u-card">'
      + '<div class="u-id"><b>' + esc(name) + '</b>'
      + (sub ? '<span class="u-sub">' + esc(sub) + '</span>' : '') + '</div>'
      + '<span class="badge blue u-tag">' + esc(tag) + '</span></div>';
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

  window.openProcessApprovers = async function (proc) {
    var uuid = proc.uuid_prc;
    var steps = (window.CONFIG.STEPS || {});
    var statusTxt = proc.status_nome || steps[proc.status_step_prc] || ('Status ' + proc.status_step_prc);

    var o = document.createElement('div'); o.className = 'modal-overlay';
    function col(key, title, sub) {
      return '<section class="apv-col">'
        + '<h3>' + title + '</h3><p class="apv-sub">' + sub + '</p>'
        + '<div class="apv-search">' + SVG_SEARCH + '<input data-search="' + key + '" placeholder="Buscar…"></div>'
        + '<div class="apv-body" data-col="' + key + '"><div class="apv-empty"><span class="apv-empty-ic">' + SVG_EMPTY + '</span><div class="apv-empty-t">Carregando…</div></div></div>'
        + '</section>';
    }
    o.innerHTML =
      '<div class="modal-box approvers"><button class="modal-x" aria-label="Fechar">×</button>'
      + '<h2>Aprovadores do Processo #' + esc(proc.id_prc) + '</h2>'
      + '<div class="apv-proc"><span class="apv-proc-icon">' + SVG_DOC + '</span>'
      + '<div><div class="apv-proc-label">Processo #' + esc(proc.id_prc) + '</div>'
      + '<div class="apv-proc-value">' + money(proc.value_prc) + '</div>'
      + '<div class="apv-proc-status">' + esc(statusTxt) + '</div></div></div>'
      + '<div class="apv-cols">'
      + col('done', 'Aprovações Concluídas', 'Quem já aprovou este processo.')
      + col('elig', 'Aprovadores Elegíveis (Etapa Atual)', 'Quem pode aprovar o processo agora.')
      + col('next', 'Próximas Etapas Necessárias', 'Aprovações futuras para este processo.')
      + '</div></div>';
    o.addEventListener('click', function (e) { if (e.target === o || e.target.classList.contains('modal-x')) o.remove(); });
    document.body.appendChild(o);

    var data = { done: [], elig: [] };
    var pendente = proc.status_step_prc === 1;

    function renderCol(key) {
      var body = o.querySelector('[data-col="' + key + '"]'); if (!body) return;
      var input = o.querySelector('[data-search="' + key + '"]');
      var term = (input && input.value || '').toLowerCase().trim();
      if (key === 'next') {
        body.innerHTML = pendente
          ? '<div class="apv-next"><span class="apv-next-ic">' + SVG_WAIT + '</span>'
            + '<div><b>Aguardando aprovação</b><span>Todos os aprovadores</span></div></div>'
          : emptyState();
        return;
      }
      var list = (data[key] || []).filter(function (a) { return matches(a, term); });
      body.innerHTML = list.length ? list.map(personRow).join('') : emptyState();
    }

    o.querySelectorAll('[data-search]').forEach(function (inp) {
      inp.addEventListener('input', function () { renderCol(inp.getAttribute('data-search')); });
    });
    renderCol('next');

    try {
      data.done = await window.Store.get('approvers', uuid);
      renderCol('done');
      data.elig = await window.Store.get('eligible_approvers', uuid);
      renderCol('elig');
    } catch (e) {
      console.error(e);
      ['done', 'elig'].forEach(function (k) { var b = o.querySelector('[data-col="' + k + '"]'); if (b) b.innerHTML = '<div class="view-error">' + esc(e.message) + '</div>'; });
    }
  };
})();
