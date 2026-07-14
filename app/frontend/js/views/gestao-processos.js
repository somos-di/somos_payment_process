// GESTÃO DE PROCESSOS (admin): lista TODOS os processos (v_processes_admin) e permite
// editar qualquer campo — exceto o Nº UAU — via um modal com MOTIVO obrigatório.
// Toda a autorização (is_admin) e a whitelist vivem na RPC admin_edit_process; aqui é UI.
// Rota gated a admin no router; o menu já fica escondido para não-admin.
async function initView_gestao_processos() {
  var SB = window.SB, $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  var parseVal = function (raw) { if (raw == null || raw === '') return null; var s = String(raw).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'); var n = parseFloat(s); return isNaN(n) ? null : n; };
  var fmtBR = function (n) { return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  function toast(msg, ok) {
    var t = document.createElement('div'); t.textContent = msg;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10000;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (ok ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4000);
  }
  function fill(sel, rows, vk, tk, ph) {
    sel.innerHTML = (ph ? '<option value="">' + ph + '</option>' : '') + (rows || []).map(function (r) {
      return '<option value="' + esc(r[vk]) + '">' + esc(r[tk]) + '</option>';
    }).join('');
  }
  var STEPS = (window.CONFIG && window.CONFIG.STEPS) || {};

  var EDIT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>';

  var pl = await window.ProcessList.mount($('gp-host'), {
    emptyText: 'Nenhum processo.',
    storageKey: 'gestao-processos',
    refreshKeys: ['processes_admin'],
    load: function () { return window.Store.get('processes_admin'); },
    extraColumns: [{ label: 'Nº UAU', col: 'uau_number_prc', type: 'text' }],
    actions: [
      { label: 'Editar', cls: 'btn-primary', icon: EDIT_ICON, effect: 'none', run: function (p) { openEdit(p); return Promise.resolve(); } },
    ],
  });

  // ---------------- Modal de edição ----------------
  function openEdit(proc) {
    var appropriationMap = {}, attachments = { boleto: proc.attachment_url_prc || null, nf: proc.attachment_url2_prc || null };
    var installments = [];

    var o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = '<div class="modal-box" style="width:760px;max-width:96vw;max-height:92vh;overflow:auto">'
      + '<button class="modal-x" aria-label="Fechar">×</button>'
      + '<div class="modal-title">Editar Processo #' + esc(proc.id_prc) + '</div>'
      + '<div class="gp-uau" style="margin:-4px 0 12px">Nº UAU (não editável): <b>' + esc(proc.uau_number_prc || '—') + '</b></div>'
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
      + '<textarea id="gp-reason" rows="2" maxlength="500" placeholder="Descreva o motivo — ficará no histórico do processo."></textarea></div>'
      + '</div>'
      + '<div class="modal-actions"><button class="btn btn-light" id="gp-cancel">Cancelar</button>'
      + '<button class="btn btn-primary" id="gp-save">Salvar alteração</button></div>'
      + '</div>';
    document.body.appendChild(o);
    function close() { o.remove(); }
    o.addEventListener('click', function (e) { if (e.target === o || e.target.classList.contains('modal-x')) close(); });
    o.querySelector('#gp-cancel').addEventListener('click', close);

    // ----- listas + cascata -----
    async function loadBuildings(company, keep) {
      var el = o.querySelector('#gp-obra'); el.innerHTML = '<option value="">Carregando…</option>';
      try { fill(el, await window.Store.get('obras', company), 'codigo', 'nome', 'Selecione'); }
      catch (e) { el.innerHTML = '<option value="">Erro</option>'; }
      if (keep) el.value = keep;
    }
    async function loadAppropriations(company, obra, keepComp, keepSup) {
      var ap = o.querySelector('#gp-apropriacao'); ap.innerHTML = '<option value="">Carregando…</option>'; appropriationMap = {};
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
        ap.innerHTML = '<option value="">Selecione</option>' + opts.map(function (op) { return '<option value="' + esc(op.k) + '">' + esc(op.t) + '</option>'; }).join('');
        if (cur) ap.value = cur;
      } catch (e) { ap.innerHTML = '<option value="">Erro</option>'; }
    }

    (async function populate() {
      try {
        fill(o.querySelector('#gp-empresa'), await window.Store.get('empresas'), 'codigo', 'nome', 'Selecione');
        fill(o.querySelector('#gp-tipo'), await window.Store.get('process_kinds'), 'id_pkn', 'name_pkn', 'Selecione');
        fill(o.querySelector('#gp-tipodoc'), await window.Store.get('document_kinds'), 'id_dck', 'name_dck', 'Selecione');
      } catch (e) { }
      o.querySelector('#gp-status').innerHTML = Object.keys(STEPS).map(function (id) {
        return '<option value="' + esc(id) + '">' + esc(STEPS[id]) + ' (' + id + ')</option>';
      }).join('');

      o.querySelector('#gp-empresa').value = proc.company_prc || '';
      await loadBuildings(proc.company_prc, proc.building_prc);
      await loadAppropriations(proc.company_prc, proc.building_prc, proc.composition_prc, proc.supply_prc);
      o.querySelector('#gp-tipo').value = proc.kind_prc != null ? String(proc.kind_prc) : '';
      o.querySelector('#gp-tipodoc').value = proc.doc_kind_prc != null ? String(proc.doc_kind_prc) : '';
      o.querySelector('#gp-urgente').value = proc.is_urgent_prc ? '1' : '0';
      o.querySelector('#gp-numdoc').value = proc.fiscal_doc_prc || '';
      o.querySelector('#gp-emissao').value = proc.issue_date_prc ? String(proc.issue_date_prc).split('T')[0] : '';
      o.querySelector('#gp-venc').value = proc.due_date_prc ? String(proc.due_date_prc).split('T')[0] : '';
      o.querySelector('#gp-valor').value = proc.value_prc != null ? 'R$ ' + fmtBR(proc.value_prc) : '';
      o.querySelector('#gp-historico').value = proc.description_prc || '';
      o.querySelector('#gp-pessoa').value = proc.person_prc != null ? String(proc.person_prc) : '';
      o.querySelector('#gp-pessoa-input').value = proc.fornecedor_nome || '';
      o.querySelector('#gp-status').value = String(proc.status_step_prc);
      o.querySelector('#gp-ativo').value = proc.active_prc === false ? 'false' : 'true';

      try {
        var insRows = await window.Store.get('installments', proc.uuid_prc);
        installments = (insRows || []).map(function (r) { return { due_date_ins: r.due_date_ins ? String(r.due_date_ins).split('T')[0] : '', value_ins: r.value_ins }; });
      } catch (e) { installments = []; }
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

    // ----- fornecedor (busca) -----
    var pin = o.querySelector('#gp-pessoa-input'), pres = o.querySelector('#gp-pessoa-results'), ptmr = null;
    async function searchSuppliers(term) {
      pres.innerHTML = '<div class="it">Buscando…</div>'; pres.classList.add('show');
      try {
        var rs = await window.Store.get('fornecedores', term || '');
        pres.innerHTML = rs.length ? rs.map(function (r) { return '<div class="it" data-id="' + r.id + '" data-nome="' + esc(r.nome) + '">' + esc(r.nome) + '<small>' + esc(r.cpf_cnpj || '') + '</small></div>'; }).join('') : '<div class="it">Nada encontrado</div>';
        pres.querySelectorAll('.it[data-id]').forEach(function (it) {
          it.addEventListener('click', function () { o.querySelector('#gp-pessoa').value = it.getAttribute('data-id'); pin.value = it.getAttribute('data-nome'); pres.classList.remove('show'); });
        });
      } catch (e) { pres.innerHTML = '<div class="it">' + esc(e.message) + '</div>'; }
    }
    pin.addEventListener('focus', function () { searchSuppliers(pin.value.trim()); });
    pin.addEventListener('input', function () { o.querySelector('#gp-pessoa').value = ''; clearTimeout(ptmr); ptmr = setTimeout(function () { searchSuppliers(pin.value.trim()); }, 300); });
    o.addEventListener('click', function (e) { if (!pin.contains(e.target) && !pres.contains(e.target)) pres.classList.remove('show'); });

    // ----- parcelas -----
    function installmentsSum() { return Math.round(installments.reduce(function (a, p) { return a + (Number(p.value_ins) || 0); }, 0) * 100) / 100; }
    function updateSum() {
      var el = o.querySelector('#gp-parc-sum'); if (!el) return;
      var total = parseVal(o.querySelector('#gp-valor').value) || 0, soma = installmentsSum();
      var ok = installments.length > 0 && Math.abs(soma - total) < 0.01;
      el.textContent = installments.length ? ('Soma das parcelas: R$ ' + fmtBR(soma) + ' de R$ ' + fmtBR(total) + (ok ? ' ✓' : ' — diferente do valor')) : 'Sem parcelas.';
      el.classList.toggle('bad', installments.length > 0 && !ok);
    }
    function renderInstallments() {
      var box = o.querySelector('#gp-parcelas');
      box.innerHTML = installments.map(function (p, i) {
        return '<div class="gp-parc-row"><span class="pl">Parcela ' + (i + 1) + '</span>'
          + '<input type="date" value="' + esc(p.due_date_ins || '') + '" data-i="' + i + '" data-f="due">'
          + '<input type="number" step="0.01" min="0" value="' + esc(p.value_ins != null ? p.value_ins : '') + '" data-i="' + i + '" data-f="val">'
          + '<button type="button" class="rm" title="Remover" data-rm="' + i + '">×</button></div>';
      }).join('');
      box.querySelectorAll('input').forEach(function (inp) {
        inp.addEventListener('input', function () {
          var i = +inp.getAttribute('data-i'), f = inp.getAttribute('data-f');
          if (f === 'due') installments[i].due_date_ins = inp.value; else installments[i].value_ins = inp.value === '' ? null : Number(inp.value);
          updateSum();
        });
      });
      box.querySelectorAll('[data-rm]').forEach(function (b) { b.addEventListener('click', function () { installments.splice(+b.getAttribute('data-rm'), 1); renderInstallments(); }); });
      updateSum();
    }
    function generateInstallments() {
      var total = parseVal(o.querySelector('#gp-valor').value), count = parseInt(o.querySelector('#gp-qtd').value, 10), first = o.querySelector('#gp-venc').value;
      var err = o.querySelector('#gp-parc-erro');
      if (!total || total <= 0 || !count || count < 1 || !first) { err.textContent = 'Preencha Valor, Quantidade e Vencimento (1ª parcela) para gerar.'; err.style.display = 'block'; return; }
      err.style.display = 'none'; installments = [];
      var base = Math.floor((total / count) * 100) / 100, acc = 0, fd = new Date(first + 'T12:00:00Z');
      for (var i = 0; i < count; i++) {
        var val = (i === count - 1) ? Math.round((total - acc) * 100) / 100 : base; acc += val;
        var d = new Date(fd); d.setUTCMonth(d.getUTCMonth() + i);
        installments.push({ due_date_ins: d.toISOString().split('T')[0], value_ins: val });
      }
      renderInstallments();
    }

    // ----- anexos (upload/substituir) -----
    // (mantém simples: não exibe preview; upload substitui a URL usada no save)
    // ----- salvar -----
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
      var btn = this; btn.disabled = true; btn.textContent = 'Salvando…';
      try {
        var payload = { process: collect(), reason: reason };
        if (installments.length) payload.installments = installments.map(function (p) { return { due_date_ins: p.due_date_ins, value_ins: Number(p.value_ins) }; });
        await window.API.post('/processes/' + proc.uuid_prc + '/admin-edit', payload);
        window.Store.invalidate('processes_admin'); window.invalidateFlowCaches && window.invalidateFlowCaches();
        toast('Processo atualizado.', true); close(); await pl.reload();
      } catch (e) { toast('Erro: ' + e.message); btn.disabled = false; btn.textContent = 'Salvar alteração'; }
    });
  }
}
