async function initView_solicitar_massa() {
  var selectElement = function (id) { return document.getElementById(id); };
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  var COLUMN_MAP = [
    { col: 'Descrição', alias: 'descr', key: 'description_prc' },
    { col: 'Empresa (código)', alias: 'companyidproc', key: 'company_prc', req: true },
    { col: 'Obra (código)', alias: 'buildingidproc', key: 'building_prc', req: true },
    { col: 'Composição (código)', alias: 'compositionidproc', key: 'composition_prc' },
    { col: 'Insumo (código)', alias: 'supplyidproc', key: 'supply_prc' },
    { col: 'Fornecedor (código)', alias: 'personidproc', key: 'person_prc', tipo: 'int' },
    { col: 'Urgente', alias: 'isurgentproc', key: 'is_urgent_prc', tipo: 'bool' },
    { col: 'Data de Emissão', alias: 'issuedateproc', key: 'issue_date_prc', tipo: 'date' },
    { col: 'Data de Vencimento', alias: 'duedateproc', key: 'due_date_prc', tipo: 'date', req: true },
    { col: 'Valor Total', alias: 'processvalueproc', key: 'value_prc', tipo: 'money', req: true },
    { col: 'Nº Documento Fiscal', alias: 'fiscaldocumentproc', key: 'fiscal_doc_prc' },
    { col: 'Qtd. Parcelas', alias: 'installmentQuantityproc', key: '__qtd', tipo: 'int' },
    { col: 'Tipo de Processo (ID)', alias: 'processkindproc', key: 'kind_prc', tipo: 'int', req: true },
  ];
  var COLS = COLUMN_MAP.map(function (COLUMN_MAPItem) { return COLUMN_MAPItem.col; });
  var toLowerCaseTrimmed = function (s) { return String(s).trim().toLowerCase(); };
  var pad2 = function (n) { return String(n).padStart(2, '0'); };

  function toYMD(value) {
    if (value == null || value === '') return '';
    if (value instanceof Date && !isNaN(value)) return value.getFullYear() + '-' + pad2(value.getMonth() + 1) + '-' + pad2(value.getDate());
    var s = String(value).trim();
    var isoDateMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (isoDateMatch) return isoDateMatch[1] + '-' + isoDateMatch[2] + '-' + isoDateMatch[3];
    isoDateMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (isoDateMatch) return isoDateMatch[3] + '-' + isoDateMatch[2] + '-' + isoDateMatch[1];
    return s;
  }
  function parseMoney(value) {
    if (value == null || value === '') return NaN;
    if (typeof value === 'number') return value;
    var s = String(value).trim().replace(/[R$\s]/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s); return isNaN(n) ? NaN : n;
  }
  function toBool(value) { var s = toLowerCaseTrimmed(value == null ? '' : value); return s === '1' || s === 'sim' || s === 's' || s === 'true' || s === 'urgente'; }
  function toInt(value) { var n = parseInt(String(value).trim(), 10); return isNaN(n) ? null : n; }
  function convert(columnMap, raw) {
    if (columnMap.tipo === 'date') return toYMD(raw) || null;
    if (columnMap.tipo === 'money') { var n = parseMoney(raw); return isNaN(n) ? null : n; }
    if (columnMap.tipo === 'bool') return toBool(raw);
    if (columnMap.tipo === 'int') return raw === '' || raw == null ? null : toInt(raw);
    var s = raw == null ? '' : String(raw).trim(); return s === '' ? null : s;
  }
  function buildMonthlyInstallments(total, count, firstYMD) {
    var output = [];
    if (!total || total <= 0 || !count || count < 1 || !firstYMD) return output;
    var base = Math.floor((total / count) * 100) / 100, accumulator = 0, first = new Date(firstYMD + 'T12:00:00Z');
    for (var index = 0; index < count; index++) {
      var value = (index === count - 1) ? (total - accumulator).toFixed(2) : base.toFixed(2); accumulator += parseFloat(value);
      var d = new Date(first); d.setUTCMonth(d.getUTCMonth() + index);
      output.push({ due_date_ins: d.toISOString().split('T')[0], value_ins: Number(value) });
    }
    return output;
  }

  function loadXLSX() {
    return new Promise(function (response, reject) {
      if (window.XLSX) return response(window.XLSX);
      var s = document.createElement('script');
      s.src = 'js/vendor/xlsx.full.min.js';
      s.onload = function () { response(window.XLSX); };
      s.onerror = function () { reject(new Error('Falha ao carregar a biblioteca de planilha')); };
      document.head.appendChild(s);
    });
  }

  var importedRows = [];
  var importedFile = null;

  async function buildInstructionsSheet(XLSX) {
    var kinds = [];
    try { kinds = await window.Store.get('process_kinds'); } catch (error) { }
    var rows = [
      ['COMO PREENCHER - LANÇAMENTO EM MASSA'],
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
      ['Tipo de Processo (ID)', 'SIM', 'ID do tipo de processo - consulte a tabela abaixo.'],
      [],
      ['TIPOS DE PROCESSO - use o ID na coluna "Tipo de Processo (ID)"'],
      ['ID', 'Tipo'],
    ].concat((kinds || []).map(function (item) { return [item.id_pkn, item.name_pkn]; }));
    var worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = [{ wch: 26 }, { wch: 12 }, { wch: 95 }];
    return worksheet;
  }

  async function downloadTemplate() {
    try {
      var XLSX = await loadXLSX();
      var sampleRow = ['Teste de lançamento em lote', '36', 'RERV3', 'C000013', 'I000168', '7907', '0', '2026-07-01', '2026-08-01', '1000,00', '12345', '1', '4'];
      var worksheet = XLSX.utils.aoa_to_sheet([COLS, sampleRow]);
      worksheet['!cols'] = COLS.map(function (COLSItem) { return { wch: Math.max(14, COLSItem.length + 2) }; });
      var workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Processos');
      XLSX.utils.book_append_sheet(workbook, await buildInstructionsSheet(XLSX), 'Instruções');
      XLSX.writeFile(workbook, 'modelo_lancamento_massa.xlsx');
    } catch (error) { showError(error.message); }
  }

  async function readSpreadsheet(file) {
    var XLSX = await loadXLSX();
    var buffer = await file.arrayBuffer();
    var workbook = XLSX.read(buffer, { cellDates: true });
    var worksheet = workbook.Sheets[workbook.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    return rows.map(function (row) {
      var norm = {}; Object.keys(row).forEach(function (item) { norm[toLowerCaseTrimmed(item)] = row[item]; }); return norm;
    }).filter(function (item) { return Object.keys(item).some(function (item) { return String(item[item]).trim() !== ''; }); });
  }

  function mapByKey(key) { for (var index = 0; index < COLUMN_MAP.length; index++) if (COLUMN_MAP[index].key === key) return COLUMN_MAP[index]; return null; }

  var names = { company: {}, building: {}, person: {}, kind: {}, composition: {} };
  async function resolveNames() {
    names = { company: {}, building: {}, person: {}, kind: {}, composition: {} };
    var companyMap = mapByKey('company_prc'), personMap = mapByKey('person_prc'), compositionMap = mapByKey('composition_prc');
    var companyIds = {}, personIds = {}, compositionIds = {};
    importedRows.forEach(function (importedRow) {
      var companyCode = cell(companyMap, importedRow); if (companyCode) companyIds[String(companyCode)] = 1;
      var personId = cell(personMap, importedRow); if (personId != null) personIds[String(personId)] = 1;
      var compositionId = cell(compositionMap, importedRow); if (compositionId) compositionIds[String(compositionId)] = 1;
    });
    try {
      var response = await Promise.all([
        window.Store.get('empresas'),
        window.Store.get('process_kinds'),
        Object.keys(companyIds).length ? window.SB.select('v_obras', function (query) { return query.in('empresa', Object.keys(companyIds)); }) : [],
        Object.keys(personIds).length ? window.SB.select('v_fornecedores', function (query) { return query.in('id', Object.keys(personIds).map(Number)); }) : [],
        Object.keys(compositionIds).length ? window.SB.select('v_compositions', function (query) { return query.in('composicao', Object.keys(compositionIds)); }) : [],
      ]);
      (response[0] || []).forEach(function (item) { names.company[String(item.codigo)] = item.nome; });
      (response[1] || []).forEach(function (item) { names.kind[String(item.id_pkn)] = item.name_pkn; });
      (response[2] || []).forEach(function (item) { names.building[String(item.empresa) + '/' + String(item.codigo).toUpperCase()] = item.nome; });
      (response[3] || []).forEach(function (item) { names.person[String(item.id)] = item.nome; });
      (response[4] || []).forEach(function (item) { names.composition[String(item.composicao) + '/' + String(item.insumo)] = { composition: item.desc_composicao, supply: item.desc_insumo }; });
    } catch (error) { }
  }

  var NAME_RESOLVERS = {
    company_prc: function (value) { return names.company[String(value)]; },
    building_prc: function (value, row) { var companyCode = cell(mapByKey('company_prc'), row); return names.building[String(companyCode) + '/' + String(value).toUpperCase()]; },
    person_prc: function (value) { return names.person[String(value)]; },
    kind_prc: function (value) { return names.kind[String(value)]; },
    composition_prc: function (value, l) { var s = cell(mapByKey('supply_prc'), l); var x = names.composition[String(value) + '/' + String(s)]; return x && x.composition; },
    supply_prc: function (value, l) { var c = cell(mapByKey('composition_prc'), l); var x = names.composition[String(c) + '/' + String(value)]; return x && x.supply; },
  };

  function showError(message) { selectElement('lm-erro-msg').textContent = message; selectElement('lm-erro').hidden = false; }
  function resetView() {
    importedRows = []; importedFile = null; selectElement('lm-file').value = '';
    selectElement('lm-preview').hidden = true; selectElement('lm-progresso').hidden = true; selectElement('lm-erro').hidden = true;
    selectElement('lm-result').innerHTML = ''; selectElement('lm-upload').hidden = false;
  }
  function rawCell(columnMap, l) {
    var value = l[toLowerCaseTrimmed(columnMap.col)];
    if (value === undefined && columnMap.alias) value = l[toLowerCaseTrimmed(columnMap.alias)];
    return value;
  }
  function cell(m, l) { return convert(m, rawCell(m, l)); }
  function preview() {
    selectElement('lm-upload').hidden = true; selectElement('lm-preview').hidden = false;
    selectElement('lm-preview-title').textContent = importedRows.length + ' linha(s) lida(s)';
    selectElement('lm-head').innerHTML = '<tr>' + COLS.map(function (COLSItem) { return '<th>' + escapeHtml(COLSItem) + '</th>'; }).join('') + '</tr>';
    var maxErrorsShown = 50;
    selectElement('lm-body').innerHTML = importedRows.slice(0, maxErrorsShown).map(function (item) {
      return '<tr>' + COLUMN_MAP.map(function (COLUMN_MAPItem) {
        var value = cell(COLUMN_MAPItem, item);
        if (value === null || value === '') return '<td><span style="color:var(--muted)">-</span></td>';

        var extra = '';
        if (NAME_RESOLVERS[COLUMN_MAPItem.key]) {
          var resolved = NAME_RESOLVERS[COLUMN_MAPItem.key](value, item);
          extra = resolved
            ? '<div style="font-size:11.5px;color:var(--muted)">' + escapeHtml(resolved) + '</div>'
            : '<div style="font-size:11.5px;color:var(--danger);font-weight:600">não encontrado</div>';
        }
        return '<td>' + escapeHtml(value) + extra + '</td>';
      }).join('') + '</tr>';
    }).join('') + (importedRows.length > maxErrorsShown ? '<tr><td colspan="' + COLS.length + '" style="text-align:center;color:var(--muted)">… e mais ' + (importedRows.length - maxErrorsShown) + ' linha(s)</td></tr>' : '');
  }
  function buildItem(l) {
    var process = {};
    COLUMN_MAP.forEach(function (COLUMN_MAPItem) { if (COLUMN_MAPItem.key !== '__qtd') process[COLUMN_MAPItem.key] = cell(COLUMN_MAPItem, l); });

    var total = process.value_prc || 0;
    var count = cell(mapByKey('__qtd'), l) || 1;
    var installments = buildMonthlyInstallments(total, count, process.due_date_prc);
    if (installments.length) process.due_date_prc = installments[0].due_date_ins;
    return { process: process, installments: installments };
  }

  async function submitAll() {
    if (!importedRows.length) return;
    var button = selectElement('lm-processar'); button.disabled = true; selectElement('lm-limpar').disabled = true;
    selectElement('lm-progresso').hidden = false;
    var items = importedRows.map(buildItem);
    selectElement('lm-prog-label').textContent = 'Enviando ' + items.length + ' processo(s)…';
    selectElement('lm-prog-fill').style.width = '30%';

    var savedUrl = null;
    if (importedFile) {
      try { var uploadResult = await window.SB.upload(importedFile, '/storage/bulk-import'); savedUrl = uploadResult && uploadResult.url; }
      catch (error) { savedUrl = null; }
    }

    try {
      var results = [];
      await window.Store.mutate('processes', async function () {
        results = await window.API.post('/processes/bulk', { items: items });
        return results;
      });
      selectElement('lm-prog-fill').style.width = '100%';
      var successCount = 0, failureCount = 0;
      selectElement('lm-result').innerHTML = results.map(function (result, index) {
        var l = importedRows[index] || {}, desc = cell(COLUMN_MAP[0], l) || ('(linha ' + (index + 1) + ')');
        var parc = (items[index].installments || []).length;
        if (result.ok) { successCount++; return '<tr><td>' + (index + 1) + '</td><td>' + escapeHtml(desc) + '</td><td><span class="badge ok">✓ criado</span></td><td>' + parc + '</td><td><span style="color:var(--muted)">' + escapeHtml(result.uuid_prc || '') + '</span></td></tr>'; }
        failureCount++; return '<tr><td>' + (index + 1) + '</td><td>' + escapeHtml(desc) + '</td><td><span class="badge red">✗ erro</span></td><td>' + parc + '</td><td>' + escapeHtml(result.error || '') + '</td></tr>';
      }).join('');
      selectElement('lm-prog-label').textContent = 'Concluído';
      selectElement('lm-prog-cont').innerHTML = escapeHtml(successCount + ' ok · ' + failureCount + ' erro(s)')
        + (savedUrl ? ' · <a href="' + escapeHtml(savedUrl) + '" target="_blank" rel="noopener">planilha salva</a>'
          : ' · <span style="color:var(--muted)">planilha não salva</span>');
    } catch (error) {
      selectElement('lm-prog-label').textContent = 'Falha';
      selectElement('lm-prog-cont').textContent = error.message;
    } finally { button.disabled = false; selectElement('lm-limpar').disabled = false; }
  }

  selectElement('lm-modelo').addEventListener('click', downloadTemplate);
  selectElement('lm-limpar').addEventListener('click', resetView);
  selectElement('lm-processar').addEventListener('click', submitAll);

  async function importFile(file) {
    if (!file) return;
    selectElement('lm-erro').hidden = true;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) { showError('Formato não suportado: envie um arquivo .xlsx, .xls ou .csv.'); return; }
    try {
      importedRows = await readSpreadsheet(file);
      importedFile = file;
      if (!importedRows.length) { showError('O arquivo não tem linhas de dados.'); return; }
      var header = Object.keys(importedRows[0]);
      var faltando = COLUMN_MAP.filter(function (COLUMN_MAPItem) {
        return COLUMN_MAPItem.req && header.indexOf(toLowerCaseTrimmed(COLUMN_MAPItem.col)) < 0 && header.indexOf(toLowerCaseTrimmed(COLUMN_MAPItem.alias)) < 0;
      }).map(function (item) { return item.col; });
      if (faltando.length) { showError('Colunas obrigatórias ausentes: ' + faltando.join(', ') + '. Baixe o modelo e use o cabeçalho correto.'); return; }
      await resolveNames();
      preview();
    } catch (error) { showError('Não foi possível ler o arquivo: ' + error.message); }
  }
  selectElement('lm-file').addEventListener('change', function (event) { importFile(event.target.files[0]); });

  var dropzone = document.querySelector('.dropzone-lote');
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(function (item) {
      dropzone.addEventListener(item, function (event) { event.preventDefault(); event.stopPropagation(); dropzone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(function (item) {
      dropzone.addEventListener(item, function (event) { event.preventDefault(); event.stopPropagation(); dropzone.classList.remove('dragover'); });
    });
    dropzone.addEventListener('drop', function (event) {
      var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      importFile(file);
    });
  }
}
