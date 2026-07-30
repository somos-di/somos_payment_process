async function initView_comissoes() {
  var selectElement = function (id) { return document.getElementById(id); };
  function escapeHtml(text) { return String(text == null ? '' : text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(value) { return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function formatDate(date) { return date ? String(date).split('T')[0].split('-').reverse().join('/') : '—'; }
  function formatDateTime(date) {
    if (!date) return '—';
    try { return new Date(date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (error) { return String(date); }
  }
  function toast(message, isSuccess) {
    var toastElement = document.createElement('div'); toastElement.textContent = message;
    toastElement.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10000;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (isSuccess ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(toastElement); setTimeout(function () { toastElement.remove(); }, 4000);
  }
  function overlay(html, width) {
    var overlayElement = document.createElement('div'); overlayElement.className = 'modal-overlay';
    overlayElement.innerHTML = '<div class="modal-box" style="width:' + (width || 440) + 'px;max-width:94vw">' + html + '</div>';
    document.body.appendChild(overlayElement);
    overlayElement.addEventListener('click', function (event) { if (event.target === overlayElement) overlayElement.remove(); });
    return overlayElement;
  }

  var STATUS_CLS = { 0: 'red', 1: 'blue', 2: 'violet', 3: 'warn', 4: 'ok', 5: 'red' };
  var STEPS = {};
  try { (await window.Store.get('comm_status') || []).forEach(function (item) { STEPS[item.id_csk] = item.descr_csk; }); } catch (error) { }

  var stSel = selectElement('com-status');
  stSel.innerHTML = '<option value="">Todos</option>' + Object.keys(STEPS).map(function (item) {
    return '<option value="' + escapeHtml(item) + '">' + escapeHtml(STEPS[item]) + '</option>';
  }).join('');

  var rows = [];
  async function reload() {
    selectElement('com-body').innerHTML = '<div class="empty">Carregando…</div>';
    try { rows = await window.Store.get('commissions'); render(); }
    catch (error) { window.viewError(selectElement('com-body'), error); }
  }

  function filtered() {
    var searchTerm = (selectElement('com-search').value || '').toLowerCase().trim();
    var trilha = selectElement('com-trilha').value, status = selectElement('com-status').value;
    return rows.filter(function (row) {
      if (trilha && row.trilha !== trilha) return false;
      if (status !== '' && Number(row.status_step_com) !== Number(status)) return false;
      if (searchTerm && [row.empreendimento_nome, row.seller_name_com, row.client_name_com, row.unit_com, row.id_com].join(' ').toLowerCase().indexOf(searchTerm) < 0) return false;
      return true;
    });
  }

  var currentUser = (window.Auth && window.Auth.getUser && window.Auth.getUser()) || {};
  var isAdmin = !!currentUser.is_admin, isTrack = !!(currentUser.is_commission || currentUser.is_admin), isFin = !!(currentUser.is_financeiro || currentUser.is_admin);

  function actionsFor(commission) {
    var statusStep = Number(commission.status_step_com), actions = [];
    if (isTrack && (statusStep === 1 || statusStep === 2 || statusStep === 5)) { actions.push('validate'); actions.push('cancel'); }
    if (isFin && statusStep === 3) { actions.push('finalize'); actions.push('pendency'); actions.push('cancel'); }
    return actions;
  }
  var LABEL = { validate: 'Validar e anexar NF', finalize: 'Finalizar (Financeiro)', pendency: 'Devolver p/ correção', cancel: 'Cancelar' };
  var ACTION_CSS_CLASSES = { validate: 'btn-primary', finalize: 'btn-primary', pendency: 'btn-light', cancel: 'btn-danger' };

  function render() {
    var data = filtered();
    if (!data.length) { selectElement('com-body').innerHTML = '<div class="empty">Nenhuma comissão.</div>'; return; }
    var html = '<div class="table-scroll"><table><thead><tr>'
      + '<th>#</th><th>Empreendimento</th><th>Trilha</th><th>Unidade</th><th>Vendedor</th><th>Cliente</th>'
      + '<th>Valor</th><th>Status</th><th></th></tr></thead><tbody>';
    data.forEach(function (entry, index) {
      html += '<tr data-i="' + index + '">'
        + '<td>' + escapeHtml(entry.id_com) + '</td>'
        + '<td>' + escapeHtml(entry.empreendimento_nome || '—') + '</td>'
        + '<td>' + escapeHtml(entry.trilha) + '</td>'
        + '<td>' + escapeHtml(entry.unit_com || '—') + '</td>'
        + '<td>' + escapeHtml(entry.seller_name_com || '—') + '</td>'
        + '<td>' + escapeHtml(entry.client_name_com || '—') + '</td>'
        + '<td>' + money(entry.value_com) + '</td>'
        + '<td><span class="badge ' + (STATUS_CLS[entry.status_step_com] || '') + '">' + escapeHtml(entry.status_nome) + '</span></td>'
        + '<td class="fin-acts" style="white-space:nowrap;text-align:right"></td></tr>';
    });
    html += '</tbody></table></div>';
    selectElement('com-body').innerHTML = html;

    selectElement('com-body').querySelectorAll('tr[data-i]').forEach(function (row) {
      var commission = data[+row.getAttribute('data-i')], cell = row.lastElementChild;
      row.style.cursor = 'pointer';
      row.addEventListener('click', function () { openDetail(commission); });
      actionsFor(commission).forEach(function (action) {
        var buttonElement = document.createElement('button');
        buttonElement.className = 'btn ' + (ACTION_CSS_CLASSES[action] || 'btn-light'); buttonElement.style.marginLeft = '6px';
        buttonElement.textContent = (action === 'validate' && Number(commission.status_step_com) === 5) ? 'Corrigir e reenviar' : LABEL[action];
        buttonElement.addEventListener('click', function (event) { event.stopPropagation(); runAction(commission, action); });
        cell.appendChild(buttonElement);
      });
    });
  }

  function post(uuid, action, body) { return window.API.post('/commissions/' + uuid + '/' + action, body || {}); }
  async function done() { window.Store.invalidate('commissions'); window.Store.invalidate('comm_history'); await reload(); }

  function runAction(commission, action) {
    if (action === 'validate') return openNfModal(commission);
    if (action === 'finalize') return confirmThen('FINALIZAR esta comissão? Encerra o processo (sem integração).', function () { return post(commission.uuid_com, 'finalize'); });
    if (action === 'pendency') return promptThen('Devolver para correção? Volta para a trilha (SOMOS/PARTINI).', function (note) { return post(commission.uuid_com, 'pendency', { note: note }); });
    if (action === 'cancel') return promptThen('Cancelar esta comissão? Esta ação é irreversível.', function (note) { return post(commission.uuid_com, 'cancel', { note: note }); }, true, true);
  }

  async function confirmThen(message, onConfirm) {
    var overlayElement = overlay('<div class="modal-title">Confirmação</div><div style="font-size:14px;color:var(--text-2);line-height:1.5">' + escapeHtml(message) + '</div>'
      + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button><button class="btn btn-primary" data-ok>Confirmar</button></div>');
    overlayElement.querySelector('[data-x]').addEventListener('click', function () { overlayElement.remove(); });
    overlayElement.querySelector('[data-ok]').addEventListener('click', async function () {
      overlayElement.remove();
      try { await onConfirm(); toast('Feito.', true); await done(); } catch (error) { toast('Erro: ' + error.message); }
    });
  }
  async function promptThen(message, onConfirm, danger, requireNote) {
    var overlayElement = overlay('<div class="modal-title">' + escapeHtml(message) + '</div>'
      + '<textarea data-note rows="3" maxlength="500" placeholder="Motivo ' + (requireNote ? '(obrigatório)' : '(opcional)') + '…" style="margin-top:10px"></textarea>'
      + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok>Confirmar</button></div>');
    overlayElement.querySelector('[data-x]').addEventListener('click', function () { overlayElement.remove(); });
    overlayElement.querySelector('[data-ok]').addEventListener('click', async function () {
      var note = overlayElement.querySelector('[data-note]').value.trim();
      if (requireNote && !note) { toast('Informe o motivo.'); return; }
      overlayElement.remove();
      try { await onConfirm(note); toast('Feito.', true); await done(); } catch (error) { toast('Erro: ' + error.message); }
    });
  }

  function openNfModal(commission) {
    var nfUrl = commission.nf_url_com || null, boletoUrl = commission.boleto_url_com || null;
    var o = overlay('<div class="modal-title">Validar e anexar Nota Fiscal</div>'
      + '<div class="com-modal-grid" style="margin-top:8px">'
      + '<div><b style="font-size:13px">Nota Fiscal (obrigatória)</b>'
      + '<label class="com-dz" for="com-nf"><b>Clique para enviar</b><small>PDF/imagem</small></label>'
      + '<input id="com-nf" type="file" hidden><div class="com-file" id="com-nf-name">' + (nfUrl ? 'NF já anexada' : '') + '</div></div>'
      + '<div><b style="font-size:13px">Boleto (opcional)</b>'
      + '<label class="com-dz" for="com-bol"><b>Clique para enviar</b><small>PDF/imagem</small></label>'
      + '<input id="com-bol" type="file" hidden><div class="com-file" id="com-bol-name">' + (boletoUrl ? 'Boleto já anexado' : '') + '</div></div>'
      + '</div>'
      + '<div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px">'
      + '<div><label style="font-size:12.5px;color:var(--muted);display:block;margin-bottom:4px">E-mail do Vendedor</label>'
      + '<input id="com-email" maxlength="200" placeholder="Opcional" value="' + escapeHtml(commission.seller_email_com || '') + '"></div>'
      + '<div><label style="font-size:12.5px;color:var(--muted);display:block;margin-bottom:4px">Celular do Vendedor</label>'
      + '<input id="com-phone" maxlength="50" placeholder="Opcional" value="' + escapeHtml(commission.seller_phone_com || '') + '"></div>'
      + '</div>'
      + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button><button class="btn btn-primary" data-ok>Salvar e avançar</button></div>', 520);
    function bindUploadField(inputId, nameId, set) {
      o.querySelector('#' + inputId).addEventListener('change', async function () {
        if (!this.files[0]) return;
        o.querySelector('#' + nameId).textContent = 'Enviando…';
        try { var uploadResult = await window.SB.upload(this.files[0]); set(uploadResult ? uploadResult.url : null); o.querySelector('#' + nameId).textContent = this.files[0].name; }
        catch (error) { o.querySelector('#' + nameId).textContent = ''; toast('Falha no anexo: ' + (error.message || 'storage')); }
      });
    }
    bindUploadField('com-nf', 'com-nf-name', function (uploadedUrl) { nfUrl = uploadedUrl; });
    bindUploadField('com-bol', 'com-bol-name', function (uploadedUrl) { boletoUrl = uploadedUrl; });
    o.querySelector('[data-x]').addEventListener('click', function () { o.remove(); });
    o.querySelector('[data-ok]').addEventListener('click', async function () {
      if (!nfUrl) { toast('Anexe a Nota Fiscal para validar.'); return; }
      var email = (o.querySelector('#com-email').value || '').trim();
      var phone = (o.querySelector('#com-phone').value || '').trim();
      o.remove();
      try {
        await post(commission.uuid_com, 'validate', { nf_url: nfUrl, boleto_url: boletoUrl, seller_email: email || null, seller_phone: phone || null });
        toast('Validado e enviado ao Financeiro.', true); await done();
      } catch (error) { toast('Erro: ' + error.message); }
    });
  }

  async function openDetail(c) {
    function fieldBox(label, value) {
      var displayValue = (value === null || value === undefined || value === '') ? '—' : value;
      return '<div class="pd-field"><label>' + escapeHtml(label) + '</label><div class="pd-field-box">' + escapeHtml(displayValue) + '</div></div>';
    }
    var nfAttachmentUrl = c.nf_url_com, boletoAttachmentUrl = c.boleto_url_com, firstUrl = nfAttachmentUrl || boletoAttachmentUrl;
    var docHtml = '';
    if (firstUrl) {
      docHtml = '<div class="pd-doc"><div class="pd-doc-head"><div class="pd-doc-tabs">'
        + (nfAttachmentUrl ? '<button class="pd-doc-tab active" data-url="' + escapeHtml(nfAttachmentUrl) + '">Nota Fiscal</button>' : '')
        + (boletoAttachmentUrl ? '<button class="pd-doc-tab' + (nfAttachmentUrl ? '' : ' active') + '" data-url="' + escapeHtml(boletoAttachmentUrl) + '">Boleto</button>' : '')
        + '</div><div class="pd-doc-actions">'
        + (nfAttachmentUrl ? '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + escapeHtml(nfAttachmentUrl) + '">Nota Fiscal</a>' : '')
        + (boletoAttachmentUrl ? '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + escapeHtml(boletoAttachmentUrl) + '">Boleto</a>' : '')
        + '</div></div><iframe class="pd-doc-frame" src="' + escapeHtml(firstUrl) + '" title="Documento"></iframe></div>';
    }
    var o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = '<div class="modal-box xl' + (firstUrl ? '' : ' no-doc') + '"><button class="modal-x" aria-label="Fechar">×</button>'
      + '<div class="tabs"><button class="tab active" data-t="dados">Detalhes</button><button class="tab" data-t="hist">Histórico</button></div>'
      + '<div data-pane="dados" class="pane pd-detail">'
      + '<div class="pd-fields"><h3>Comissão #' + escapeHtml(c.id_com) + ' — ' + escapeHtml(c.status_nome) + '</h3>'
      + fieldBox('Empreendimento', c.empreendimento_nome)
      + fieldBox('Empresa', c.empresa_nome || c.company_com)
      + fieldBox('Obra', c.building_com)
      + fieldBox('Trilha', c.trilha)
      + fieldBox('Unidade', c.unit_com)
      + fieldBox('Nº da Venda', c.sale_num_com)
      + fieldBox('Data da Venda', c.sale_date_com ? formatDate(c.sale_date_com) : '')
      + fieldBox('Data de Liberação', c.release_date_com ? formatDate(c.release_date_com) : '')
      + fieldBox('Cliente', c.client_name_com)
      + fieldBox('Vendedor', c.seller_name_com)
      + fieldBox('Código do Vendedor', c.seller_id_com)
      + fieldBox('E-mail', c.seller_email_com)
      + fieldBox('Celular', c.seller_phone_com)
      + fieldBox('Valor', money(c.value_com))
      + fieldBox('Observação', c.note_com)
      + '</div>' + docHtml + '</div>'
      + '<div data-pane="hist" class="pane" hidden><div class="col-body">…</div></div></div>';
    o.addEventListener('click', function (event) { if (event.target === o || event.target.classList.contains('modal-x')) o.remove(); });
    o.querySelectorAll('.tab').forEach(function (tabButton) {
      tabButton.addEventListener('click', function () {
        o.querySelectorAll('.tab').forEach(function (otherTab) { otherTab.classList.remove('active'); }); tabButton.classList.add('active');
        o.querySelectorAll('.pane').forEach(function (pane) { pane.hidden = (pane.getAttribute('data-pane') !== tabButton.getAttribute('data-t')); });
      });
    });
    var frame = o.querySelector('.pd-doc-frame');
    o.querySelectorAll('.pd-doc-tab').forEach(function (documentTab) {
      documentTab.addEventListener('click', function () {
        o.querySelectorAll('.pd-doc-tab').forEach(function (otherDocumentTab) { otherDocumentTab.classList.remove('active'); });
        documentTab.classList.add('active'); if (frame) frame.src = documentTab.getAttribute('data-url');
      });
    });
    document.body.appendChild(o);
    try {
      var hist = await window.Store.get('comm_history', c.uuid_com);
      o.querySelector('[data-pane="hist"] .col-body').innerHTML = (hist && hist.length)
        ? '<ul class="timeline">' + hist.map(function (histItem) {
          return '<li><span class="tl-dot"></span><div class="tl-card"><div class="tl-act">' + escapeHtml(histItem.action_chs) + '</div>'
            + '<div class="tl-meta">' + escapeHtml(histItem.user_nome || 'Sistema') + ' · ' + escapeHtml(formatDateTime(histItem.created_at_chs)) + '</div></div></li>';
        }).join('') + '</ul>'
        : '<div class="empty">Sem histórico.</div>';
    } catch (error) { o.querySelector('[data-pane="hist"] .col-body').innerHTML = '<div class="empty">Falha ao carregar histórico.</div>'; }
  }

  ['com-search', 'com-trilha', 'com-status'].forEach(function (item) { selectElement(item).addEventListener('input', render); selectElement(item).addEventListener('change', render); });
  selectElement('com-refresh').addEventListener('click', done);
  selectElement('com-clear').addEventListener('click', function () { selectElement('com-search').value = ''; selectElement('com-trilha').value = ''; selectElement('com-status').value = ''; render(); });

  await reload();
}
