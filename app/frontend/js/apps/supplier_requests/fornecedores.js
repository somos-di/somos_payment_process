async function initView_fornecedores() {
  var selectElement = function (id) { return document.getElementById(id); };
  function escapeHtml(text) { return String(text == null ? '' : text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function formatDateTime(date) {
    if (!date) return '-';
    try { return new Date(date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (error) { return String(date); }
  }
  function formatDoc(kind, doc) {
    var d = String(doc || '').replace(/\D/g, '');
    if (kind === 'pf' || d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  function toast(message, isSuccess) {
    var t = document.createElement('div'); t.textContent = message;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10000;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (isSuccess ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4000);
  }
  function overlay(html, width) {
    var o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = '<div class="modal-box" style="width:' + (width || 440) + 'px;max-width:94vw">' + html + '</div>';
    document.body.appendChild(o);
    o.addEventListener('click', function (event) { if (event.target === o) o.remove(); });
    return o;
  }
  function askConfirm(message, danger) {
    return new Promise(function (resolve) {
      var o = overlay('<div class="modal-title">Confirmação</div><div style="font-size:14px;color:var(--text-2);line-height:1.5">' + escapeHtml(message) + '</div>'
        + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok>Confirmar</button></div>');
      o.querySelector('[data-x]').addEventListener('click', function () { o.remove(); resolve(false); });
      o.querySelector('[data-ok]').addEventListener('click', function () { o.remove(); resolve(true); });
    });
  }

  var STATUS_CLS = { 0: 'red', 1: 'blue', 2: 'ok', 3: 'warn', 4: 'red' };
  var STEPS = {};
  try { (await window.Store.get('supplier_status') || []).forEach(function (item) { STEPS[item.id_sst] = item.descr_sst; }); } catch (error) { }
  selectElement('sup-status').innerHTML = '<option value="">Todos</option>' + Object.keys(STEPS).map(function (item) {
    return '<option value="' + escapeHtml(item) + '">' + escapeHtml(STEPS[item]) + '</option>';
  }).join('');

  var currentUser = (window.Auth && window.Auth.getUser && window.Auth.getUser()) || {};
  var isReq = !!(currentUser.is_supplier_requester || currentUser.is_admin);
  var isSender = !!(currentUser.is_supplier_sender || currentUser.is_admin);
  var isAdmin = !!currentUser.is_admin;
  if (isReq) selectElement('sup-new').style.display = '';

  var rows = [];
  var supPage = 0;

  async function reload() {
    selectElement('sup-body').innerHTML = '<div class="empty">Carregando…</div>';
    try { rows = await window.Store.get('supplier_requests'); render(); }
    catch (error) { window.viewError(selectElement('sup-body'), error); }
  }
  async function done() { window.Store.invalidate('supplier_requests'); window.Store.invalidate('supplier_history'); await reload(); }

  function filtered() {
    var searchTerm = (selectElement('sup-search').value || '').toLowerCase().trim();
    var status = selectElement('sup-status').value, kind = selectElement('sup-kind').value;
    return rows.filter(function (row) {
      if (status !== '' && Number(row.status_step_sup) !== Number(status)) return false;
      if (kind && row.kind_sup !== kind) return false;
      if (searchTerm && [row.name_sup, row.fantasy_sup, row.document_sup, row.erp_key_sup, row.author_nome, row.id_sup].join(' ').toLowerCase().indexOf(searchTerm) < 0) return false;
      return true;
    });
  }

  function canCancel(req) { return req.author_sup === currentUser.id || isAdmin; }
  function actionsFor(req) {
    var st = Number(req.status_step_sup), acts = [];
    if (st === 1 || st === 4) { if (isSender) { acts.push('send'); acts.push('reject'); } if (canCancel(req)) acts.push('cancel'); }
    else if (st === 3) { if (req.author_sup === currentUser.id || isReq) acts.push('resubmit'); if (canCancel(req)) acts.push('cancel'); }
    return acts;
  }
  var LABEL = { send: 'Enviar ao UAU', reject: 'Devolver p/ correção', cancel: 'Cancelar', resubmit: 'Reenviar' };
  var ACT_CSS = { send: 'btn-primary', reject: 'btn-light', cancel: 'btn-danger', resubmit: 'btn-primary' };

  var COLS = [
    { col: 'id_sup', label: '#', width: 60 },
    { col: 'kind_sup', label: 'Tipo', width: 64, render: function (e) { return e.kind_sup === 'pf' ? 'PF' : 'PJ'; } },
    { col: 'document_sup', label: 'Documento', width: 160, render: function (e) { return escapeHtml(formatDoc(e.kind_sup, e.document_sup)); } },
    { col: 'name_sup', label: 'Nome / Razão Social', width: 220 },
    { col: 'erp_key_sup', label: 'Nº UAU', width: 100, render: function (e) { return escapeHtml(e.erp_key_sup || '-'); } },
    { col: 'status_nome', label: 'Status', width: 130, render: function (e) { return '<span class="badge ' + (STATUS_CLS[e.status_step_sup] || '') + '">' + escapeHtml(e.status_nome) + '</span>'; } },
    { col: 'author_nome', label: 'Solicitante', width: 150 },
    { col: 'created_at_sup', label: 'Criado', width: 140, render: function (e) { return escapeHtml(formatDateTime(e.created_at_sup)); } },
  ];
  var supCols = window.ColumnTools.create({ storageKey: 'fornecedores', columns: COLS, onChange: render });
  var actionsBar = selectElement('sup-refresh').parentElement;
  if (actionsBar) { actionsBar.insertAdjacentHTML('afterbegin', supCols.menuButton()); supCols.wireMenu(actionsBar); }

  function render() {
    var full = filtered();
    if (!full.length) { selectElement('sup-body').innerHTML = '<div class="empty">Nenhuma solicitação.</div>'; return; }
    var cp = window.ClientPager(full.length, supPage, 50); supPage = cp.page;
    var data = cp.slice(full);
    var html = '<div class="table-scroll"><table class="ct-fixed" style="width:' + supCols.tableWidth([], [320]) + 'px"><colgroup>'
      + supCols.colgroup([], [320]) + '</colgroup><thead><tr>' + supCols.head() + '<th class="ct-keep"></th></tr></thead><tbody>';
    data.forEach(function (entry, index) {
      html += '<tr data-i="' + index + '">' + supCols.cells(entry)
        + '<td class="fin-acts ct-keep" style="white-space:nowrap;text-align:right"></td></tr>';
    });
    html += '</tbody></table></div>' + cp.html();
    selectElement('sup-body').innerHTML = html;
    cp.wire(selectElement('sup-body'), function (p) { supPage = p; render(); });
    supCols.wireResize(selectElement('sup-body').querySelector('table.ct-fixed'), 0);

    selectElement('sup-body').querySelectorAll('tr[data-i]').forEach(function (row) {
      var req = data[+row.getAttribute('data-i')], cell = row.lastElementChild;
      row.style.cursor = 'pointer';
      row.addEventListener('click', function () { openDetail(req); });
      actionsFor(req).forEach(function (action) {
        var b = document.createElement('button');
        b.className = 'btn ' + (ACT_CSS[action] || 'btn-light'); b.style.marginLeft = '6px';
        b.textContent = LABEL[action];
        b.addEventListener('click', function (event) { event.stopPropagation(); runAction(req, action); });
        cell.appendChild(b);
      });
    });
    supCols.autofitTrail(selectElement('sup-body').querySelector('table.ct-fixed'), '.fin-acts');
  }

  function post(uuid, action, body) { return window.API.post('/supplier-requests/' + uuid + '/' + action, body || {}); }

  function runAction(req, action) {
    if (action === 'send') return doSend(req);
    if (action === 'reject') return promptThen('Devolver para correção? Volta para o solicitante.', function (note) { return post(req.uuid_sup, 'reject', { note: note }); }, false, true);
    if (action === 'cancel') return promptThen('Cancelar esta solicitação? Ação irreversível.', function (note) { return post(req.uuid_sup, 'cancel', { note: note }); }, true, true);
    if (action === 'resubmit') return confirmThen('Reenviar para o responsável enviar ao UAU?', function () { return post(req.uuid_sup, 'resubmit', {}); });
  }

  async function confirmThen(message, onConfirm) {
    if (!(await askConfirm(message))) return;
    try { await onConfirm(); toast('Feito.', true); await done(); } catch (error) { toast('Erro: ' + error.message); }
  }
  function promptThen(message, onConfirm, danger, requireNote) {
    var o = overlay('<div class="modal-title">' + escapeHtml(message) + '</div>'
      + '<textarea data-note rows="3" maxlength="500" placeholder="Motivo ' + (requireNote ? '(obrigatório)' : '(opcional)') + '…" style="margin-top:10px"></textarea>'
      + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok>Confirmar</button></div>');
    o.querySelector('[data-x]').addEventListener('click', function () { o.remove(); });
    o.querySelector('[data-ok]').addEventListener('click', async function () {
      var note = o.querySelector('[data-note]').value.trim();
      if (requireNote && !note) { toast('Informe o motivo.'); return; }
      o.remove();
      try { await onConfirm(note); toast('Feito.', true); await done(); } catch (error) { toast('Erro: ' + error.message); }
    });
  }

  function doSend(req) {
    var o = overlay('<div class="modal-title">Enviar ao UAU</div>'
      + '<div style="font-size:14px;color:var(--text-2);line-height:1.5">Enviar <b>' + escapeHtml(req.name_sup || '') + '</b> ao UAU agora?</div>'
      + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button><button class="btn btn-primary" data-ok>Enviar</button></div>');
    o.querySelector('[data-x]').addEventListener('click', function () { o.remove(); });
    o.querySelector('[data-ok]').addEventListener('click', async function () {
      o.querySelector('.modal-box').innerHTML = '<div class="modal-title">Enviando ao UAU…</div><div style="font-size:14px;color:var(--text-2)">Aguarde, pode levar alguns segundos.</div>';
      try {
        var data = await window.API.post('/supplier-requests/' + req.uuid_sup + '/send', {});
        o.remove();
        toast('Enviado ao UAU' + (data && data.erp_key ? ' (chave ' + data.erp_key + ')' : '') + '.', true);
      } catch (error) { o.remove(); toast('Erro: ' + error.message); }
      await done();
    });
  }

  function openDetail(c) {
    var payload = c.payload_sup || {};
    function fieldBox(label, value) {
      var displayValue = (value === null || value === undefined || value === '') ? '-' : value;
      return '<div class="pd-field"><label>' + escapeHtml(label) + '</label><div class="pd-field-box">' + escapeHtml(displayValue) + '</div></div>';
    }
    var isPj = c.kind_sup !== 'pf';
    var o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = '<div class="modal-box xl no-doc"><button class="modal-x" aria-label="Fechar">×</button>'
      + '<div class="pd-detail">'
      + '<div class="pd-fields"><h3>Fornecedor #' + escapeHtml(c.id_sup) + ' - ' + escapeHtml(c.status_nome) + '</h3>'
      + fieldBox('Tipo', isPj ? 'Pessoa Jurídica (PJ)' : 'Pessoa Física (PF)')
      + fieldBox(isPj ? 'CNPJ' : 'CPF', formatDoc(c.kind_sup, c.document_sup))
      + fieldBox('Nome / Razão Social', c.name_sup)
      + (isPj ? fieldBox('Nome Fantasia', c.fantasy_sup) : '')
      + (isPj ? fieldBox('Inscrição Estadual', payload.inscricao_estadual) : '')
      + (isPj ? fieldBox('CNAE principal', payload.atividade_principal) : '')
      + fieldBox('E-mail', payload.email)
      + fieldBox('Telefone', payload.telefone)
      + fieldBox('Logradouro', payload.logradouro)
      + fieldBox('Número', payload.numero)
      + fieldBox('Complemento', payload.complemento)
      + fieldBox('Bairro', payload.bairro)
      + fieldBox('Município', payload.municipio)
      + fieldBox('UF', payload.uf)
      + fieldBox('CEP', payload.cep)
      + fieldBox('Nº no UAU', c.erp_key_sup)
      + fieldBox('Motivo', c.reason_sup)
      + fieldBox('Solicitante', c.author_nome)
      + fieldBox('Enviado por', c.sent_by_nome)
      + '</div>'
      + '<div class="pd-hist">'
      + '<div class="pd-hist-head"><h3>Histórico</h3>'
      + '<button type="button" class="pd-hist-toggle" aria-label="Recolher histórico">›</button></div>'
      + '<div class="pd-hist-body col-body">…</div>'
      + '<div class="pd-hist-comment">'
      + '<textarea class="pd-comment-input" rows="3" maxlength="2000" placeholder="Escreva um comentário… (Ctrl+Enter para enviar)"></textarea>'
      + '<button type="button" class="btn btn-primary pd-comment-send">Comentar</button>'
      + '</div>'
      + '</div>'
      + '</div></div>';
    o.addEventListener('click', function (event) { if (event.target === o || event.target.classList.contains('modal-x')) o.remove(); });
    var modalBox = o.querySelector('.modal-box');
    var histToggle = o.querySelector('.pd-hist-toggle');
    if (histToggle) histToggle.addEventListener('click', function () {
      var collapsed = modalBox.classList.toggle('hist-collapsed');
      histToggle.textContent = collapsed ? '‹' : '›';
    });
    document.body.appendChild(o);

    async function renderHistory() {
      try {
        var hist = await window.Store.get('supplier_history', c.uuid_sup);
        o.querySelector('.pd-hist-body').innerHTML = (hist && hist.length)
          ? '<ul class="timeline">' + hist.map(function (h) {
            var kindColor = /^#[0-9a-fA-F]{3,8}$/.test(h.kind_color || '') ? h.kind_color : '';
            var kindStyle = kindColor ? ' style="--kind:' + kindColor + '"' : '';
            return '<li' + kindStyle + '><span class="tl-dot"></span><div class="tl-card"><div class="tl-act">' + escapeHtml(h.action_shs) + '</div>'
              + '<div class="tl-meta">' + escapeHtml(h.user_nome || 'Sistema') + ' · ' + escapeHtml(formatDateTime(h.created_at_shs)) + '</div></div></li>';
          }).join('') + '</ul>'
          : '<div class="empty">Sem histórico.</div>';
      } catch (error) { o.querySelector('.pd-hist-body').innerHTML = '<div class="empty">Falha ao carregar histórico.</div>'; }
    }
    var commentInput = o.querySelector('.pd-comment-input');
    var commentSend = o.querySelector('.pd-comment-send');
    async function submitComment() {
      var text = (commentInput.value || '').trim(); if (!text) return;
      commentSend.disabled = true; commentInput.disabled = true;
      try {
        await window.API.post('/supplier-requests/' + c.uuid_sup + '/comment', { text: text });
        commentInput.value = ''; window.Store.invalidate('supplier_history'); await renderHistory();
        var body = o.querySelector('.pd-hist-body'); if (body) body.scrollTop = 0;
      } catch (error) { commentInput.title = (error && error.message) || 'Erro ao comentar'; commentInput.style.borderColor = 'var(--danger, #ef4444)'; }
      finally { commentSend.disabled = false; commentInput.disabled = false; commentInput.focus(); }
    }
    if (commentSend) commentSend.addEventListener('click', submitComment);
    if (commentInput) commentInput.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); submitComment(); }
    });
    renderHistory();
  }

  var ADDR_FIELDS = ['email', 'telefone', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'municipio', 'uf'];
  function fieldInput(id, label, cls) {
    return '<div class="sup-field ' + (cls || '') + '"><label>' + escapeHtml(label) + '</label><input id="f-' + id + '" maxlength="200" autocomplete="off"></div>';
  }
  function addressGrid() {
    return fieldInput('email', 'E-mail') + fieldInput('telefone', 'Telefone')
      + fieldInput('cep', 'CEP') + fieldInput('logradouro', 'Logradouro')
      + fieldInput('numero', 'Número') + fieldInput('complemento', 'Complemento')
      + fieldInput('bairro', 'Bairro') + fieldInput('municipio', 'Município') + fieldInput('uf', 'UF');
  }
  function formFieldsHtml(kind) {
    if (kind === 'pf') {
      return '<div class="sup-form-grid">' + fieldInput('cpf', 'CPF *') + fieldInput('nome', 'Nome completo *') + addressGrid() + '</div>';
    }
    return '<div class="sup-row-inline">' + fieldInput('cnpj', 'CNPJ *')
      + '<button type="button" class="btn btn-light" id="f-lookup" style="white-space:nowrap">Buscar na Receita</button></div>'
      + '<div class="sup-form-grid" style="margin-top:10px">'
      + fieldInput('razao_social', 'Razão Social *', 'full') + fieldInput('nome', 'Nome Fantasia')
      + fieldInput('inscricao_estadual', 'Inscrição Estadual') + fieldInput('atividade_principal', 'CNAE principal')
      + addressGrid() + '</div>';
  }

  function openNewForm() {
    var kind = 'pj';
    var o = overlay('<div class="modal-title">Solicitar Fornecedor</div>'
      + '<div class="sup-kind-toggle"><button type="button" data-k="pj" class="active">Pessoa Jurídica</button><button type="button" data-k="pf">Pessoa Física</button></div>'
      + '<div id="sup-form-fields"></div>'
      + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button><button class="btn btn-primary" data-ok>Conferir e solicitar</button></div>', 640);
    var fieldsHost = o.querySelector('#sup-form-fields');

    function paint() {
      fieldsHost.innerHTML = formFieldsHtml(kind);
      var lookup = o.querySelector('#f-lookup');
      if (lookup) lookup.addEventListener('click', doLookup);
    }
    o.querySelectorAll('.sup-kind-toggle button').forEach(function (b) {
      b.addEventListener('click', function () {
        kind = b.getAttribute('data-k');
        o.querySelectorAll('.sup-kind-toggle button').forEach(function (x) { x.classList.toggle('active', x === b); });
        paint();
      });
    });

    async function doLookup() {
      var cnpj = (o.querySelector('#f-cnpj').value || '').replace(/\D/g, '');
      if (cnpj.length !== 14) { toast('Informe um CNPJ válido (14 dígitos).'); return; }
      var btn = o.querySelector('#f-lookup'); btn.disabled = true; btn.textContent = 'Buscando…';
      try {
        var data = await window.API.get('/supplier-requests/lookup?cnpj=' + cnpj);
        if (!data) { toast('CNPJ não encontrado na Receita.'); }
        else {
          Object.keys(data).forEach(function (key) { var el = o.querySelector('#f-' + key); if (el && data[key] != null && data[key] !== '') el.value = data[key]; });
          toast('Dados da Receita preenchidos. Confira antes de solicitar.', true);
        }
      } catch (error) { toast('Erro: ' + error.message); }
      finally { btn.disabled = false; btn.textContent = 'Buscar na Receita'; }
    }

    function collect() {
      var fields = {};
      ADDR_FIELDS.forEach(function (id) { var el = o.querySelector('#f-' + id); if (el) fields[id] = el.value.trim(); });
      var nome = o.querySelector('#f-nome'); if (nome) fields.nome = nome.value.trim();
      if (kind === 'pj') {
        fields.razao_social = (o.querySelector('#f-razao_social').value || '').trim();
        fields.inscricao_estadual = (o.querySelector('#f-inscricao_estadual').value || '').trim();
        fields.atividade_principal = (o.querySelector('#f-atividade_principal').value || '').trim();
      }
      return fields;
    }

    o.querySelector('[data-x]').addEventListener('click', function () { o.remove(); });
    o.querySelector('[data-ok]').addEventListener('click', async function () {
      var document = (o.querySelector(kind === 'pj' ? '#f-cnpj' : '#f-cpf').value || '').replace(/\D/g, '');
      var fields = collect();
      var name = kind === 'pj' ? (fields.razao_social || fields.nome || '') : (fields.nome || '');
      if (!document) { toast('Informe o ' + (kind === 'pj' ? 'CNPJ' : 'CPF') + '.'); return; }
      if (!name) { toast('Informe o nome / razão social.'); return; }
      var okBtn = o.querySelector('[data-ok]'); okBtn.disabled = true; okBtn.textContent = 'Verificando…';
      try {
        var check = await window.API.get('/supplier-requests/check-uau?document=' + document + '&kind=' + kind);
        if (check && check.registered) {
          var code = (check.person && (check.person.codigoPessoa || check.person.CodigoPessoa || check.person.codigo_pessoa)) || '';
          okBtn.disabled = false; okBtn.textContent = 'Conferir e solicitar';
          if (!(await askConfirm('Este documento já está cadastrado no UAU' + (code ? ' (código ' + code + ')' : '') + '. Registrar a solicitação mesmo assim?'))) return;
          okBtn.disabled = true; okBtn.textContent = 'Enviando…';
        }
      } catch (error) { /* UAU indisponível: segue sem a pré-checagem */ }
      try {
        await window.API.post('/supplier-requests/create', {
          kind: kind, document: document, name: name,
          fantasy: kind === 'pj' ? (fields.nome || null) : null, fields: fields,
        });
        o.remove(); toast('Solicitação registrada.', true); await done();
      } catch (error) { okBtn.disabled = false; okBtn.textContent = 'Conferir e solicitar'; toast('Erro: ' + error.message); }
    });

    paint();
  }

  selectElement('sup-new').addEventListener('click', openNewForm);
  ['sup-search', 'sup-status', 'sup-kind'].forEach(function (id) {
    selectElement(id).addEventListener('input', function () { supPage = 0; render(); });
    selectElement(id).addEventListener('change', function () { supPage = 0; render(); });
  });
  selectElement('sup-refresh').addEventListener('click', done);
  selectElement('sup-clear').addEventListener('click', function () { ['sup-search', 'sup-status', 'sup-kind'].forEach(function (id) { selectElement(id).value = ''; }); supPage = 0; render(); });

  await reload();
}
