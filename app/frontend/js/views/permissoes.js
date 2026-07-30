async function initView_permissoes() {
  var selectElement = function (id) { return document.getElementById(id); };
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function toast(message, isSuccess) {
    var t = document.createElement('div'); t.textContent = message;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (isSuccess ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3500);
  }

  var groups = [], empresas = [], kinds = [];
  var companyNames = {}, kindNames = {};
  var buildingsByCompany = {};
  var buildingNames = {};

  try {
    groups = await window.SB.select('groups', function (query) { return query.order('name_grp'); });
    empresas = await window.SB.select('v_empresas', function (query) { return query.order('nome'); });
    kinds = await window.SB.select('process_kinds', function (query) { return query.order('name_pkn'); });
  } catch (error) { window.viewError(selectElement('pm-list'), error); return; }

  empresas.forEach(function (empresa) { companyNames[String(empresa.codigo)] = empresa.nome; });
  kinds.forEach(function (kind) { kindNames[kind.id_pkn] = kind.name_pkn; });

  selectElement('pm-group').innerHTML = '<option value="">Selecione…</option>' +
    groups.map(function (group) { return '<option value="' + group.id_grp + '">' + escapeHtml(group.name_grp) + '</option>'; }).join('');
  selectElement('pm-empresa').innerHTML = '<option value="">Selecione…</option>' +
    empresas.map(function (empresa) { return '<option value="' + escapeHtml(empresa.codigo) + '">' + escapeHtml(empresa.nome) + ' (' + escapeHtml(empresa.codigo) + ')</option>'; }).join('');
  selectElement('pm-tipos').innerHTML = kinds.map(function (kind) {
    return '<label class="pm-check"><input type="checkbox" class="pm-tipo" value="' + kind.id_pkn + '"> ' + escapeHtml(kind.name_pkn) + '</label>';
  }).join('');

  async function buildingsOf(company) {
    if (buildingsByCompany[company]) return buildingsByCompany[company];
    var rows = await window.SB.select('v_obras', function (query) { return query.eq('empresa', company).order('nome'); });
    buildingsByCompany[company] = rows;
    rows.forEach(function (row) { buildingNames[company + '/' + row.codigo] = row.nome; });
    return rows;
  }

  async function renderBuildings() {
    var company = selectElement('pm-empresa').value;
    var box = selectElement('pm-obras');
    if (!company) { box.innerHTML = '<div class="pm-hint">Selecione uma empresa.</div>'; updateCounts(); return; }
    box.innerHTML = '<div class="pm-hint">Carregando…</div>';
    var rows = await buildingsOf(company);
    box.innerHTML = rows.length ? rows.map(function (row) {
      return '<label class="pm-check"><input type="checkbox" class="pm-obra-ck" value="' + escapeHtml(row.codigo) + '"> ' + escapeHtml(row.nome) + ' (' + escapeHtml(row.codigo) + ')</label>';
    }).join('') : '<div class="pm-hint">Nenhuma obra para esta empresa.</div>';
    updateCounts();
  }

  function checked(cssClass) { return Array.prototype.slice.call(document.querySelectorAll('.' + cssClass + ':checked')).map(function (item) { return item.value; }); }
  function setAll(cssClass, on) { document.querySelectorAll('.' + cssClass).forEach(function (item) { item.checked = on; }); updateCounts(); }

  function updateCounts() {
    function format(cssClass) {
      var totalCount = document.querySelectorAll('.' + cssClass).length;
      var checkedCount = document.querySelectorAll('.' + cssClass + ':checked').length;
      return totalCount ? checkedCount + ' de ' + totalCount + ' selecionada(s)' : '';
    }
    selectElement('pm-obras-count').textContent = format('pm-obra-ck');
    selectElement('pm-tipos-count').textContent = format('pm-tipo');
  }
  selectElement('pm-obras').addEventListener('change', updateCounts);
  selectElement('pm-tipos').addEventListener('change', updateCounts);

  selectElement('pm-empresa').addEventListener('change', renderBuildings);
  selectElement('pm-obras-all').addEventListener('click', function () { setAll('pm-obra-ck', true); });
  selectElement('pm-obras-none').addEventListener('click', function () { setAll('pm-obra-ck', false); });
  selectElement('pm-tipos-all').addEventListener('click', function () { setAll('pm-tipo', true); });
  selectElement('pm-tipos-none').addEventListener('click', function () { setAll('pm-tipo', false); });
  selectElement('pm-tipos-nopj').addEventListener('click', function () {
    document.querySelectorAll('.pm-tipo').forEach(function (item) { item.checked = (item.value !== '3'); });
    updateCounts();
  });
  updateCounts();

  var SVG_BUILDING = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4v18"/><path d="M19 21V11l-7-4"/><path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></svg>';
  var SVG_SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
  function emptyState(title, subject) {
    return '<div class="pm-empty">' + SVG_SHIELD + '<b>' + escapeHtml(title) + '</b><span>' + escapeHtml(subject) + '</span></div>';
  }

  async function loadList() {
    var groupId = selectElement('pm-group').value, host = selectElement('pm-list'), count = selectElement('pm-list-count');
    count.textContent = '';
    if (!groupId) { host.innerHTML = emptyState('Nenhum grupo selecionado', 'Escolha um grupo acima para ver as permissões dele.'); return; }
    host.innerHTML = '<div class="empty">Carregando…</div>';
    var rules;
    try { rules = await window.SB.select('process_kind_rules', function (query) { return query.eq('group_pkr', Number(groupId)); }); }
    catch (error) { window.viewError(host, error); return; }
    if (!rules.length) { host.innerHTML = emptyState('Este grupo ainda não tem permissões', 'Use o formulário acima para conceder visibilidade por empresa, obra e tipo.'); return; }

    var companyCodes = {}; rules.forEach(function (rule) { companyCodes[String(rule.company_pkr)] = 1; });
    await Promise.all(Object.keys(companyCodes).map(function (item) { return buildingsOf(item); }));

    var tree = {};
    rules.forEach(function (rule) {
      var c = String(rule.company_pkr), b = String(rule.building_pkr);
      (tree[c] = tree[c] || {});
      (tree[c][b] = tree[c][b] || []).push(rule.kind_pkr);
    });
    count.textContent = rules.length + ' regra(s) em ' + Object.keys(tree).length + ' empresa(s)';
    host.innerHTML = Object.keys(tree).sort().map(function (company) {
      var buildingCount = Object.keys(tree[company]).length;
      var ruleCount = Object.keys(tree[company]).reduce(function (accumulated, building) { return accumulated + tree[company][building].length; }, 0);
      var buildingsHtml = Object.keys(tree[company]).sort().map(function (building) {
        var tags = tree[company][building].sort(function (left, right) { return left - right; }).map(function (kindId) {
          return '<span class="pm-tag">' + escapeHtml(kindNames[kindId] || ('Tipo ' + kindId))
            + '<button title="Remover" data-c="' + escapeHtml(company) + '" data-b="' + escapeHtml(building) + '" data-k="' + kindId + '">&times;</button></span>';
        }).join('');
        return '<div class="pm-obra">'
          + '<div class="pm-obra-id"><div class="pm-obra-name">' + escapeHtml(buildingNames[company + '/' + building] || building) + '</div>'
          + '<div class="pm-obra-code">' + escapeHtml(building) + '</div></div>'
          + '<div class="pm-obra-tags">' + tags + '</div></div>';
      }).join('');
      return '<div class="pm-emp">'
        + '<div class="pm-emp-head"><span class="pm-emp-ic">' + SVG_BUILDING + '</span>'
        + '<div><div class="pm-emp-name">' + escapeHtml(companyNames[company] || company) + '</div>'
        + '<div class="pm-emp-code">Empresa ' + escapeHtml(company) + '</div></div>'
        + '<span class="pm-emp-total badge blue">' + buildingCount + ' obra(s) · ' + ruleCount + ' regra(s)</span></div>'
        + buildingsHtml + '</div>';
    }).join('');
    host.querySelectorAll('.pm-tag button').forEach(function (item) {
      item.addEventListener('click', async function () {
        item.disabled = true;
        try {
          await window.API.post('/admin/permissions/delete', { group: Number(groupId), company: item.getAttribute('data-c'), building: item.getAttribute('data-b'), kind: Number(item.getAttribute('data-k')) });
          toast('Permissão removida.', true); loadList();
        } catch (error) { item.disabled = false; toast('Erro: ' + error.message); }
      });
    });
  }
  selectElement('pm-group').addEventListener('change', loadList);
  loadList();

  selectElement('pm-add').addEventListener('click', async function () {
    var groupId = selectElement('pm-group').value, company = selectElement('pm-empresa').value;
    var buildingsHtml = checked('pm-obra-ck'), tipos = checked('pm-tipo');
    var message = selectElement('pm-msg');
    if (!groupId) return toast('Escolha um grupo.');
    if (!company || !buildingsHtml.length || !tipos.length) return toast('Escolha empresa, ao menos 1 obra e 1 tipo.');
    var combos = [];
    buildingsHtml.forEach(function (buildingCode) { tipos.forEach(function (tipo) { combos.push({ group: Number(groupId), company: company, building: buildingCode, kind: Number(tipo) }); }); });
    selectElement('pm-add').disabled = true; message.textContent = 'Adicionando ' + combos.length + '…'; message.style.color = 'var(--muted)';
    var successCount = 0, errorCount = 0;
    for (var index = 0; index < combos.length; index++) {
      try { await window.API.post('/admin/permissions', combos[index]); successCount++; } catch (error) { errorCount++; }
    }
    selectElement('pm-add').disabled = false;
    message.textContent = successCount + ' adicionada(s)' + (errorCount ? ' · ' + errorCount + ' erro(s)' : ''); message.style.color = errorCount ? '#9f1239' : '#166534';
    loadList();
  });
}
