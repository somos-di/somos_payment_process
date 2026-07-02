// Solicitar em Massa — mesma lógica do lote do solicitar.html, com as MESMAS colunas
// do import_base.xlsx. Lê/gera .xlsx (e .csv) via SheetJS hospedado localmente
// (js/vendor/xlsx.full.min.js, sem CDN em runtime). Envia tudo ao backend (/processes/bulk).
async function initView_solicitar_massa() {
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // colunas EXATAS do import_base.xlsx (esquerda) -> campo do processo (direita).
  // installmentQuantityproc (qtd de parcelas) não é campo do processo (__qtd).
  var MAPA = [
    { col: 'descr', key: 'description_prc' },
    { col: 'companyidproc', key: 'company_prc', req: true },
    { col: 'buildingidproc', key: 'building_prc', req: true },
    { col: 'compositionidproc', key: 'composition_prc' },
    { col: 'supplyidproc', key: 'supply_prc' },
    { col: 'personidproc', key: 'person_prc', tipo: 'int' },
    { col: 'isurgentproc', key: 'is_urgent_prc', tipo: 'bool' },
    { col: 'issuedateproc', key: 'issue_date_prc', tipo: 'data' },
    { col: 'duedateproc', key: 'due_date_prc', tipo: 'data', req: true },
    { col: 'processvalueproc', key: 'value_prc', tipo: 'valor', req: true },
    { col: 'fiscaldocumentproc', key: 'fiscal_doc_prc' },
    { col: 'installmentQuantityproc', key: '__qtd', tipo: 'int' },
    { col: 'processkindproc', key: 'kind_prc', tipo: 'int', req: true },
  ];
  var COLS = MAPA.map(function (m) { return m.col; });               // cabeçalho do modelo (exato)
  var REQ = MAPA.filter(function (m) { return m.req; }).map(function (m) { return m.col.toLowerCase(); });
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

  // carrega o SheetJS local sob demanda (uma vez)
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

  async function baixarModelo() {
    try {
      var XLSX = await loadXLSX();
      var exemplo = ['Teste de lançamento em lote', 'CO146', 'RET28', 'C000013', 'I000168', '7907', '0', '2026-07-01', '2026-08-01', '1000,00', '12345', '1', '1'];
      var ws = XLSX.utils.aoa_to_sheet([COLS, exemplo]);
      ws['!cols'] = COLS.map(function (h) { return { wch: Math.max(14, h.length + 2) }; });
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Processos');
      XLSX.writeFile(wb, 'import_base.xlsx');
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

  function erro(msg) { $('lm-erro-msg').textContent = msg; $('lm-erro').hidden = false; }
  function limpar() {
    linhas = []; $('lm-file').value = '';
    $('lm-preview').hidden = true; $('lm-progresso').hidden = true; $('lm-erro').hidden = true;
    $('lm-result').innerHTML = ''; $('lm-upload').hidden = false;
  }
  function cell(m, l) { return conv(m, l[lc(m.col)]); }
  function preview() {
    $('lm-upload').hidden = true; $('lm-preview').hidden = false;
    $('lm-preview-title').textContent = linhas.length + ' linha(s) lida(s)';
    $('lm-head').innerHTML = '<tr>' + COLS.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr>';
    var max = 50;
    $('lm-body').innerHTML = linhas.slice(0, max).map(function (l) {
      return '<tr>' + MAPA.map(function (m) {
        var v = cell(m, l); return '<td>' + (v === null || v === '' ? '<span style="color:var(--muted)">—</span>' : esc(v)) + '</td>';
      }).join('') + '</tr>';
    }).join('') + (linhas.length > max ? '<tr><td colspan="' + COLS.length + '" style="text-align:center;color:var(--muted)">… e mais ' + (linhas.length - max) + ' linha(s)</td></tr>' : '');
  }
  function buildItem(l) {
    var process = {};
    MAPA.forEach(function (m) { if (m.key !== '__qtd') process[m.key] = cell(m, l); });
    // status_step_prc/approving_status_prc: o RPC ignora colunas de controle; o banco aplica o default.
    var total = process.value_prc || 0;
    var qtd = toInt(l[lc('installmentQuantityproc')]) || 1;
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
  $('lm-file').addEventListener('change', async function (e) {
    var file = e.target.files[0]; if (!file) return;
    $('lm-erro').hidden = true;
    try {
      linhas = await lerArquivo(file);
      if (!linhas.length) { erro('O arquivo não tem linhas de dados.'); return; }
      var header = Object.keys(linhas[0]);
      var faltando = REQ.filter(function (c) { return header.indexOf(c) < 0; });
      if (faltando.length) { erro('Colunas obrigatórias ausentes: ' + faltando.join(', ') + '. Baixe o modelo e use o cabeçalho correto.'); return; }
      preview();
    } catch (err) { erro('Não foi possível ler o arquivo: ' + err.message); }
  });
}
