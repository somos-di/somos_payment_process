async function initView_editar_processo() {
  var SB = window.SB, $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function toast(msg, ok) {
    var t = document.createElement('div'); t.textContent = msg;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (ok ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4000);
  }
  var parseVal = function (raw) { if (raw == null || raw === '') return null; var s = String(raw).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'); var n = parseFloat(s); return isNaN(n) ? null : n; };
  var fmtBR = function (n) { return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  function fill(sel, rows, vk, tk, ph) {
    sel.innerHTML = (ph ? '<option value="">' + ph + '</option>' : '') + rows.map(function (r) {
      return '<option value="' + esc(r[vk]) + '">' + esc(r[tk]) + '</option>';
    }).join('');
  }

  var params = window.routeParams;
  var uuid = params && params.get ? params.get('uuid') : null;
  if (!uuid) { $('ep-loading').textContent = 'Processo não informado.'; return; }

  var minDate = new Date(); minDate.setDate(minDate.getDate() + 10);
  var MIN_DUE_DATE = minDate.toISOString().split('T')[0];

  var ready = false, appropriationMap = {}, attachments = { boleto: null, nf: null }, tmr = null;
  var installments = [];   // [{ due_date_ins, value_ins }]

  var proc;
  try {
    var rows = await SB.select('v_processes', function (q) { return q.eq('uuid_prc', uuid); });
    proc = rows[0];
    if (!proc) { $('ep-loading').textContent = 'Processo não encontrado.'; return; }
  } catch (e) { $('ep-loading').textContent = 'Erro: ' + e.message; return; }

  $('ep-title').textContent = 'Editar Processo #' + proc.id_prc;
  attachments.boleto = proc.attachment_url_prc || null;
  attachments.nf = proc.attachment_url2_prc || null;

  try {
    fill($('ep-empresa'), await window.Store.get('empresas'), 'codigo', 'nome', 'Selecione');
    fill($('ep-tipo'), await window.Store.get('process_kinds'), 'id_pkn', 'name_pkn', 'Selecione');
    fill($('ep-tipodoc'), await window.Store.get('document_kinds'), 'id_dck', 'name_dck', 'Selecione');
  } catch (e) { $('ep-loading').textContent = 'Erro ao carregar listas: ' + e.message; return; }

  async function loadBuildings(company, keep) {
    var o = $('ep-obra'); o.innerHTML = '<option value="">Carregando…</option>';
    try { fill(o, await window.Store.get('obras', company), 'codigo', 'nome', 'Selecione'); }
    catch (e) { o.innerHTML = '<option value="">Erro</option>'; }
    if (keep) o.value = keep;
  }
  async function loadAppropriations(company, obra, keepComp, keepSup) {
    var ap = $('ep-apropriacao'); ap.innerHTML = '<option value="">Carregando…</option>'; appropriationMap = {};
    try {
      var rs = await window.Store.get('compositions_lk', company + '|' + obra);
      var seen = {}, opts = [];
      rs.forEach(function (r) {
        var key = r.codigo_composicao + '|' + r.codigo_insumo;
        if (seen[key] || !r.codigo_composicao || !r.codigo_insumo) return; seen[key] = 1;
        appropriationMap[key] = { comp: r.codigo_composicao, insumo: r.codigo_insumo };
        opts.push({ k: key, t: (r.descricao_composicao || r.codigo_composicao) + ' / ' + (r.descricao_insumo || r.codigo_insumo) });
      });
      var cur = keepComp ? (keepComp + '|' + keepSup) : '';

      if (cur && !appropriationMap[cur]) { appropriationMap[cur] = { comp: keepComp, insumo: keepSup }; opts.unshift({ k: cur, t: keepComp + ' / ' + keepSup }); }
      ap.innerHTML = '<option value="">Selecione</option>' + opts.map(function (o) { return '<option value="' + esc(o.k) + '">' + esc(o.t) + '</option>'; }).join('');
      if (cur) ap.value = cur;
    } catch (e) { ap.innerHTML = '<option value="">Erro</option>'; }
  }

  $('ep-empresa').value = proc.company_prc || '';
  await loadBuildings(proc.company_prc, proc.building_prc);
  await loadAppropriations(proc.company_prc, proc.building_prc, proc.composition_prc, proc.supply_prc);
  $('ep-tipo').value = proc.kind_prc != null ? String(proc.kind_prc) : '';
  $('ep-tipodoc').value = proc.doc_kind_prc != null ? String(proc.doc_kind_prc) : '';
  $('ep-urgente').value = proc.is_urgent_prc ? '1' : '0';
  $('ep-numdoc').value = proc.fiscal_doc_prc || '';
  $('ep-emissao').value = proc.issue_date_prc || '';
  $('ep-venc').min = MIN_DUE_DATE;
  $('ep-venc').value = proc.due_date_prc || '';
  $('ep-valor').value = proc.value_prc != null ? 'R$ ' + fmtBR(proc.value_prc) : '';
  $('ep-historico').value = proc.description_prc || '';
  $('ep-pessoa').value = proc.person_prc != null ? String(proc.person_prc) : '';
  $('ep-pessoa-input').value = proc.fornecedor_nome || '';
  renderAttachment('boleto'); renderAttachment('nf');

  // parcelas atuais do processo (o financeiro pode ter apagado -> vem vazio; o autor recria)
  try {
    var insRows = await window.Store.get('installments', uuid);
    installments = (insRows || []).map(function (r) {
      return { due_date_ins: r.due_date_ins ? String(r.due_date_ins).split('T')[0] : '', value_ins: r.value_ins };
    });
  } catch (e) { installments = []; }
  $('ep-qtd').value = installments.length || 1;
  renderInstallments();

  $('ep-loading').hidden = true; $('ep-grid').hidden = false;

  // Editável: em correção (status 2) OU aguardando aprovação (status 1) SEM nenhuma
  // aprovação registrada — sempre pelo AUTOR. O gate real é a RPC correct_process;
  // aqui é só UX para não abrir um formulário que falharia ao salvar.
  var STATUS = window.CONFIG.STATUS;
  var isCorrection = proc.status_step_prc === STATUS.correcao;
  var isAwaiting = proc.status_step_prc === STATUS.aguardando;
  var me = (window.Auth && window.Auth.getUser && window.Auth.getUser()) || null;
  var isAuthor = !!(me && me.id && proc.author_prc === me.id);
  var hasApprovals = false;
  if (isAwaiting) {
    try {
      var approvals = await SB.select('v_process_approvers', function (q) { return q.eq('process_app', uuid); });
      hasApprovals = (approvals || []).length > 0;
    } catch (e) { hasApprovals = true; } // na dúvida, bloqueia — o banco é a autoridade final
  }
  if (!isAuthor || !(isCorrection || (isAwaiting && !hasApprovals))) {
    $('ep-status').textContent = !isAuthor
      ? 'Apenas o autor pode editar este processo.'
      : (isAwaiting
        ? 'Este processo já recebeu aprovação e não pode mais ser editado.'
        : 'Somente processos em correção ou aguardando aprovação (sem aprovações) podem ser editados.');
    $('ep-reenviar').disabled = true;
    return;
  }
  if (isAwaiting) {
    $('ep-reenviar').hidden = true; // já está em aprovação — o auto-save basta
    $('ep-voltar').setAttribute('href', '#/meus-lancamentos');
    $('ep-sub').textContent = 'Altere os dados do processo — as alterações são salvas automaticamente enquanto ninguém aprovar.';
  }
  ready = true;

  function dueDateValid() { var v = $('ep-venc').value; return !!v && v >= MIN_DUE_DATE; }
  function toggleDueDateError() { $('ep-venc-erro').style.display = dueDateValid() || !$('ep-venc').value ? 'none' : 'block'; }

  function collect() {
    var ap = appropriationMap[$('ep-apropriacao').value] || {};
    return {
      description_prc: $('ep-historico').value || null,
      company_prc: $('ep-empresa').value || null,
      building_prc: $('ep-obra').value || null,
      composition_prc: ap.comp || null, supply_prc: ap.insumo || null,
      person_prc: $('ep-pessoa').value ? Number($('ep-pessoa').value) : null,
      kind_prc: $('ep-tipo').value ? Number($('ep-tipo').value) : null,
      doc_kind_prc: $('ep-tipodoc').value ? Number($('ep-tipodoc').value) : null,
      is_urgent_prc: $('ep-urgente').value === '1',
      issue_date_prc: $('ep-emissao').value || null,
      due_date_prc: $('ep-venc').value || null,
      value_prc: parseVal($('ep-valor').value),
      fiscal_doc_prc: $('ep-numdoc').value || null,
      attachment_url_prc: attachments.boleto, attachment_url2_prc: attachments.nf,
    };
  }
  // ----- Parcelas -----
  function renderInstallments() {
    var box = $('ep-parcelas');
    box.innerHTML = installments.map(function (p, i) {
      return '<div class="ep-parc-row"><span class="pl">Parcela ' + (i + 1) + '</span>'
        + '<input type="date" value="' + esc(p.due_date_ins || '') + '" data-i="' + i + '" data-f="due">'
        + '<input type="number" step="0.01" min="0" value="' + esc(p.value_ins != null ? p.value_ins : '') + '" data-i="' + i + '" data-f="val">'
        + '<button type="button" class="rm" title="Remover parcela" data-rm="' + i + '">×</button></div>';
    }).join('');
    box.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var i = +inp.getAttribute('data-i'), f = inp.getAttribute('data-f');
        if (f === 'due') installments[i].due_date_ins = inp.value;
        else installments[i].value_ins = inp.value === '' ? null : Number(inp.value);
        updateSum(); scheduleSave();
      });
    });
    box.querySelectorAll('[data-rm]').forEach(function (b) {
      b.addEventListener('click', function () {
        installments.splice(+b.getAttribute('data-rm'), 1); renderInstallments(); scheduleSave();
      });
    });
    updateSum();
  }
  function installmentsSum() { return Math.round(installments.reduce(function (a, p) { return a + (Number(p.value_ins) || 0); }, 0) * 100) / 100; }
  function updateSum() {
    var el = $('ep-parc-sum'); if (!el) return;
    var total = parseVal($('ep-valor').value) || 0, soma = installmentsSum();
    var ok = installments.length > 0 && Math.abs(soma - total) < 0.01;
    el.textContent = installments.length
      ? ('Soma das parcelas: R$ ' + fmtBR(soma) + ' de R$ ' + fmtBR(total) + (ok ? ' ✓' : ' — ajuste para bater com o valor'))
      : 'Nenhuma parcela. Gere as parcelas a partir do valor e do 1º vencimento.';
    el.classList.toggle('bad', !ok);
  }
  function generateInstallments() {
    var total = parseVal($('ep-valor').value), count = parseInt($('ep-qtd').value, 10), first = $('ep-venc').value;
    var err = $('ep-parc-erro');
    if (!total || total <= 0 || !count || count < 1 || !first) {
      err.textContent = 'Preencha Valor, Quantidade de Parcelas e Data de Vencimento (1ª parcela) para gerar.';
      err.style.display = 'block'; return;
    }
    err.style.display = 'none';
    installments = [];
    var base = Math.floor((total / count) * 100) / 100, acc = 0, fd = new Date(first + 'T12:00:00Z');
    for (var i = 0; i < count; i++) {
      var val = (i === count - 1) ? Math.round((total - acc) * 100) / 100 : base; acc += val;
      var d = new Date(fd); d.setUTCMonth(d.getUTCMonth() + i);
      installments.push({ due_date_ins: d.toISOString().split('T')[0], value_ins: val });
    }
    renderInstallments(); scheduleSave();
  }
  // Reenvio exige processo completo (mesma regra reforçada na RPC correct_process).
  function validateForResend() {
    var ap = appropriationMap[$('ep-apropriacao').value] || {}, val = parseVal($('ep-valor').value), probs = [];
    if (!$('ep-empresa').value) probs.push('empresa');
    if (!$('ep-obra').value) probs.push('obra');
    if (!ap.comp || !ap.insumo) probs.push('composição/insumo');
    if (!$('ep-pessoa').value) probs.push('fornecedor');
    if (!$('ep-tipodoc').value) probs.push('tipo de documento');
    if (val == null || val <= 0) probs.push('valor');
    if (!dueDateValid()) probs.push('vencimento (≥ 10 dias)');
    if (!installments.length) probs.push('parcelas');
    else if (installments.some(function (p) { return !p.due_date_ins || p.value_ins == null || Number(p.value_ins) <= 0; })) probs.push('parcelas incompletas');
    else if (val != null && Math.abs(installmentsSum() - val) >= 0.01) probs.push('soma das parcelas ≠ valor');
    return probs;
  }

  async function save(resend) {
    if (!ready) return;
    toggleDueDateError();
    if (resend) {
      var probs = validateForResend();
      if (probs.length) {
        $('ep-status').textContent = 'Complete os obrigatórios para reenviar.';
        toast('Não é possível reenviar. Verifique: ' + probs.join(', ') + '.');
        return;
      }
    } else if (!dueDateValid()) {
      $('ep-status').textContent = 'Ajuste o vencimento (≥ 10 dias) para salvar.'; return;
    }
    $('ep-status').textContent = resend ? 'Reenviando…' : 'Salvando…';
    try {
      var payload = { process: collect(), resend: !!resend };
      // auto-save só envia parcelas se houver (não apaga sem querer); no reenvio sempre (já validado >=1).
      if (resend || installments.length) {
        payload.installments = installments.map(function (p) { return { due_date_ins: p.due_date_ins, value_ins: Number(p.value_ins) }; });
      }
      await window.API.post('/processes/' + uuid + '/correct', payload);
      if (resend) {
        window.Store.invalidate('processes'); window.Store.invalidate('installments');
        toast('Processo corrigido e reenviado para aprovação.', true); window.location.hash = '#/correcao';
      } else $('ep-status').textContent = 'Salvo automaticamente ✓';
    } catch (e) { $('ep-status').textContent = 'Erro ao salvar'; toast('Erro: ' + e.message); }
  }
  function scheduleSave() { if (!ready) return; $('ep-status').textContent = 'Editando…'; clearTimeout(tmr); tmr = setTimeout(function () { save(false); }, 700); }

  $('ep-empresa').addEventListener('change', async function () {
    await loadBuildings(this.value); await loadAppropriations(this.value, $('ep-obra').value); scheduleSave();
  });
  $('ep-obra').addEventListener('change', async function () {
    await loadAppropriations($('ep-empresa').value, this.value); scheduleSave();
  });
  ['ep-apropriacao', 'ep-tipo', 'ep-tipodoc', 'ep-urgente', 'ep-numdoc', 'ep-emissao', 'ep-historico'].forEach(function (id) {
    $(id).addEventListener('change', scheduleSave); $(id).addEventListener('input', scheduleSave);
  });
  $('ep-venc').addEventListener('change', function () { toggleDueDateError(); scheduleSave(); });
  $('ep-valor').addEventListener('input', function () { updateSum(); scheduleSave(); });
  $('ep-valor').addEventListener('blur', function () { var n = parseVal(this.value); if (n != null) this.value = 'R$ ' + fmtBR(n); updateSum(); });
  $('ep-gerar').addEventListener('click', generateInstallments);

  var pin = $('ep-pessoa-input'), pres = $('ep-pessoa-results'), ptmr = null;
  async function searchSuppliers(term) {
    pres.innerHTML = '<div class="it">Buscando…</div>'; pres.classList.add('show');
    try {
      var rs = await window.Store.get('fornecedores', term || '');
      pres.innerHTML = rs.length ? rs.map(function (r) { return '<div class="it" data-id="' + r.id + '" data-nome="' + esc(r.nome) + '">' + esc(r.nome) + '<small>' + esc(r.cpf_cnpj || '') + '</small></div>'; }).join('') : '<div class="it">Nada encontrado</div>';
      pres.querySelectorAll('.it[data-id]').forEach(function (it) {
        it.addEventListener('click', function () { $('ep-pessoa').value = it.getAttribute('data-id'); pin.value = it.getAttribute('data-nome'); pres.classList.remove('show'); scheduleSave(); });
      });
    } catch (e) { pres.innerHTML = '<div class="it">' + esc(e.message) + '</div>'; }
  }
  pin.addEventListener('focus', function () { searchSuppliers(pin.value.trim()); });
  pin.addEventListener('input', function () { $('ep-pessoa').value = ''; clearTimeout(ptmr); ptmr = setTimeout(function () { searchSuppliers(pin.value.trim()); }, 300); });
  document.addEventListener('click', function (e) { if (!pin.contains(e.target) && !pres.contains(e.target)) pres.classList.remove('show'); });

  function renderAttachment(key) {
    var box = $('ep-' + key + '-file'), url = attachments[key];
    var label = key === 'boleto' ? 'Boleto' : 'Documento Fiscal';
    if (!url) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = '<a href="' + esc(url) + '" target="_blank">' + label + ' anexado</a>'
      + '<span style="display:inline-flex;gap:8px;align-items:center">'
      + '<label class="btn btn-light" for="ep-' + key + '" style="padding:5px 10px;font-size:12px;cursor:pointer">Substituir</label>'
      + '<button title="Remover anexo" aria-label="Remover anexo">×</button></span>';
    box.querySelector('button').addEventListener('click', function () { attachments[key] = null; renderAttachment(key); scheduleSave(); });
  }
  async function upload(file, key) {
    $('ep-status').textContent = 'Enviando anexo…';
    try { var r = await SB.upload(file); attachments[key] = r ? r.url : null; renderAttachment(key); save(false); }
    catch (e) { $('ep-status').textContent = ''; toast('Anexo não enviado: ' + (e.message || 'storage')); }
  }

  $('ep-boleto').addEventListener('change', function () { if (this.files[0]) upload(this.files[0], 'boleto'); this.value = ''; });
  $('ep-nf').addEventListener('change', function () { if (this.files[0]) upload(this.files[0], 'nf'); this.value = ''; });

  $('ep-reenviar').addEventListener('click', function () { save(true); });
  toggleDueDateError();
}
