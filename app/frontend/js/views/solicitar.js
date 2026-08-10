async function initView_solicitar() {
  var SB = window.SB;
  var selectElement = function (id) { return document.getElementById(id); };
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function toast(message, isSuccess) {
    var t = document.createElement('div'); t.textContent = message;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (isSuccess ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4500);
  }
  var parseVal = function (raw) { if (!raw) return NaN; var s = String(raw).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'); var n = parseFloat(s); return isNaN(n) ? NaN : n; };
  var fmtBR = function (n) { return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

  var STEPS = [
    { n: 1, t: 'Dados Iniciais', d: 'Empresa e obra do processo.' },
    { n: 2, t: 'Detalhes', d: 'Informações sobre o pagamento.' },
    { n: 3, t: 'Parcelamento', d: 'Definição dos vencimentos.' },
    { n: 4, t: 'Anexos', d: 'Upload de documentos.' },
  ];
  var step = 1, installments = [], appropriationMap = {}, appropriationOptions = [], attachments = { boleto: null, nf: null }, userId = null, deptId = null;

  function renderStepper() {
    selectElement('sol-stepper').innerHTML = STEPS.map(function (STEPSItem) {
      var cssClass = step > STEPSItem.n ? 'done' : (step === STEPSItem.n ? 'current' : '');
      var inner = step > STEPSItem.n ? '✓' : STEPSItem.n;
      return '<li class="step ' + cssClass + '"><span class="num">' + inner + '</span><span><span class="st">' + STEPSItem.t + '</span><br><span class="sd">' + STEPSItem.d + '</span></span></li>';
    }).join('');
  }
  function show() {
    renderStepper();
    document.querySelectorAll('.sol-step').forEach(function (item) { item.hidden = Number(item.getAttribute('data-step')) !== step; });
    selectElement('sol-back').disabled = step === 1;

    selectElement('sol-next').hidden = step === 4;
    selectElement('sol-save').hidden = step !== 4;
    selectElement('sol-save').disabled = !allValid();
    selectElement('sol-next').disabled = !validStep(step);
  }

  function validStep(n) {
    if (n === 1) return !!(selectElement('sol-empresa').value && selectElement('sol-obra').value);
    if (n === 2) return !!(selectElement('sol-pessoa').value && selectElement('sol-apropriacao').value && selectElement('sol-tipo').value
      && selectElement('sol-urgente').value !== '' && selectElement('sol-tipodoc').value && parseVal(selectElement('sol-valor').value) > 0);
    if (n === 3) return installments.length > 0 && parseInt(selectElement('sol-qtd').value, 10) === installments.length && sumCheck().ok;
    return true;
  }
  function allValid() { return validStep(1) && validStep(2) && validStep(3); }

  try {
    var currentUser = (window.Auth && window.Auth.getUser()) || null;
    if (!currentUser) { try { currentUser = await window.API.get('/auth/me'); } catch (error) { } }
    userId = currentUser ? currentUser.id : null;
    deptId = currentUser ? currentUser.department : null;
  } catch (error) { }

  function fill(selector, rows, valueKey, textKey, placeholder) {
    selector.innerHTML = '<option value="">' + placeholder + '</option>' + rows.map(function (row) {
      return '<option value="' + escapeHtml(row[valueKey]) + '">' + escapeHtml(row[textKey]) + '</option>';
    }).join('');
  }
  try {
    fill(selectElement('sol-empresa'), await window.Store.get('empresas'), 'codigo', 'nome', 'Selecione uma empresa');

    var kinds = (await window.Store.get('launchable_kinds')) || [];
    var payKinds = kinds.filter(function (kind) { return String(kind.name_pkn || '').trim().toLowerCase() !== 'comissão'; });
    fill(selectElement('sol-tipo'), payKinds, 'id_pkn', 'name_pkn', 'Selecione o tipo');
    if (currentUser && (currentUser.is_commission || currentUser.is_admin)) {
      var optC = document.createElement('option'); optC.value = 'commission'; optC.textContent = 'Comissão';
      selectElement('sol-tipo').appendChild(optC);
    }
    fill(selectElement('sol-tipodoc'), await window.Store.get('document_kinds'), 'id_dck', 'name_dck', 'Selecione');
  } catch (error) { toast('Falha ao carregar listas: ' + error.message); }

  var commissionMounted = false;
  function applyMode() {
    var isComm = selectElement('sol-tipo').value === 'commission';
    document.querySelectorAll('[data-payonly]').forEach(function (item) { item.hidden = isComm; });
    var host = selectElement('sol-commission-host'); host.hidden = !isComm;
    if (isComm) {
      if (commissionMounted) return;
      if (window.CommissionLaunch && typeof window.CommissionLaunch.mount === 'function') {
        window.CommissionLaunch.mount(host, { onDone: function () { window.location.hash = '#/comissoes'; } });
        commissionMounted = true;
      } else { host.innerHTML = '<div class="view-error">Módulo de comissão não carregado.</div>'; }
    } else { show(); }
  }
  selectElement('sol-tipo').addEventListener('change', applyMode);

  selectElement('sol-empresa').addEventListener('change', async function () {
    var company = this.value;
    var building = selectElement('sol-obra'); building.disabled = true; building.innerHTML = '<option value="">Carregando…</option>';
    resetAppropriation('Selecione uma obra');
    if (company) {
      try {
        var buildings = await window.Store.get('obras', company);
        fill(building, buildings, 'codigo', 'nome', 'Selecione uma obra'); building.disabled = false;
      } catch (error) { building.innerHTML = '<option value="">Erro</option>'; building.disabled = false; }
    }
    show();
  });
  selectElement('sol-obra').addEventListener('change', async function () {
    var company = selectElement('sol-empresa').value, building = this.value;
    resetAppropriation('Carregando…');
    if (building) {
      try {
        var rows = await window.Store.get('compositions_lk', company + '|' + building);
        var seen = {};
        rows.forEach(function (row) {
          var key = row.codigo_composicao + '|' + row.codigo_insumo;
          if (seen[key] || !row.codigo_composicao || !row.codigo_insumo) return; seen[key] = 1;
          appropriationMap[key] = { comp: row.codigo_composicao, insumo: row.codigo_insumo };
          appropriationOptions.push({ k: key, t: (row.descricao_composicao || row.codigo_composicao) + ' / ' + (row.descricao_insumo || row.codigo_insumo) });
        });
        var apin = selectElement('sol-apropriacao-input');
        apin.disabled = false; apin.placeholder = 'Busque a composição / insumo (' + appropriationOptions.length + ')…';
      } catch (error) { selectElement('sol-apropriacao-input').placeholder = 'Erro ao carregar'; }
    } else {
      selectElement('sol-apropriacao-input').placeholder = 'Selecione empresa e obra primeiro';
    }
    show();
  });

  var apin = selectElement('sol-apropriacao-input'), apres = selectElement('sol-apropriacao-results');
  function resetAppropriation(placeholder) {
    appropriationMap = {}; appropriationOptions = [];
    selectElement('sol-apropriacao').value = ''; apin.value = ''; apin.disabled = true;
    apin.placeholder = placeholder || 'Selecione empresa e obra primeiro';
    apres.classList.remove('show');
  }
  function renderAppropriation(term) {
    term = (term || '').toLowerCase().trim();
    var list = appropriationOptions.filter(function (appropriationOption) {
      return !term || appropriationOption.t.toLowerCase().indexOf(term) >= 0 || appropriationOption.k.toLowerCase().indexOf(term) >= 0;
    }).slice(0, 100);
    apres.innerHTML = list.length
      ? list.map(function (listItem) { return '<div class="it" data-k="' + escapeHtml(listItem.k) + '">' + escapeHtml(listItem.t) + '</div>'; }).join('')
      : '<div class="it">Nada encontrado</div>';
    apres.classList.add('show');
    apres.querySelectorAll('.it[data-k]').forEach(function (item) {
      item.addEventListener('click', function () {
        selectElement('sol-apropriacao').value = item.getAttribute('data-k'); apin.value = item.textContent;
        apres.classList.remove('show'); show();
      });
    });
  }
  apin.addEventListener('focus', function () { if (!apin.disabled) renderAppropriation(apin.value); });
  apin.addEventListener('input', function () { selectElement('sol-apropriacao').value = ''; renderAppropriation(apin.value); show(); });
  document.addEventListener('click', function (event) { if (!apin.contains(event.target) && !apres.contains(event.target)) apres.classList.remove('show'); });

  var personInput = selectElement('sol-pessoa-input'), personResults = selectElement('sol-pessoa-results'), personDebounceTimer = null;
  async function searchSuppliers(term) {
    personResults.innerHTML = '<div class="it">Buscando…</div>'; personResults.classList.add('show');
    try {
      var rows = await window.Store.get('fornecedores', term || '');
      personResults.innerHTML = rows.length
        ? rows.map(function (row) { return '<div class="it" data-id="' + row.id + '" data-nome="' + escapeHtml(row.nome) + '">' + escapeHtml(row.nome) + '<small>' + escapeHtml(row.cpf_cnpj || '') + '</small></div>'; }).join('')
        : '<div class="it">Nada encontrado</div>';
      personResults.querySelectorAll('.it[data-id]').forEach(function (item) {
        item.addEventListener('click', function () { selectElement('sol-pessoa').value = item.getAttribute('data-id'); personInput.value = item.getAttribute('data-nome'); personResults.classList.remove('show'); show(); });
      });
    } catch (error) { personResults.innerHTML = '<div class="it">' + escapeHtml(error.message) + '</div>'; }
  }
  personInput.addEventListener('focus', function () { if (!selectElement('sol-pessoa').value) searchSuppliers(personInput.value.trim()); });
  personInput.addEventListener('input', function () {
    var term = personInput.value.trim(); selectElement('sol-pessoa').value = '';
    clearTimeout(personDebounceTimer); personDebounceTimer = setTimeout(function () { searchSuppliers(term); }, 300); show();
  });
  document.addEventListener('click', function (event) { if (!personInput.contains(event.target) && !personResults.contains(event.target)) personResults.classList.remove('show'); });

  selectElement('sol-valor').addEventListener('blur', function () { var n = parseVal(this.value); if (!isNaN(n) && n > 0) this.value = 'R$ ' + fmtBR(n); show(); });
  ['sol-tipo', 'sol-urgente', 'sol-tipodoc', 'sol-apropriacao', 'sol-numdoc', 'sol-emissao', 'sol-valor', 'sol-historico'].forEach(function (item) {
    selectElement(item).addEventListener('input', show); selectElement(item).addEventListener('change', show);
  });

  function generateInstallments() {
    var total = parseVal(selectElement('sol-valor').value), count = parseInt(selectElement('sol-qtd').value, 10), first = selectElement('sol-venc1').value;
    var box = selectElement('sol-parcelas');
    if (!total || total <= 0 || !count || count < 1 || !first) { box.innerHTML = '<p class="empty">Preencha valor, quantidade e 1º vencimento.</p>'; installments = []; show(); return; }
    installments = []; var base = Math.floor((total / count) * 100) / 100, accumulator = 0, firstDueDate = new Date(first + 'T12:00:00Z'), html = '';
    for (var index = 0; index < count; index++) {
      var value = (index === count - 1) ? (total - accumulator).toFixed(2) : base.toFixed(2); accumulator += parseFloat(value);
      var d = new Date(firstDueDate); d.setUTCMonth(d.getUTCMonth() + index); var dueDate = d.toISOString().split('T')[0];
      installments.push({ vencimento: dueDate, valor: value });
      html += '<div class="parc-row"><span class="pl">Parcela ' + (index + 1) + '</span>'
        + '<input type="date" value="' + dueDate + '" data-i="' + index + '" data-f="vencimento">'
        + '<input type="number" step="0.01" value="' + value + '" data-i="' + index + '" data-f="valor"></div>';
    }
    box.innerHTML = html;
    box.querySelectorAll('input').forEach(function (item) {
      item.addEventListener('input', function () { var index = +item.getAttribute('data-i'); installments[index][item.getAttribute('data-f')] = item.value; });
    });
    show();
  }
  selectElement('sol-gerar').addEventListener('click', generateInstallments);
  function sumCheck() { var gross = parseVal(selectElement('sol-valor').value) || 0, s = installments.reduce(function (a, p) { return a + (parseFloat(p.valor) || 0); }, 0); return { soma: Math.round(s * 100) / 100, bruto: gross, ok: Math.abs(Math.round(s * 100) / 100 - gross) < 0.01 }; }

  async function upload(file, key) {
    try {
      var response = await SB.upload(file);
      attachments[key] = response ? response.url : null;
      selectElement('sol-' + (key === 'boleto' ? 'boleto' : 'nf') + '-name').textContent = file.name;
    } catch (error) { toast('Anexo não enviado (' + (error.message || 'storage') + ') - verifique o bucket "attachments".'); }
  }
  selectElement('sol-boleto').addEventListener('change', function () { if (this.files[0]) upload(this.files[0], 'boleto'); });
  selectElement('sol-nf').addEventListener('change', function () { if (this.files[0]) upload(this.files[0], 'nf'); });

  selectElement('sol-back').addEventListener('click', function () { if (step > 1) { step--; show(); } });
  selectElement('sol-next').addEventListener('click', function () {
    if (!validStep(step)) return;
    if (step === 3) {
      var isUrgent = selectElement('sol-urgente').value === '1';
      if (!isUrgent && selectElement('sol-venc1').value) {
        var today = new Date(); today.setHours(0, 0, 0, 0);
        var diff = (new Date(selectElement('sol-venc1').value + 'T00:00:00').getTime() - today.getTime()) / 86400000;
        if (diff < 10) { selectElement('sol-parc-erro-msg').textContent = 'Prazo mínimo de 10 dias a partir de hoje para o 1º vencimento. Ajuste a data.'; selectElement('sol-parc-erro').hidden = false; return; }
      }
      var s = sumCheck();
      if (!s.ok) { selectElement('sol-parc-erro-msg').textContent = 'A soma das parcelas (R$ ' + fmtBR(s.soma) + ') difere do valor bruto (R$ ' + fmtBR(s.bruto) + '). Ajuste.'; selectElement('sol-parc-erro').hidden = false; return; }
      selectElement('sol-parc-erro').hidden = true;
    }
    if (step < 4) { step++; show(); }
  });

  function optionText(selector) { var o = selector.options[selector.selectedIndex]; return o ? o.text : '-'; }
  selectElement('sol-save').addEventListener('click', function () {
    var rows = [
      ['Empresa', optionText(selectElement('sol-empresa'))], ['Obra', optionText(selectElement('sol-obra'))], ['Fornecedor', personInput.value || '-'],
      ['Apropriação', apin.value || '-'], ['Tipo de Processo', optionText(selectElement('sol-tipo'))],
      ['Urgente', selectElement('sol-urgente').value === '1' ? 'SIM' : 'NÃO'], ['Tipo de Documento', optionText(selectElement('sol-tipodoc'))],
      ['Nº Documento', selectElement('sol-numdoc').value || '-'], ['Data de Emissão', selectElement('sol-emissao').value || '-'],
      ['Valor Total Bruto', 'R$ ' + fmtBR(parseVal(selectElement('sol-valor').value) || 0)], ['Parcelas', String(installments.length)],
    ];
    var o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = '<div class="modal-box"><div class="modal-title">Valide os dados do processo</div>'
      + '<div class="validate-table">' + rows.map(function (row) { return '<div class="vr"><div class="vk">' + escapeHtml(row[0]) + '</div><div class="vv">' + escapeHtml(row[1]) + '</div></div>'; }).join('') + '</div>'
      + '<div class="modal-actions"><button class="btn btn-light" id="m-cancel">Cancelar</button><button class="btn btn-primary" id="m-ok">Confirmar e Salvar</button></div></div>';
    document.body.appendChild(o);
    o.querySelector('#m-cancel').addEventListener('click', function () { o.remove(); });
    o.querySelector('#m-ok').addEventListener('click', async function () {
      var button = this; button.disabled = true; button.textContent = 'Salvando…';
      try { await save(); o.remove(); toast('Processo salvo com sucesso!', true); window.location.hash = '#/consulta?kind=' + selectElement('sol-tipo').value; }
      catch (error) { button.disabled = false; button.textContent = 'Confirmar e Salvar'; toast('Erro ao salvar: ' + error.message); }
    });
  });

  async function save() {
    var ap = appropriationMap[selectElement('sol-apropriacao').value] || {};

    await window.Store.mutate('processes', function () {
      var process = {
        description_prc: selectElement('sol-historico').value || null,
        company_prc: selectElement('sol-empresa').value, building_prc: selectElement('sol-obra').value,
        composition_prc: ap.comp || null, supply_prc: ap.insumo || null,
        person_prc: selectElement('sol-pessoa').value ? Number(selectElement('sol-pessoa').value) : null,
        kind_prc: Number(selectElement('sol-tipo').value), department_prc: deptId,
        doc_kind_prc: selectElement('sol-tipodoc').value ? Number(selectElement('sol-tipodoc').value) : null,
        is_urgent_prc: selectElement('sol-urgente').value === '1',
        issue_date_prc: selectElement('sol-emissao').value || null,
        due_date_prc: installments[0] ? installments[0].vencimento : null,
        value_prc: parseVal(selectElement('sol-valor').value), fiscal_doc_prc: selectElement('sol-numdoc').value || null,
        attachment_url_prc: attachments.boleto, attachment_url2_prc: attachments.nf,

      };
      var installmentsPayload = installments.map(function (installment) { return { due_date_ins: installment.vencimento, value_ins: Number(installment.valor) }; });
      return window.API.post('/processes/full', { process: process, installments: installmentsPayload });
    });
  }

  var quickBtn = selectElement('sol-quick'), quickFile = selectElement('sol-quick-file');
  if (quickBtn && quickFile) {
    quickBtn.addEventListener('click', function () { quickFile.value = ''; quickFile.click(); });
    quickFile.addEventListener('change', function () { if (this.files[0]) runQuickLaunch(this.files[0]); });
  }

  function readBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(',')[1] || ''); };
      reader.onerror = function () { reject(new Error('Falha ao ler o arquivo')); };
      reader.readAsDataURL(file);
    });
  }

  function setSelectIfOption(selector, value) {
    if (value == null || value === '') return false;
    var target = String(value);
    var found = Array.prototype.some.call(selector.options, function (opt) { return opt.value === target; });
    if (found) { selector.value = target; return true; }
    return false;
  }

  async function prefillFromExtract(data) {
    if (selectElement('sol-tipo').value === 'commission') selectElement('sol-tipo').value = '';
    setSelectIfOption(selectElement('sol-tipo'), data.payment_kind_id);
    applyMode();

    if (setSelectIfOption(selectElement('sol-empresa'), data.company_id)) {
      var building = selectElement('sol-obra'); building.disabled = true; building.innerHTML = '<option value="">Carregando…</option>';
      resetAppropriation('Carregando…');
      try {
        fill(building, await window.Store.get('obras', selectElement('sol-empresa').value), 'codigo', 'nome', 'Selecione uma obra');
        building.disabled = false;
      } catch (error) { building.innerHTML = '<option value="">Erro</option>'; building.disabled = false; }
    }

    if (data.building_id != null && setSelectIfOption(selectElement('sol-obra'), data.building_id)) {
      try {
        var rows = await window.Store.get('compositions_lk', selectElement('sol-empresa').value + '|' + selectElement('sol-obra').value);
        var seen = {}; appropriationMap = {}; appropriationOptions = [];
        rows.forEach(function (row) {
          var key = row.codigo_composicao + '|' + row.codigo_insumo;
          if (seen[key] || !row.codigo_composicao || !row.codigo_insumo) return; seen[key] = 1;
          appropriationMap[key] = { comp: row.codigo_composicao, insumo: row.codigo_insumo };
          appropriationOptions.push({ k: key, t: (row.descricao_composicao || row.codigo_composicao) + ' / ' + (row.descricao_insumo || row.codigo_insumo) });
        });
        apin.disabled = false; apin.placeholder = 'Busque a composição / insumo (' + appropriationOptions.length + ')…';
        if (data.composition_code && data.supply_code) {
          var apKey = data.composition_code + '|' + data.supply_code;
          if (appropriationMap[apKey]) {
            selectElement('sol-apropriacao').value = apKey;
            var chosen = appropriationOptions.filter(function (option) { return option.k === apKey; })[0];
            apin.value = chosen ? chosen.t : apKey;
          }
        }
      } catch (error) { apin.placeholder = 'Erro ao carregar'; }
    }

    if (data.supplier_id != null) {
      selectElement('sol-pessoa').value = String(data.supplier_id);
      try {
        var suppliers = await SB.select('v_fornecedores', function (query) { return query.eq('id', Number(data.supplier_id)).limit(1); });
        personInput.value = (suppliers && suppliers[0] && suppliers[0].nome) ? suppliers[0].nome : ('Fornecedor #' + data.supplier_id);
      } catch (error) { personInput.value = 'Fornecedor #' + data.supplier_id; }
    }

    setSelectIfOption(selectElement('sol-tipodoc'), data.document_kind_id);
    if (data.document_number != null && data.document_number !== '') selectElement('sol-numdoc').value = String(data.document_number);
    if (data.issue_date) selectElement('sol-emissao').value = String(data.issue_date).slice(0, 10);
    if (data.is_urgente != null) selectElement('sol-urgente').value = data.is_urgente ? '1' : '0';
    if (data.additional_info) selectElement('sol-historico').value = String(data.additional_info);
    if (data.process_value != null && data.process_value !== '') {
      var amount = Number(String(data.process_value));
      if (!isNaN(amount) && amount > 0) selectElement('sol-valor').value = 'R$ ' + fmtBR(amount);
    }
    if (data.installment_quantity && Number(data.installment_quantity) > 0) selectElement('sol-qtd').value = String(Number(data.installment_quantity));
    if (data.due_date) selectElement('sol-venc1').value = String(data.due_date).slice(0, 10);
    if (selectElement('sol-valor').value && selectElement('sol-venc1').value) generateInstallments();

    step = 1; show();
  }

  async function runQuickLaunch(file) {
    var previous = quickBtn.textContent; quickBtn.disabled = true; quickBtn.textContent = 'Lendo documento…';
    try {
      var content = await readBase64(file);
      var data = await window.API.post('/processes/quick/extract', { content: content });
      await prefillFromExtract(data || {});
      await upload(file, 'nf');
      selectElement('sol-nf').disabled = true;
      var nfDrop = document.querySelector('label.dropzone[for="sol-nf"]');
      if (nfDrop) { nfDrop.style.pointerEvents = 'none'; nfDrop.style.opacity = '0.65'; }
      toast('Documento lido. Confira os dados e ajuste o que precisar (a NF já foi anexada).', true);
    } catch (error) {
      toast('Não consegui ler o documento: ' + (error.message || 'erro'));
    } finally { quickBtn.disabled = false; quickBtn.textContent = previous; }
  }

  show();
}
