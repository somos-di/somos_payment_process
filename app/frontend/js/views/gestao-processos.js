async function initView_gestao_processos() {
  var SB = window.SB, selectElement = function (id) { return document.getElementById(id); };
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(value) { return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  var parseVal = function (raw) { if (raw == null || raw === '') return null; var s = String(raw).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'); var n = parseFloat(s); return isNaN(n) ? null : n; };
  var fmtBR = function (n) { return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  function toast(message, isSuccess) {
    var t = document.createElement('div'); t.textContent = message;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10000;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (isSuccess ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4000);
  }
  function fill(selector, rows, valueKey, textKey, placeholder) {
    selector.innerHTML = (placeholder ? '<option value="">' + placeholder + '</option>' : '') + (rows || []).map(function (item) {
      return '<option value="' + escapeHtml(item[valueKey]) + '">' + escapeHtml(item[textKey]) + '</option>';
    }).join('');
  }
  var STEPS = (window.CONFIG && window.CONFIG.STEPS) || {};

  var EDIT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>';

  var processList = await window.ProcessList.mount(selectElement('gp-host'), {
    emptyText: 'Nenhum processo.',
    storageKey: 'gestao-processos',
    pageSize: 50,
    fetchPage: window.fetchProcessesPage(null, false, 'v_processes_admin'),
    extraColumns: [{ label: 'Nº UAU', col: 'uau_number_prc', type: 'text' }],
    actions: [
      { label: 'Editar', cls: 'btn-primary', icon: EDIT_ICON, effect: 'none', run: function (p) { openEdit(p); return Promise.resolve(); } },
    ],
  });

  function openEdit(process) {
    var appropriationMap = {}, attachments = { boleto: process.attachment_url_prc || null, nf: process.attachment_url2_prc || null };
    var installments = [];

    var o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = '<div class="modal-box" style="width:760px;max-width:96vw;max-height:92vh;overflow:auto">'
      + '<button class="modal-x" aria-label="Fechar">×</button>'
      + '<div class="modal-title">Editar Processo #' + escapeHtml(process.id_prc) + '</div>'
      + '<div class="gp-uau" style="margin:-4px 0 12px">Nº UAU (não editável): <b>' + escapeHtml(process.uau_number_prc || '-') + '</b></div>'
      + '<div class="gp-modal-grid">'
      + '<div class="gp-sec">Dados Gerais</div>'
      + '<div class="field"><label>Empresa</label><select id="gp-empresa"></select></div>'
      + '<div class="field"><label>Obra</label><select id="gp-obra"></select></div>'
      + '<div class="field full gp-search-wrap"><label>Fornecedor</label>'
      + '<input id="gp-pessoa-input" placeholder="Busque por nome ou CNPJ/CPF" autocomplete="off"><input type="hidden" id="gp-pessoa">'
      + '<div class="gp-results" id="gp-pessoa-results"></div></div>'
      + '<div class="field full"><label>Composição / Apropriação</label><select id="gp-apropriacao"></select></div>'
      + '<div class="field"><label>Tipo de Processo</label><select id="gp-tipo"></select></div>'
      + '<div class="field"><label>Urgente</label><select id="gp-urgente"><option value="0">Não</option><option value="1">Sim</option></select></div>'

      + '<div class="gp-sec">Documento e Valores</div>'
      + '<div class="field"><label>Tipo de Documento</label><select id="gp-tipodoc"></select></div>'
      + '<div class="field"><label>Nº Documento</label><input id="gp-numdoc"></div>'
      + '<div class="field"><label>Data de Emissão</label><input type="date" id="gp-emissao"></div>'
      + '<div class="field"><label>Data de Vencimento</label><input type="date" id="gp-venc"></div>'
      + '<div class="field"><label>Valor Total Bruto</label><input id="gp-valor" inputmode="decimal" placeholder="R$ 0,00"></div>'
      + '<div class="field full"><label>Histórico / Descrição</label><input id="gp-historico"></div>'

      + '<div class="gp-sec">Situação</div>'
      + '<div class="field"><label>Status</label><select id="gp-status"></select></div>'
      + '<div class="field"><label>Ativo</label><select id="gp-ativo"><option value="true">Sim</option><option value="false">Não</option></select></div>'

      + '<div class="gp-sec">Parcelas</div>'
      + '<div class="field"><label>Quantidade de Parcelas</label><input type="number" id="gp-qtd" min="1" value="1"></div>'
      + '<div class="field" style="align-self:end"><button class="btn btn-light" type="button" id="gp-gerar">Gerar parcelas</button></div>'
      + '<div class="field full"><div id="gp-parcelas" class="gp-parcelas"></div><div class="gp-parc-sum" id="gp-parc-sum"></div>'
      + '<small id="gp-parc-erro" style="color:var(--danger);display:none"></small></div>'

      + '<div class="gp-sec">Motivo da alteração</div>'
      + '<div class="field full gp-reason"><label>Por que está alterando este processo? (obrigatório)</label>'
      + '<textarea id="gp-reason" rows="2" maxlength="500" placeholder="Descreva o motivo - ficará no histórico do processo."></textarea></div>'
      + '</div>'
      + '<div class="modal-actions"><button class="btn btn-light" id="gp-cancel">Cancelar</button>'
      + '<button class="btn btn-primary" id="gp-save">Salvar alteração</button></div>'
      + '</div>';
    document.body.appendChild(o);
    function close() { o.remove(); }
    o.addEventListener('click', function (event) { if (event.target === o || event.target.classList.contains('modal-x')) close(); });
    o.querySelector('#gp-cancel').addEventListener('click', close);

    async function loadBuildings(company, keep) {
      var element = o.querySelector('#gp-obra'); element.innerHTML = '<option value="">Carregando…</option>';
      try { fill(element, await window.Store.get('obras', company), 'codigo', 'nome', 'Selecione'); }
      catch (error) { element.innerHTML = '<option value="">Erro</option>'; }
      if (keep) element.value = keep;
    }
    async function loadAppropriations(company, obra, keepComp, keepSup) {
      var appropriationSelect = o.querySelector('#gp-apropriacao'); appropriationSelect.innerHTML = '<option value="">Carregando…</option>'; appropriationMap = {};
      try {
        var compositions = await window.Store.get('compositions_lk', company + '|' + obra);
        var seen = {}, options = [];
        compositions.forEach(function (item) {
          var key = item.codigo_composicao + '|' + item.codigo_insumo;
          if (seen[key] || !item.codigo_composicao || !item.codigo_insumo) return; seen[key] = 1;
          appropriationMap[key] = { comp: item.codigo_composicao, insumo: item.codigo_insumo };
          options.push({ k: key, t: (item.descricao_composicao || item.codigo_composicao) + ' / ' + (item.descricao_insumo || item.codigo_insumo) });
        });
        var current = keepComp ? (keepComp + '|' + keepSup) : '';
        if (current && !appropriationMap[current]) { appropriationMap[current] = { comp: keepComp, insumo: keepSup }; options.unshift({ k: current, t: keepComp + ' / ' + keepSup }); }
        appropriationSelect.innerHTML = '<option value="">Selecione</option>' + options.map(function (item) { return '<option value="' + escapeHtml(item.k) + '">' + escapeHtml(item.t) + '</option>'; }).join('');
        if (current) appropriationSelect.value = current;
      } catch (error) { appropriationSelect.innerHTML = '<option value="">Erro</option>'; }
    }

    (async function populate() {
      try {
        fill(o.querySelector('#gp-empresa'), await window.Store.get('empresas'), 'codigo', 'nome', 'Selecione');
        fill(o.querySelector('#gp-tipo'), await window.Store.get('process_kinds'), 'id_pkn', 'name_pkn', 'Selecione');
        fill(o.querySelector('#gp-tipodoc'), await window.Store.get('document_kinds'), 'id_dck', 'name_dck', 'Selecione');
      } catch (error) { }
      o.querySelector('#gp-status').innerHTML = Object.keys(STEPS).map(function (item) {
        return '<option value="' + escapeHtml(item) + '">' + escapeHtml(STEPS[item]) + ' (' + item + ')</option>';
      }).join('');

      o.querySelector('#gp-empresa').value = process.company_prc || '';
      await loadBuildings(process.company_prc, process.building_prc);
      await loadAppropriations(process.company_prc, process.building_prc, process.composition_prc, process.supply_prc);
      o.querySelector('#gp-tipo').value = process.kind_prc != null ? String(process.kind_prc) : '';
      o.querySelector('#gp-tipodoc').value = process.doc_kind_prc != null ? String(process.doc_kind_prc) : '';
      o.querySelector('#gp-urgente').value = process.is_urgent_prc ? '1' : '0';
      o.querySelector('#gp-numdoc').value = process.fiscal_doc_prc || '';
      o.querySelector('#gp-emissao').value = process.issue_date_prc ? String(process.issue_date_prc).split('T')[0] : '';
      o.querySelector('#gp-venc').value = process.due_date_prc ? String(process.due_date_prc).split('T')[0] : '';
      o.querySelector('#gp-valor').value = process.value_prc != null ? 'R$ ' + fmtBR(process.value_prc) : '';
      o.querySelector('#gp-historico').value = process.description_prc || '';
      o.querySelector('#gp-pessoa').value = process.person_prc != null ? String(process.person_prc) : '';
      o.querySelector('#gp-pessoa-input').value = process.fornecedor_nome || '';
      o.querySelector('#gp-status').value = String(process.status_step_prc);
      o.querySelector('#gp-ativo').value = process.active_prc === false ? 'false' : 'true';

      try {
        var insRows = await window.Store.get('installments', process.uuid_prc);
        installments = (insRows || []).map(function (item) { return { due_date_ins: item.due_date_ins ? String(item.due_date_ins).split('T')[0] : '', value_ins: item.value_ins }; });
      } catch (error) { installments = []; }
      o.querySelector('#gp-qtd').value = installments.length || 1;
      renderInstallments();
    })();

    o.querySelector('#gp-empresa').addEventListener('change', async function () {
      await loadBuildings(this.value); await loadAppropriations(this.value, o.querySelector('#gp-obra').value);
    });
    o.querySelector('#gp-obra').addEventListener('change', async function () {
      await loadAppropriations(o.querySelector('#gp-empresa').value, this.value);
    });
    o.querySelector('#gp-valor').addEventListener('input', updateSum);
    o.querySelector('#gp-valor').addEventListener('blur', function () { var n = parseVal(this.value); if (n != null) this.value = 'R$ ' + fmtBR(n); updateSum(); });
    o.querySelector('#gp-gerar').addEventListener('click', generateInstallments);

    var personInput = o.querySelector('#gp-pessoa-input'), personResults = o.querySelector('#gp-pessoa-results'), ptmr = null;
    async function searchSuppliers(term) {
      personResults.innerHTML = '<div class="it">Buscando…</div>'; personResults.classList.add('show');
      try {
        var suppliers = await window.Store.get('fornecedores', term || '');
        personResults.innerHTML = suppliers.length ? suppliers.map(function (item) { return '<div class="it" data-id="' + item.id + '" data-nome="' + escapeHtml(item.nome) + '">' + escapeHtml(item.nome) + '<small>' + escapeHtml(item.cpf_cnpj || '') + '</small></div>'; }).join('') : '<div class="it">Nada encontrado</div>';
        personResults.querySelectorAll('.it[data-id]').forEach(function (item) {
          item.addEventListener('click', function () { o.querySelector('#gp-pessoa').value = item.getAttribute('data-id'); personInput.value = item.getAttribute('data-nome'); personResults.classList.remove('show'); });
        });
      } catch (error) { personResults.innerHTML = '<div class="it">' + escapeHtml(error.message) + '</div>'; }
    }
    personInput.addEventListener('focus', function () { searchSuppliers(personInput.value.trim()); });
    personInput.addEventListener('input', function () { o.querySelector('#gp-pessoa').value = ''; clearTimeout(ptmr); ptmr = setTimeout(function () { searchSuppliers(personInput.value.trim()); }, 300); });
    o.addEventListener('click', function (event) { if (!personInput.contains(event.target) && !personResults.contains(event.target)) personResults.classList.remove('show'); });

    function installmentsSum() { return Math.round(installments.reduce(function (a, p) { return a + (Number(p.value_ins) || 0); }, 0) * 100) / 100; }
    function updateSum() {
      var element = o.querySelector('#gp-parc-sum'); if (!element) return;
      var total = parseVal(o.querySelector('#gp-valor').value) || 0, soma = installmentsSum();
      var isSuccess = installments.length > 0 && Math.abs(soma - total) < 0.01;
      element.textContent = installments.length ? ('Soma das parcelas: R$ ' + fmtBR(soma) + ' de R$ ' + fmtBR(total) + (isSuccess ? ' ✓' : ' - diferente do valor')) : 'Sem parcelas.';
      element.classList.toggle('bad', installments.length > 0 && !isSuccess);
    }
    function renderInstallments() {
      var box = o.querySelector('#gp-parcelas');
      box.innerHTML = installments.map(function (installment, index) {
        return '<div class="gp-parc-row"><span class="pl">Parcela ' + (index + 1) + '</span>'
          + '<input type="date" value="' + escapeHtml(installment.due_date_ins || '') + '" data-i="' + index + '" data-f="due">'
          + '<input type="number" step="0.01" min="0" value="' + escapeHtml(installment.value_ins != null ? installment.value_ins : '') + '" data-i="' + index + '" data-f="val">'
          + '<button type="button" class="rm" title="Remover" data-rm="' + index + '">×</button></div>';
      }).join('');
      box.querySelectorAll('input').forEach(function (item) {
        item.addEventListener('input', function () {
          var index = +item.getAttribute('data-i'), fieldName = item.getAttribute('data-f');
          if (fieldName === 'due') installments[index].due_date_ins = item.value; else installments[index].value_ins = item.value === '' ? null : Number(item.value);
          updateSum();
        });
      });
      box.querySelectorAll('[data-rm]').forEach(function (item) { item.addEventListener('click', function () { installments.splice(+item.getAttribute('data-rm'), 1); renderInstallments(); }); });
      updateSum();
    }
    function generateInstallments() {
      var total = parseVal(o.querySelector('#gp-valor').value), count = parseInt(o.querySelector('#gp-qtd').value, 10), first = o.querySelector('#gp-venc').value;
      var errorElement = o.querySelector('#gp-parc-erro');
      if (!total || total <= 0 || !count || count < 1 || !first) { errorElement.textContent = 'Preencha Valor, Quantidade e Vencimento (1ª parcela) para gerar.'; errorElement.style.display = 'block'; return; }
      errorElement.style.display = 'none'; installments = [];
      var base = Math.floor((total / count) * 100) / 100, accumulator = 0, firstDueDate = new Date(first + 'T12:00:00Z');
      for (var index = 0; index < count; index++) {
        var value = (index === count - 1) ? Math.round((total - accumulator) * 100) / 100 : base; accumulator += value;
        var d = new Date(firstDueDate); d.setUTCMonth(d.getUTCMonth() + index);
        installments.push({ due_date_ins: d.toISOString().split('T')[0], value_ins: value });
      }
      renderInstallments();
    }

    function collect() {
      var ap = appropriationMap[o.querySelector('#gp-apropriacao').value] || {};
      return {
        description_prc: o.querySelector('#gp-historico').value || null,
        company_prc: o.querySelector('#gp-empresa').value || null,
        building_prc: o.querySelector('#gp-obra').value || null,
        composition_prc: ap.comp || null, supply_prc: ap.insumo || null,
        person_prc: o.querySelector('#gp-pessoa').value ? Number(o.querySelector('#gp-pessoa').value) : null,
        kind_prc: o.querySelector('#gp-tipo').value ? Number(o.querySelector('#gp-tipo').value) : null,
        doc_kind_prc: o.querySelector('#gp-tipodoc').value ? Number(o.querySelector('#gp-tipodoc').value) : null,
        is_urgent_prc: o.querySelector('#gp-urgente').value === '1',
        issue_date_prc: o.querySelector('#gp-emissao').value || null,
        due_date_prc: o.querySelector('#gp-venc').value || null,
        value_prc: parseVal(o.querySelector('#gp-valor').value),
        fiscal_doc_prc: o.querySelector('#gp-numdoc').value || null,
        status_step_prc: Number(o.querySelector('#gp-status').value),
        active_prc: o.querySelector('#gp-ativo').value === 'true',
        attachment_url_prc: attachments.boleto, attachment_url2_prc: attachments.nf,
      };
    }
    o.querySelector('#gp-save').addEventListener('click', async function () {
      var reason = (o.querySelector('#gp-reason').value || '').trim();
      if (!reason) { toast('Informe o motivo da alteração.'); o.querySelector('#gp-reason').focus(); return; }
      var button = this; button.disabled = true; button.textContent = 'Salvando…';
      try {
        var payload = { process: collect(), reason: reason };
        if (installments.length) payload.installments = installments.map(function (installment) { return { due_date_ins: installment.due_date_ins, value_ins: Number(installment.value_ins) }; });
        await window.API.post('/processes/' + process.uuid_prc + '/admin-edit', payload);
        window.Store.invalidate('processes_admin'); window.invalidateFlowCaches && window.invalidateFlowCaches();
        toast('Processo atualizado.', true); close(); await processList.reload();
      } catch (error) { toast('Erro: ' + error.message); button.disabled = false; button.textContent = 'Salvar alteração'; }
    });
  }
}
