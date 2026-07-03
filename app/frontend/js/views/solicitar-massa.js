async function initView_solicitar_massa() {
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  var MAPA = [
    { col: 'Descrição', alias: 'descr', key: 'description_prc' },
    { col: 'Empresa (código)', alias: 'companyidproc', key: 'company_prc', req: true },
    { col: 'Obra (código)', alias: 'buildingidproc', key: 'building_prc', req: true },
    { col: 'Composição (código)', alias: 'compositionidproc', key: 'composition_prc' },
    { col: 'Insumo (código)', alias: 'supplyidproc', key: 'supply_prc' },
    { col: 'Fornecedor (código)', alias: 'personidproc', key: 'person_prc', tipo: 'int' },
    { col: 'Urgente', alias: 'isurgentproc', key: 'is_urgent_prc', tipo: 'bool' },
    { col: 'Data de Emissão', alias: 'issuedateproc', key: 'issue_date_prc', tipo: 'data' },
    { col: 'Data de Vencimento', alias: 'duedateproc', key: 'due_date_prc', tipo: 'data', req: true },
    { col: 'Valor Total', alias: 'processvalueproc', key: 'value_prc', tipo: 'valor', req: true },
    { col: 'Nº Documento Fiscal', alias: 'fiscaldocumentproc', key: 'fiscal_doc_prc' },
    { col: 'Qtd. Parcelas', alias: 'installmentQuantityproc', key: '__qtd', tipo: 'int' },
    { col: 'Tipo de Processo (ID)', alias: 'processkindproc', key: 'kind_prc', tipo: 'int', req: true },
  ];
  var COLS = MAPA.map(function (m) { return m.col; });
  var lc = function (s) { return String(s).trim().toLowerCase(); };
  var pad2 = function (n) { return String(n).padStart(2, '0'); };

  function toYMD(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date && !isNaN(v)) return v.getFullYear() + '-' + pad2(v.getMonth() + 1) + '-' + pad2(v.getDate());
    var s = String(v).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return m[3] + '-' + m[2] + '-' + m[1];
    return s;
  }
  function toValor(v) {
    if (v == null || v === '') return NaN;
    if (typeof v === 'number') return v;
    var s = String(v).trim().replace(/[R$\s]/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s); return isNaN(n) ? NaN : n;
  }
  function toBool(v) { var s = lc(v == null ? '' : v); return s === '1' || s === 'sim' || s === 's' || s === 'true' || s === 'urgente'; }
  function toInt(v) { var n = parseInt(String(v).trim(), 10); return isNaN(n) ? null : n; }
  function conv(m, raw) {
    if (m.tipo === 'data') return toYMD(raw) || null;
    if (m.tipo === 'valor') { var n = toValor(raw); return isNaN(n) ? null : n; }
    if (m.tipo === 'bool') return toBool(raw);
    if (m.tipo === 'int') return raw === '' || raw == null ? null : toInt(raw);
    var s = raw == null ? '' : String(raw).trim(); return s === '' ? null : s;
  }
  function gerarParcelas(total, count, firstYMD) {
    var out = [];
    if (!total || total <= 0 || !count || count < 1 || !firstYMD) return out;
    var base = Math.floor((total / count) * 100) / 100, acc = 0, first = new Date(firstYMD + 'T12:00:00Z');
    for (var i = 0; i < count; i++) {
      var val = (i === count - 1) ? (total - acc).toFixed(2) : base.toFixed(2); acc += parseFloat(val);
      var d = new Date(first); d.setUTCMonth(d.getUTCMonth() + i);
      out.push({ due_date_ins: d.toISOString().split('T')[0], value_ins: Number(val) });
    }
    return out;
  }

  function loadXLSX() {
    return new Promise(function (res, rej) {
      if (window.XLSX) return res(window.XLSX);
      var s = document.createElement('script');
      s.src = 'js/vendor/xlsx.full.min.js';
      s.onload = function () { res(window.XLSX); };
      s.onerror = function () { rej(new Error('Falha ao carregar a biblioteca de planilha')); };
      document.head.appendChild(s);
    });
  }

  var linhas = [];

  async function buildInstructionsSheet(XLSX) {
    var kinds = [];
    try { kinds = await window.Store.get('process_kinds'); } catch (e) {  }
    var rows = [
      ['COMO PREENCHER — LANÇAMENTO EM MASSA'],
      ['Preencha a aba "Processos" (uma linha por processo) e importe o arquivo nesta tela.'],
      ['Não renomeie as colunas do cabeçalho. Datas: AAAA-MM-DD ou DD/MM/AAAA. Valores: 1000,00.'],
      [],
      ['Coluna', 'Obrigatória', 'Como preencher'],
      ['Descrição', 'não', 'Descrição do processo (texto livre).'],
      ['Empresa (código)', 'SIM', 'Código da empresa (o mesmo exibido na tela Solicitar).'],
      ['Obra (código)', 'SIM', 'Código da obra dentro da empresa.'],
      ['Composição (código)', 'não', 'Código da composição (apropriação).'],
      ['Insumo (código)', 'não', 'Código do insumo (apropriação).'],
      ['Fornecedor (código)', 'não', 'Código do fornecedor.'],
      ['Urgente', 'não', '1 ou sim = urgente · 0 ou vazio = normal.'],
      ['Data de Emissão', 'não', 'Data de emissão do documento (AAAA-MM-DD ou DD/MM/AAAA).'],
      ['Data de Vencimento', 'SIM', 'Vencimento da 1ª parcela (AAAA-MM-DD ou DD/MM/AAAA).'],
      ['Valor Total', 'SIM', 'Valor TOTAL do processo (ex.: 1000,00).'],
      ['Nº Documento Fiscal', 'não', 'Número do documento fiscal (apenas números).'],
      ['Qtd. Parcelas', 'não', 'Qtd. de parcelas mensais a partir do vencimento (vazio = 1); o valor total é dividido igualmente.'],
      ['Tipo de Processo (ID)', 'SIM', 'ID do tipo de processo — consulte a tabela abaixo.'],
      [],
      ['TIPOS DE PROCESSO — use o ID na coluna "Tipo de Processo (ID)"'],
      ['ID', 'Tipo'],
    ].concat((kinds || []).map(function (k) { return [k.id_pkn, k.name_pkn]; }));
    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 26 }, { wch: 12 }, { wch: 95 }];
    return ws;
  }

  async function baixarModelo() {
    try {
      var XLSX = await loadXLSX();
      var exemplo = ['Teste de lançamento em lote', 'CO146', 'RET28', 'C000013', 'I000168', '7907', '0', '2026-07-01', '2026-08-01', '1000,00', '12345', '1', '1'];
      var ws = XLSX.utils.aoa_to_sheet([COLS, exemplo]);
      ws['!cols'] = COLS.map(function (h) { return { wch: Math.max(14, h.length + 2) }; });
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Processos');
      XLSX.utils.book_append_sheet(wb, await buildInstructionsSheet(XLSX), 'Instruções');
      XLSX.writeFile(wb, 'modelo_lancamento_massa.xlsx');
    } catch (e) { erro(e.message); }
  }

  async function lerArquivo(file) {
    var XLSX = await loadXLSX();
    var buf = await file.arrayBuffer();
    var wb = XLSX.read(buf, { cellDates: true });
    var ws = wb.Sheets[wb.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    return rows.map(function (r) {
      var norm = {}; Object.keys(r).forEach(function (k) { norm[lc(k)] = r[k]; }); return norm;
    }).filter(function (r) { return Object.keys(r).some(function (k) { return String(r[k]).trim() !== ''; }); });
  }

  function mapByKey(key) { for (var i = 0; i < MAPA.length; i++) if (MAPA[i].key === key) return MAPA[i]; return null; }

  var names = { company: {}, building: {}, person: {}, kind: {}, composition: {} };
  async function resolveNames() {
    names = { company: {}, building: {}, person: {}, kind: {}, composition: {} };
    var companyMap = mapByKey('company_prc'), personMap = mapByKey('person_prc'), compositionMap = mapByKey('composition_prc');
    var companyIds = {}, personIds = {}, compositionIds = {};
    linhas.forEach(function (l) {
      var e = cell(companyMap, l); if (e) companyIds[String(e)] = 1;
      var p = cell(personMap, l); if (p != null) personIds[String(p)] = 1;
      var c = cell(compositionMap, l); if (c) compositionIds[String(c)] = 1;
    });
    try {
      var res = await Promise.all([
        window.Store.get('empresas'),
        window.Store.get('process_kinds'),
        Object.keys(companyIds).length ? window.SB.select('v_obras', function (q) { return q.in('empresa', Object.keys(companyIds)); }) : [],
        Object.keys(personIds).length ? window.SB.select('v_fornecedores', function (q) { return q.in('id', Object.keys(personIds).map(Number)); }) : [],
        Object.keys(compositionIds).length ? window.SB.select('v_compositions', function (q) { return q.in('composicao', Object.keys(compositionIds)); }) : [],
      ]);
      (res[0] || []).forEach(function (e) { names.company[String(e.codigo)] = e.nome; });
      (res[1] || []).forEach(function (k) { names.kind[String(k.id_pkn)] = k.name_pkn; });
      (res[2] || []).forEach(function (o) { names.building[String(o.empresa) + '/' + String(o.codigo).toUpperCase()] = o.nome; });
      (res[3] || []).forEach(function (p) { names.person[String(p.id)] = p.nome; });
      (res[4] || []).forEach(function (c) { names.composition[String(c.composicao) + '/' + String(c.insumo)] = { composition: c.desc_composicao, supply: c.desc_insumo }; });
    } catch (e) {  }
  }

  var NAME_RESOLVERS = {
    company_prc: function (v) { return names.company[String(v)]; },
    building_prc: function (v, l) { var e = cell(mapByKey('company_prc'), l); return names.building[String(e) + '/' + String(v).toUpperCase()]; },
    person_prc: function (v) { return names.person[String(v)]; },
    kind_prc: function (v) { return names.kind[String(v)]; },
    composition_prc: function (v, l) { var s = cell(mapByKey('supply_prc'), l); var x = names.composition[String(v) + '/' + String(s)]; return x && x.composition; },
    supply_prc: function (v, l) { var c = cell(mapByKey('composition_prc'), l); var x = names.composition[String(c) + '/' + String(v)]; return x && x.supply; },
  };

  function erro(msg) { $('lm-erro-msg').textContent = msg; $('lm-erro').hidden = false; }
  function limpar() {
    linhas = []; $('lm-file').value = '';
    $('lm-preview').hidden = true; $('lm-progresso').hidden = true; $('lm-erro').hidden = true;
    $('lm-result').innerHTML = ''; $('lm-upload').hidden = false;
  }
  function rawCell(m, l) {
    var v = l[lc(m.col)];
    if (v === undefined && m.alias) v = l[lc(m.alias)];
    return v;
  }
  function cell(m, l) { return conv(m, rawCell(m, l)); }
  function preview() {
    $('lm-upload').hidden = true; $('lm-preview').hidden = false;
    $('lm-preview-title').textContent = linhas.length + ' linha(s) lida(s)';
    $('lm-head').innerHTML = '<tr>' + COLS.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr>';
    var max = 50;
    $('lm-body').innerHTML = linhas.slice(0, max).map(function (l) {
      return '<tr>' + MAPA.map(function (m) {
        var v = cell(m, l);
        if (v === null || v === '') return '<td><span style="color:var(--muted)">—</span></td>';

        var extra = '';
        if (NAME_RESOLVERS[m.key]) {
          var resolved = NAME_RESOLVERS[m.key](v, l);
          extra = resolved
            ? '<div style="font-size:11.5px;color:var(--muted)">' + esc(resolved) + '</div>'
            : '<div style="font-size:11.5px;color:var(--danger);font-weight:600">não encontrado</div>';
        }
        return '<td>' + esc(v) + extra + '</td>';
      }).join('') + '</tr>';
    }).join('') + (linhas.length > max ? '<tr><td colspan="' + COLS.length + '" style="text-align:center;color:var(--muted)">… e mais ' + (linhas.length - max) + ' linha(s)</td></tr>' : '');
  }
  function buildItem(l) {
    var process = {};
    MAPA.forEach(function (m) { if (m.key !== '__qtd') process[m.key] = cell(m, l); });

    var total = process.value_prc || 0;
    var qtd = cell(mapByKey('__qtd'), l) || 1;
    var installments = gerarParcelas(total, qtd, process.due_date_prc);
    if (installments.length) process.due_date_prc = installments[0].due_date_ins;
    return { process: process, installments: installments };
  }

  async function processar() {
    if (!linhas.length) return;
    var btn = $('lm-processar'); btn.disabled = true; $('lm-limpar').disabled = true;
    $('lm-progresso').hidden = false;
    var items = linhas.map(buildItem);
    $('lm-prog-label').textContent = 'Enviando ' + items.length + ' processo(s)…';
    $('lm-prog-fill').style.width = '30%';
    try {
      var results = [];
      await window.Store.mutate('processes', async function () {
        results = await window.API.post('/processes/bulk', { items: items });
        return results;
      });
      $('lm-prog-fill').style.width = '100%';
      var ok = 0, fail = 0;
      $('lm-result').innerHTML = results.map(function (r, i) {
        var l = linhas[i] || {}, desc = cell(MAPA[0], l) || ('(linha ' + (i + 1) + ')');
        var parc = (items[i].installments || []).length;
        if (r.ok) { ok++; return '<tr><td>' + (i + 1) + '</td><td>' + esc(desc) + '</td><td><span class="badge ok">✓ criado</span></td><td>' + parc + '</td><td><span style="color:var(--muted)">' + esc(r.uuid_prc || '') + '</span></td></tr>'; }
        fail++; return '<tr><td>' + (i + 1) + '</td><td>' + esc(desc) + '</td><td><span class="badge red">✗ erro</span></td><td>' + parc + '</td><td>' + esc(r.error || '') + '</td></tr>';
      }).join('');
      $('lm-prog-label').textContent = 'Concluído';
      $('lm-prog-cont').textContent = ok + ' ok · ' + fail + ' erro(s)';
    } catch (e) {
      $('lm-prog-label').textContent = 'Falha';
      $('lm-prog-cont').textContent = e.message;
    } finally { btn.disabled = false; $('lm-limpar').disabled = false; }
  }

  $('lm-modelo').addEventListener('click', baixarModelo);
  $('lm-limpar').addEventListener('click', limpar);
  $('lm-processar').addEventListener('click', processar);

  async function importFile(file) {
    if (!file) return;
    $('lm-erro').hidden = true;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) { erro('Formato não suportado: envie um arquivo .xlsx, .xls ou .csv.'); return; }
    try {
      linhas = await lerArquivo(file);
      if (!linhas.length) { erro('O arquivo não tem linhas de dados.'); return; }
      var header = Object.keys(linhas[0]);
      var faltando = MAPA.filter(function (m) {
        return m.req && header.indexOf(lc(m.col)) < 0 && header.indexOf(lc(m.alias)) < 0;
      }).map(function (m) { return m.col; });
      if (faltando.length) { erro('Colunas obrigatórias ausentes: ' + faltando.join(', ') + '. Baixe o modelo e use o cabeçalho correto.'); return; }
      await resolveNames();
      preview();
    } catch (err) { erro('Não foi possível ler o arquivo: ' + err.message); }
  }
  $('lm-file').addEventListener('change', function (e) { importFile(e.target.files[0]); });

  var dropzone = document.querySelector('.dropzone-lote');
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); dropzone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); dropzone.classList.remove('dragover'); });
    });
    dropzone.addEventListener('drop', function (e) {
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      importFile(file);
    });
  }
}
