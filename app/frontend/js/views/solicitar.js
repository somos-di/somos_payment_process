// Solicitar — wizard de 4 passos (segue o fluxo do solicitar.html do Mitra,
// adaptado: supabase + design system + Store.mutate no save). Sem condicional de
// reembolso: tudo é "Tipo de Processo" (process_kinds). Departamento = do usuário.
async function initView_solicitar() {
  var SB = window.SB;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function toast(msg, ok) {
    var t = document.createElement('div'); t.textContent = msg;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (ok ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
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
  var step = 1, parcelas = [], apropMap = {}, anexos = { boleto: null, nf: null }, userId = null, deptId = null;

  // --- stepper ---
  function renderStepper() {
    $('sol-stepper').innerHTML = STEPS.map(function (s) {
      var cls = step > s.n ? 'done' : (step === s.n ? 'current' : '');
      var inner = step > s.n ? '✓' : s.n;
      return '<li class="step ' + cls + '"><span class="num">' + inner + '</span><span><span class="st">' + s.t + '</span><br><span class="sd">' + s.d + '</span></span></li>';
    }).join('');
  }
  function show() {
    renderStepper();
    document.querySelectorAll('.sol-step').forEach(function (el) { el.hidden = Number(el.getAttribute('data-step')) !== step; });
    $('sol-back').disabled = step === 1;
    // "Salvar Processo" só aparece no último passo e só habilita com tudo preenchido.
    $('sol-next').hidden = step === 4;
    $('sol-save').hidden = step !== 4;
    $('sol-save').disabled = !allValid();
    $('sol-next').disabled = !validStep(step);
  }
  // numdoc (fiscal) e histórico/descrição NÃO são obrigatórios; o resto é.
  function validStep(n) {
    if (n === 1) return !!($('sol-empresa').value && $('sol-obra').value);
    if (n === 2) return !!($('sol-pessoa').value && $('sol-apropriacao').value && $('sol-tipo').value
      && $('sol-urgente').value !== '' && $('sol-tipodoc').value && parseVal($('sol-valor').value) > 0);
    if (n === 3) return parcelas.length > 0 && parseInt($('sol-qtd').value, 10) === parcelas.length && somaOk().ok;
    return true;
  }
  function allValid() { return validStep(1) && validStep(2) && validStep(3); }

  // --- carrega usuário + lookups (do backend: /auth/me traz id + departamento) ---
  try {
    var me = (window.Auth && window.Auth.getUser()) || null;
    if (!me) { try { me = await window.API.get('/auth/me'); } catch (e) { } }
    userId = me ? me.id : null;
    deptId = me ? me.department : null;
  } catch (e) { }

  function fill(sel, rows, vk, tk, ph) {
    sel.innerHTML = '<option value="">' + ph + '</option>' + rows.map(function (r) {
      return '<option value="' + esc(r[vk]) + '">' + esc(r[tk]) + '</option>';
    }).join('');
  }
  try {
    fill($('sol-empresa'), await window.Store.get('empresas'), 'codigo', 'nome', 'Selecione uma empresa');
    fill($('sol-tipo'), await window.Store.get('process_kinds'), 'id_pkn', 'name_pkn', 'Selecione o tipo');
    fill($('sol-tipodoc'), await window.Store.get('document_kinds'), 'id_dck', 'name_dck', 'Selecione');
  } catch (e) { toast('Falha ao carregar listas: ' + e.message); }

  // --- cascatas ---
  $('sol-empresa').addEventListener('change', async function () {
    var emp = this.value;
    var obra = $('sol-obra'); obra.disabled = true; obra.innerHTML = '<option value="">Carregando…</option>';
    $('sol-apropriacao').disabled = true; $('sol-apropriacao').innerHTML = '<option value="">Selecione uma obra</option>';
    apropMap = {};
    if (emp) {
      try {
        var obras = await window.Store.get('obras', emp);
        fill(obra, obras, 'codigo', 'nome', 'Selecione uma obra'); obra.disabled = false;
      } catch (e) { obra.innerHTML = '<option value="">Erro</option>'; obra.disabled = false; }
    }
    show();
  });
  $('sol-obra').addEventListener('change', async function () {
    var emp = $('sol-empresa').value, obra = this.value;
    var ap = $('sol-apropriacao'); ap.disabled = true; ap.innerHTML = '<option value="">Carregando…</option>'; apropMap = {};
    if (obra) {
      try {
        var rows = await window.Store.get('compositions_lk', emp + '|' + obra);
        var seen = {}; var opts = [];
        rows.forEach(function (r) {
          var key = r.codigo_composicao + '|' + r.codigo_insumo;
          if (seen[key] || !r.codigo_composicao || !r.codigo_insumo) return; seen[key] = 1;
          apropMap[key] = { comp: r.codigo_composicao, insumo: r.codigo_insumo };
          opts.push({ k: key, t: (r.descricao_composicao || r.codigo_composicao) + ' / ' + (r.descricao_insumo || r.codigo_insumo) });
        });
        ap.innerHTML = '<option value="">Selecione uma apropriação</option>' + opts.map(function (o) { return '<option value="' + esc(o.k) + '">' + esc(o.t) + '</option>'; }).join('');
        ap.disabled = false;
      } catch (e) { ap.innerHTML = '<option value="">Erro</option>'; ap.disabled = false; }
    }
    show();
  });

  // --- pessoa (busca paginada): mostra 100 por padrão; ao digitar, busca no banco
  //     por nome OU cpf/cnpj (coluna cpf_pes, exposta como cpf_cnpj na v_fornecedores).
  var pin = $('sol-pessoa-input'), pres = $('sol-pessoa-results'), tmr = null;
  async function searchPessoas(term) {
    pres.innerHTML = '<div class="it">Buscando…</div>'; pres.classList.add('show');
    try {
      var rows = await window.Store.get('fornecedores', term || '');
      pres.innerHTML = rows.length
        ? rows.map(function (r) { return '<div class="it" data-id="' + r.id + '" data-nome="' + esc(r.nome) + '">' + esc(r.nome) + '<small>' + esc(r.cpf_cnpj || '') + '</small></div>'; }).join('')
        : '<div class="it">Nada encontrado</div>';
      pres.querySelectorAll('.it[data-id]').forEach(function (it) {
        it.addEventListener('click', function () { $('sol-pessoa').value = it.getAttribute('data-id'); pin.value = it.getAttribute('data-nome'); pres.classList.remove('show'); show(); });
      });
    } catch (e) { pres.innerHTML = '<div class="it">' + esc(e.message) + '</div>'; }
  }
  pin.addEventListener('focus', function () { if (!$('sol-pessoa').value) searchPessoas(pin.value.trim()); });
  pin.addEventListener('input', function () {
    var term = pin.value.trim(); $('sol-pessoa').value = '';
    clearTimeout(tmr); tmr = setTimeout(function () { searchPessoas(term); }, 300); show();
  });
  document.addEventListener('click', function (e) { if (!pin.contains(e.target) && !pres.contains(e.target)) pres.classList.remove('show'); });

  // valor format
  $('sol-valor').addEventListener('blur', function () { var n = parseVal(this.value); if (!isNaN(n) && n > 0) this.value = 'R$ ' + fmtBR(n); show(); });
  ['sol-tipo', 'sol-urgente', 'sol-tipodoc', 'sol-apropriacao', 'sol-numdoc', 'sol-emissao', 'sol-valor', 'sol-historico'].forEach(function (id) {
    $(id).addEventListener('input', show); $(id).addEventListener('change', show);
  });

  // --- parcelas ---
  function gerar() {
    var total = parseVal($('sol-valor').value), count = parseInt($('sol-qtd').value, 10), first = $('sol-venc1').value;
    var box = $('sol-parcelas');
    if (!total || total <= 0 || !count || count < 1 || !first) { box.innerHTML = '<p class="empty">Preencha valor, quantidade e 1º vencimento.</p>'; parcelas = []; show(); return; }
    parcelas = []; var base = Math.floor((total / count) * 100) / 100, acc = 0, fd = new Date(first + 'T12:00:00Z'), html = '';
    for (var i = 0; i < count; i++) {
      var val = (i === count - 1) ? (total - acc).toFixed(2) : base.toFixed(2); acc += parseFloat(val);
      var d = new Date(fd); d.setUTCMonth(d.getUTCMonth() + i); var venc = d.toISOString().split('T')[0];
      parcelas.push({ vencimento: venc, valor: val });
      html += '<div class="parc-row"><span class="pl">Parcela ' + (i + 1) + '</span>'
        + '<input type="date" value="' + venc + '" data-i="' + i + '" data-f="vencimento">'
        + '<input type="number" step="0.01" value="' + val + '" data-i="' + i + '" data-f="valor"></div>';
    }
    box.innerHTML = html;
    box.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('input', function () { var i = +inp.getAttribute('data-i'); parcelas[i][inp.getAttribute('data-f')] = inp.value; });
    });
    show();
  }
  $('sol-gerar').addEventListener('click', gerar);
  function somaOk() { var bruto = parseVal($('sol-valor').value) || 0, s = parcelas.reduce(function (a, p) { return a + (parseFloat(p.valor) || 0); }, 0); return { soma: Math.round(s * 100) / 100, bruto: bruto, ok: Math.abs(Math.round(s * 100) / 100 - bruto) < 0.01 }; }

  // --- anexos (upload via backend -> Storage; opcional) ---
  async function upload(file, key) {
    try {
      var res = await SB.upload(file); // { url }
      anexos[key] = res ? res.url : null;
      $('sol-' + (key === 'boleto' ? 'boleto' : 'nf') + '-name').textContent = file.name;
    } catch (e) { toast('Anexo não enviado (' + (e.message || 'storage') + ') — verifique o bucket "attachments".'); }
  }
  $('sol-boleto').addEventListener('change', function () { if (this.files[0]) upload(this.files[0], 'boleto'); });
  $('sol-nf').addEventListener('change', function () { if (this.files[0]) upload(this.files[0], 'nf'); });

  // --- navegação ---
  $('sol-back').addEventListener('click', function () { if (step > 1) { step--; show(); } });
  $('sol-next').addEventListener('click', function () {
    if (!validStep(step)) return;
    if (step === 3) {
      var urgente = $('sol-urgente').value === '1';
      if (!urgente && $('sol-venc1').value) {
        var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        var diff = (new Date($('sol-venc1').value + 'T00:00:00').getTime() - hoje.getTime()) / 86400000;
        if (diff < 10) { $('sol-parc-erro-msg').textContent = 'Prazo mínimo de 10 dias a partir de hoje para o 1º vencimento. Ajuste a data.'; $('sol-parc-erro').hidden = false; return; }
      }
      var s = somaOk();
      if (!s.ok) { $('sol-parc-erro-msg').textContent = 'A soma das parcelas (R$ ' + fmtBR(s.soma) + ') difere do valor bruto (R$ ' + fmtBR(s.bruto) + '). Ajuste.'; $('sol-parc-erro').hidden = false; return; }
      $('sol-parc-erro').hidden = true;
    }
    if (step < 4) { step++; show(); }
  });

  // --- modal de validação + save ---
  function txt(sel) { var o = sel.options[sel.selectedIndex]; return o ? o.text : '—'; }
  $('sol-save').addEventListener('click', function () {
    var rows = [
      ['Empresa', txt($('sol-empresa'))], ['Obra', txt($('sol-obra'))], ['Fornecedor', pin.value || '—'],
      ['Apropriação', txt($('sol-apropriacao'))], ['Tipo de Processo', txt($('sol-tipo'))],
      ['Urgente', $('sol-urgente').value === '1' ? 'SIM' : 'NÃO'], ['Tipo de Documento', txt($('sol-tipodoc'))],
      ['Nº Documento', $('sol-numdoc').value || '—'], ['Data de Emissão', $('sol-emissao').value || '—'],
      ['Valor Total Bruto', 'R$ ' + fmtBR(parseVal($('sol-valor').value) || 0)], ['Parcelas', String(parcelas.length)],
    ];
    var o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = '<div class="modal-box"><div class="modal-title">Valide os dados do processo</div>'
      + '<div class="validate-table">' + rows.map(function (r) { return '<div class="vr"><div class="vk">' + esc(r[0]) + '</div><div class="vv">' + esc(r[1]) + '</div></div>'; }).join('') + '</div>'
      + '<div class="modal-actions"><button class="btn btn-light" id="m-cancel">Cancelar</button><button class="btn btn-primary" id="m-ok">Confirmar e Salvar</button></div></div>';
    document.body.appendChild(o);
    o.querySelector('#m-cancel').addEventListener('click', function () { o.remove(); });
    o.querySelector('#m-ok').addEventListener('click', async function () {
      var btn = this; btn.disabled = true; btn.textContent = 'Salvando…';
      try { await save(); o.remove(); toast('Processo salvo com sucesso!', true); window.location.hash = '#/consulta?kind=' + $('sol-tipo').value; }
      catch (e) { btn.disabled = false; btn.textContent = 'Confirmar e Salvar'; toast('Erro ao salvar: ' + e.message); }
    });
  });

  async function save() {
    var ap = apropMap[$('sol-apropriacao').value] || {};
    // author_prc e uuid são definidos no backend (JWT + default do banco).
    await window.Store.mutate('processes', function () {
      var process = {
        description_prc: $('sol-historico').value || null,
        company_prc: $('sol-empresa').value, building_prc: $('sol-obra').value,
        composition_prc: ap.comp || null, supply_prc: ap.insumo || null,
        person_prc: $('sol-pessoa').value ? Number($('sol-pessoa').value) : null,
        kind_prc: Number($('sol-tipo').value), department_prc: deptId,
        doc_kind_prc: $('sol-tipodoc').value ? Number($('sol-tipodoc').value) : null,
        is_urgent_prc: $('sol-urgente').value === '1',
        issue_date_prc: $('sol-emissao').value || null,
        due_date_prc: parcelas[0] ? parcelas[0].vencimento : null,
        value_prc: parseVal($('sol-valor').value), fiscal_doc_prc: $('sol-numdoc').value || null,
        attachment_url_prc: anexos.boleto, attachment_url2_prc: anexos.nf,
        // status_step_prc/approving_status_prc não são enviados: o RPC ignora colunas
        // de controle e o banco aplica o default (1 = Aguardando aprovação).
      };
      var installments = parcelas.map(function (p) { return { due_date_ins: p.vencimento, value_ins: Number(p.valor) }; });
      return window.API.post('/processes/full', { process: process, installments: installments });
    });
  }

  show();
}
