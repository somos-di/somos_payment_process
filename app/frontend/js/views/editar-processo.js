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

  var minD = new Date(); minD.setDate(minD.getDate() + 10);
  var MIN_VENC = minD.toISOString().split('T')[0];

  var ready = false, apropMap = {}, anexos = { boleto: null, nf: null }, tmr = null;

  var proc;
  try {
    var rows = await SB.select('v_processes', function (q) { return q.eq('uuid_prc', uuid); });
    proc = rows[0];
    if (!proc) { $('ep-loading').textContent = 'Processo não encontrado.'; return; }
  } catch (e) { $('ep-loading').textContent = 'Erro: ' + e.message; return; }

  $('ep-title').textContent = 'Editar Processo #' + proc.id_prc;
  anexos.boleto = proc.attachment_url_prc || null;
  anexos.nf = proc.attachment_url2_prc || null;

  try {
    fill($('ep-empresa'), await window.Store.get('empresas'), 'codigo', 'nome', 'Selecione');
    fill($('ep-tipo'), await window.Store.get('process_kinds'), 'id_pkn', 'name_pkn', 'Selecione');
    fill($('ep-tipodoc'), await window.Store.get('document_kinds'), 'id_dck', 'name_dck', 'Selecione');
  } catch (e) { $('ep-loading').textContent = 'Erro ao carregar listas: ' + e.message; return; }

  async function loadObras(emp, keep) {
    var o = $('ep-obra'); o.innerHTML = '<option value="">Carregando…</option>';
    try { fill(o, await window.Store.get('obras', emp), 'codigo', 'nome', 'Selecione'); }
    catch (e) { o.innerHTML = '<option value="">Erro</option>'; }
    if (keep) o.value = keep;
  }
  async function loadAprop(emp, obra, keepComp, keepSup) {
    var ap = $('ep-apropriacao'); ap.innerHTML = '<option value="">Carregando…</option>'; apropMap = {};
    try {
      var rs = await window.Store.get('compositions_lk', emp + '|' + obra);
      var seen = {}, opts = [];
      rs.forEach(function (r) {
        var key = r.codigo_composicao + '|' + r.codigo_insumo;
        if (seen[key] || !r.codigo_composicao || !r.codigo_insumo) return; seen[key] = 1;
        apropMap[key] = { comp: r.codigo_composicao, insumo: r.codigo_insumo };
        opts.push({ k: key, t: (r.descricao_composicao || r.codigo_composicao) + ' / ' + (r.descricao_insumo || r.codigo_insumo) });
      });
      var cur = keepComp ? (keepComp + '|' + keepSup) : '';

      if (cur && !apropMap[cur]) { apropMap[cur] = { comp: keepComp, insumo: keepSup }; opts.unshift({ k: cur, t: keepComp + ' / ' + keepSup }); }
      ap.innerHTML = '<option value="">Selecione</option>' + opts.map(function (o) { return '<option value="' + esc(o.k) + '">' + esc(o.t) + '</option>'; }).join('');
      if (cur) ap.value = cur;
    } catch (e) { ap.innerHTML = '<option value="">Erro</option>'; }
  }

  $('ep-empresa').value = proc.company_prc || '';
  await loadObras(proc.company_prc, proc.building_prc);
  await loadAprop(proc.company_prc, proc.building_prc, proc.composition_prc, proc.supply_prc);
  $('ep-tipo').value = proc.kind_prc != null ? String(proc.kind_prc) : '';
  $('ep-tipodoc').value = proc.doc_kind_prc != null ? String(proc.doc_kind_prc) : '';
  $('ep-urgente').value = proc.is_urgent_prc ? '1' : '0';
  $('ep-numdoc').value = proc.fiscal_doc_prc || '';
  $('ep-emissao').value = proc.issue_date_prc || '';
  $('ep-venc').min = MIN_VENC;
  $('ep-venc').value = proc.due_date_prc || '';
  $('ep-valor').value = proc.value_prc != null ? 'R$ ' + fmtBR(proc.value_prc) : '';
  $('ep-historico').value = proc.description_prc || '';
  $('ep-pessoa').value = proc.person_prc != null ? String(proc.person_prc) : '';
  $('ep-pessoa-input').value = proc.fornecedor_nome || '';
  renderAnexo('boleto'); renderAnexo('nf');

  $('ep-loading').hidden = true; $('ep-grid').hidden = false;

  if (proc.status_step_prc !== window.CONFIG.STATUS.correcao) {
    $('ep-status').textContent = 'Somente processos em correção podem ser editados.';
    $('ep-reenviar').disabled = true;
    return;
  }
  ready = true;

  function vencOk() { var v = $('ep-venc').value; return !!v && v >= MIN_VENC; }
  function showVencErro() { $('ep-venc-erro').style.display = vencOk() || !$('ep-venc').value ? 'none' : 'block'; }

  function collect() {
    var ap = apropMap[$('ep-apropriacao').value] || {};
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
      attachment_url_prc: anexos.boleto, attachment_url2_prc: anexos.nf,
    };
  }
  async function save(resend) {
    if (!ready) return;
    showVencErro();
    if (!vencOk()) { $('ep-status').textContent = 'Ajuste o vencimento (≥ 10 dias) para salvar.'; if (resend) toast('Vencimento deve ser pelo menos 10 dias a partir de hoje.'); return; }
    $('ep-status').textContent = resend ? 'Reenviando…' : 'Salvando…';
    try {
      await window.API.post('/processes/' + uuid + '/correct', { process: collect(), resend: !!resend });
      if (resend) {
        window.Store.invalidate('processes');
        toast('Processo corrigido e reenviado para aprovação.', true); window.location.hash = '#/correcao';
      } else $('ep-status').textContent = 'Salvo automaticamente ✓';
    } catch (e) { $('ep-status').textContent = 'Erro ao salvar'; toast('Erro: ' + e.message); }
  }
  function scheduleSave() { if (!ready) return; $('ep-status').textContent = 'Editando…'; clearTimeout(tmr); tmr = setTimeout(function () { save(false); }, 700); }

  $('ep-empresa').addEventListener('change', async function () {
    await loadObras(this.value); await loadAprop(this.value, $('ep-obra').value); scheduleSave();
  });
  $('ep-obra').addEventListener('change', async function () {
    await loadAprop($('ep-empresa').value, this.value); scheduleSave();
  });
  ['ep-apropriacao', 'ep-tipo', 'ep-tipodoc', 'ep-urgente', 'ep-numdoc', 'ep-emissao', 'ep-historico'].forEach(function (id) {
    $(id).addEventListener('change', scheduleSave); $(id).addEventListener('input', scheduleSave);
  });
  $('ep-venc').addEventListener('change', function () { showVencErro(); scheduleSave(); });
  $('ep-valor').addEventListener('input', scheduleSave);
  $('ep-valor').addEventListener('blur', function () { var n = parseVal(this.value); if (n != null) this.value = 'R$ ' + fmtBR(n); });

  var pin = $('ep-pessoa-input'), pres = $('ep-pessoa-results'), ptmr = null;
  async function searchPessoas(term) {
    pres.innerHTML = '<div class="it">Buscando…</div>'; pres.classList.add('show');
    try {
      var rs = await window.Store.get('fornecedores', term || '');
      pres.innerHTML = rs.length ? rs.map(function (r) { return '<div class="it" data-id="' + r.id + '" data-nome="' + esc(r.nome) + '">' + esc(r.nome) + '<small>' + esc(r.cpf_cnpj || '') + '</small></div>'; }).join('') : '<div class="it">Nada encontrado</div>';
      pres.querySelectorAll('.it[data-id]').forEach(function (it) {
        it.addEventListener('click', function () { $('ep-pessoa').value = it.getAttribute('data-id'); pin.value = it.getAttribute('data-nome'); pres.classList.remove('show'); scheduleSave(); });
      });
    } catch (e) { pres.innerHTML = '<div class="it">' + esc(e.message) + '</div>'; }
  }
  pin.addEventListener('focus', function () { searchPessoas(pin.value.trim()); });
  pin.addEventListener('input', function () { $('ep-pessoa').value = ''; clearTimeout(ptmr); ptmr = setTimeout(function () { searchPessoas(pin.value.trim()); }, 300); });
  document.addEventListener('click', function (e) { if (!pin.contains(e.target) && !pres.contains(e.target)) pres.classList.remove('show'); });

  function renderAnexo(key) {
    var box = $('ep-' + key + '-file'), url = anexos[key];
    var label = key === 'boleto' ? 'Boleto' : 'Documento Fiscal';
    if (!url) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = '<a href="' + esc(url) + '" target="_blank">' + label + ' anexado</a>'
      + '<span style="display:inline-flex;gap:8px;align-items:center">'
      + '<label class="btn btn-light" for="ep-' + key + '" style="padding:5px 10px;font-size:12px;cursor:pointer">Substituir</label>'
      + '<button title="Remover anexo" aria-label="Remover anexo">×</button></span>';
    box.querySelector('button').addEventListener('click', function () { anexos[key] = null; renderAnexo(key); scheduleSave(); });
  }
  async function upload(file, key) {
    $('ep-status').textContent = 'Enviando anexo…';
    try { var r = await SB.upload(file); anexos[key] = r ? r.url : null; renderAnexo(key); save(false); }
    catch (e) { $('ep-status').textContent = ''; toast('Anexo não enviado: ' + (e.message || 'storage')); }
  }

  $('ep-boleto').addEventListener('change', function () { if (this.files[0]) upload(this.files[0], 'boleto'); this.value = ''; });
  $('ep-nf').addEventListener('change', function () { if (this.files[0]) upload(this.files[0], 'nf'); this.value = ''; });

  $('ep-reenviar').addEventListener('click', function () { save(true); });
  showVencErro();
}
