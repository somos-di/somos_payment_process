(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDate(d) { return d ? String(d).split('T')[0].split('-').reverse().join('/') : '—'; }
  // created_at_hst vem do banco como timestamptz (UTC). Formata no fuso do Brasil
  // (America/Sao_Paulo) via Intl — fatiar a string crua mostraria o relógio UTC (+3h).
  function fmtDT(d) {
    if (!d) return '';
    var dt = new Date(d);
    if (isNaN(dt)) { var s = String(d).replace('T', ' '); return s.slice(0, 10).split('-').reverse().join('/') + ' ' + s.slice(11, 16); }
    return dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function fieldBox(label, val) {
    var v = (val === null || val === undefined || val === '') ? '—' : val;
    return '<div class="pd-field"><label>' + esc(label) + '</label><div class="pd-field-box">' + esc(v) + '</div></div>';
  }

  window.openProcessDetail = async function (proc) {
    var o = document.createElement('div'); o.className = 'modal-overlay';
    var steps = (window.CONFIG.STEPS || {}), kinds = (window.CONFIG.PROCESS_KINDS || {});
    var nf = proc.attachment_url2_prc, bol = proc.attachment_url_prc;
    var firstUrl = nf || bol;

    var docHtml = '';
    if (firstUrl) {
      docHtml = '<div class="pd-doc">'
        + '<div class="pd-doc-head">'
        + '<div class="pd-doc-tabs">'
        + (nf ? '<button class="pd-doc-tab active" data-url="' + esc(nf) + '">Nota Fiscal</button>' : '')
        + (bol ? '<button class="pd-doc-tab' + (nf ? '' : ' active') + '" data-url="' + esc(bol) + '">Boleto</button>' : '')
        + '</div>'
        + '<div class="pd-doc-actions">'
        + (nf ? '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + esc(nf) + '">Nota Fiscal</a>' : '')
        + (bol ? '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + esc(bol) + '">Boleto</a>' : '')
        + '</div></div>'
        + '<iframe class="pd-doc-frame" src="' + esc(firstUrl) + '" title="Documento"></iframe>'
        + '</div>';
    }

    o.innerHTML =
      '<div class="modal-box xl' + (firstUrl ? '' : ' no-doc') + '"><button class="modal-x" aria-label="Fechar">×</button>'
      + '<div class="tabs"><button class="tab active" data-t="dados">Detalhes</button><button class="tab" data-t="hist">Histórico</button></div>'
      + '<div data-pane="dados" class="pane pd-detail">'
      + '<div class="pd-fields"><h3>Dados Gerais</h3>'
      + fieldBox('Descrição', proc.description_prc)
      + fieldBox('Empresa', proc.empresa_nome || proc.company_prc)
      + fieldBox('Obra', proc.obra_nome || proc.building_prc)
      + fieldBox('Fornecedor', proc.fornecedor_nome || proc.person_prc)
      + fieldBox('Apropriação (Composição)', proc.composicao_nome || ((proc.composition_prc || '') + (proc.supply_prc ? ' / ' + proc.supply_prc : '')))
      + fieldBox('Tipo de Processo', proc.tipo_nome || kinds[proc.kind_prc] || proc.kind_prc)
      + fieldBox('Tipo de Documento', proc.documento_nome)
      + fieldBox('Nº Documento Fiscal', proc.fiscal_doc_prc)
      + fieldBox('Status', proc.status_nome || steps[proc.status_step_prc] || proc.status_step_prc)
      + fieldBox('Valor', money(proc.value_prc))
      + fieldBox('Emissão', fmtDate(proc.issue_date_prc))
      + fieldBox('Vencimento', fmtDate(proc.due_date_prc))
      + '</div>'
      + docHtml
      + '</div>'
      + '<div data-pane="hist" class="pane" hidden><div class="col-body">…</div></div></div>';

    o.addEventListener('click', function (e) { if (e.target === o || e.target.classList.contains('modal-x')) o.remove(); });
    o.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        o.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active') }); t.classList.add('active');
        o.querySelectorAll('.pane').forEach(function (p) { p.hidden = (p.getAttribute('data-pane') !== t.getAttribute('data-t')); });
      });
    });

    var frame = o.querySelector('.pd-doc-frame');
    o.querySelectorAll('.pd-doc-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        o.querySelectorAll('.pd-doc-tab').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        if (frame) frame.src = b.getAttribute('data-url');
      });
    });

    document.body.appendChild(o);

    try { await window.API.post('/processes/' + proc.uuid_prc + '/log', { action: 'Visualizado' }); window.Store.invalidate('history'); } catch (e) { }
    try {
      var h = await window.Store.get('history', proc.uuid_prc);
      o.querySelector('[data-pane="hist"] .col-body').innerHTML = h.length
        ? '<ul class="timeline">' + h.map(function (x) {
          return '<li><span class="tl-dot"></span><div class="tl-card"><div class="tl-act">' + esc(x.action_hst) + '</div>'
            + '<div class="tl-meta">' + esc(x.user_nome || 'Sistema') + ' · ' + esc(fmtDT(x.created_at_hst)) + '</div></div></li>';
        }).join('') + '</ul>'
        : '<div class="empty">Sem histórico.</div>';
    } catch (e) { }
  };
})();
