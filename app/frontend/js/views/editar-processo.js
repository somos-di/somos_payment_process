async function initView_editar_processo() {
  var SB = window.SB, selectElement = function (id) { return document.getElementById(id); };
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function toast(message, isSuccess) {
    var t = document.createElement('div'); t.textContent = message;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (isSuccess ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4000);
  }
  var parseVal = function (raw) { if (raw == null || raw === '') return null; var s = String(raw).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'); var n = parseFloat(s); return isNaN(n) ? null : n; };
  var fmtBR = function (n) { return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  function fill(selector, rows, vk, tk, ph) {
    selector.innerHTML = (ph ? '<option value="">' + ph + '</option>' : '') + rows.map(function (row) {
      return '<option value="' + escapeHtml(row[vk]) + '">' + escapeHtml(row[tk]) + '</option>';
    }).join('');
  }

  var params = window.routeParams;
  var uuid = params && params.get ? params.get('uuid') : null;
  if (!uuid) { selectElement('ep-loading').textContent = 'Processo não informado.'; return; }

  var minDate = new Date(); minDate.setDate(minDate.getDate() + 10);
  var MIN_DUE_DATE = minDate.toISOString().split('T')[0];

  var ready = false, appropriationMap = {}, attachments = { boleto: null, nf: null }, tmr = null;
  var installments = [];

  var process;
  try {
    var rows = await SB.select('v_processes', function (query) { return query.eq('uuid_prc', uuid); });
    process = rows[0];
    if (!process) { selectElement('ep-loading').textContent = 'Processo não encontrado.'; return; }
  } catch (error) { selectElement('ep-loading').textContent = 'Erro: ' + error.message; return; }

  selectElement('ep-title').textContent = 'Editar Processo #' + process.id_prc;
  attachments.boleto = process.attachment_url_prc || null;
  attachments.nf = process.attachment_url2_prc || null;

  try {
    fill(selectElement('ep-empresa'), await window.Store.get('empresas'), 'codigo', 'nome', 'Selecione');
    fill(selectElement('ep-tipo'), await window.Store.get('process_kinds'), 'id_pkn', 'name_pkn', 'Selecione');
    fill(selectElement('ep-tipodoc'), await window.Store.get('document_kinds'), 'id_dck', 'name_dck', 'Selecione');
  } catch (error) { selectElement('ep-loading').textContent = 'Erro ao carregar listas: ' + error.message; return; }

  async function loadBuildings(company, keep) {
    var o = selectElement('ep-obra'); o.innerHTML = '<option value="">Carregando…</option>';
    try { fill(o, await window.Store.get('obras', company), 'codigo', 'nome', 'Selecione'); }
    catch (error) { o.innerHTML = '<option value="">Erro</option>'; }
    if (keep) o.value = keep;
  }
  async function loadAppropriations(company, obra, keepComp, keepSup) {
    var ap = selectElement('ep-apropriacao'); ap.innerHTML = '<option value="">Carregando…</option>'; appropriationMap = {};
    try {
      var rs = await window.Store.get('compositions_lk', company + '|' + obra);
      var seen = {}, options = [];
      rs.forEach(function (item) {
        var key = item.codigo_composicao + '|' + item.codigo_insumo;
        if (seen[key] || !item.codigo_composicao || !item.codigo_insumo) return; seen[key] = 1;
        appropriationMap[key] = { comp: item.codigo_composicao, insumo: item.codigo_insumo };
        options.push({ k: key, t: (item.descricao_composicao || item.codigo_composicao) + ' / ' + (item.descricao_insumo || item.codigo_insumo) });
      });
      var current = keepComp ? (keepComp + '|' + keepSup) : '';

      if (current && !appropriationMap[current]) { appropriationMap[current] = { comp: keepComp, insumo: keepSup }; options.unshift({ k: current, t: keepComp + ' / ' + keepSup }); }
      ap.innerHTML = '<option value="">Selecione</option>' + options.map(function (item) { return '<option value="' + escapeHtml(item.k) + '">' + escapeHtml(item.t) + '</option>'; }).join('');
      if (current) ap.value = current;
    } catch (error) { ap.innerHTML = '<option value="">Erro</option>'; }
  }

  selectElement('ep-empresa').value = process.company_prc || '';
  await loadBuildings(process.company_prc, process.building_prc);
  await loadAppropriations(process.company_prc, process.building_prc, process.composition_prc, process.supply_prc);
  selectElement('ep-tipo').value = process.kind_prc != null ? String(process.kind_prc) : '';
  selectElement('ep-tipodoc').value = process.doc_kind_prc != null ? String(process.doc_kind_prc) : '';
  selectElement('ep-urgente').value = process.is_urgent_prc ? '1' : '0';
  selectElement('ep-numdoc').value = process.fiscal_doc_prc || '';
  selectElement('ep-emissao').value = process.issue_date_prc || '';
  selectElement('ep-venc').min = MIN_DUE_DATE;
  selectElement('ep-venc').value = process.due_date_prc || '';
  selectElement('ep-valor').value = process.value_prc != null ? 'R$ ' + fmtBR(process.value_prc) : '';
  selectElement('ep-historico').value = process.description_prc || '';
  selectElement('ep-pessoa').value = process.person_prc != null ? String(process.person_prc) : '';
  selectElement('ep-pessoa-input').value = process.fornecedor_nome || '';
  renderAttachment('boleto'); renderAttachment('nf');

  try {
    var insRows = await window.Store.get('installments', uuid);
    installments = (insRows || []).map(function (item) {
      return { due_date_ins: item.due_date_ins ? String(item.due_date_ins).split('T')[0] : '', value_ins: item.value_ins };
    });
  } catch (error) { installments = []; }
  selectElement('ep-qtd').value = installments.length || 1;
  renderInstallments();

  selectElement('ep-loading').hidden = true; selectElement('ep-grid').hidden = false;

  var STATUS = window.CONFIG.STATUS;
  var isCorrection = process.status_step_prc === STATUS.correcao;
  var isAwaiting = process.status_step_prc === STATUS.aguardando;
  var currentUser = (window.Auth && window.Auth.getUser && window.Auth.getUser()) || null;
  var isAuthor = !!(currentUser && currentUser.id && process.author_prc === currentUser.id);
  var hasApprovals = false;
  if (isAwaiting) {
    try {
      var approvals = await SB.select('v_process_approvers', function (query) { return query.eq('process_app', uuid); });
      hasApprovals = (approvals || []).length > 0;
    } catch (error) { hasApprovals = true; }
  }
  if (!isAuthor || !(isCorrection || (isAwaiting && !hasApprovals))) {
    selectElement('ep-status').textContent = !isAuthor
      ? 'Apenas o autor pode editar este processo.'
      : (isAwaiting
        ? 'Este processo já recebeu aprovação e não pode mais ser editado.'
        : 'Somente processos em correção ou aguardando aprovação (sem aprovações) podem ser editados.');
    selectElement('ep-reenviar').disabled = true;
    return;
  }
  if (isAwaiting) {
    selectElement('ep-reenviar').hidden = true;
    selectElement('ep-voltar').setAttribute('href', '#/meus-lancamentos');
    selectElement('ep-sub').textContent = 'Altere os dados do processo — as alterações são salvas automaticamente enquanto ninguém aprovar.';
  }
  ready = true;

  function dueDateValid() { var value = selectElement('ep-venc').value; return !!value && value >= MIN_DUE_DATE; }
  function toggleDueDateError() { selectElement('ep-venc-erro').style.display = dueDateValid() || !selectElement('ep-venc').value ? 'none' : 'block'; }

  function collect() {
    var ap = appropriationMap[selectElement('ep-apropriacao').value] || {};
    return {
      description_prc: selectElement('ep-historico').value || null,
      company_prc: selectElement('ep-empresa').value || null,
      building_prc: selectElement('ep-obra').value || null,
      composition_prc: ap.comp || null, supply_prc: ap.insumo || null,
      person_prc: selectElement('ep-pessoa').value ? Number(selectElement('ep-pessoa').value) : null,
      kind_prc: selectElement('ep-tipo').value ? Number(selectElement('ep-tipo').value) : null,
      doc_kind_prc: selectElement('ep-tipodoc').value ? Number(selectElement('ep-tipodoc').value) : null,
      is_urgent_prc: selectElement('ep-urgente').value === '1',
      issue_date_prc: selectElement('ep-emissao').value || null,
      due_date_prc: selectElement('ep-venc').value || null,
      value_prc: parseVal(selectElement('ep-valor').value),
      fiscal_doc_prc: selectElement('ep-numdoc').value || null,
      attachment_url_prc: attachments.boleto, attachment_url2_prc: attachments.nf,
    };
  }
  function renderInstallments() {
    var box = selectElement('ep-parcelas');
    box.innerHTML = installments.map(function (installment, index) {
      return '<div class="ep-parc-row"><span class="pl">Parcela ' + (index + 1) + '</span>'
        + '<input type="date" value="' + escapeHtml(installment.due_date_ins || '') + '" data-i="' + index + '" data-f="due">'
        + '<input type="number" step="0.01" min="0" value="' + escapeHtml(installment.value_ins != null ? installment.value_ins : '') + '" data-i="' + index + '" data-f="val">'
        + '<button type="button" class="rm" title="Remover parcela" data-rm="' + index + '">×</button></div>';
    }).join('');
    box.querySelectorAll('input').forEach(function (item) {
      item.addEventListener('input', function () {
        var index = +item.getAttribute('data-i'), f = item.getAttribute('data-f');
        if (f === 'due') installments[index].due_date_ins = item.value;
        else installments[index].value_ins = item.value === '' ? null : Number(item.value);
        updateSum(); scheduleSave();
      });
    });
    box.querySelectorAll('[data-rm]').forEach(function (item) {
      item.addEventListener('click', function () {
        installments.splice(+item.getAttribute('data-rm'), 1); renderInstallments(); scheduleSave();
      });
    });
    updateSum();
  }
  function installmentsSum() { return Math.round(installments.reduce(function (a, p) { return a + (Number(p.value_ins) || 0); }, 0) * 100) / 100; }
  function updateSum() {
    var element = selectElement('ep-parc-sum'); if (!element) return;
    var total = parseVal(selectElement('ep-valor').value) || 0, soma = installmentsSum();
    var isSuccess = installments.length > 0 && Math.abs(soma - total) < 0.01;
    element.textContent = installments.length
      ? ('Soma das parcelas: R$ ' + fmtBR(soma) + ' de R$ ' + fmtBR(total) + (isSuccess ? ' ✓' : ' — ajuste para bater com o valor'))
      : 'Nenhuma parcela. Gere as parcelas a partir do valor e do 1º vencimento.';
    element.classList.toggle('bad', !isSuccess);
  }
  function generateInstallments() {
    var total = parseVal(selectElement('ep-valor').value), count = parseInt(selectElement('ep-qtd').value, 10), first = selectElement('ep-venc').value;
    var errorElement = selectElement('ep-parc-erro');
    if (!total || total <= 0 || !count || count < 1 || !first) {
      errorElement.textContent = 'Preencha Valor, Quantidade de Parcelas e Data de Vencimento (1ª parcela) para gerar.';
      errorElement.style.display = 'block'; return;
    }
    errorElement.style.display = 'none';
    installments = [];
    var base = Math.floor((total / count) * 100) / 100, accumulator = 0, firstDueDate = new Date(first + 'T12:00:00Z');
    for (var index = 0; index < count; index++) {
      var value = (index === count - 1) ? Math.round((total - accumulator) * 100) / 100 : base; accumulator += value;
      var d = new Date(firstDueDate); d.setUTCMonth(d.getUTCMonth() + index);
      installments.push({ due_date_ins: d.toISOString().split('T')[0], value_ins: value });
    }
    renderInstallments(); scheduleSave();
  }
  function validateForResend() {
    var appropriation = appropriationMap[selectElement('ep-apropriacao').value] || {}, value = parseVal(selectElement('ep-valor').value), probs = [];
    if (!selectElement('ep-empresa').value) probs.push('empresa');
    if (!selectElement('ep-obra').value) probs.push('obra');
    if (!appropriation.comp || !appropriation.insumo) probs.push('composição/insumo');
    if (!selectElement('ep-pessoa').value) probs.push('fornecedor');
    if (!selectElement('ep-tipodoc').value) probs.push('tipo de documento');
    if (value == null || value <= 0) probs.push('valor');
    if (!dueDateValid()) probs.push('vencimento (≥ 10 dias)');
    if (!installments.length) probs.push('parcelas');
    else if (installments.some(function (installment) { return !installment.due_date_ins || installment.value_ins == null || Number(installment.value_ins) <= 0; })) probs.push('parcelas incompletas');
    else if (value != null && Math.abs(installmentsSum() - value) >= 0.01) probs.push('soma das parcelas ≠ valor');
    return probs;
  }

  async function save(resend) {
    if (!ready) return;
    toggleDueDateError();
    if (resend) {
      var probs = validateForResend();
      if (probs.length) {
        selectElement('ep-status').textContent = 'Complete os obrigatórios para reenviar.';
        toast('Não é possível reenviar. Verifique: ' + probs.join(', ') + '.');
        return;
      }
    } else if (!dueDateValid()) {
      selectElement('ep-status').textContent = 'Ajuste o vencimento (≥ 10 dias) para salvar.'; return;
    }
    selectElement('ep-status').textContent = resend ? 'Reenviando…' : 'Salvando…';
    try {
      var payload = { process: collect(), resend: !!resend };
      if (resend || installments.length) {
        payload.installments = installments.map(function (installment) { return { due_date_ins: installment.due_date_ins, value_ins: Number(installment.value_ins) }; });
      }
      await window.API.post('/processes/' + uuid + '/correct', payload);
      if (resend) {
        window.Store.invalidate('processes'); window.Store.invalidate('installments');
        toast('Processo corrigido e reenviado para aprovação.', true); window.location.hash = '#/correcao';
      } else selectElement('ep-status').textContent = 'Salvo automaticamente ✓';
    } catch (error) { selectElement('ep-status').textContent = 'Erro ao salvar'; toast('Erro: ' + error.message); }
  }
  function scheduleSave() { if (!ready) return; selectElement('ep-status').textContent = 'Editando…'; clearTimeout(tmr); tmr = setTimeout(function () { save(false); }, 700); }

  selectElement('ep-empresa').addEventListener('change', async function () {
    await loadBuildings(this.value); await loadAppropriations(this.value, selectElement('ep-obra').value); scheduleSave();
  });
  selectElement('ep-obra').addEventListener('change', async function () {
    await loadAppropriations(selectElement('ep-empresa').value, this.value); scheduleSave();
  });
  ['ep-apropriacao', 'ep-tipo', 'ep-tipodoc', 'ep-urgente', 'ep-numdoc', 'ep-emissao', 'ep-historico'].forEach(function (item) {
    selectElement(item).addEventListener('change', scheduleSave); selectElement(item).addEventListener('input', scheduleSave);
  });
  selectElement('ep-venc').addEventListener('change', function () { toggleDueDateError(); scheduleSave(); });
  selectElement('ep-valor').addEventListener('input', function () { updateSum(); scheduleSave(); });
  selectElement('ep-valor').addEventListener('blur', function () { var n = parseVal(this.value); if (n != null) this.value = 'R$ ' + fmtBR(n); updateSum(); });
  selectElement('ep-gerar').addEventListener('click', generateInstallments);

  var personInput = selectElement('ep-pessoa-input'), personResults = selectElement('ep-pessoa-results'), personDebounceTimer = null;
  async function searchSuppliers(term) {
    personResults.innerHTML = '<div class="it">Buscando…</div>'; personResults.classList.add('show');
    try {
      var suppliers = await window.Store.get('fornecedores', term || '');
      personResults.innerHTML = suppliers.length ? suppliers.map(function (item) { return '<div class="it" data-id="' + item.id + '" data-nome="' + escapeHtml(item.nome) + '">' + escapeHtml(item.nome) + '<small>' + escapeHtml(item.cpf_cnpj || '') + '</small></div>'; }).join('') : '<div class="it">Nada encontrado</div>';
      personResults.querySelectorAll('.it[data-id]').forEach(function (item) {
        item.addEventListener('click', function () { selectElement('ep-pessoa').value = item.getAttribute('data-id'); personInput.value = item.getAttribute('data-nome'); personResults.classList.remove('show'); scheduleSave(); });
      });
    } catch (error) { personResults.innerHTML = '<div class="it">' + escapeHtml(error.message) + '</div>'; }
  }
  personInput.addEventListener('focus', function () { searchSuppliers(personInput.value.trim()); });
  personInput.addEventListener('input', function () { selectElement('ep-pessoa').value = ''; clearTimeout(personDebounceTimer); personDebounceTimer = setTimeout(function () { searchSuppliers(personInput.value.trim()); }, 300); });
  document.addEventListener('click', function (event) { if (!personInput.contains(event.target) && !personResults.contains(event.target)) personResults.classList.remove('show'); });

  function renderAttachment(key) {
    var box = selectElement('ep-' + key + '-file'), attachmentUrl = attachments[key];
    var label = key === 'boleto' ? 'Boleto' : 'Documento Fiscal';
    if (!attachmentUrl) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = '<a href="' + escapeHtml(attachmentUrl) + '" target="_blank">' + label + ' anexado</a>'
      + '<span style="display:inline-flex;gap:8px;align-items:center">'
      + '<label class="btn btn-light" for="ep-' + key + '" style="padding:5px 10px;font-size:12px;cursor:pointer">Substituir</label>'
      + '<button title="Remover anexo" aria-label="Remover anexo">×</button></span>';
    box.querySelector('button').addEventListener('click', function () { attachments[key] = null; renderAttachment(key); scheduleSave(); });
  }
  async function upload(file, key) {
    selectElement('ep-status').textContent = 'Enviando anexo…';
    try { var r = await SB.upload(file); attachments[key] = r ? r.url : null; renderAttachment(key); save(false); }
    catch (error) { selectElement('ep-status').textContent = ''; toast('Anexo não enviado: ' + (error.message || 'storage')); }
  }

  selectElement('ep-boleto').addEventListener('change', function () { if (this.files[0]) upload(this.files[0], 'boleto'); this.value = ''; });
  selectElement('ep-nf').addEventListener('change', function () { if (this.files[0]) upload(this.files[0], 'nf'); this.value = ''; });

  selectElement('ep-reenviar').addEventListener('click', function () { save(true); });
  toggleDueDateError();
}
