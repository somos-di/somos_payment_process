(function () {
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(value) { return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function formatDate(d) { return d ? String(d).split('T')[0].split('-').reverse().join('/') : '—'; }
  function fmtDT(d) {
    if (!d) return '';
    var date = new Date(d);
    if (isNaN(date)) { var s = String(d).replace('T', ' '); return s.slice(0, 10).split('-').reverse().join('/') + ' ' + s.slice(11, 16); }
    return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function fieldBox(label, value) {
    var displayValue = (value === null || value === undefined || value === '') ? '—' : value;
    return '<div class="pd-field"><label>' + escapeHtml(label) + '</label><div class="pd-field-box">' + escapeHtml(displayValue) + '</div></div>';
  }

  window.openProcessDetail = async function (process) {
    var o = document.createElement('div'); o.className = 'modal-overlay';
    var steps = (window.CONFIG.STEPS || {}), kinds = (window.CONFIG.PROCESS_KINDS || {});
    var fiscalDocUrl = process.attachment_url2_prc, boletoUrl = process.attachment_url_prc;
    var firstUrl = fiscalDocUrl || boletoUrl;

    var docHtml = '';
    if (firstUrl) {
      docHtml = '<div class="pd-doc">'
        + '<div class="pd-doc-head">'
        + '<div class="pd-doc-tabs">'
        + (fiscalDocUrl ? '<button class="pd-doc-tab active" data-url="' + escapeHtml(fiscalDocUrl) + '">Nota Fiscal</button>' : '')
        + (boletoUrl ? '<button class="pd-doc-tab' + (fiscalDocUrl ? '' : ' active') + '" data-url="' + escapeHtml(boletoUrl) + '">Boleto</button>' : '')
        + '</div>'
        + '<div class="pd-doc-actions">'
        + (fiscalDocUrl ? '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + escapeHtml(fiscalDocUrl) + '">Nota Fiscal</a>' : '')
        + (boletoUrl ? '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + escapeHtml(boletoUrl) + '">Boleto</a>' : '')
        + '</div></div>'
        + '<iframe class="pd-doc-frame" src="' + escapeHtml(firstUrl) + '" title="Documento"></iframe>'
        + '</div>';
    }

    o.innerHTML =
      '<div class="modal-box xl' + (firstUrl ? '' : ' no-doc') + '"><button class="modal-x" aria-label="Fechar">×</button>'
      + '<div class="tabs"><button class="tab active" data-t="dados">Detalhes</button><button class="tab" data-t="hist">Histórico</button></div>'
      + '<div data-pane="dados" class="pane pd-detail">'
      + '<div class="pd-fields"><h3>Dados Gerais</h3>'
      + fieldBox('Descrição', process.description_prc)
      + fieldBox('Empresa', process.empresa_nome || process.company_prc)
      + fieldBox('Obra', process.obra_nome || process.building_prc)
      + fieldBox('Fornecedor', process.fornecedor_nome || process.person_prc)
      + fieldBox('Apropriação (Composição)', process.composicao_nome || ((process.composition_prc || '') + (process.supply_prc ? ' / ' + process.supply_prc : '')))
      + fieldBox('Tipo de Processo', process.tipo_nome || kinds[process.kind_prc] || process.kind_prc)
      + fieldBox('Tipo de Documento', process.documento_nome)
      + fieldBox('Nº Documento Fiscal', process.fiscal_doc_prc)
      + fieldBox('Status', process.status_nome || steps[process.status_step_prc] || process.status_step_prc)
      + fieldBox('Valor', money(process.value_prc))
      + fieldBox('Emissão', formatDate(process.issue_date_prc))
      + fieldBox('Vencimento', formatDate(process.due_date_prc))
      + '</div>'
      + docHtml
      + '</div>'
      + '<div data-pane="hist" class="pane" hidden><div class="col-body">…</div></div></div>';

    o.addEventListener('click', function (event) { if (event.target === o || event.target.classList.contains('modal-x')) o.remove(); });
    o.querySelectorAll('.tab').forEach(function (tabButton) {
      tabButton.addEventListener('click', function () {
        o.querySelectorAll('.tab').forEach(function (otherTab) { otherTab.classList.remove('active') }); tabButton.classList.add('active');
        o.querySelectorAll('.pane').forEach(function (pane) { pane.hidden = (pane.getAttribute('data-pane') !== tabButton.getAttribute('data-t')); });
      });
    });

    var frame = o.querySelector('.pd-doc-frame');
    o.querySelectorAll('.pd-doc-tab').forEach(function (documentTab) {
      documentTab.addEventListener('click', function () {
        o.querySelectorAll('.pd-doc-tab').forEach(function (otherDocumentTab) { otherDocumentTab.classList.remove('active'); });
        documentTab.classList.add('active');
        if (frame) frame.src = documentTab.getAttribute('data-url');
      });
    });

    document.body.appendChild(o);

    try { await window.API.post('/processes/' + process.uuid_prc + '/log', { action: 'Visualizado' }); window.Store.invalidate('history'); } catch (error) { }
    try {
      var h = await window.Store.get('history', process.uuid_prc);
      o.querySelector('[data-pane="hist"] .col-body').innerHTML = h.length
        ? '<ul class="timeline">' + h.map(function (hItem) {
          return '<li><span class="tl-dot"></span><div class="tl-card"><div class="tl-act">' + escapeHtml(hItem.action_hst) + '</div>'
            + '<div class="tl-meta">' + escapeHtml(hItem.user_nome || 'Sistema') + ' · ' + escapeHtml(fmtDT(hItem.created_at_hst)) + '</div></div></li>';
        }).join('') + '</ul>'
        : '<div class="empty">Sem histórico.</div>';
    } catch (error) { }
  };
})();
