(function () {
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(value) { return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function formatDate(d) { return d ? String(d).split('T')[0].split('-').reverse().join('/') : '-'; }
  function fmtDT(d) {
    if (!d) return '';
    var date = new Date(d);
    if (isNaN(date)) { var s = String(d).replace('T', ' '); return s.slice(0, 10).split('-').reverse().join('/') + ' ' + s.slice(11, 16); }
    return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function fieldBox(label, value) {
    var displayValue = (value === null || value === undefined || value === '') ? '-' : value;
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
        + '<a class="pd-doc-open" href="' + escapeHtml(firstUrl) + '" target="_blank" rel="noopener">Abrir ↗</a>'
        + '</div>'
        + '<iframe class="pd-doc-frame" src="' + escapeHtml(firstUrl) + '" title="Documento"></iframe>'
        + '</div>';
    }

    o.innerHTML =
      '<div class="modal-box xl' + (firstUrl ? '' : ' no-doc') + '"><button class="modal-x" aria-label="Fechar">×</button>'
      + '<div class="pd-detail">'
      + '<div class="pd-fields"><h3>Dados Gerais <span style="color:var(--muted);font-weight:600">#' + escapeHtml(process.id_prc) + '</span></h3>'
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
      + '<div class="pd-hist">'
      + '<div class="pd-hist-head"><h3>Histórico</h3>'
      + '<button type="button" class="pd-hist-toggle" aria-label="Recolher histórico">›</button></div>'
      + '<div class="pd-hist-body col-body">…</div>'
      + '<div class="pd-hist-comment" style="display:flex;gap:8px;padding:10px;border-top:1px solid var(--border)">'
      + '<textarea class="pd-comment-input" rows="2" maxlength="2000" placeholder="Escreva um comentário… (Ctrl+Enter para enviar)" style="flex:1;resize:vertical;min-height:38px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font:inherit"></textarea>'
      + '<button type="button" class="btn btn-primary pd-comment-send" style="align-self:flex-end">Comentar</button>'
      + '</div>'
      + '</div>'
      + '</div></div>';

    o.addEventListener('click', function (event) { if (event.target === o || event.target.classList.contains('modal-x')) o.remove(); });
    var modalBox = o.querySelector('.modal-box');
    var histToggle = o.querySelector('.pd-hist-toggle');
    if (histToggle) histToggle.addEventListener('click', function () {
      var collapsed = modalBox.classList.toggle('hist-collapsed');
      histToggle.textContent = collapsed ? '‹' : '›';
      histToggle.setAttribute('aria-label', collapsed ? 'Expandir histórico' : 'Recolher histórico');
    });

    var frame = o.querySelector('.pd-doc-frame');
    var openLink = o.querySelector('.pd-doc-open');
    o.querySelectorAll('.pd-doc-tab').forEach(function (documentTab) {
      documentTab.addEventListener('click', function () {
        o.querySelectorAll('.pd-doc-tab').forEach(function (otherDocumentTab) { otherDocumentTab.classList.remove('active'); });
        documentTab.classList.add('active');
        var url = documentTab.getAttribute('data-url');
        if (frame) frame.src = url;
        if (openLink) openLink.setAttribute('href', url);
      });
    });

    document.body.appendChild(o);

    async function renderHistory() {
      try {
        var historyEntries = await window.Store.get('history', process.uuid_prc);
        o.querySelector('.pd-hist-body').innerHTML = historyEntries.length
          ? '<ul class="timeline">' + historyEntries.map(function (historyEntry) {
            var kindColor = /^#[0-9a-fA-F]{3,8}$/.test(historyEntry.kind_color || '') ? historyEntry.kind_color : '';
            var kindStyle = kindColor ? ' style="--kind:' + kindColor + '"' : '';
            return '<li' + kindStyle + '><span class="tl-dot"></span><div class="tl-card"><div class="tl-act">' + escapeHtml(historyEntry.action_hst) + '</div>'
              + '<div class="tl-meta">' + escapeHtml(historyEntry.user_nome || 'Sistema') + ' · ' + escapeHtml(fmtDT(historyEntry.created_at_hst)) + '</div></div></li>';
          }).join('') + '</ul>'
          : '<div class="empty">Sem histórico.</div>';
      } catch (error) { }
    }

    var commentInput = o.querySelector('.pd-comment-input');
    var commentSend = o.querySelector('.pd-comment-send');
    async function submitComment() {
      var text = (commentInput.value || '').trim();
      if (!text) return;
      commentSend.disabled = true; commentInput.disabled = true;
      try {
        await window.API.post('/processes/' + process.uuid_prc + '/comment', { text: text });
        commentInput.value = '';
        window.Store.invalidate('history');
        await renderHistory();
        var body = o.querySelector('.pd-hist-body'); if (body) body.scrollTop = 0;
      } catch (error) {
        commentInput.title = (error && error.message) || 'Erro ao comentar';
        commentInput.style.borderColor = 'var(--danger, #ef4444)';
      } finally {
        commentSend.disabled = false; commentInput.disabled = false; commentInput.focus();
      }
    }
    if (commentSend) commentSend.addEventListener('click', submitComment);
    if (commentInput) {
      commentInput.addEventListener('input', function () { commentInput.style.borderColor = ''; });
      commentInput.addEventListener('keydown', function (event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); submitComment(); }
      });
    }

    try { window.Store.invalidate('history'); } catch (error) { }
    await renderHistory();
  };
})();
